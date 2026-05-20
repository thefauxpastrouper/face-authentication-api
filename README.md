# Face Recognition System - Backend API

This repository contains the backend implementation for a Face Registration and Authentication system, built for the AI/ML Intern Assignment.

![Architecture Diagram](./assignment.png)
## 🚀 Setup Instructions

### Prerequisites
- [Bun](https://bun.sh/)
- Docker and Docker Compose
- PostgreSQL (via Docker)

### 1. Install Dependencies
Clone the repository and install the required packages:
```bash
bun install
```

### 2. Environment Variables
Create a `.env` file in the root directory (or use the existing one) and ensure the `DATABASE_URL` is configured to point to your local PostgreSQL instance:
```env
DATABASE_URL="postgresql://root:password@localhost:5433/face_recognition?schema=public"
```

### 3. Start the Database
Run Docker Compose to start the PostgreSQL instance with the `pgvector` extension:
```bash
docker compose up -d
```

### 4. Setup Database Schema
Push the Prisma schema to the database to create the necessary tables and extensions:
```bash
bunx prisma db push
bunx prisma generate
```

### 5. Run the Server
Start the backend server:
```bash
bun run dev
```
The server will start on `http://localhost:3000`.

---

## 🛠️ API Endpoints Documentation

### 1. Register a User
Registers a new user and extracts their facial features to a stored vector representation.

- **Endpoint:** `POST /register`
- **Content-Type:** `multipart/form-data`
- **Body Parameters:**
  - `name` (String): The full name of the user.
  - `email` (String): A unique email address.
  - `file` (File): A clear photo of the user's face (JPEG/PNG).

**Success Response (201 Created):**
```json
{
  "success": true,
  "message": "User registered successfully",
  "user": {
    "id": "uuid",
    "name": "User A",
    "email": "user@example.com"
  }
}
```

### 2. Authenticate a User
Verifies the identity of a user by comparing an uploaded photo's facial features against registered users.

- **Endpoint:** `POST /authenticate`
- **Content-Type:** `multipart/form-data`
- **Body Parameters:**
  - `file` (File): A new photo of the user's face (varying lighting, glasses, etc.).

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Identity verified",
  "user": {
    "id": "uuid",
    "name": "User A",
    "email": "user@example.com"
  },
  "distance": 0.45
}
```

**Failure Response (401 Unauthorized):**
```json
{
  "success": false,
  "message": "Face does not match any user",
  "distance": 0.85
}
```

---

## 💾 Storage Technology

**Chosen Technology:** PostgreSQL + Prisma + `pgvector`

**Why this fits:**
- **Persistence & Reliability:** PostgreSQL is a robust, production-ready relational database that easily survives server restarts and ensures data integrity.
- **Efficient Native Vector Storage:** Instead of loading all user embeddings into Node.js memory for comparison, the `pgvector` extension allows us to natively store the 128-dimensional floating-point arrays produced by the ML model as vector data types.
- **High-Performance Lookups:** The combination of standard indexed string lookups (for emails) and native vector similarity search makes the database lightning fast. 

---

## 🔍 Comparison Method & Threshold

**Machine Learning Library:** `@vladmandic/face-api` (an actively maintained fork of `face-api.js` operating locally via TensorFlow.js).

**Comparison Method:** 
The extraction generates a 128-dimensional feature vector. During authentication, the system calculates the **Euclidean Distance** between the newly uploaded image vector and the stored database vectors.

Rather than calculating this in JavaScript, the Euclidean distance is computed directly inside the PostgreSQL database using the `pgvector` Euclidean distance operator (`<->`):
```sql
SELECT id, name, email, "faceDescriptor" <-> ${descriptorStr}::vector as distance ...
```

**Threshold Used:** `< 0.6`
A threshold of `0.6` is the standard recommended Euclidean distance limit for the SSD MobileNet V1 model in `face-api`.
- If `distance < 0.6`: The system determines the faces match and the identity is verified.
- If `distance >= 0.6`: The system determines the faces do not match and rejects the authentication attempt.

**ETL Pipeline**
<img width="1304" height="2234" alt="etl_pipeline_diagram" src="https://github.com/user-attachments/assets/2f42ddc2-3c77-4e85-8a2c-40f58b0e1b12" />
<svg xmlns="http://www.w3.org/2000/svg" width="1304.00" height="2233.62" viewBox="0 0 1304.00 2233.62">
<defs>
    <marker id="arr-a0a0a0" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#a0a0a0"/></marker>
  </defs>
<rect width="1304.00" height="2233.62" fill="#1e1e1e"/>
<ellipse cx="629.12" cy="67.50" rx="415.00" ry="27.50" fill="#2d2d2d" stroke="#a0a0a0" stroke-width="2" opacity="1.00"/>
<rect x="195.25" y="181.93" width="238.00" height="55.00" rx="8" fill="#2d2d2d" stroke="#a0a0a0" stroke-width="2" opacity="1.00"/>
<rect x="553.25" y="181.93" width="175.00" height="55.00" rx="8" fill="#2d2d2d" stroke="#a0a0a0" stroke-width="2" opacity="1.00"/>
<rect x="848.25" y="181.93" width="229.00" height="55.00" rx="8" fill="#2d2d2d" stroke="#a0a0a0" stroke-width="2" opacity="1.00"/>
<rect x="504.50" y="321.86" width="256.00" height="55.00" rx="8" fill="#2d2d2d" stroke="#a0a0a0" stroke-width="2" opacity="1.00"/>
<rect x="450.50" y="457.86" width="364.00" height="55.00" rx="8" fill="#2d2d2d" stroke="#a0a0a0" stroke-width="2" opacity="1.00"/>
<rect x="518.00" y="591.86" width="229.00" height="55.00" rx="8" fill="#2d2d2d" stroke="#a0a0a0" stroke-width="2" opacity="1.00"/>
<rect x="281.25" y="736.21" width="328.00" height="55.00" rx="8" fill="#2d2d2d" stroke="#a0a0a0" stroke-width="2" opacity="1.00"/>
<rect x="294.75" y="870.21" width="301.00" height="55.00" rx="8" fill="#2d2d2d" stroke="#a0a0a0" stroke-width="2" opacity="1.00"/>
<polygon points="445.25,1006.21 515.25,1033.71 445.25,1061.21 375.25,1033.71" fill="#2d2d2d" stroke="#a0a0a0" stroke-width="2" opacity="1.00"/>
<rect x="466.25" y="1140.21" width="283.00" height="55.00" rx="8" fill="#2d2d2d" stroke="#a0a0a0" stroke-width="2" opacity="1.00"/>
<rect x="159.25" y="1140.21" width="247.00" height="55.00" rx="8" fill="#2d2d2d" stroke="#a0a0a0" stroke-width="2" opacity="1.00"/>
<rect x="809.25" y="736.21" width="301.00" height="55.00" rx="8" fill="#2d2d2d" stroke="#a0a0a0" stroke-width="2" opacity="1.00"/>
<rect x="635.50" y="1276.21" width="319.00" height="55.00" rx="8" fill="#2d2d2d" stroke="#a0a0a0" stroke-width="2" opacity="1.00"/>
<rect x="676.00" y="1410.21" width="238.00" height="55.00" rx="8" fill="#2d2d2d" stroke="#a0a0a0" stroke-width="2" opacity="1.00"/>
<rect x="301.50" y="1560.04" width="292.00" height="55.00" rx="8" fill="#2d2d2d" stroke="#a0a0a0" stroke-width="2" opacity="1.00"/>
<rect x="838.50" y="1560.04" width="283.00" height="55.00" rx="8" fill="#2d2d2d" stroke="#a0a0a0" stroke-width="2" opacity="1.00"/>
<rect x="464.00" y="1707.86" width="337.00" height="55.00" rx="8" fill="#2d2d2d" stroke="#a0a0a0" stroke-width="2" opacity="1.00"/>
<rect x="109.50" y="1843.86" width="965.00" height="55.00" rx="8" fill="#2d2d2d" stroke="#a0a0a0" stroke-width="2" opacity="1.00"/>
<rect x="40.00" y="2002.62" width="409.00" height="55.00" rx="8" fill="#2d2d2d" stroke="#a0a0a0" stroke-width="2" opacity="1.00"/>
<rect x="569.00" y="2002.62" width="319.00" height="55.00" rx="8" fill="#2d2d2d" stroke="#a0a0a0" stroke-width="2" opacity="1.00"/>
<rect x="342.00" y="2138.62" width="229.00" height="55.00" rx="8" fill="#2d2d2d" stroke="#a0a0a0" stroke-width="2" opacity="1.00"/>
<rect x="1008.00" y="2002.62" width="256.00" height="55.00" rx="8" fill="#2d2d2d" stroke="#a0a0a0" stroke-width="2" opacity="1.00"/>
<path d="M 425.62,95.00 L 425.24,181.93" fill="none" stroke="#a0a0a0" stroke-width="2" opacity="1.00" marker-end="url(#arr-a0a0a0)"/>
<path d="M 629.12,95.00 L 629.12,181.93" fill="none" stroke="#a0a0a0" stroke-width="2" opacity="1.00" marker-end="url(#arr-a0a0a0)"/>
<path d="M 832.62,95.00 L 856.24,181.93" fill="none" stroke="#a0a0a0" stroke-width="2" opacity="1.00" marker-end="url(#arr-a0a0a0)"/>
<path d="M 425.25,236.93 L 592.50,321.86" fill="none" stroke="#a0a0a0" stroke-width="2" opacity="1.00" marker-end="url(#arr-a0a0a0)"/>
<path d="M 856.25,236.93 L 672.50,321.86" fill="none" stroke="#a0a0a0" stroke-width="2" opacity="1.00" marker-end="url(#arr-a0a0a0)"/>
<path d="M 632.50,376.86 L 632.50,457.86" fill="none" stroke="#a0a0a0" stroke-width="2" opacity="1.00" marker-end="url(#arr-a0a0a0)"/>
<path d="M 632.50,512.86 L 632.50,591.86" fill="none" stroke="#a0a0a0" stroke-width="2" opacity="1.00" marker-end="url(#arr-a0a0a0)"/>
<path d="M 597.00,646.86 L 601.25,736.22" fill="none" stroke="#a0a0a0" stroke-width="2" opacity="1.00" marker-end="url(#arr-a0a0a0)"/>
<path d="M 445.25,791.21 L 445.25,870.21" fill="none" stroke="#a0a0a0" stroke-width="2" opacity="1.00" marker-end="url(#arr-a0a0a0)"/>
<path d="M 445.25,925.21 L 445.25,1006.21" fill="none" stroke="#a0a0a0" stroke-width="2" opacity="1.00" marker-end="url(#arr-a0a0a0)"/>
<path d="M 465.92,1053.09 L 474.25,1140.21" fill="none" stroke="#a0a0a0" stroke-width="2" opacity="1.00" marker-end="url(#arr-a0a0a0)"/>
<path d="M 424.58,1053.09 L 398.25,1140.21" fill="none" stroke="#a0a0a0" stroke-width="2" opacity="1.00" marker-end="url(#arr-a0a0a0)"/>
<path d="M 668.00,646.86 L 817.25,736.22" fill="none" stroke="#a0a0a0" stroke-width="2" opacity="1.00" marker-end="url(#arr-a0a0a0)"/>
<path d="M 817.25,791.21 L 845.50,1276.21" fill="none" stroke="#a0a0a0" stroke-width="2" opacity="1.00" marker-end="url(#arr-a0a0a0)"/>
<path d="M 741.25,1195.21 L 744.50,1276.21" fill="none" stroke="#a0a0a0" stroke-width="2" opacity="1.00" marker-end="url(#arr-a0a0a0)"/>
<path d="M 795.00,1331.21 L 795.00,1410.21" fill="none" stroke="#a0a0a0" stroke-width="2" opacity="1.00" marker-end="url(#arr-a0a0a0)"/>
<path d="M 614.25,236.93 L 854.50,268.38 L 854.50,1332.66 L 493.50,1560.04" fill="none" stroke="#a0a0a0" stroke-width="2" opacity="1.00" stroke-dasharray="12,6" marker-end="url(#arr-a0a0a0)"/>
<path d="M 667.25,236.93 L 1170.25,268.38 L 1170.25,1521.66 L 1024.50,1560.04" fill="none" stroke="#a0a0a0" stroke-width="2" opacity="1.00" stroke-dasharray="12,6" marker-end="url(#arr-a0a0a0)"/>
<path d="M 758.00,1465.21 L 401.50,1560.04" fill="none" stroke="#a0a0a0" stroke-width="2" opacity="1.00" marker-end="url(#arr-a0a0a0)"/>
<path d="M 832.00,1465.21 L 935.50,1560.04" fill="none" stroke="#a0a0a0" stroke-width="2" opacity="1.00" marker-end="url(#arr-a0a0a0)"/>
<path d="M 585.50,1615.04 L 579.00,1707.87" fill="none" stroke="#a0a0a0" stroke-width="2" opacity="1.00" marker-end="url(#arr-a0a0a0)"/>
<path d="M 846.50,1615.04 L 686.00,1707.87" fill="none" stroke="#a0a0a0" stroke-width="2" opacity="1.00" marker-end="url(#arr-a0a0a0)"/>
<path d="M 592.00,1762.86 L 632.50,1843.86" fill="none" stroke="#a0a0a0" stroke-width="2" opacity="1.00" marker-end="url(#arr-a0a0a0)"/>
<path d="M 354.75,1898.86 L 441.00,2002.62" fill="none" stroke="#a0a0a0" stroke-width="2" opacity="1.00" marker-end="url(#arr-a0a0a0)"/>
<path d="M 592.00,1898.86 L 592.00,2002.62" fill="none" stroke="#a0a0a0" stroke-width="2" opacity="1.00" marker-end="url(#arr-a0a0a0)"/>
<path d="M 441.00,2057.62 L 421.00,2138.62" fill="none" stroke="#a0a0a0" stroke-width="2" opacity="1.00" marker-end="url(#arr-a0a0a0)"/>
<path d="M 577.00,2057.62 L 492.00,2138.62" fill="none" stroke="#a0a0a0" stroke-width="2" opacity="1.00" marker-end="url(#arr-a0a0a0)"/>
<path d="M 829.25,1898.86 L 1016.00,2002.62" fill="none" stroke="#a0a0a0" stroke-width="2" opacity="1.00" marker-end="url(#arr-a0a0a0)"/>
<text x="629.12" y="57.50" font-size="16" font-family="cursive" fill="#e0e0e0" text-anchor="middle" opacity="1.00"><tspan x="629.12" dy="16.00">CelebA Dataset</tspan></text>
<text x="314.25" y="199.43" font-size="16" font-family="cursive" fill="#e0e0e0" text-anchor="middle" opacity="1.00"><tspan x="314.25" dy="16.00">Load identity mappings</tspan></text>
<text x="640.75" y="199.43" font-size="16" font-family="cursive" fill="#e0e0e0" text-anchor="middle" opacity="1.00"><tspan x="640.75" dy="16.00">Load attributes</tspan></text>
<text x="962.75" y="199.43" font-size="16" font-family="cursive" fill="#e0e0e0" text-anchor="middle" opacity="1.00"><tspan x="962.75" dy="16.00">Load images from disk</tspan></text>
<text x="632.50" y="339.36" font-size="16" font-family="cursive" fill="#e0e0e0" text-anchor="middle" opacity="1.00"><tspan x="632.50" dy="16.00">Group images by identity</tspan></text>
<text x="632.50" y="475.36" font-size="16" font-family="cursive" fill="#e0e0e0" text-anchor="middle" opacity="1.00"><tspan x="632.50" dy="16.00">Filter for identities with 2+ images</tspan></text>
<text x="632.50" y="609.36" font-size="16" font-family="cursive" fill="#e0e0e0" text-anchor="middle" opacity="1.00"><tspan x="632.50" dy="16.00">Cap to MAX IDENTITIES</tspan></text>
<text x="445.25" y="753.71" font-size="16" font-family="cursive" fill="#e0e0e0" text-anchor="middle" opacity="1.00"><tspan x="445.25" dy="16.00">Select 20% images for enrollment</tspan></text>
<text x="445.25" y="887.71" font-size="16" font-family="cursive" fill="#e0e0e0" text-anchor="middle" opacity="1.00"><tspan x="445.25" dy="16.00">Concurrent POST /api/register</tspan></text>
<text x="445.25" y="1023.71" font-size="16" font-family="cursive" fill="#e0e0e0" text-anchor="middle" opacity="1.00"><tspan x="445.25" dy="16.00">Success?</tspan></text>
<text x="607.75" y="1157.71" font-size="16" font-family="cursive" fill="#e0e0e0" text-anchor="middle" opacity="1.00"><tspan x="607.75" dy="16.00">Track successful identities</tspan></text>
<text x="282.75" y="1157.71" font-size="16" font-family="cursive" fill="#e0e0e0" text-anchor="middle" opacity="1.00"><tspan x="282.75" dy="16.00">Track failed identities</tspan></text>
<text x="959.75" y="753.71" font-size="16" font-family="cursive" fill="#e0e0e0" text-anchor="middle" opacity="1.00"><tspan x="959.75" dy="16.00">Select 80% images for testing</tspan></text>
<text x="795.00" y="1293.71" font-size="16" font-family="cursive" fill="#e0e0e0" text-anchor="middle" opacity="1.00"><tspan x="795.00" dy="16.00">Filter to successful identities</tspan></text>
<text x="795.00" y="1427.71" font-size="16" font-family="cursive" fill="#e0e0e0" text-anchor="middle" opacity="1.00"><tspan x="795.00" dy="16.00">Cap to MAX TEST IMAGES</tspan></text>
<text x="447.50" y="1577.54" font-size="16" font-family="cursive" fill="#e0e0e0" text-anchor="middle" opacity="1.00"><tspan x="447.50" dy="16.00">True Positive: Correct Email</tspan></text>
<text x="980.00" y="1577.54" font-size="16" font-family="cursive" fill="#e0e0e0" text-anchor="middle" opacity="1.00"><tspan x="980.00" dy="16.00">True Negative: Random Email</tspan></text>
<text x="632.50" y="1725.36" font-size="16" font-family="cursive" fill="#e0e0e0" text-anchor="middle" opacity="1.00"><tspan x="632.50" dy="16.00">Concurrent POST /api/authenticate</tspan></text>
<text x="592.00" y="1861.36" font-size="16" font-family="cursive" fill="#e0e0e0" text-anchor="middle" opacity="1.00"><tspan x="592.00" dy="16.00">Record AuthResult</tspan></text>
<text x="244.50" y="2020.12" font-size="16" font-family="cursive" fill="#e0e0e0" text-anchor="middle" opacity="1.00"><tspan x="244.50" dy="16.00">Compute Accuracy Precision Recall FAR FRR</tspan></text>
<text x="728.50" y="2020.12" font-size="16" font-family="cursive" fill="#e0e0e0" text-anchor="middle" opacity="1.00"><tspan x="728.50" dy="16.00">Compute Per-Attribute Breakdown</tspan></text>
<text x="456.50" y="2156.12" font-size="16" font-family="cursive" fill="#e0e0e0" text-anchor="middle" opacity="1.00"><tspan x="456.50" dy="16.00">Save etl_results.json</tspan></text>
<text x="1136.00" y="2020.12" font-size="16" font-family="cursive" fill="#e0e0e0" text-anchor="middle" opacity="1.00"><tspan x="1136.00" dy="16.00">Save dashboard_data.json</tspan></text>
<text x="470.09" y="1087.90" font-size="14" font-family="cursive" fill="#c0c0c0" text-anchor="middle" opacity="1.00"><tspan x="470.09" dy="14.00">Yes</tspan></text>
<text x="411.41" y="1087.90" font-size="14" font-family="cursive" fill="#c0c0c0" text-anchor="middle" opacity="1.00"><tspan x="411.41" dy="14.00">No</tspan></text>
</svg>
