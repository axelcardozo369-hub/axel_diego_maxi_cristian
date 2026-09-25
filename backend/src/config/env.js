import 'dotenv/config';

// Única fuente de configuración: el resto del código importa "env"
// y nunca lee process.env directamente.
export const env = {
  PORT: Number(process.env.PORT) || 3000,
  DB_NAME: process.env.DB_NAME || 'infohub',
  DB_USER: process.env.DB_USER || 'root',
  DB_PASS: process.env.DB_PASS || '',
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: Number(process.env.DB_PORT) || 3306,
  DB_SYNC_ALTER: process.env.DB_SYNC_ALTER === 'true',
  JWT_SECRET: process.env.JWT_SECRET || 'solo-para-desarrollo',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '8h',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
  UPLOADS_DIR: process.env.UPLOADS_DIR || 'uploads',
  IA_PROVEEDOR: (process.env.IA_PROVEEDOR || 'auto').toLowerCase(),
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  // Uno o varios modelos separados por coma: si el primero no tiene cuota, se usa el siguiente
  GEMINI_MODELOS: (process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite,gemini-3.8-flash').split(',').map((m) => m.trim()).filter(Boolean),
  // Opcional: solo si se usa un proxy o un servidor de pruebas
  GEMINI_BASE_URL: process.env.GEMINI_BASE_URL || '',
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || '',
  OPENROUTER_BASE_URL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
  OPENROUTER_MODEL: process.env.OPENROUTER_MODEL || 'openrouter/free',
  OPENROUTER_SITE_URL: process.env.OPENROUTER_SITE_URL || '',
  OPENROUTER_SITE_NAME: process.env.OPENROUTER_SITE_NAME || 'InfoHub',
};
