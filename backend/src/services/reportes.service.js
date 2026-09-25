import { analizarContenido, leerTabla, aNumero, generarResumen } from '../utils/analizador.js';
import { fragmentosRelevantes, normalizar, terminosDeConsulta, palabrasClave } from '../utils/textoLocal.js';
import { textoParaAnalizar } from './extractor.service.js';
import { ejecutarConIA, hayIA } from './ia/index.js';
import { MAX_FRAGMENTOS_REPORTE } from './ia/prompts.js';
import { ErrorIA, traducirError } from './ia/errores.js';

const numero = (n) => Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 });
const recortar = (t, n) => (t.length > n ? `${t.slice(0, n).trim()}…` : t);

// Filas de una tabla que mencionan algún término de la consulta
function filasQueCoinciden(tabla, terminos) {
  if (!terminos.length) return [];
  return tabla.filas.filter((fila) => {
    const texto = normalizar(fila.join(' '));
    return terminos.some((t) => texto.includes(t));
  });
}

// Qué se le manda a la IA: SOLO lo relevante para la pregunta
function contextoParaIA(fuente, consulta, base) {
  const tabla = base ? leerTabla(base) : null;
  if (tabla) {
    const coinciden = filasQueCoinciden(tabla, terminosDeConsulta(consulta));
    const filas = [...coinciden.slice(0, 150), ...tabla.filas.slice(0, 20)];
    const unicas = [...new Map(filas.map((f) => [f.join('|'), f])).values()];
    return [
      `Columnas: ${tabla.encabezados.join(' ; ')}`,
      `Total de filas: ${tabla.filas.length}. Filas que mencionan la consulta: ${coinciden.length}.`,
      'Filas (las que coinciden y una muestra):',
      ...unicas.map((f) => f.join(' ; ')),
    ].join('\n');
  }
  if (fuente.contenido_crudo) return fragmentosRelevantes(fuente.contenido_crudo, consulta, MAX_FRAGMENTOS_REPORTE).texto;
  return null;
}

// ============================================================
// MOTOR LOCAL: responde sin IA buscando en la fuente lo que
// menciona la consulta y calculando cifras exactas sobre eso.
// ============================================================
export function reporteLocal(analisis, fuente, consulta = '', aviso = '') {
  const terminos = terminosDeConsulta(consulta);
  const base = textoParaAnalizar(fuente);
  const tabla = base ? leerTabla(base) : null;
  const r = { indicadores: [], hallazgos: [], recomendaciones: [], tabla: { titulo: '', columnas: [], filas: [] } };
  let resumen;

  if (tabla && analisis?.tipo === 'tabla') {
    const coinciden = filasQueCoinciden(tabla, terminos);
    const usadas = coinciden.length ? coinciden : tabla.filas;
    r.indicadores.push({ nombre: 'Registros en la fuente', valor: numero(tabla.filas.length), contexto: `${tabla.encabezados.length} columnas.` });
    if (terminos.length) {
      r.indicadores.push({ nombre: 'Relacionados con tu pregunta', valor: numero(coinciden.length), contexto: coinciden.length ? 'Filas que mencionan lo que preguntaste.' : 'Ninguna fila lo menciona: se muestran todas.' });
    }
    // Totales de las columnas numéricas sobre las filas que coinciden
    analisis.numericas.slice(0, 3).forEach((col) => {
      const i = tabla.encabezados.indexOf(col.columna);
      const valores = usadas.map((f) => aNumero(f[i])).filter((n) => n !== null);
      if (!valores.length) return;
      const suma = valores.reduce((a, b) => a + b, 0);
      r.indicadores.push({ nombre: `Total de ${col.columna}`, valor: numero(suma), contexto: `${coinciden.length ? 'En las filas relacionadas' : 'En toda la fuente'} · promedio ${numero(suma / valores.length)}.` });
    });
    analisis.categoricas.slice(0, 2).forEach((c) => r.hallazgos.push(`En ${c.columna}, lo más frecuente es "${c.top[0].valor}" (${c.top[0].cantidad} de ${analisis.filas}).`));
    analisis.fechas.slice(0, 1).forEach((f) => r.hallazgos.push(`Los datos van del ${f.desde} al ${f.hasta}.`));
    if (analisis.filas_duplicadas) r.recomendaciones.push(`Revisar ${analisis.filas_duplicadas} registro(s) duplicado(s).`);
    if (analisis.completitud_pct < 95) r.recomendaciones.push(`Completar las ${analisis.celdas_vacias} celdas vacías para que los totales sean confiables.`);
    r.tabla = {
      titulo: coinciden.length ? 'Registros relacionados con tu pregunta' : 'Primeros registros',
      columnas: tabla.encabezados,
      filas: usadas.slice(0, 50),
    };
    resumen = coinciden.length
      ? `Encontramos ${coinciden.length} de ${tabla.filas.length} registros relacionados con tu pregunta. ${generarResumen(analisis, fuente.titulo)}`
      : generarResumen(analisis, fuente.titulo);
  } else {
    const texto = fuente.contenido_crudo || '';
    const { fragmentos, coincidencias } = fragmentosRelevantes(texto, consulta, 6000);
    r.indicadores.push({ nombre: 'Palabras en la fuente', valor: numero((texto.match(/\S+/g) || []).length), contexto: fuente.metadata?.paginas ? `${fuente.metadata.paginas} páginas.` : '' });
    if (terminos.length) r.indicadores.push({ nombre: 'Fragmentos relacionados', valor: numero(coincidencias), contexto: 'Partes del texto que mencionan tu pregunta.' });
    fragmentos.slice(0, 4).forEach((f) => r.hallazgos.push(recortar(f.replace(/\s+/g, ' '), 350)));
    const temas = palabrasClave(texto, 6);
    if (temas.length) r.recomendaciones.push(`Temas principales para profundizar: ${temas.join(', ')}.`);
    resumen = coincidencias
      ? `Encontramos ${coincidencias} fragmento(s) de "${fuente.titulo}" relacionados con tu pregunta. Abajo están los más relevantes.`
      : `${fuente.descripcion_ia || fuente.titulo} No encontramos fragmentos que mencionen directamente tu pregunta.`;
  }

  return {
    titulo: recortar(consulta ? `Sobre: ${consulta}` : `Resumen de ${fuente.titulo}`, 200),
    resumen_ejecutivo: resumen,
    ...r,
    limitaciones: [
      'Respuesta del motor local: busca coincidencias y calcula cifras exactas, pero no interpreta la pregunta como lo haría la IA.',
      aviso,
    ].filter(Boolean).join(' '),
  };
}

// Solo se manda el archivo original si no hay texto que alcance (o si es una foto)
const debeUsarArchivo = (f) => Boolean(f.archivo_ruta) && (f.tipo_fuente === 'imagen' || !f.contenido_crudo);

// Arma el BORRADOR del reporte (no lo guarda). Nunca se traba: si la IA
// falla y hay texto, responde el motor local y avisa por qué.
export async function generarBorrador({ fuente, consulta }) {
  const base = textoParaAnalizar(fuente);
  const analisis = base ? analizarContenido(base) : null;
  const calculos = analisis?.tipo === 'tabla' ? { ...analisis, encabezados: undefined } : null;

  let aviso = '';
  if (hayIA()) {
    try {
      const { resultado, proveedor, modelo } = await ejecutarConIA('generarReporte', {
        fuente, consulta,
        texto: contextoParaIA(fuente, consulta, base),
        analisis: calculos,
        usarArchivo: debeUsarArchivo(fuente),
      });
      const { titulo, resumen_ejecutivo, ...resto } = resultado.reporte;
      return {
        borrador: {
          data_source_id: fuente.id, consulta, titulo, resumen_ejecutivo,
          origen: 'ia', modelo_ia: `${proveedor} · ${modelo}`.slice(0, 80),
          metricas_clave: { tipo: 'reporte', ...resto, analisis_local: calculos },
        },
        ia_archivo: resultado.ia_archivo,
        aviso: null,
      };
    } catch (error) {
      aviso = `La IA no respondió (${traducirError(error).message}), así que contestó el motor local.`;
      if (!fuente.contenido_crudo) throw new ErrorIA(`${aviso} Esta fuente no tiene texto para el motor local; probá de nuevo en un rato.`, error.status || 503);
    }
  }

  if (!fuente.contenido_crudo) {
    throw new ErrorIA('Esta fuente no tiene texto legible (foto, audio, video o PDF escaneado): para analizarla hace falta la IA.', 503);
  }
  const local = reporteLocal(analisis, fuente, consulta, aviso);
  const { titulo, resumen_ejecutivo, ...resto } = local;
  return {
    borrador: {
      data_source_id: fuente.id, consulta, titulo, resumen_ejecutivo,
      origen: 'local', modelo_ia: null,
      metricas_clave: { tipo: 'reporte', ...resto, analisis_local: calculos },
    },
    ia_archivo: null,
    aviso: aviso || null,
  };
}
