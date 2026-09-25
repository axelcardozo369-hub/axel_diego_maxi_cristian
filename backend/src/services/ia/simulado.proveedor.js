import { generarResumen } from '../../utils/analizador.js';

// ============================================================
// Proveedor SIMULADO: responde sin internet con datos coherentes.
// Sirve para la demo si no hay conexión y para las pruebas.
// Devuelve exactamente la misma forma que Gemini.
// ============================================================
const SUGERENCIAS = {
  planilla: ['¿Cuáles son los totales por categoría?', '¿Qué registros tienen datos incompletos?', '¿Cómo cambió en el tiempo?'],
  json: ['¿Qué registros se repiten?', '¿Cuáles son los valores más frecuentes?', '¿Qué campos faltan completar?'],
  pdf: ['¿Cuáles son los puntos principales?', '¿Qué fechas y montos aparecen?', '¿Qué decisiones hay pendientes?'],
  imagen: ['¿Qué datos se ven en la imagen?', '¿Qué montos y fechas aparecen?', '¿Hay algo que requiera atención?'],
  audio: ['¿Qué temas se trataron?', '¿Qué compromisos se asumieron?', '¿Quiénes participaron?'],
  video: ['¿Qué se muestra en el video?', '¿Qué temas se tratan?', '¿Qué acciones se proponen?'],
  documento: ['¿Cuáles son los puntos principales?', '¿Qué tareas quedaron asignadas?', '¿Qué fechas importan?'],
  texto: ['¿Cuáles son los puntos principales?', '¿Qué problemas se mencionan?', '¿Qué acciones se proponen?'],
  otro: ['¿Qué contiene este archivo?', '¿Qué datos útiles tiene?', '¿Qué falta para poder usarlo?'],
};

export function crearProveedorSimulado() {
  return {
    nombre: 'simulado',
    modelo: 'simulado',
    aceptaArchivos: true,

    async probar() { return { modelo: 'simulado' }; },

    async identificar({ fuente, texto }) {
      const nombre = fuente.archivo_nombre || fuente.titulo;
      return { modelo: 'simulado', resultado: {
        tipo_contenido: `${fuente.tipo_fuente} (modo simulado)`,
        descripcion: texto
          ? `"${nombre}" contiene ${texto.split(/\r?\n/).filter(Boolean).length} líneas de información. Identificación generada en modo simulado.`
          : `"${nombre}" es un archivo de tipo ${fuente.tipo_fuente}. En modo simulado no se extrae su contenido real: configurá GEMINI_API_KEY.`,
        contenido_extraido: texto ? '' : `[Contenido de ${nombre} no disponible en modo simulado]`,
        sugerencias: SUGERENCIAS[fuente.tipo_fuente] || SUGERENCIAS.otro,
        ia_archivo: null,
      } };
    },

    async generarReporte({ fuente, consulta, analisis }) {
      const indicadores = [];
      const hallazgos = [];
      if (analisis?.tipo === 'tabla') {
        indicadores.push({ nombre: 'Registros', valor: String(analisis.filas), contexto: 'Filas con datos en la fuente.' });
        indicadores.push({ nombre: 'Datos completos', valor: `${analisis.completitud_pct}%`, contexto: 'Porcentaje de celdas con contenido.' });
        analisis.numericas.slice(0, 2).forEach((c) => indicadores.push({ nombre: `Total de ${c.columna}`, valor: String(c.suma), contexto: `Promedio ${c.promedio}.` }));
        analisis.categoricas.slice(0, 2).forEach((c) => hallazgos.push(`En ${c.columna}, lo más frecuente es "${c.top[0].valor}" (${c.top[0].cantidad}).`));
        if (analisis.filas_duplicadas) hallazgos.push(`Hay ${analisis.filas_duplicadas} registros duplicados.`);
      }
      const categoria = analisis?.categoricas?.[0];
      return { modelo: 'simulado', resultado: {
        reporte: {
          titulo: `Respuesta: ${consulta.slice(0, 60)}`,
          resumen_ejecutivo: analisis?.tipo === 'tabla'
            ? `${generarResumen(analisis, fuente.titulo)} (Respuesta simulada: con GEMINI_API_KEY la IA responde exactamente a tu consulta.)`
            : `Respuesta simulada para "${consulta}". Configurá GEMINI_API_KEY para obtener el análisis real de "${fuente.titulo}".`,
          indicadores,
          hallazgos,
          recomendaciones: ['Revisar los registros incompletos antes de la próxima reunión.', 'Actualizar la fuente con la misma frecuencia con que se usa.'],
          tabla: categoria
            ? { titulo: `Valores más frecuentes de ${categoria.columna}`, columnas: [categoria.columna, 'Cantidad'], filas: categoria.top.map((t) => [t.valor, String(t.cantidad)]) }
            : { titulo: '', columnas: [], filas: [] },
          limitaciones: 'Modo simulado: la respuesta no interpreta la consulta. Configurá GEMINI_API_KEY para respuestas reales.',
        },
        ia_archivo: null,
      } };
    },
  };
}
