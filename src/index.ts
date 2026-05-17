import express from 'express';
import multer from 'multer';
import { loadModels } from './faceApi';
import { register, authenticate } from './controllers';

import path from 'path';

const app = express();
const port = 3000;

const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }});

app.use(express.json());
app.use(express.static(path.join(process.cwd(), 'public')));
app.use('/data_bank', express.static(path.join(process.cwd(), 'data_bank')));

app.post('/api/register', upload.single('photo'), register);
app.post('/api/authenticate', upload.single('photo'), authenticate);

async function startServer() {
  await loadModels();
  
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

startServer().catch(console.error);
