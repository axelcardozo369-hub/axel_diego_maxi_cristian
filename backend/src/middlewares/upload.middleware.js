import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import { validationResult } from 'express-validator';
import { env } from '../config/env.js';

const carpeta = path.resolve(env.UPLOADS_DIR);
fs.mkdirSync(carpeta, { recursive: true });

// El archivo va directo a disco (no a memoria): así no hay límite práctico
// de tamaño y un video de 1 GB no satura el servidor.
const almacenamiento = multer.diskStorage({
  destination: carpeta,
  filename: (req, archivo, cb) => {
    const extension = path.extname(archivo.originalname).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${extension}`);
  },
});

// Sin "limits": se eliminó la restricción de tamaño
export const subirArchivo = multer({ storage: almacenamiento }).single('archivo');

// Los navegadores mandan el nombre en UTF-8 pero multer lo lee como latin1
// ("ReuniÃ³n.mp3"): se corrige para conservar tildes y eñes
export const nombreOriginal = (archivo) => {
  const corregido = Buffer.from(archivo.originalname, 'latin1').toString('utf8');
  return corregido.includes('\uFFFD') ? archivo.originalname : corregido;
};

// Si la validación falla, se borra el archivo recién subido (no queda basura en disco)
export const descartarArchivoSiHayErrores = (req, res, next) => {
  if (req.file && !validationResult(req).isEmpty()) {
    fs.unlink(req.file.path, () => {});
  }
  next();
};
