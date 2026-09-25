import { textoParaAnalizar } from './extractor.service.js';
import { ejecutarConIA, hayIA } from './ia/index.js';
import { ErrorIA, traducirError } from './ia/errores.js';
import { fragmentosRelevantes, normalizar, terminosDeConsulta } from '../utils/textoLocal.js';
import { aNumero } from '../utils/analizador.js';
import {
  nombreCanonico, prepararFuente, compararFuentes, consolidarFuentes, reporteDeComparacion, reporteDeConsolidacion,
} from '../utils/multifuente.js';

export const MODOS = {
  comparacion: { nombre: 'Comparación', consulta: '¿En qué se distinguen estas fuentes?' },
  consolidacion: { nombre: 'Consolidación', consulta: 'Consolidá la información y hacé un arqueo de movimientos.' },
  consulta: { nombre: 'Consulta sobre varias fuentes', consulta: '' },
};

const fmt = (n) => Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 });

// Consulta libre sin IA: resumen por fuente + filas y fragmentos que mencionan la pregunta
function reporteDeConsultaMultiple(fuentes, consulta, consolidado) {
  const terminos = terminosDeConsulta(consulta);
  const coinciden = (texto) => terminos.some((t) => normalizar(texto).includes(t));
  const filasRelacionadas = [];
  const hallazgos = [];
  let sumaMonto = 0;
  let conMonto = 0;
  const resumenFuentes = fuentes.map((f) => {
    if (f.tabla) {
      const filas = terminos.length ? f.tabla.filas.filter((fila) => coinciden(fila.join(' '))) : [];
      filas.slice(0, 20).forEach((fila) => filasRelacionadas.push([f.titulo, fila.join(' · ')]));
      // Si la fuente tiene una columna de monto (monto, importe, total...), se suman las filas relacionadas
      const iMonto = f.tabla.encabezados.findIndex((h) => nombreCanonico(h) === 'monto');
      if (iMonto >= 0) filas.forEach((fila) => { const n = aNumero(fila[iMonto]); if (n !== null) { sumaMonto += n; conMonto += 1; } });
      return [f.titulo, 'Tabla', fmt(f.tabla.filas.length), fmt(filas.length)];
    }
    const { fragmentos, coincidencias } = fragmentosRelevantes(f.texto, consulta, 4000);
    fragmentos.slice(0, 2).forEach((fr) => hallazgos.push(`${f.titulo}: ${fr.replace(/\s+/g, ' ').slice(0, 300)}…`));
    return [f.titulo, 'Texto', fmt((f.texto.match(/\S+/g) || []).length) + ' palabras', fmt(coincidencias)];
  });

  const base = consolidado?.tipo === 'tabla' ? reporteDeConsolidacion(consolidado, consulta) : null;
  const tablas_extra = [];
  if (filasRelacionadas.length) tablas_extra.push({ titulo: 'Registros relacionados con tu pregunta', columnas: ['Fuente', 'Registro'], filas: filasRelacionadas.slice(0, 60) });
  if (base) tablas_extra.push(base.tabla, ...base.tablas_extra);

  return {
    titulo: (consulta ? `Consulta: ${consulta}` : 'Consulta sobre varias fuentes').slice(0, 200),
    resumen_ejecutivo: `Se buscó tu pregunta en ${fuentes.length} fuentes: ${filasRelacionadas.length} registro(s) y ${hallazgos.length} fragmento(s) de texto la mencionan.${conMonto ? ` Esos registros suman $ ${fmt(sumaMonto)}.` : ''}${base ? ` Contexto general: ${base.resumen_ejecutivo}` : ''}`,
    indicadores: [
      { nombre: 'Fuentes consultadas', valor: fmt(fuentes.length), contexto: fuentes.map((f) => f.titulo).join(', ') },
      { nombre: 'Registros relacionados', valor: fmt(filasRelacionadas.length), contexto: 'Filas que mencionan tu pregunta.' },
      ...(conMonto ? [{ nombre: 'Monto de esos registros', valor: `$ ${fmt(sumaMonto)}`, contexto: `Suma de ${fmt(conMonto)} registro(s) relacionados.` }] : []),
      ...(base ? base.indicadores.slice(2) : []),
    ],
    hallazgos: [...hallazgos, ...(base ? base.hallazgos : [])],
    recomendaciones: base ? base.recomendaciones : [],
    tabla: { titulo: 'Fuentes consultadas', columnas: ['Fuente', 'Tipo', 'Tamaño', 'Coincidencias'], filas: resumenFuentes },
    tablas_extra,
  };
}

// Lo que se le manda a la IA: cálculos exactos + muestra chica de cada fuente
function contextoParaIA(fuentes, consulta) {
  const porFuente = Math.floor(18_000 / fuentes.length);
  return fuentes.map((f) => {
    if (f.tabla) {
      const filas = [f.tabla.encabezados, ...f.tabla.filas.slice(0, 25)].map((x) => x.join(' ; ')).join('\n');
      return `### FUENTE "${f.titulo}" (tabla, ${f.tabla.filas.length} filas)\n${filas.slice(0, porFuente)}`;
    }
    return `### FUENTE "${f.titulo}" (texto)\n${fragmentosRelevantes(f.texto, consulta, porFuente).texto}`;
  }).join('\n\n');
}

// Recorta listas largas para no mandar de más a la IA
const resumirParaIA = (resultado) => JSON.parse(JSON.stringify(resultado, (k, v) => {
  if (k === 'muestra_filas') return undefined;
  if (Array.isArray(v) && v.length > 30) return v.slice(0, 30);
  return v;
}));

// ============================================================
// Arma el BORRADOR de un reporte sobre varias fuentes (no lo guarda).
// 1. El motor local calcula todo con cifras exactas.
// 2. Si hay IA, redacta la respuesta usando esos cálculos.
// 3. Las tablas exactas del motor SIEMPRE van en el reporte.
// ============================================================
export async function generarBorradorMultiple({ fuentes, consulta, modo }) {
  const sinContenido = fuentes.filter((f) => !f.contenido_crudo);
  if (sinContenido.length) {
    throw new ErrorIA(`Estas fuentes todavía no tienen contenido legible: ${sinContenido.map((f) => f.titulo).join(', ')}. Esperá a que terminen de procesarse.`, 409);
  }
  const pregunta = consulta || MODOS[modo].consulta;
  const preparadas = fuentes.map((f) => prepararFuente(f, textoParaAnalizar(f)));

  let resultado;
  let local;
  if (modo === 'comparacion') {
    resultado = compararFuentes(preparadas[0], preparadas[1]);
    local = reporteDeComparacion(resultado, consulta);
  } else if (modo === 'consolidacion') {
    resultado = consolidarFuentes(preparadas, pregunta);
    local = reporteDeConsolidacion(resultado, consulta);
  } else {
    resultado = consolidarFuentes(preparadas, pregunta);
    local = reporteDeConsultaMultiple(preparadas, pregunta, resultado);
  }

  const lista = fuentes.map((f) => ({ id: f.id, titulo: f.titulo, identificador: f.identificador, tipo_fuente: f.tipo_fuente }));
  const base = {
    data_source_id: fuentes[0].id,
    data_source_ids: fuentes.map((f) => f.id),
    consulta: pregunta,
  };
  const tablasExactas = [local.tabla, ...local.tablas_extra].filter((t) => t?.columnas?.length && t.filas?.length);

  let aviso = null;
  if (hayIA()) {
    try {
      const { resultado: r, proveedor, modelo } = await ejecutarConIA('generarReporte', {
        fuente: {
          titulo: `${MODOS[modo].nombre} de ${fuentes.map((f) => `"${f.titulo}"`).join(', ')}`,
          tipo_fuente: 'varias fuentes',
          descripcion_ia: fuentes.map((f) => `${f.titulo} (${f.tipo_fuente}): ${f.descripcion_ia || 'sin descripción'}`).join(' | '),
        },
        consulta: `${pregunta} (Tarea: ${MODOS[modo].nombre.toLowerCase()} de varias fuentes. Los CÁLCULOS VERIFICADOS ya comparan/consolidan las fuentes: usalos tal cual.)`,
        texto: contextoParaIA(preparadas, pregunta),
        analisis: resumirParaIA(resultado),
        usarArchivo: false,
      });
      const { titulo, resumen_ejecutivo, tabla, ...resto } = r.reporte;
      const tablaIA = tabla?.columnas?.length && tabla?.filas?.length ? tabla : null;
      return {
        borrador: {
          ...base, titulo, resumen_ejecutivo, origen: 'ia', modelo_ia: `${proveedor} · ${modelo}`.slice(0, 80),
          metricas_clave: {
            tipo: 'reporte', modo, fuentes: lista, ...resto,
            tabla: tablaIA || tablasExactas[0] || { titulo: '', columnas: [], filas: [] },
            tablas_extra: tablaIA ? tablasExactas : tablasExactas.slice(1),
          },
        },
        aviso,
      };
    } catch (error) {
      aviso = `La IA no respondió (${traducirError(error).message}), así que el reporte lo armó el motor local.`;
    }
  }

  const { titulo, resumen_ejecutivo, tabla, tablas_extra, ...resto } = local;
  return {
    borrador: {
      ...base, titulo, resumen_ejecutivo, origen: 'local', modelo_ia: null,
      metricas_clave: {
        tipo: 'reporte', modo, fuentes: lista, ...resto, tabla, tablas_extra,
        limitaciones: ['Cifras calculadas por el motor local de InfoHub.', aviso].filter(Boolean).join(' '),
      },
    },
    aviso,
  };
}
