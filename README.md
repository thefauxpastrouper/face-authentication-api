# Face Recognition System - Backend API

This repository contains the backend implementation for a Face Registration and Authentication system, built for the AI/ML Intern Assignment.

## 🚀 Setup Instructions

### Prerequisites
- Node.js (v18+) or [Bun](https://bun.sh/)
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
# or
npm run dev
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
