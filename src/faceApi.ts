import * as canvas from 'canvas';
import * as faceapi from '@vladmandic/face-api';
import path from 'path';

const { Canvas, Image, ImageData } = canvas;
faceapi.env.monkeyPatch({ Canvas, Image, ImageData } as any);

export async function loadModels() {
  const modelPath = path.resolve(process.cwd(), 'node_modules/@vladmandic/face-api/model');
  console.log(`Loading face-api models from ${modelPath}`);
  
  await Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromDisk(modelPath),
    faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath),
    faceapi.nets.faceRecognitionNet.loadFromDisk(modelPath),
  ]);
  console.log('Face models loaded successfully');
}

export async function getFaceDescriptor(buffer: Buffer): Promise<Float32Array | null> {
  const img = await canvas.loadImage(buffer);
  
  const detection = await faceapi.detectSingleFace(img as any).withFaceLandmarks().withFaceDescriptor();
  
  if (!detection) {
    return null;
  }
  return detection.descriptor;
}