import fs from 'node:fs/promises';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { extractText, getDocumentProxy } from 'unpdf';

// ============================================================
// Extracción LOCAL de texto (sin IA, sin costo, sin internet)
// para los formatos que se pueden leer directamente.
// ============================================================

// ¿Parece texto? (menos de 2% de bytes de control en una muestra)
function pareceTexto(buffer) {
  const muestra = buffer.subarray(0, 8000);
  if (muestra.length === 0) return false;
  let control = 0;
  for (const b of muestra) if (b === 0 || (b < 9) || (b > 13 && b < 32)) control += 1;
  return control / muestra.length < 0.02;
}

export async function extraerTextoLocal(ruta, modo) {
  if (modo === 'texto') {
    return { texto: await fs.readFile(ruta, 'utf8'), detalle: {} };
  }

  if (modo === 'hoja') {
    // Cada hoja de la planilla se convierte a CSV (separador ;)
    const libro = XLSX.read(await fs.readFile(ruta), { type: 'buffer', cellDates: true });
    const hojas = libro.SheetNames.map((nombre) => ({
      nombre,
      csv: XLSX.utils.sheet_to_csv(libro.Sheets[nombre], { FS: ';', blankrows: false, dateNF: 'yyyy-mm-dd' }).trim(),
    })).filter((h) => h.csv);
    const texto = hojas.length === 1
      ? hojas[0].csv
      : hojas.map((h) => `### Hoja: ${h.nombre}\n${h.csv}`).join('\n\n');
    return { texto, detalle: { hojas: hojas.map((h) => h.nombre), primera_hoja_csv: hojas[0]?.csv ?? '' } };
  }

  if (modo === 'pdf') {
    // PDF con texto (la gran mayoría): se lee localmente, sin IA y sin límite.
    // Si casi no tiene texto por página, es un escaneo o fotos → lo lee la IA.
    const pdf = await getDocumentProxy(new Uint8Array(await fs.readFile(ruta)));
    const { totalPages, text } = await extractText(pdf, { mergePages: true });
    const texto = String(text || '').replace(/[ \t]+\n/g, '\n').trim();
    const escaneado = texto.length / Math.max(totalPages, 1) < 80;
    return { texto: escaneado ? null : texto, detalle: { paginas: totalPages, escaneado } };
  }

  if (modo === 'docx') {
    const { value } = await mammoth.extractRawText({ path: ruta });
    return { texto: value.trim(), detalle: {} };
  }

  if (modo === 'otro') {
    // Formato desconocido: si es texto se aprovecha; si no, queda como binario
    const buffer = await fs.readFile(ruta);
    if (pareceTexto(buffer)) return { texto: buffer.toString('utf8'), detalle: { leido_como_texto: true } };
    return { texto: null, detalle: { binario_no_reconocido: true } };
  }

  return { texto: null, detalle: {} }; // modo 'ia': lo resuelve el proveedor de IA
}

// Texto sobre el que se calculan métricas: si es un Excel con varias hojas, la primera
export const textoParaAnalizar = (fuente) => fuente.metadata?.primera_hoja_csv || fuente.contenido_crudo || '';
