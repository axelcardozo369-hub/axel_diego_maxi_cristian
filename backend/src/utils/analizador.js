// ============================================================
// Analizador de contenido crudo
// Convierte una planilla/CSV o un texto en métricas útiles:
// cuántos registros hay, qué tan completos están, si hay
// duplicados, totales por columna y valores más frecuentes.
// ============================================================

const DELIMITADORES = [',', ';', '\t', '|'];

// Elige el delimitador que aparece la misma cantidad de veces en más filas
function detectarDelimitador(lineas) {
  const muestra = lineas.slice(0, 10);
  let mejor = null;
  let mejorPuntaje = 0;
  for (const d of DELIMITADORES) {
    const conteos = muestra.map((l) => l.split(d).length - 1);
    const base = conteos[0];
    if (base === 0) continue;
    const coincidencias = conteos.filter((c) => c === base).length;
    const puntaje = coincidencias * 100 + base;
    if (puntaje > mejorPuntaje) { mejor = d; mejorPuntaje = puntaje; }
  }
  return mejor;
}

const limpiarCelda = (c = '') => c.trim().replace(/^"(.*)"$/, '$1').trim();

// Acepta "1234.5", "1.234,50" (formato argentino) y "$ 1.200"
export function aNumero(valor) {
  if (valor == null) return null;
  let v = String(valor).replace(/[$\s%]/g, '');
  if (v === '') return null;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(v)) v = v.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d+,\d+$/.test(v)) v = v.replace(',', '.');
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const redondear = (n) => Math.round(n * 100) / 100;

// "2026-09-24" o "24/09/2026" → "2026-09-24" (null si no es fecha)
function aFechaISO(valor) {
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(valor);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

// Un JSON con una lista de objetos ([{...}, {...}] o { "datos": [{...}] })
// se convierte en tabla para poder medirlo igual que una planilla
function jsonATabla(texto) {
  const t = String(texto).trim();
  if (!(t.startsWith('[') || t.startsWith('{'))) return null;
  let dato;
  try { dato = JSON.parse(t); } catch { return null; }
  const esListaDeObjetos = (v) => Array.isArray(v) && v.length > 0 && v.every((x) => x && typeof x === 'object' && !Array.isArray(x));
  let lista = esListaDeObjetos(dato) ? dato : null;
  if (!lista && dato && typeof dato === 'object') {
    lista = Object.values(dato).find(esListaDeObjetos) || null;
  }
  if (!lista) return { esJson: true, csv: null, claves: dato && typeof dato === 'object' ? Object.keys(dato).length : 0 };
  const columnas = [...new Set(lista.flatMap((o) => Object.keys(o)))];
  const celda = (v) => {
    if (v == null) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return s.replace(/[;\r\n]+/g, ' ');
  };
  const filas = lista.map((o) => columnas.map((c) => celda(o[c])).join(';'));
  return { esJson: true, csv: [columnas.join(';'), ...filas].join('\n') };
}

// Devuelve { encabezados, filas } si el texto es una tabla (CSV/TSV o JSON con lista), si no null
export function leerTabla(texto = '') {
  const json = jsonATabla(texto);
  const fuente = json?.csv ?? (json?.esJson ? null : texto);
  if (!fuente) return null;
  const lineas = String(fuente).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const delimitador = lineas.length >= 2 ? detectarDelimitador(lineas) : null;
  if (!delimitador) return null;
  const encabezados = lineas[0].split(delimitador).map(limpiarCelda);
  const filas = lineas.slice(1).map((l) => {
    const celdas = l.split(delimitador).map(limpiarCelda);
    return encabezados.map((_, i) => celdas[i] ?? '');
  });
  return { encabezados, filas };
}

export function analizarContenido(texto = '') {
  const json = jsonATabla(texto);
  if (json?.csv) return { ...analizarContenido(json.csv), origen: 'json' };
  if (json?.esJson) {
    return { tipo: 'texto', origen: 'json', claves: json.claves, lineas: String(texto).split(/\r?\n/).length, palabras: 0, caracteres: String(texto).length };
  }

  const lineas = String(texto).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const delimitador = lineas.length >= 2 ? detectarDelimitador(lineas) : null;

  // ---------- Texto libre ----------
  if (!delimitador) {
    const palabras = String(texto).split(/\s+/).filter(Boolean);
    return {
      tipo: 'texto',
      lineas: lineas.length,
      palabras: palabras.length,
      caracteres: String(texto).length,
    };
  }

  // ---------- Tabla ----------
  const encabezados = lineas[0].split(delimitador).map(limpiarCelda);
  const filas = lineas.slice(1).map((l) => {
    const celdas = l.split(delimitador).map(limpiarCelda);
    return encabezados.map((_, i) => celdas[i] ?? '');
  });

  const totalCeldas = filas.length * encabezados.length;
  const celdasVacias = filas.reduce((acc, f) => acc + f.filter((c) => c === '').length, 0);
  const filasUnicas = new Set(filas.map((f) => f.join('\u0001').toLowerCase()));

  const numericas = [];
  const categoricas = [];
  const fechas = [];

  encabezados.forEach((columna, i) => {
    const valores = filas.map((f) => f[i]).filter((v) => v !== '');
    if (valores.length === 0) return;

    // Columnas de fecha → rango cubierto (sirve para saber si está desactualizada)
    const iso = valores.map(aFechaISO).filter(Boolean);
    if (iso.length / valores.length >= 0.8) {
      iso.sort();
      fechas.push({ columna, desde: iso[0], hasta: iso[iso.length - 1] });
      return;
    }

    const numeros = valores.map(aNumero).filter((n) => n !== null);
    if (numeros.length / valores.length >= 0.8) {
      const suma = numeros.reduce((a, b) => a + b, 0);
      numericas.push({
        columna,
        suma: redondear(suma),
        promedio: redondear(suma / numeros.length),
        minimo: redondear(Math.min(...numeros)),
        maximo: redondear(Math.max(...numeros)),
      });
      return;
    }

    const frecuencias = valores.reduce((m, v) => m.set(v, (m.get(v) || 0) + 1), new Map());
    // Solo columnas con valores que se repiten (categorías), no texto libre
    if (frecuencias.size <= Math.max(10, valores.length * 0.5)) {
      categoricas.push({
        columna,
        distintos: frecuencias.size,
        top: [...frecuencias.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([valor, cantidad]) => ({ valor, cantidad })),
      });
    }
  });

  return {
    tipo: 'tabla',
    filas: filas.length,
    columnas: encabezados.length,
    encabezados,
    celdas_vacias: celdasVacias,
    completitud_pct: totalCeldas ? redondear(((totalCeldas - celdasVacias) / totalCeldas) * 100) : 100,
    filas_duplicadas: filas.length - filasUnicas.size,
    numericas,
    // Primero las columnas más "categóricas" (menos valores distintos)
    categoricas: categoricas.sort((a, b) => a.distintos - b.distintos),
    fechas,
  };
}

const formatear = (n) => n.toLocaleString('es-AR', { maximumFractionDigits: 2 });

// Borrador de resumen ejecutivo en lenguaje llano, a partir de las métricas
export function generarResumen(m, titulo = 'La fuente') {
  if (m.tipo === 'texto') {
    return `${titulo} es un texto de ${m.palabras} palabras en ${m.lineas} líneas. Conviene pasarlo a una planilla para poder medirlo.`;
  }
  const partes = [
    `${titulo} tiene ${m.filas} registros y ${m.columnas} columnas.`,
    `El ${formatear(m.completitud_pct)}% de los datos está completo`
      + (m.celdas_vacias ? ` (${m.celdas_vacias} ${m.celdas_vacias === 1 ? 'celda vacía' : 'celdas vacías'}).` : '.'),
  ];
  if (m.filas_duplicadas === 1) partes.push('Hay 1 registro duplicado que conviene revisar.');
  if (m.filas_duplicadas > 1) partes.push(`Hay ${m.filas_duplicadas} registros duplicados que conviene revisar.`);
  m.fechas.slice(0, 1).forEach((f) => {
    partes.push(`Los datos van del ${f.desde} al ${f.hasta}.`);
  });
  m.numericas.slice(0, 2).forEach((c) => {
    partes.push(`Total de ${c.columna}: ${formatear(c.suma)} (promedio ${formatear(c.promedio)}).`);
  });
  m.categoricas.slice(0, 1).forEach((c) => {
    const top = c.top[0];
    partes.push(`En ${c.columna}, lo más frecuente es "${top.valor}" (${top.cantidad}).`);
  });
  return partes.join(' ');
}
