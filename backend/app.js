import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './src/config/env.js';
import apiRoutes from './src/routes/index.js';
import { notFound, errorHandler } from './src/middlewares/error.middleware.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// Middlewares globales
app.use(cors({ origin: env.CORS_ORIGIN }));
// Texto pegado sin límite práctico (los archivos van por multipart, no por acá)
app.use(express.json({ limit: '200mb' }));

app.get('/api/health', (req, res) => res.status(200).json({ status: 'ok' }));

// API REST
app.use('/api', apiRoutes);
app.use('/api', notFound);

// Frontend compilado (npm run build en /frontend) servido en la misma URL
const dist = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  // React Router: cualquier ruta que no sea /api devuelve index.html
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use(errorHandler);

export default app;
