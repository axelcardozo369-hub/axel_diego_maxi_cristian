import path from 'node:path';

// ============================================================
// Detecta qué tipo de fuente es un archivo y cómo hay que leerlo.
//   modo 'texto' → se lee como texto (CSV, JSON, TXT, XML...)
//   modo 'hoja'  → planilla Excel/ODS, se convierte a CSV
//   modo 'docx'  → documento Word, se extrae el texto
//   modo 'pdf'   → se extrae el texto localmente; si es escaneado, lo lee la IA
//   modo 'ia'    → imagen, audio, video: lo entiende la IA
//   modo 'otro'  → formato desconocido: se intenta como texto
// ============================================================

export const TIPOS_FUENTE = ['planilla', 'json', 'pdf', 'imagen', 'audio', 'video', 'documento', 'texto', 'otro'];

const POR_EXTENSION = {
  csv: ['planilla', 'texto', 'text/csv'],
  tsv: ['planilla', 'texto', 'text/tab-separated-values'],
  xlsx: ['planilla', 'hoja', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  xls: ['planilla', 'hoja', 'application/vnd.ms-excel'],
  ods: ['planilla', 'hoja', 'application/vnd.oasis.opendocument.spreadsheet'],
  json: ['json', 'texto', 'application/json'],
  txt: ['texto', 'texto', 'text/plain'],
  md: ['texto', 'texto', 'text/markdown'],
  xml: ['texto', 'texto', 'text/xml'],
  html: ['texto', 'texto', 'text/html'],
  htm: ['texto', 'texto', 'text/html'],
  log: ['texto', 'texto', 'text/plain'],
  docx: ['documento', 'docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  pdf: ['pdf', 'pdf', 'application/pdf'],
  png: ['imagen', 'ia', 'image/png'],
  jpg: ['imagen', 'ia', 'image/jpeg'],
  jpeg: ['imagen', 'ia', 'image/jpeg'],
  webp: ['imagen', 'ia', 'image/webp'],
  heic: ['imagen', 'ia', 'image/heic'],
  heif: ['imagen', 'ia', 'image/heif'],
  mp3: ['audio', 'ia', 'audio/mp3'],
  wav: ['audio', 'ia', 'audio/wav'],
  ogg: ['audio', 'ia', 'audio/ogg'],
  opus: ['audio', 'ia', 'audio/ogg'], // Audios de WhatsApp
  m4a: ['audio', 'ia', 'audio/aac'],
  aac: ['audio', 'ia', 'audio/aac'],
  flac: ['audio', 'ia', 'audio/flac'],
  aiff: ['audio', 'ia', 'audio/aiff'],
  mp4: ['video', 'ia', 'video/mp4'],
  mov: ['video', 'ia', 'video/mov'],
  webm: ['video', 'ia', 'video/webm'],
  avi: ['video', 'ia', 'video/avi'],
  mpeg: ['video', 'ia', 'video/mpeg'],
  mpg: ['video', 'ia', 'video/mpg'],
  wmv: ['video', 'ia', 'video/wmv'],
  '3gp': ['video', 'ia', 'video/3gpp'],
};

export function detectarTipo(nombreArchivo = '', mimeDeclarado = '') {
  const ext = path.extname(nombreArchivo).slice(1).toLowerCase();
  if (POR_EXTENSION[ext]) {
    const [tipo_fuente, modo, mime] = POR_EXTENSION[ext];
    return { tipo_fuente, modo, mime_type: mime, extension: ext };
  }
  // Sin extensión conocida: se usa el MIME que mandó el navegador
  const mime = (mimeDeclarado || 'application/octet-stream').toLowerCase();
  if (mime.startsWith('image/')) return { tipo_fuente: 'imagen', modo: 'ia', mime_type: mime, extension: ext };
  if (mime.startsWith('audio/')) return { tipo_fuente: 'audio', modo: 'ia', mime_type: mime, extension: ext };
  if (mime.startsWith('video/')) return { tipo_fuente: 'video', modo: 'ia', mime_type: mime, extension: ext };
  if (mime === 'application/pdf') return { tipo_fuente: 'pdf', modo: 'pdf', mime_type: mime, extension: ext };
  if (mime.includes('json')) return { tipo_fuente: 'json', modo: 'texto', mime_type: mime, extension: ext };
  if (mime.startsWith('text/')) return { tipo_fuente: 'texto', modo: 'texto', mime_type: mime, extension: ext };
  return { tipo_fuente: 'otro', modo: 'otro', mime_type: mime, extension: ext };
}

// Para texto pegado directamente en el formulario
export function detectarTipoDeTexto(texto = '') {
  const t = texto.trim();
  if ((t.startsWith('{') || t.startsWith('[')) && (() => { try { JSON.parse(t); return true; } catch { return false; } })()) {
    return 'json';
  }
  const lineas = t.split(/\r?\n/).filter(Boolean).slice(0, 5);
  const separadores = [',', ';', '\t', '|'];
  const esTabla = lineas.length >= 2 && separadores.some((s) => {
    const n = lineas[0].split(s).length;
    return n > 1 && lineas.every((l) => l.split(s).length === n);
  });
  return esTabla ? 'planilla' : 'texto';
}
