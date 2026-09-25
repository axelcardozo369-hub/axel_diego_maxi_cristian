import crypto from 'node:crypto';

const PREFIJOS = {
  planilla: 'PLA', json: 'JSN', pdf: 'PDF', imagen: 'IMG', audio: 'AUD',
  video: 'VID', documento: 'DOC', texto: 'TXT', otro: 'ARC',
};
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Sin 0/O ni 1/I: se leen sin confundir

// Genera un identificador legible y único: PDF-20260924-K7Q2M9
export function generarIdentificador(tipo = 'otro', fecha = new Date()) {
  const dia = fecha.toISOString().slice(0, 10).replace(/-/g, '');
  const bytes = crypto.randomBytes(6);
  const sufijo = [...bytes].map((b) => ALFABETO[b % ALFABETO.length]).join('');
  return `${PREFIJOS[tipo] || 'ARC'}-${dia}-${sufijo}`;
}
