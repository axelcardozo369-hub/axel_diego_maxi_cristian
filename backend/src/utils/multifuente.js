// ============================================================
// MOTOR MULTIFUENTE (100% local, cifras exactas)
//  - compararFuentes(a, b): en qué se distinguen dos fuentes
//  - consolidarFuentes([...]): une varias fuentes (JSON, CSV, Excel)
//    y arma un arqueo por sucursal (u otro grupo)
// La IA, si está disponible, solo REDACTA a partir de estos resultados.
// ============================================================
import { leerTabla, analizarContenido, aNumero } from './analizador.js';
import { normalizar, terminosDeConsulta } from './textoLocal.js';

// Nombres de columna distintos que significan lo mismo
const SINONIMOS = {
  sucursal: ['sucursal', 'sucursales', 'local', 'sede', 'tienda', 'branch', 'punto_de_venta', 'punto_venta', 'filial', 'nombre_sucursal'],
  monto: ['monto', 'importe', 'total', 'valor', 'amount', 'precio_total', 'monto_total', 'importe_total', 'subtotal'],
  tipo: ['tipo', 'movimiento', 'tipo_movimiento', 'tipo_de_movimiento', 'operacion', 'tipo_operacion', 'naturaleza'],
  fecha: ['fecha', 'dia', 'date', 'fecha_movimiento', 'fecha_operacion'],
  cantidad: ['cantidad', 'unidades', 'qty', 'cant'],
  producto: ['producto', 'articulo', 'item'],
  medio_pago: ['medio_pago', 'medio_de_pago', 'forma_pago', 'forma_de_pago', 'metodo_pago'],
};
const NOMBRES_CLAVE = /^(id|codigo|cod|nro|numero|n_operacion|nro_operacion|id_venta|id_movimiento|comprobante|factura|dni|cuit|legajo|email)$/;
const POSITIVOS = /ingres|entrada|venta|cobr|credit|deposit|aporte|cuota/;
const NEGATIVOS = /egres|salida|gasto|pago|compra|debit|retiro|extraccion|devolucion/;

export const claveColumna = (h) => normalizar(h).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

export function nombreCanonico(h) {
  const c = claveColumna(h);
  for (const [canon, lista] of Object.entries(SINONIMOS)) if (lista.includes(c)) return canon;
  return c;
}

const fmt = (n) => Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 });

// Valor comparable: "$ 1.500" y "1500" son el mismo número; " Ana " y "ana" el mismo texto
const valorNormalizado = (v) => {
  const n = aNumero(v);
  if (n !== null) return `n:${n}`;
  return `t:${normalizar(v).trim().replace(/\s+/g, ' ')}`;
};

// Tabla con columnas renombradas a su nombre canónico
function canonizar(tabla) {
  const renombres = [];
  const columnas = tabla.encabezados.map((h) => {
    const canon = nombreCanonico(h);
    if (canon !== claveColumna(h)) renombres.push({ original: h, canonica: canon });
    return canon;
  });
  const filas = tabla.filas.map((f) => Object.fromEntries(columnas.map((c, i) => [c, f[i] ?? ''])));
  return { columnas: [...new Set(columnas)], filas, renombres };
}

const esNumerica = (filas, col) => {
  const valores = filas.map((f) => f[col]).filter((v) => String(v ?? '').trim() !== '');
  return valores.length > 0 && valores.filter((v) => aNumero(v) !== null).length / valores.length >= 0.8;
};

const sumar = (filas, col) => filas.reduce((t, f) => t + (aNumero(f[col]) ?? 0), 0);

// Resta de multiconjuntos: cuántas veces aparece cada firma en A que no está en B
function restar(firmasA, firmasB) {
  const cuenta = new Map();
  firmasB.forEach((f) => cuenta.set(f, (cuenta.get(f) || 0) + 1));
  const sobrantes = [];
  firmasA.forEach((f, i) => {
    const n = cuenta.get(f) || 0;
    if (n > 0) cuenta.set(f, n - 1);
    else sobrantes.push(i);
  });
  return sobrantes;
}

// Prepara una fuente del modelo para el motor: tabla (si la hay) + texto
export function prepararFuente(fuente, textoTabla) {
  const texto = fuente.contenido_crudo || '';
  const tabla = textoTabla ? leerTabla(textoTabla) : null;
  return {
    id: fuente.id,
    titulo: fuente.titulo,
    tipo_fuente: fuente.tipo_fuente,
    identificador: fuente.identificador,
    texto,
    tabla: tabla && tabla.filas.length ? tabla : null,
    analisis: textoTabla ? analizarContenido(textoTabla) : null,
  };
}

// ============================================================
// COMPARACIÓN
// ============================================================
function compararTablas(a, b) {
  const ca = canonizar(a.tabla);
  const cb = canonizar(b.tabla);
  const comunes = ca.columnas.filter((c) => cb.columnas.includes(c));
  const soloA = ca.columnas.filter((c) => !cb.columnas.includes(c));
  const soloB = cb.columnas.filter((c) => !ca.columnas.includes(c));

  const firmaNorm = (f) => comunes.map((c) => valorNormalizado(f[c])).join('|');
  const firmaCruda = (f) => comunes.map((c) => String(f[c] ?? '').trim()).join('|');
  const normA = ca.filas.map(firmaNorm);
  const normB = cb.filas.map(firmaNorm);

  const indicesSoloA = restar(normA, normB);
  const indicesSoloB = restar(normB, normA);
  const coincidentes = ca.filas.length - indicesSoloA.length;

  // Filas iguales en contenido pero escritas distinto ("$1.500" vs "1500", " ana" vs "Ana")
  const crudasB = new Set(cb.filas.map(firmaCruda));
  const soloAIdx = new Set(indicesSoloA);
  const cambiosFormato = ca.filas.filter((f, i) => !soloAIdx.has(i) && !crudasB.has(firmaCruda(f))).length;

  // Columna clave (id, código...): casi siempre distinta en ambas fuentes.
  // Se toleran algunos repetidos: justamente la fuente "sucia" puede tener duplicados.
  const casiUnica = (filas, c) => {
    const valores = filas.map((f) => String(f[c] ?? '').trim()).filter(Boolean);
    return valores.length >= filas.length * 0.9 && new Set(valores).size >= valores.length * 0.8;
  };
  const clave = comunes.find((c) => NOMBRES_CLAVE.test(c) && casiUnica(ca.filas, c) && casiUnica(cb.filas, c)) || null;

  let modificados = [];
  let nuevos = [];
  let eliminados = [];
  if (clave) {
    // Con claves repetidas se toma la primera aparición (el resto cuenta como duplicado)
    const primeraAparicion = (filas) => {
      const mapa = new Map();
      filas.forEach((f) => { const k = valorNormalizado(f[clave]); if (!mapa.has(k)) mapa.set(k, f); });
      return mapa;
    };
    const mapaB = primeraAparicion(cb.filas);
    const mapaA = primeraAparicion(ca.filas);
    for (const [k, filaA] of mapaA) {
      const filaB = mapaB.get(k);
      if (!filaB) { eliminados.push(filaA); continue; }
      comunes.forEach((c) => {
        if (c !== clave && valorNormalizado(filaA[c]) !== valorNormalizado(filaB[c])) {
          modificados.push({ clave: filaA[clave], columna: c, antes: filaA[c] || '(vacío)', despues: filaB[c] || '(vacío)' });
        }
      });
    }
    nuevos = [...mapaB.entries()].filter(([k]) => !mapaA.has(k)).map(([, f]) => f);
  }

  // Nombre original de cada columna (para mostrar "total" y no "monto")
  const etiqueta = (c) => a.tabla.encabezados.find((h) => nombreCanonico(h) === c) || c;
  const totales = comunes
    .filter((c) => c !== clave && !NOMBRES_CLAVE.test(c))
    .filter((c) => esNumerica(ca.filas, c) || esNumerica(cb.filas, c))
    .map((c) => {
      const ta = sumar(ca.filas, c);
      const tb = sumar(cb.filas, c);
      return { columna: etiqueta(c), a: ta, b: tb, diferencia: tb - ta };
    });

  // Solo interesan las equivalencias entre nombres DISTINTOS de una fuente a otra
  const origenes = new Map();
  [...ca.renombres, ...cb.renombres].forEach((x) => origenes.set(x.canonica, new Set([...(origenes.get(x.canonica) || []), x.original])));
  const renombres = [...origenes.entries()].filter(([, set]) => set.size > 1).map(([canonica, set]) => ({ original: [...set].join(' / '), canonica }));

  return {
    modo: 'comparacion',
    tipo: 'tabla',
    fuentes: [a, b].map((f) => ({
      titulo: f.titulo,
      filas: f.tabla.filas.length,
      columnas: f.tabla.encabezados.length,
      duplicados: f.analisis?.filas_duplicadas ?? 0,
      celdas_vacias: f.analisis?.celdas_vacias ?? 0,
      completitud_pct: f.analisis?.completitud_pct ?? 100,
    })),
    columnas: { comunes: comunes.map(etiqueta), solo_a: soloA, solo_b: soloB, renombres },
    filas: { coincidentes, solo_a: indicesSoloA.length, solo_b: indicesSoloB.length, cambios_formato: cambiosFormato },
    clave,
    modificados: modificados.length,
    registros_modificados: new Set(modificados.map((m) => String(m.clave))).size,
    nuevos: nuevos.length,
    eliminados: eliminados.length,
    totales,
    ejemplos: {
      columnas: comunes.map(etiqueta),
      cambios_columnas: modificados.slice(0, 30).map((m) => ({ ...m, columna: etiqueta(m.columna) })),
      nuevos: nuevos.slice(0, 15).map((f) => comunes.map((c) => f[c])),
      eliminados: eliminados.slice(0, 15).map((f) => comunes.map((c) => f[c])),
      solo_a: indicesSoloA.slice(0, 15).map((i) => comunes.map((c) => ca.filas[i][c])),
      solo_b: indicesSoloB.slice(0, 15).map((i) => comunes.map((c) => cb.filas[i][c])),
      cambios: modificados.slice(0, 30),
    },
  };
}

function compararTextos(a, b) {
  const lineas = (t) => t.split(/\r?\n/).map((l) => normalizar(l).trim()).filter(Boolean);
  const la = lineas(a.texto);
  const lb = lineas(b.texto);
  const setA = new Set(la);
  const setB = new Set(lb);
  const comunes = [...setA].filter((l) => setB.has(l));
  const union = new Set([...la, ...lb]).size || 1;
  const originales = (t) => new Map(t.split(/\r?\n/).map((l) => [normalizar(l).trim(), l.trim()]));
  const oa = originales(a.texto);
  const ob = originales(b.texto);
  return {
    modo: 'comparacion',
    tipo: 'texto',
    fuentes: [a, b].map((f) => ({ titulo: f.titulo, lineas: lineas(f.texto).length, palabras: (f.texto.match(/\S+/g) || []).length })),
    similitud_pct: Math.round((comunes.length / union) * 1000) / 10,
    lineas_comunes: comunes.length,
    solo_a: [...setA].filter((l) => !setB.has(l)).slice(0, 20).map((l) => oa.get(l)),
    solo_b: [...setB].filter((l) => !setA.has(l)).slice(0, 20).map((l) => ob.get(l)),
    total_solo_a: [...setA].filter((l) => !setB.has(l)).length,
    total_solo_b: [...setB].filter((l) => !setA.has(l)).length,
  };
}

export function compararFuentes(a, b) {
  return a.tabla && b.tabla ? compararTablas(a, b) : compararTextos(a, b);
}

// ============================================================
// CONSOLIDACIÓN (arqueo)
// ============================================================
export function consolidarFuentes(fuentes, consulta = '') {
  const conTabla = fuentes.filter((f) => f.tabla).map((f) => ({ f, c: canonizar(f.tabla) }));
  const sinTabla = fuentes.filter((f) => !f.tabla).map((f) => f.titulo);
  if (conTabla.length === 0) return { modo: 'consolidacion', tipo: 'sin_tablas', sin_tabla: sinTabla };

  const filas = conTabla.flatMap(({ f, c }) => c.filas.map((fila) => ({ ...fila, __fuente: f.titulo })));
  const presencia = new Map(); // columna → en cuántas fuentes está
  conTabla.forEach(({ c }) => c.columnas.forEach((col) => presencia.set(col, (presencia.get(col) || 0) + 1)));
  const todas = [...presencia.keys()];
  const enTodas = todas.filter((c) => presencia.get(c) === conTabla.length);

  // Columna para agrupar: "sucursal" si existe; si no, la que nombre la consulta; si no, una categórica común
  const terminos = terminosDeConsulta(consulta);
  const categoricas = todas.filter((c) => !esNumerica(filas, c) && c !== 'fecha' && presencia.get(c) >= Math.min(2, conTabla.length));
  const grupo = (presencia.has('sucursal') && 'sucursal')
    || categoricas.find((c) => terminos.some((t) => c.includes(t)))
    || categoricas.find((c) => {
      const distintos = new Set(filas.map((f) => normalizar(f[c] || ''))).size;
      return distintos > 1 && distintos <= Math.max(12, filas.length / 3);
    })
    || null;

  const monto = (presencia.has('monto') && 'monto') || todas.find((c) => esNumerica(filas, c) && c !== 'cantidad') || null;
  const tipo = presencia.has('tipo') ? 'tipo' : null;

  // Signo de cada movimiento: por la columna "tipo" (ingreso/egreso) o por el signo del monto
  const signo = (fila) => {
    const valor = aNumero(fila[monto]);
    if (valor === null) return { valor: null, clase: 'sin_monto' };
    if (tipo) {
      const t = normalizar(fila.tipo || '');
      if (NEGATIVOS.test(t)) return { valor: Math.abs(valor), clase: 'egreso' };
      if (POSITIVOS.test(t)) return { valor: Math.abs(valor), clase: 'ingreso' };
    }
    return valor < 0 ? { valor: Math.abs(valor), clase: 'egreso' } : { valor, clase: 'ingreso' };
  };
  const hayEgresos = monto && filas.some((f) => signo(f).clase === 'egreso');

  const grupos = new Map();
  const nombreGrupo = (fila) => (grupo ? String(fila[grupo] || '').trim() || '(sin dato)' : 'Total');
  for (const fila of filas) {
    const g = nombreGrupo(fila);
    const clave = normalizar(g);
    if (!grupos.has(clave)) grupos.set(clave, { nombre: g, registros: 0, ingresos: 0, egresos: 0, sin_monto: 0, por_fuente: {} });
    const acc = grupos.get(clave);
    acc.registros += 1;
    acc.por_fuente[fila.__fuente] = (acc.por_fuente[fila.__fuente] || 0) + 1;
    if (monto) {
      const { valor, clase } = signo(fila);
      if (clase === 'ingreso') acc.ingresos += valor;
      else if (clase === 'egreso') acc.egresos += valor;
      else acc.sin_monto += 1;
    }
  }
  const lista = [...grupos.values()]
    .map((g) => ({ ...g, saldo: g.ingresos - g.egresos }))
    .sort((x, y) => y.saldo - x.saldo);

  const total = lista.reduce((t, g) => ({
    registros: t.registros + g.registros,
    ingresos: t.ingresos + g.ingresos,
    egresos: t.egresos + g.egresos,
    sin_monto: t.sin_monto + g.sin_monto,
  }), { registros: 0, ingresos: 0, egresos: 0, sin_monto: 0 });
  total.saldo = total.ingresos - total.egresos;

  const fechas = filas.map((f) => String(f.fecha || '')).filter((f) => /^\d{4}-\d{2}-\d{2}/.test(f)).sort();

  return {
    modo: 'consolidacion',
    tipo: 'tabla',
    fuentes: conTabla.map(({ f }) => ({ titulo: f.titulo, filas: f.tabla.filas.length, columnas: f.tabla.encabezados })),
    sin_tabla: sinTabla,
    renombres: conTabla.flatMap(({ f, c }) => c.renombres.map((r) => ({ fuente: f.titulo, ...r }))),
    columnas_en_todas: enTodas,
    agrupado_por: grupo,
    columna_monto: monto,
    columna_tipo: tipo,
    con_egresos: Boolean(hayEgresos),
    grupos: lista,
    total,
    fechas: fechas.length ? { desde: fechas[0].slice(0, 10), hasta: fechas.at(-1).slice(0, 10) } : null,
    muestra_filas: filas.slice(0, 40),
  };
}

// ============================================================
// Resultados → partes de reporte (indicadores, hallazgos, tablas)
// ============================================================
export function reporteDeComparacion(r, consulta) {
  const [A, B] = r.fuentes;
  const indicadores = [];
  const hallazgos = [];
  const recomendaciones = [];
  const tablas_extra = [];
  let tabla;

  if (r.tipo === 'tabla') {
    const quitados = Math.max(A.duplicados - B.duplicados, 0);
    const iguales = r.clave ? r.filas.coincidentes : r.filas.coincidentes;
    indicadores.push({ nombre: 'Registros', valor: `${fmt(A.filas)} → ${fmt(B.filas)}`, contexto: `${A.titulo} → ${B.titulo}.` });
    indicadores.push({ nombre: 'Mismo contenido', valor: fmt(iguales), contexto: r.filas.cambios_formato ? `${fmt(r.filas.cambios_formato)} de ellos solo cambian el formato (espacios, mayúsculas, "$ 4.500" vs 4500).` : 'Idénticos en ambas fuentes.' });
    if (r.clave) {
      indicadores.push({ nombre: 'Con valores distintos', valor: fmt(r.registros_modificados), contexto: `Mismo "${r.clave}", datos cambiados (${fmt(r.modificados)} celdas).` });
      if (quitados) indicadores.push({ nombre: 'Duplicados quitados', valor: fmt(quitados), contexto: `${A.titulo} los tenía repetidos.` });
      if (r.nuevos) indicadores.push({ nombre: `Nuevos en ${B.titulo}`, valor: fmt(r.nuevos), contexto: `No estaban en ${A.titulo}.` });
      if (r.eliminados) indicadores.push({ nombre: `No están en ${B.titulo}`, valor: fmt(r.eliminados), contexto: `Estaban en ${A.titulo}.` });
    } else {
      indicadores.push({ nombre: `Solo en ${A.titulo}`, valor: fmt(r.filas.solo_a), contexto: 'No están (igual) en la otra fuente.' });
      indicadores.push({ nombre: `Solo en ${B.titulo}`, valor: fmt(r.filas.solo_b), contexto: 'No están (igual) en la otra fuente.' });
    }

    if (A.duplicados !== B.duplicados) hallazgos.push(`Duplicados: ${fmt(A.duplicados)} en ${A.titulo} y ${fmt(B.duplicados)} en ${B.titulo}.`);
    if (A.celdas_vacias !== B.celdas_vacias) hallazgos.push(`Celdas vacías: ${fmt(A.celdas_vacias)} en ${A.titulo} (${fmt(A.completitud_pct)}% completo) y ${fmt(B.celdas_vacias)} en ${B.titulo} (${fmt(B.completitud_pct)}% completo).`);
    if (r.filas.cambios_formato) hallazgos.push(`${fmt(r.filas.cambios_formato)} registro(s) tienen el mismo dato escrito distinto: se normalizó el formato.`);
    if (r.columnas.solo_a.length) hallazgos.push(`Columnas que solo tiene ${A.titulo}: ${r.columnas.solo_a.join(', ')}.`);
    if (r.columnas.solo_b.length) hallazgos.push(`Columnas que solo tiene ${B.titulo}: ${r.columnas.solo_b.join(', ')}.`);
    if (r.columnas.renombres.length) hallazgos.push(`Columnas equivalentes: ${r.columnas.renombres.map((x) => `${x.original} (${x.canonica})`).join(', ')}.`);
    r.totales.filter((t) => t.diferencia !== 0).forEach((t) => hallazgos.push(`La suma de la columna "${t.columna}" pasa de ${fmt(t.a)} a ${fmt(t.b)} (diferencia ${t.diferencia > 0 ? '+' : ''}${fmt(t.diferencia)}).`));
    if (!hallazgos.length) hallazgos.push('Las dos fuentes tienen el mismo contenido.');

    if (r.registros_modificados || r.filas.solo_a || r.filas.solo_b) recomendaciones.push('Revisar los registros con valores distintos antes de usar los datos para decidir.');
    if (B.duplicados < A.duplicados || B.celdas_vacias < A.celdas_vacias) recomendaciones.push(`Usar ${B.titulo} como versión de trabajo: tiene menos duplicados o celdas vacías.`);
    else if (A.duplicados < B.duplicados || A.celdas_vacias < B.celdas_vacias) recomendaciones.push(`Usar ${A.titulo} como versión de trabajo: tiene menos duplicados o celdas vacías.`);

    tabla = {
      titulo: 'Resumen comparativo',
      columnas: ['Indicador', A.titulo, B.titulo],
      filas: [
        ['Registros', fmt(A.filas), fmt(B.filas)],
        ['Columnas', fmt(A.columnas), fmt(B.columnas)],
        ['Duplicados', fmt(A.duplicados), fmt(B.duplicados)],
        ['Celdas vacías', fmt(A.celdas_vacias), fmt(B.celdas_vacias)],
        ['Datos completos', `${fmt(A.completitud_pct)}%`, `${fmt(B.completitud_pct)}%`],
        ...r.totales.map((t) => [`Suma de "${t.columna}"`, fmt(t.a), fmt(t.b)]),
      ],
    };
    if (r.ejemplos.cambios_columnas.length) tablas_extra.push({ titulo: `Valores distintos (comparando por ${r.clave})`, columnas: [r.clave, 'Columna', A.titulo, B.titulo], filas: r.ejemplos.cambios_columnas.map((c) => [c.clave, c.columna, c.antes, c.despues]) });
    if (r.clave) {
      if (r.ejemplos.nuevos.length) tablas_extra.push({ titulo: `Nuevos en ${B.titulo}`, columnas: r.ejemplos.columnas, filas: r.ejemplos.nuevos });
      if (r.ejemplos.eliminados.length) tablas_extra.push({ titulo: `No están en ${B.titulo}`, columnas: r.ejemplos.columnas, filas: r.ejemplos.eliminados });
    } else {
      if (r.ejemplos.solo_a.length) tablas_extra.push({ titulo: `Registros solo en ${A.titulo}`, columnas: r.ejemplos.columnas, filas: r.ejemplos.solo_a });
      if (r.ejemplos.solo_b.length) tablas_extra.push({ titulo: `Registros solo en ${B.titulo}`, columnas: r.ejemplos.columnas, filas: r.ejemplos.solo_b });
    }
  } else {
    indicadores.push({ nombre: 'Similitud', valor: `${fmt(r.similitud_pct)}%`, contexto: 'Líneas en común sobre el total de líneas distintas.' });
    indicadores.push({ nombre: `Solo en ${A.titulo}`, valor: fmt(r.total_solo_a), contexto: 'Líneas.' });
    indicadores.push({ nombre: `Solo en ${B.titulo}`, valor: fmt(r.total_solo_b), contexto: 'Líneas.' });
    hallazgos.push(`${A.titulo} tiene ${fmt(A.palabras)} palabras y ${B.titulo} tiene ${fmt(B.palabras)}.`);
    tabla = { titulo: 'Líneas distintas', columnas: [`Solo en ${A.titulo}`, `Solo en ${B.titulo}`], filas: Array.from({ length: Math.max(r.solo_a.length, r.solo_b.length) }, (_, i) => [r.solo_a[i] || '', r.solo_b[i] || '']).slice(0, 20) };
  }

  return {
    titulo: consulta ? `Comparación: ${consulta}`.slice(0, 200) : `Comparación de ${A.titulo} y ${B.titulo}`.slice(0, 200),
    resumen_ejecutivo: r.tipo !== 'tabla' ? `Los textos comparten el ${fmt(r.similitud_pct)}% de sus líneas.`
      : r.clave
        ? `${A.titulo} tiene ${fmt(A.filas)} registros y ${B.titulo} ${fmt(B.filas)}. Comparando por "${r.clave}": ${fmt(r.filas.coincidentes)} tienen el mismo contenido${r.filas.cambios_formato ? ` (${fmt(r.filas.cambios_formato)} con otro formato)` : ''}, ${fmt(r.registros_modificados)} tienen valores distintos${Math.max(A.duplicados - B.duplicados, 0) ? `, se quitaron ${fmt(A.duplicados - B.duplicados)} duplicado(s)` : ''}, ${fmt(r.nuevos)} son nuevos y ${fmt(r.eliminados)} ya no están.`
        : `${A.titulo} tiene ${fmt(A.filas)} registros y ${B.titulo} ${fmt(B.filas)}. Coinciden ${fmt(r.filas.coincidentes)}; ${fmt(r.filas.solo_a)} están solo en la primera y ${fmt(r.filas.solo_b)} solo en la segunda.${r.filas.cambios_formato ? ` ${fmt(r.filas.cambios_formato)} tienen el mismo dato con otro formato.` : ''}`,
    indicadores, hallazgos, recomendaciones, tabla, tablas_extra,
  };
}

export function reporteDeConsolidacion(r, consulta) {
  if (r.tipo === 'sin_tablas') {
    return {
      titulo: 'Consolidación', resumen_ejecutivo: 'Ninguna de las fuentes elegidas tiene datos en forma de tabla para consolidar.',
      indicadores: [], hallazgos: [], recomendaciones: ['Elegí fuentes CSV, JSON o Excel.'], tabla: { titulo: '', columnas: [], filas: [] }, tablas_extra: [],
    };
  }
  const nombreGrupo = r.agrupado_por ? r.agrupado_por.replace(/_/g, ' ') : 'grupo';
  const Grupo = nombreGrupo.charAt(0).toUpperCase() + nombreGrupo.slice(1);
  const indicadores = [
    { nombre: 'Fuentes consolidadas', valor: fmt(r.fuentes.length), contexto: r.fuentes.map((f) => f.titulo).join(', ') },
    { nombre: 'Movimientos', valor: fmt(r.total.registros), contexto: r.fechas ? `Del ${r.fechas.desde} al ${r.fechas.hasta}.` : 'Registros unificados.' },
  ];
  const hallazgos = [];
  const recomendaciones = [];
  let tabla;

  if (r.columna_monto) {
    if (r.con_egresos) {
      indicadores.push({ nombre: 'Ingresos', valor: `$ ${fmt(r.total.ingresos)}`, contexto: 'Suma de todas las fuentes.' });
      indicadores.push({ nombre: 'Egresos', valor: `$ ${fmt(r.total.egresos)}`, contexto: 'Suma de todas las fuentes.' });
      indicadores.push({ nombre: 'Saldo', valor: `$ ${fmt(r.total.saldo)}`, contexto: 'Ingresos menos egresos.' });
    } else {
      indicadores.push({ nombre: `Total de ${r.columna_monto}`, valor: `$ ${fmt(r.total.ingresos)}`, contexto: 'Suma de todas las fuentes.' });
    }
    tabla = {
      titulo: `Arqueo por ${nombreGrupo}`,
      columnas: r.con_egresos ? [Grupo, 'Movimientos', 'Ingresos', 'Egresos', 'Saldo'] : [Grupo, 'Movimientos', `Total ${r.columna_monto}`],
      filas: [
        ...r.grupos.map((g) => (r.con_egresos
          ? [g.nombre, fmt(g.registros), fmt(g.ingresos), fmt(g.egresos), fmt(g.saldo)]
          : [g.nombre, fmt(g.registros), fmt(g.ingresos)])),
        r.con_egresos
          ? ['TOTAL', fmt(r.total.registros), fmt(r.total.ingresos), fmt(r.total.egresos), fmt(r.total.saldo)]
          : ['TOTAL', fmt(r.total.registros), fmt(r.total.ingresos)],
      ],
    };
    if (r.grupos.length > 1 && r.agrupado_por) {
      const mejor = r.grupos[0];
      const peor = r.grupos.at(-1);
      hallazgos.push(`${mejor.nombre} tiene el mayor ${r.con_egresos ? 'saldo' : 'total'}: $ ${fmt(r.con_egresos ? mejor.saldo : mejor.ingresos)}.`);
      hallazgos.push(`${peor.nombre} tiene el menor ${r.con_egresos ? 'saldo' : 'total'}: $ ${fmt(r.con_egresos ? peor.saldo : peor.ingresos)}.`);
      const negativos = r.grupos.filter((g) => r.con_egresos && g.saldo < 0);
      if (negativos.length) recomendaciones.push(`Revisar ${negativos.map((g) => g.nombre).join(', ')}: gastó más de lo que ingresó.`);
    }
    if (r.total.sin_monto) {
      hallazgos.push(`${fmt(r.total.sin_monto)} movimiento(s) no tienen ${r.columna_monto} y no se sumaron.`);
      recomendaciones.push(`Completar el ${r.columna_monto} de los movimientos vacíos para cerrar el arqueo.`);
    }
  } else {
    tabla = { titulo: `Registros por ${nombreGrupo}`, columnas: [Grupo, 'Registros'], filas: r.grupos.map((g) => [g.nombre, fmt(g.registros)]) };
    hallazgos.push('Ninguna columna numérica común para sumar montos: se contaron registros.');
  }

  if (r.renombres.length) hallazgos.push(`Se unificaron ${fmt(r.renombres.length)} columnas que tenían otro nombre (por ejemplo "${r.renombres[0].original}" como "${r.renombres[0].canonica}"). Detalle en la tabla de columnas equivalentes.`);
  if (r.sin_tabla.length) hallazgos.push(`No se consolidaron por no tener tabla: ${r.sin_tabla.join(', ')}.`);
  const soloEnUna = r.grupos.filter((g) => Object.keys(g.por_fuente).length === 1 && r.fuentes.length > 1 && r.agrupado_por);
  if (soloEnUna.length && soloEnUna.length < r.grupos.length) hallazgos.push(`Aparecen en una sola fuente: ${soloEnUna.map((g) => `${g.nombre} (${Object.keys(g.por_fuente)[0]})`).join(', ')}.`);

  const tablas_extra = [];
  if (r.agrupado_por && r.fuentes.length > 1) {
    tablas_extra.push({
      titulo: `Movimientos por fuente y ${nombreGrupo}`,
      columnas: [Grupo, ...r.fuentes.map((f) => f.titulo)],
      filas: r.grupos.map((g) => [g.nombre, ...r.fuentes.map((f) => fmt(g.por_fuente[f.titulo] || 0))]),
    });
  }
  if (r.renombres.length) {
    tablas_extra.push({ titulo: 'Columnas equivalentes detectadas', columnas: ['Fuente', 'Columna original', 'Se unificó como'], filas: r.renombres.map((x) => [x.fuente, x.original, x.canonica]) });
  }

  const resumenMonto = r.columna_monto
    ? (r.con_egresos
      ? ` Ingresos $ ${fmt(r.total.ingresos)}, egresos $ ${fmt(r.total.egresos)} y saldo $ ${fmt(r.total.saldo)}.`
      : ` El total de ${r.columna_monto} es $ ${fmt(r.total.ingresos)}.`)
    : '';
  return {
    titulo: (consulta ? `Consolidado: ${consulta}` : `Arqueo consolidado por ${nombreGrupo}`).slice(0, 200),
    resumen_ejecutivo: `Se consolidaron ${fmt(r.total.registros)} movimientos de ${fmt(r.fuentes.length)} fuentes${r.agrupado_por ? `, agrupados por ${nombreGrupo} (${fmt(r.grupos.length)})` : ''}.${resumenMonto}`,
    indicadores, hallazgos, recomendaciones, tabla, tablas_extra,
  };
}
