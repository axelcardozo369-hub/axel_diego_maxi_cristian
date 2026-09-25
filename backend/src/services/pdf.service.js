import PDFDocument from 'pdfkit';

// ============================================================
// Genera el PDF de un reporte (pdfkit, sin navegador ni servicios externos).
// Incluye: encabezado, fuentes, consulta, respuesta, indicadores,
// hallazgos, recomendaciones, todas las tablas y limitaciones.
// ============================================================
const COLOR = { tinta: '#161D2F', indigo: '#1F2B63', primario: '#3346A8', suave: '#5A6478', linea: '#DCE1EA', fondo: '#F4F6F9', resaltador: '#E6F24A' };
const MODOS = { comparacion: 'Comparación', consolidacion: 'Consolidación', consulta: 'Consulta sobre varias fuentes' };

// Las fuentes estándar de PDF usan WinAnsi: se reemplazan los caracteres que no existen
const PERMITIDOS = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ');
const REEMPLAZOS = { '→': '->', '←': '<-', '●': '•', '▪': '•', '✔': 'OK', '✓': 'OK', '✖': 'X', '≈': '~', '≥': '>=', '≤': '<=', '−': '-', '\u00A0': ' ' };
const limpiar = (texto) => String(texto ?? '')
  .split('')
  .map((c) => REEMPLAZOS[c] ?? (c.charCodeAt(0) <= 0xff || PERMITIDOS.has(c) ? c : ''))
  .join('');

export function generarPDFReporte(reporte, salida) {
  const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true, info: { Title: limpiar(reporte.titulo || 'Reporte InfoHub'), Author: 'InfoHub' } });
  doc.pipe(salida);

  const ancho = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const izquierda = doc.page.margins.left;
  const limiteInferior = () => doc.page.height - doc.page.margins.bottom - 20;
  const asegurarEspacio = (alto) => { if (doc.y + alto > limiteInferior()) doc.addPage(); };

  const m = reporte.metricas_clave || {};
  const fuentes = reporte.fuentes?.length ? reporte.fuentes : [reporte.fuente].filter(Boolean);

  // ---------- Encabezado ----------
  doc.rect(0, 0, doc.page.width, 92).fill(COLOR.indigo);
  doc.rect(izquierda, 28, 44, 7).fill(COLOR.resaltador);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(11).text('InfoHub', izquierda + 54, 25);
  doc.font('Helvetica-Bold').fontSize(17).text(limpiar(reporte.titulo || 'Reporte'), izquierda, 46, { width: ancho, height: 40, ellipsis: true });
  doc.y = 112;

  // ---------- Datos del reporte ----------
  const datos = [
    ['Tipo', m.modo ? MODOS[m.modo] : 'Consulta sobre una fuente'],
    ['Fuentes', fuentes.map((f) => `${f.titulo} (${f.identificador})`).join(' · ')],
    ['Generado por', reporte.origen === 'ia' ? `IA (${reporte.modelo_ia || 'IA'}) con cálculos del sistema` : 'Motor local de InfoHub'],
    ['Autor', `${reporte.autor?.nombre || '-'} · ${new Date(reporte.updatedAt || Date.now()).toLocaleString('es-AR')}`],
    ['Estado', reporte.estado],
  ];
  doc.fontSize(9);
  datos.forEach(([k, v]) => {
    const y = doc.y;
    doc.font('Helvetica-Bold').fillColor(COLOR.suave).text(limpiar(k), izquierda, y, { width: 80 });
    doc.font('Helvetica').fillColor(COLOR.tinta).text(limpiar(v), izquierda + 85, y, { width: ancho - 85 });
    doc.moveDown(0.25);
  });
  doc.moveDown(0.6);

  const titulo = (texto) => {
    asegurarEspacio(40);
    doc.moveDown(0.4);
    doc.font('Helvetica-Bold').fontSize(12).fillColor(COLOR.primario).text(limpiar(texto), izquierda, doc.y, { width: ancho });
    doc.moveDown(0.3);
  };
  const parrafo = (texto, opciones = {}) => {
    doc.font('Helvetica').fontSize(10).fillColor(COLOR.tinta).text(limpiar(texto), izquierda, doc.y, { width: ancho, lineGap: 2, ...opciones });
    doc.moveDown(0.4);
  };
  const lista = (items) => items.forEach((item) => {
    asegurarEspacio(18);
    const y = doc.y;
    doc.font('Helvetica').fontSize(10).fillColor(COLOR.primario).text('•', izquierda + 4, y);
    doc.fillColor(COLOR.tinta).text(limpiar(item), izquierda + 16, y, { width: ancho - 16, lineGap: 2 });
    doc.moveDown(0.25);
  });

  // ---------- Consulta y respuesta ----------
  if (reporte.consulta) {
    asegurarEspacio(40);
    const alto = doc.font('Helvetica-Bold').fontSize(10).heightOfString(limpiar(reporte.consulta), { width: ancho - 24 }) + 14;
    const y = doc.y;
    doc.rect(izquierda, y, ancho, alto).fill(COLOR.fondo);
    doc.rect(izquierda, y, 3, alto).fill(COLOR.primario);
    doc.fillColor(COLOR.tinta).text(limpiar(reporte.consulta), izquierda + 14, y + 7, { width: ancho - 24 });
    doc.y = y + alto + 8;
  }
  titulo('Respuesta');
  parrafo(reporte.resumen_ejecutivo);

  // ---------- Indicadores (tarjetas de 3 por fila) ----------
  const indicadores = m.indicadores || [];
  if (indicadores.length) {
    titulo('Indicadores clave');
    const col = 3;
    const gap = 8;
    const w = (ancho - gap * (col - 1)) / col;
    for (let i = 0; i < indicadores.length; i += col) {
      const fila = indicadores.slice(i, i + col);
      const alto = Math.max(...fila.map((ind) => {
        doc.fontSize(8);
        const hNombre = doc.heightOfString(limpiar(ind.nombre), { width: w - 16 });
        doc.font('Helvetica-Bold').fontSize(13);
        const hValor = doc.heightOfString(limpiar(ind.valor), { width: w - 16 });
        doc.font('Helvetica').fontSize(8);
        const hCtx = ind.contexto ? doc.heightOfString(limpiar(ind.contexto), { width: w - 16 }) : 0;
        return hNombre + hValor + hCtx + 22;
      }));
      asegurarEspacio(alto + 6);
      const y = doc.y;
      fila.forEach((ind, j) => {
        const x = izquierda + j * (w + gap);
        doc.roundedRect(x, y, w, alto, 4).lineWidth(0.7).strokeColor(COLOR.linea).stroke();
        let yy = y + 7;
        doc.font('Helvetica').fontSize(8).fillColor(COLOR.suave).text(limpiar(ind.nombre), x + 8, yy, { width: w - 16 });
        yy = doc.y + 2;
        doc.font('Helvetica-Bold').fontSize(13).fillColor(COLOR.tinta).text(limpiar(ind.valor), x + 8, yy, { width: w - 16 });
        if (ind.contexto) doc.font('Helvetica').fontSize(8).fillColor(COLOR.suave).text(limpiar(ind.contexto), x + 8, doc.y + 2, { width: w - 16 });
      });
      doc.y = y + alto + gap;
    }
  }

  if (m.hallazgos?.length) { titulo('Hallazgos'); lista(m.hallazgos); }
  if (m.recomendaciones?.length) { titulo('Recomendaciones'); lista(m.recomendaciones); }

  // ---------- Tablas ----------
  const tablas = [m.tabla, ...(m.tablas_extra || [])].filter((t) => t?.columnas?.length && t?.filas?.length);
  tablas.forEach((t) => dibujarTabla(doc, t, { izquierda, ancho, limiteInferior, titulo }));

  if (m.limitaciones) { titulo('Limitaciones'); parrafo(m.limitaciones, { oblique: true }); }

  // ---------- Pie con número de página ----------
  const paginas = doc.bufferedPageRange();
  for (let i = 0; i < paginas.count; i += 1) {
    doc.switchToPage(i);
    // Sin margen inferior mientras se escribe el pie (si no, pdfkit agrega páginas vacías)
    const margenOriginal = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    const y = doc.page.height - 35;
    doc.font('Helvetica').fontSize(8).fillColor(COLOR.suave);
    doc.text(limpiar(`InfoHub · ${reporte.titulo || 'Reporte'}`).slice(0, 90), izquierda, y, { width: ancho - 60, lineBreak: false });
    doc.text(`Página ${i + 1} de ${paginas.count}`, izquierda + ancho - 80, y, { width: 80, align: 'right', lineBreak: false });
    doc.page.margins.bottom = margenOriginal;
  }
  doc.end();
}

// Tabla con anchos proporcionales al contenido, texto que se ajusta,
// filas alternadas y encabezado repetido en cada página nueva
function dibujarTabla(doc, tabla, { izquierda, ancho, limiteInferior, titulo }) {
  // El título nunca queda solo al pie: si no entran título + encabezado + 2 filas, página nueva
  if (doc.y + 110 > limiteInferior()) doc.addPage();
  titulo(tabla.titulo || 'Tabla');
  const columnas = tabla.columnas.map(limpiar);
  const filas = tabla.filas.slice(0, 300).map((f) => columnas.map((_, i) => limpiar(f[i] ?? '')));
  const pad = 4;
  doc.font('Helvetica').fontSize(8);

  // Ancho natural de cada columna (limitado) y escalado al ancho de la página
  const natural = columnas.map((c, i) => Math.min(
    Math.max(doc.widthOfString(c) + 10, ...filas.slice(0, 60).map((f) => doc.widthOfString(f[i]) + 10), 40),
    220,
  ));
  const total = natural.reduce((a, b) => a + b, 0);
  const anchos = natural.map((w) => (w / total) * ancho);
  // Columnas numéricas alineadas a la derecha
  const esNumero = (v) => /^[-+]?\$?\s?[\d.,]+\s?%?$/.test(String(v).trim());
  const derecha = columnas.map((_, i) => {
    const valores = filas.map((f) => f[i]).filter((v) => String(v).trim());
    return valores.length > 0 && valores.filter(esNumero).length / valores.length >= 0.8;
  });

  const altoFila = (celdas, negrita) => {
    doc.font(negrita ? 'Helvetica-Bold' : 'Helvetica').fontSize(8);
    return Math.max(...celdas.map((c, i) => doc.heightOfString(c || ' ', { width: anchos[i] - pad * 2 }))) + pad * 2;
  };
  const dibujarFila = (celdas, y, { negrita = false, fondo = null } = {}) => {
    const alto = altoFila(celdas, negrita);
    if (fondo) doc.rect(izquierda, y, ancho, alto).fill(fondo);
    let x = izquierda;
    celdas.forEach((c, i) => {
      doc.font(negrita ? 'Helvetica-Bold' : 'Helvetica').fontSize(8).fillColor(negrita ? '#FFFFFF' : '#161D2F')
        .text(c, x + pad, y + pad, { width: anchos[i] - pad * 2, align: derecha[i] ? 'right' : 'left' });
      x += anchos[i];
    });
    doc.moveTo(izquierda, y + alto).lineTo(izquierda + ancho, y + alto).lineWidth(0.4).strokeColor('#DCE1EA').stroke();
    return alto;
  };

  let y = doc.y;
  if (y + altoFila(columnas, true) * 2 > limiteInferior()) { doc.addPage(); y = doc.y; }
  y += dibujarFila(columnas, y, { negrita: true, fondo: '#3346A8' });
  filas.forEach((fila, n) => {
    const alto = altoFila(fila, false);
    if (y + alto > limiteInferior()) {
      doc.addPage();
      y = doc.y;
      y += dibujarFila(columnas, y, { negrita: true, fondo: '#3346A8' });
    }
    // La fila TOTAL se destaca
    const esTotal = /^total$/i.test(fila[0]);
    y += dibujarFila(fila, y, { fondo: esTotal ? '#E6F24A' : n % 2 ? '#F7F8FB' : null });
  });
  if (tabla.filas.length > 300) {
    doc.font('Helvetica').fontSize(8).fillColor('#5A6478').text(`(Se muestran 300 de ${tabla.filas.length} filas)`, izquierda, y + 4);
    y = doc.y;
  }
  doc.y = y + 10;
  doc.x = izquierda;
}
