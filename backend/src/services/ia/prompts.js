// ============================================================
// Instrucciones y esquemas JSON que se le dan al modelo.
// Pedir JSON con esquema obliga a la IA a responder siempre
// con la misma forma, así el backend y el frontend no se rompen.
// ============================================================

export const SISTEMA = `Sos el analista de datos de InfoHub. Ayudás a organizaciones chicas
(comisiones vecinales, emprendimientos, cooperativas, escuelas, clubes) a transformar
información dispersa en información útil para decidir.
Reglas:
- Escribí en español rioplatense, claro y sin tecnicismos.
- Usá SOLO la información de la fuente. Si algo no está, decilo; nunca inventes datos ni cifras.
- Si te doy "CÁLCULOS VERIFICADOS", usalos como verdad para totales, promedios, mínimos, máximos y conteos.
- Sé concreto: números con su unidad, nombres, fechas.`;

export const ESQUEMA_IDENTIFICACION = {
  type: 'object',
  properties: {
    tipo_contenido: { type: 'string', description: 'Qué es, en pocas palabras. Ej: "planilla de cuotas sociales", "acta de reunión", "foto de un ticket", "audio de asamblea".' },
    descripcion: { type: 'string', description: '2 o 3 oraciones: de qué trata, qué período cubre y qué datos contiene.' },
    contenido_extraido: { type: 'string', description: 'Todo el contenido útil en texto. Tablas como CSV con separador ; y encabezado. Audio/video: transcripción. Imagen: texto visible y descripción. Vacío si el texto ya fue provisto.' },
    sugerencias: { type: 'array', items: { type: 'string' }, description: '3 preguntas concretas y útiles que alguien de la organización podría hacerle a esta fuente.' },
  },
  required: ['tipo_contenido', 'descripcion', 'contenido_extraido', 'sugerencias'],
};

export const promptIdentificacion = ({ nombre, tipo, conTexto }) => `Identificá esta fuente de información.
Nombre del archivo: "${nombre}". Tipo detectado: ${tipo}.
${conTexto
    ? 'Te paso su contenido como texto: NO lo repitas, devolvé contenido_extraido como cadena vacía.'
    : `Extraé TODO el contenido útil en contenido_extraido:
- si hay tablas (en PDF o imágenes), transcribilas completas como CSV con separador ; y una fila de encabezado;
- si es audio o video, transcribí lo que se dice y anotá lo relevante que se ve;
- si es una imagen, transcribí el texto visible y describí lo importante.`}`;

export const ESQUEMA_REPORTE = {
  type: 'object',
  properties: {
    titulo: { type: 'string', description: 'Título corto del reporte (máximo 10 palabras).' },
    resumen_ejecutivo: { type: 'string', description: 'Respuesta directa a la consulta en 3 a 6 oraciones, con las cifras clave.' },
    indicadores: {
      type: 'array',
      description: 'De 2 a 6 cifras clave que responden la consulta.',
      items: {
        type: 'object',
        properties: {
          nombre: { type: 'string' },
          valor: { type: 'string', description: 'Valor con unidad. Ej: "$ 9.500", "3 socios", "68%".' },
          contexto: { type: 'string', description: 'Una frase que explica el valor.' },
        },
        required: ['nombre', 'valor', 'contexto'],
      },
    },
    hallazgos: { type: 'array', items: { type: 'string' }, description: 'Hechos concretos encontrados en los datos, con números.' },
    recomendaciones: { type: 'array', items: { type: 'string' }, description: 'Acciones concretas y realistas para la organización.' },
    tabla: {
      type: 'object',
      description: 'Tabla que ayude a responder (por ejemplo, un ranking o un detalle). Si no hace falta, columnas y filas vacías.',
      properties: {
        titulo: { type: 'string' },
        columnas: { type: 'array', items: { type: 'string' } },
        filas: { type: 'array', items: { type: 'array', items: { type: 'string' } } },
      },
      required: ['titulo', 'columnas', 'filas'],
    },
    limitaciones: { type: 'string', description: 'Qué no se pudo responder o qué datos faltan. Vacío si no hay.' },
  },
  required: ['titulo', 'resumen_ejecutivo', 'indicadores', 'hallazgos', 'recomendaciones', 'tabla', 'limitaciones'],
};

export const promptReporte = ({ consulta, fuente, analisis }) => `CONSULTA DEL USUARIO: "${consulta}"

FUENTE: "${fuente.titulo}" (${fuente.tipo_fuente}).
${fuente.descripcion_ia ? `Descripción: ${fuente.descripcion_ia}` : ''}
${analisis ? `\nCÁLCULOS VERIFICADOS (hechos localmente, usalos tal cual):\n${JSON.stringify(analisis)}` : ''}

Respondé exactamente lo que pide la consulta a partir de la fuente.`;

// Tamaños chicos a propósito: menos tokens por pedido = la cuota gratuita rinde más
export const MAX_MUESTRA_IDENTIFICACION = 8_000;
export const MAX_FRAGMENTOS_REPORTE = 20_000;
