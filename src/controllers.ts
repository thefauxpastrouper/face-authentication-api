import { type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { getFaceDescriptor } from './faceApi';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const MATCH_THRESHOLD = 0.6; 

export async function register(req: Request, res: Response): Promise<any> {
  try {
    const { name, email } = req.body;
    const file = req.file;

    if (!name || !email || !file) {
      return res.status(400).json({ success: false, message: 'Name, email, and photo are required.' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User with this email already exists.' });
    }

    const descriptor = await getFaceDescriptor(file.buffer);
    if (!descriptor) {
      return res.status(400).json({ success: false, message: 'Could not detect a face in the provided photo.' });
    }

    const descriptorStr = `[${Array.from(descriptor).join(',')}]`;

    const users = await prisma.$queryRaw<any[]>`
      INSERT INTO "User" (id, name, email, "faceDescriptor", "updatedAt")
      VALUES (gen_random_uuid(), ${name}, ${email}, ${descriptorStr}::vector, now())
      RETURNING id, name, email
    `;

    const user = users[0];

    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

export async function authenticate(req: Request, res: Response): Promise<any> {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, message: 'Photo is required.' });
    }

    const descriptor = await getFaceDescriptor(file.buffer);
    if (!descriptor) {
      return res.status(400).json({ success: false, message: 'Could not detect a face in the provided photo.' });
    }

    const descriptorStr = `[${Array.from(descriptor).join(',')}]`;

    const matches = await prisma.$queryRaw<any[]>`
      SELECT id, name, email, "faceDescriptor" <-> ${descriptorStr}::vector as distance
      FROM "User"
      ORDER BY distance ASC
      LIMIT 1
    `;

    if (matches.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const match = matches[0];
    const distance = match.distance;
    const isMatch = distance < MATCH_THRESHOLD;

    if (isMatch) {
      return res.status(200).json({
        success: true,
        message: 'Identity verified',
        user: { id: match.id, name: match.name, email: match.email },
        distance,
      });
    } else {
      return res.status(401).json({
        success: false,
        message: 'Face does not match any user',
        distance,
      });
    }
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}
