/// <reference types="bun" />
import * as tf from '@tensorflow/tfjs-node-gpu';
import { join } from "node:path";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";

// ──────────────────────────────────────────────
// CONFIGURATION
// ──────────────────────────────────────────────
const CELEBA_DIR = "./data_bank/img_align_celeba/img_align_celeba";
const IDENTITY_FILE = "./data_bank/identity_CelebA.txt";
const ATTRIBUTES_FILE = "./data_bank/list_attr_celeba.csv";
const API_BASE_URL = "http://localhost:3000/api";
const REGISTER_URL = `${API_BASE_URL}/register`;
const AUTH_URL = `${API_BASE_URL}/authenticate`;
const CONCURRENCY_LIMIT = 20;
const MAX_IDENTITIES = 500;   // Number of identities to register (set to Infinity for all)
const MAX_TEST_IMAGES = 1000; // Max authentication test images (set to Infinity for all)
const RESULTS_FILE = "./etl_results.json";

// ──────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────
interface AuthResult {
  fileName: string;
  identity: string;
  testType: "tp" | "tn";
  expected: boolean;
  actual: boolean | null; // null = error/no face
  attributes: Record<string, number>;
}

// ──────────────────────────────────────────────
// PHASE 0: DATA LOADING
// ──────────────────────────────────────────────
function loadIdentityMap(): Map<string, string> {
  console.log("  Loading identity_CelebA.txt...");
  const map = new Map<string, string>();
  const data = readFileSync(IDENTITY_FILE, "utf-8");
  for (const line of data.split("\n")) {
    if (!line.trim()) continue;
    const parts = line.trim().split(/\s+/);
    if (parts[0] && parts[1]) map.set(parts[0], parts[1]);
  }
  console.log(`    → ${map.size} image-identity mappings loaded`);
  return map;
}

function loadAttributes(): { headers: string[]; map: Map<string, Record<string, number>> } {
  console.log("  Loading list_attr_celeba.csv...");
  const map = new Map<string, Record<string, number>>();
  const data = readFileSync(ATTRIBUTES_FILE, "utf-8");
  const lines = data.split("\n");
  const headerLine = lines[0]!.trim();
  const headers = headerLine.split(",").slice(1); // skip image_id column
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) continue;
    const parts = line.split(",");
    const fileName = parts[0]!;
    const attrs: Record<string, number> = {};
    for (let j = 0; j < headers.length; j++) {
      attrs[headers[j]!] = parseInt(parts[j + 1]!, 10); // -1 or 1
    }
    map.set(fileName, attrs);
  }
  console.log(`    → ${map.size} attribute records loaded (${headers.length} attributes)`);
  return { headers, map };
}

// ──────────────────────────────────────────────
// API HELPERS
// ──────────────────────────────────────────────
async function registerIdentity(fileName: string, identity: string): Promise<boolean> {
  const filePath = join(CELEBA_DIR, fileName);
  try {
    const fileBlob = Bun.file(filePath);
    const formData = new FormData();
    formData.append("photo", fileBlob as unknown as Blob, fileName);
    formData.append("name", `Celeb ${identity}`);
    formData.append("email", `celeb_${identity}@example.com`);

    const response = await fetch(REGISTER_URL, { method: "POST", body: formData });
    const data = (await response.json()) as any;

    if (response.status === 201) return true;
    if (response.status === 400 && data.message?.includes("already exists")) return true;
    return false;
  } catch {
    return false;
  }
}

async function authenticateImage(fileName: string, email: string): Promise<boolean | null> {
  const filePath = join(CELEBA_DIR, fileName);
  try {
    const fileBlob = Bun.file(filePath);
    const formData = new FormData();
    formData.append("photo", fileBlob as unknown as Blob, fileName);
    formData.append("email", email);

    const response = await fetch(AUTH_URL, { method: "POST", body: formData });
    const data = (await response.json()) as any;

    if (response.status === 200 && data.success) return true;
    if (response.status === 401 && !data.success) return false;
    return null;
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────
// CONCURRENCY HELPER
// ──────────────────────────────────────────────
async function runConcurrent<T>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<void>,
  progressLabel?: string,
): Promise<void> {
  let idx = 0;
  const total = items.length;
  const startTime = Date.now();

  const workers = Array(Math.min(concurrency, total))
    .fill(0)
    .map(async () => {
      while (idx < total) {
        const i = idx++;
        await fn(items[i]!, i);
        if (progressLabel && i > 0 && i % 50 === 0) {
          const elapsed = (Date.now() - startTime) / 1000;
          const rate = i / elapsed;
          const remaining = ((total - i) / rate).toFixed(0);
          console.log(`  ${progressLabel}: ${i}/${total} (${remaining}s remaining)`);
        }
      }
    });
  await Promise.all(workers);
}

// ──────────────────────────────────────────────
// METRICS COMPUTATION
// ──────────────────────────────────────────────
function computeMetrics(results: AuthResult[]) {
  let tp = 0, fp = 0, tn = 0, fn = 0, errors = 0;

  for (const r of results) {
    if (r.actual === null) { errors++; continue; }
    if (r.testType === "tp") {
      if (r.actual) tp++; else fn++;
    } else {
      if (r.actual) fp++; else tn++;
    }
  }

  const total = tp + fp + tn + fn;
  const accuracy = total > 0 ? (tp + tn) / total : 0;
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const far = fp + tn > 0 ? fp / (fp + tn) : 0;
  const frr = tp + fn > 0 ? fn / (tp + fn) : 0;

  return { tp, fp, tn, fn, errors, total, accuracy, precision, recall, f1, far, frr };
}

function computeAttributeBreakdown(results: AuthResult[], attrHeaders: string[]) {
  const breakdown: Record<string, { present: ReturnType<typeof computeMetrics>; absent: ReturnType<typeof computeMetrics> }> = {};

  for (const attr of attrHeaders) {
    const present = results.filter((r) => r.attributes[attr] === 1);
    const absent = results.filter((r) => r.attributes[attr] === -1);
    breakdown[attr] = {
      present: computeMetrics(present),
      absent: computeMetrics(absent),
    };
  }
  return breakdown;
}

// ──────────────────────────────────────────────
// MAIN ETL
// ──────────────────────────────────────────────
async function runEtl() {
  console.log("\n╔═══════════════════════════════════════════════════╗");
  console.log("║      CelebA Face Authentication ETL Pipeline     ║");
  console.log("╚═══════════════════════════════════════════════════╝\n");

  console.log('GPU Available:', tf.getBackend() === 'webgl');
  // ── Phase 0: Load data ──
  console.log("Phase 0: Loading dataset metadata...");
  const identityMap = loadIdentityMap();
  const { headers: attrHeaders, map: attrMap } = loadAttributes();

  const availableImages = new Set(readdirSync(CELEBA_DIR).filter((f) => f.endsWith(".jpg")));
  console.log(`    → ${availableImages.size} images available on disk\n`);

  // Group images by identity
  const imagesByIdentity = new Map<string, string[]>();
  for (const [fileName, identity] of identityMap) {
    if (!availableImages.has(fileName)) continue;
    if (!imagesByIdentity.has(identity)) imagesByIdentity.set(identity, []);
    imagesByIdentity.get(identity)!.push(fileName);
  }

  // Filter to identities with 2+ images (need at least 1 for register, 1 for test)
  const qualifyingIdentities: Array<{ identity: string; enrollImages: string[]; testImages: string[] }> = [];

  for (const [identity, fileNames] of imagesByIdentity) {
    if (fileNames.length < 2) continue;
    // First image for enrollment, rest for testing
    qualifyingIdentities.push({
      identity,
      enrollImages: fileNames.slice(0, Math.max(1, Math.floor(fileNames.length * 0.2))), // up to 20% for enrollment fallback
      testImages: fileNames.slice(Math.max(1, Math.floor(fileNames.length * 0.2))),
    });
  }

  // Sort by identity number for determinism, then cap
  qualifyingIdentities.sort((a, b) => parseInt(a.identity) - parseInt(b.identity));
  const selectedIdentities = qualifyingIdentities.slice(0, MAX_IDENTITIES);

  console.log(`  Total identities:     ${imagesByIdentity.size}`);
  console.log(`  With 2+ images:       ${qualifyingIdentities.length}`);
  console.log(`  Selected for testing: ${selectedIdentities.length}\n`);

  // ── Phase 1: Registration ──
  console.log("Phase 1: Registering identities...");
  const successfullyRegistered = new Set<string>();
  let regFailures = 0;

  await runConcurrent(
    selectedIdentities,
    CONCURRENCY_LIMIT,
    async ({ identity, enrollImages }) => {
      let registered = false;
      for (const fileName of enrollImages) {
        if (await registerIdentity(fileName, identity)) {
          registered = true;
          break;
        }
      }
      if (registered) {
        successfullyRegistered.add(identity);
      } else {
        regFailures++;
      }
    },
    "Registering",
  );

  console.log(`  ✓ Successfully registered: ${successfullyRegistered.size}`);
  console.log(`  ✗ Failed to register:      ${regFailures}\n`);

  // ── Phase 2: Authentication Testing ──
  console.log("Phase 2: Running authentication tests...");

  // Build test item list
  const testItems: { fileName: string; identity: string }[] = [];
  for (const { identity, testImages } of selectedIdentities) {
    if (!successfullyRegistered.has(identity)) continue;
    for (const fileName of testImages) {
      testItems.push({ fileName, identity });
    }
  }

  // Apply cap
  const cappedTestItems = testItems.slice(0, MAX_TEST_IMAGES);
  const registeredArray = Array.from(successfullyRegistered);

  console.log(`  Total test images available: ${testItems.length}`);
  console.log(`  Testing images (capped):     ${cappedTestItems.length}`);
  console.log(`  Total Auth Tests to run:     ${cappedTestItems.length * 2} (1 TP + 1 TN per image)\n`);

  const authResults: AuthResult[] = [];

  await runConcurrent(
    cappedTestItems,
    CONCURRENCY_LIMIT,
    async ({ fileName, identity }) => {
      const attrs = attrMap.get(fileName) ?? {};

      // True Positive test: authenticate with correct identity email
      const tpResult = await authenticateImage(fileName, `celeb_${identity}@example.com`);
      authResults.push({
        fileName, identity, testType: "tp",
        expected: true, actual: tpResult, attributes: attrs,
      });

      // True Negative test: authenticate with a random different identity email
      const otherIdentities = registeredArray.filter((id) => id !== identity);
      if (otherIdentities.length > 0) {
        const randomId = otherIdentities[Math.floor(Math.random() * otherIdentities.length)]!;
        const tnResult = await authenticateImage(fileName, `celeb_${randomId}@example.com`);
        authResults.push({
          fileName, identity, testType: "tn",
          expected: false, actual: tnResult, attributes: attrs,
        });
      }
    },
    "Authenticating",
  );

  // ── Phase 3: Metrics ──
  console.log("\nPhase 3: Computing metrics...\n");

  const overall = computeMetrics(authResults);
  const attrBreakdown = computeAttributeBreakdown(authResults, attrHeaders);

  // ── Print Results ──
  console.log("╔═══════════════════════════════════════════════════╗");
  console.log("║                 OVERALL RESULTS                  ║");
  console.log("╠═══════════════════════════════════════════════════╣");
  console.log(`║  True Positives  : ${String(overall.tp).padStart(6)}                      ║`);
  console.log(`║  False Positives : ${String(overall.fp).padStart(6)}                      ║`);
  console.log(`║  True Negatives  : ${String(overall.tn).padStart(6)}                      ║`);
  console.log(`║  False Negatives : ${String(overall.fn).padStart(6)}                      ║`);
  console.log(`║  Errors (no face): ${String(overall.errors).padStart(6)}                      ║`);
  console.log("╠═══════════════════════════════════════════════════╣");
  console.log(`║  Accuracy        : ${(overall.accuracy * 100).toFixed(2).padStart(7)}%                    ║`);
  console.log(`║  Precision       : ${(overall.precision * 100).toFixed(2).padStart(7)}%                    ║`);
  console.log(`║  Recall          : ${(overall.recall * 100).toFixed(2).padStart(7)}%                    ║`);
  console.log(`║  F1 Score        : ${(overall.f1 * 100).toFixed(2).padStart(7)}%                    ║`);
  console.log(`║  FAR             : ${(overall.far * 100).toFixed(2).padStart(7)}%                    ║`);
  console.log(`║  FRR             : ${(overall.frr * 100).toFixed(2).padStart(7)}%                    ║`);
  console.log("╚═══════════════════════════════════════════════════╝\n");

  // Per-attribute breakdown sorted by accuracy difference
  console.log("── Per-Attribute Accuracy (Present vs Absent) ──\n");
  console.log("  Attribute                   | Present Acc | Absent Acc | Δ");
  console.log("  ────────────────────────────┼─────────────┼────────────┼──────");

  const attrEntries = Object.entries(attrBreakdown)
    .map(([attr, data]) => ({
      attr,
      presentAcc: data.present.accuracy,
      absentAcc: data.absent.accuracy,
      delta: Math.abs(data.present.accuracy - data.absent.accuracy),
    }))
    .sort((a, b) => b.delta - a.delta);

  for (const { attr, presentAcc, absentAcc, delta } of attrEntries) {
    const name = attr.padEnd(28);
    const pAcc = (presentAcc * 100).toFixed(1).padStart(6) + "%";
    const aAcc = (absentAcc * 100).toFixed(1).padStart(6) + "%";
    const d = (delta > 0.01 ? (delta * 100).toFixed(1) : "~0") + "%";
    console.log(`  ${name}| ${pAcc.padStart(11)} | ${aAcc.padStart(10)} | ${d}`);
  }

  // ── Save Results ──
  const resultsPayload = {
    timestamp: new Date().toISOString(),
    config: {
      maxIdentities: MAX_IDENTITIES,
      maxTestImages: MAX_TEST_IMAGES,
      concurrency: CONCURRENCY_LIMIT,
    },
    registration: {
      attempted: selectedIdentities.length,
      succeeded: successfullyRegistered.size,
      failed: regFailures,
    },
    authentication: {
      totalTestImages: testItems.length,
      testedImages: cappedTestItems.length,
      totalAuthCalls: authResults.length,
    },
    overall,
    attributeBreakdown: attrBreakdown,
  };

  const dashboardData = {
    metrics: overall,
    tp: authResults.filter(r => r.testType === "tp" && r.actual === true),
    tn: authResults.filter(r => r.testType === "tn" && r.actual === false),
    fp: authResults.filter(r => r.testType === "tn" && r.actual === true),
    fn: authResults.filter(r => r.testType === "tp" && r.actual === false),
    errors: authResults.filter(r => r.actual === null)
  };
  writeFileSync("./public/dashboard_data.json", JSON.stringify(dashboardData, null, 2));
  console.log(`✓ Dashboard data saved to ./public/dashboard_data.json`);

  writeFileSync(RESULTS_FILE, JSON.stringify(resultsPayload, null, 2));
  console.log(`\n✓ Detailed results saved to ${RESULTS_FILE}`);
}

runEtl().catch(console.error);
