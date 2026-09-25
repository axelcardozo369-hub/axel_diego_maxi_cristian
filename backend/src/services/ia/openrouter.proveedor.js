import { ESQUEMA_IDENTIFICACION, ESQUEMA_REPORTE, promptIdentificacion, promptReporte, SISTEMA } from './prompts.js';
import { ErrorIA, traducirError } from './errores.js';

const ESQUEMA_PRUEBA = { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] };

function esquemaEstricto(esquema) {
  if (!esquema || typeof esquema !== 'object') return esquema;
  const salida = { ...esquema };
  delete salida.description;
  if (salida.type === 'object' && salida.properties) {
    salida.properties = Object.fromEntries(Object.entries(salida.properties).map(([k, v]) => [k, esquemaEstricto(v)]));
    salida.additionalProperties = false;
    salida.required = Object.keys(salida.properties);
  }
  if (salida.type === 'array' && salida.items) salida.items = esquemaEstricto(salida.items);
  return salida;
}

// Algunos modelos gratuitos envuelven el JSON en texto o en ```json ... ```
function extraerJSON(texto) {
  const limpio = String(texto || '').replace(/```(?:json)?/gi, '').trim();
  try { return JSON.parse(limpio); } catch { /* sigue */ }
  const inicio = limpio.indexOf('{');
  const fin = limpio.lastIndexOf('}');
  if (inicio >= 0 && fin > inicio) {
    try { return JSON.parse(limpio.slice(inicio, fin + 1)); } catch { /* sigue */ }
  }
  throw new ErrorIA('OpenRouter: el modelo no devolvió JSON válido.', 502);
}

// ============================================================
// OpenRouter (API compatible con OpenAI). Con el modelo
// "openrouter/free" elige solo un modelo gratuito disponible.
// Límites del plan gratis: 20 pedidos/minuto y 50 por día sin créditos.
// Trabaja con TEXTO: por eso se le mandan los fragmentos ya extraídos.
// ============================================================
export function crearProveedorOpenRouter({ apiKey, modelo = 'openrouter/free', siteUrl = '', siteName = 'InfoHub', baseUrl = 'https://openrouter.ai/api/v1' }) {
  async function pedir(body) {
    let respuesta;
    try {
      respuesta = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          ...(siteUrl ? { 'HTTP-Referer': siteUrl } : {}),
          'X-Title': siteName,
        },
        body: JSON.stringify(body),
      });
    } catch (error) {
      throw traducirError(error, 'OpenRouter');
    }
    const data = await respuesta.json().catch(() => null);
    if (respuesta.ok && !data?.error) return data;
    const error = new Error(data?.error?.message || `HTTP ${respuesta.status}`);
    error.status = data?.error?.code && Number.isInteger(data.error.code) ? data.error.code : respuesta.status;
    error.retryAfterSec = Number(respuesta.headers.get('retry-after')) || null;
    throw traducirError(error, 'OpenRouter');
  }

  async function generarJSON(contenido, esquema) {
    const mensajes = [{ role: 'system', content: SISTEMA }, { role: 'user', content: contenido }];
    let data;
    try {
      // 1er intento: JSON con esquema estricto (el router elige un modelo que lo soporte)
      data = await pedir({
        model: modelo,
        messages: mensajes,
        temperature: 0.2,
        response_format: { type: 'json_schema', json_schema: { name: 'infohub', strict: true, schema: esquemaEstricto(esquema) } },
        provider: { require_parameters: true },
      });
    } catch (error) {
      if ([429, 401, 402].includes(error.status)) throw error;
      // 2do intento: sin esquema, pidiendo el JSON en el texto (más modelos lo soportan)
      data = await pedir({
        model: modelo,
        messages: [...mensajes, { role: 'user', content: `Respondé SOLO con un objeto JSON válido con esta forma: ${JSON.stringify(esquemaEstricto(esquema))}` }],
        temperature: 0.2,
      });
    }
    const texto = data?.choices?.[0]?.message?.content;
    if (!texto) throw new ErrorIA('OpenRouter: el modelo no devolvió contenido.', 502);
    return { datos: extraerJSON(texto), modelo: data.model || modelo };
  }

  const sinArchivo = () => new ErrorIA('OpenRouter trabaja con texto: este archivo necesita Gemini.', 422);

  return {
    nombre: 'openrouter',
    modelo,
    aceptaArchivos: false,

    async identificar({ fuente, texto, usarArchivo }) {
      if (usarArchivo || !texto) throw sinArchivo();
      const prompt = `${promptIdentificacion({ nombre: fuente.archivo_nombre || fuente.titulo, tipo: fuente.tipo_fuente, conTexto: true })}\n\nCONTENIDO (muestra):\n${texto}`;
      const { datos, modelo: usado } = await generarJSON(prompt, ESQUEMA_IDENTIFICACION);
      return { resultado: { ...datos, ia_archivo: null }, modelo: usado };
    },

    async generarReporte({ fuente, consulta, texto, analisis, usarArchivo }) {
      if (usarArchivo && !texto) throw sinArchivo();
      const prompt = `${promptReporte({ consulta, fuente, analisis })}\n\nFRAGMENTOS DE LA FUENTE:\n${texto || '(sin texto)'}`;
      const { datos, modelo: usado } = await generarJSON(prompt, ESQUEMA_REPORTE);
      return { resultado: { reporte: datos, ia_archivo: null }, modelo: usado };
    },

    async probar() {
      const { modelo: usado } = await generarJSON('Respondé {"ok": true}', ESQUEMA_PRUEBA);
      return { modelo: usado };
    },
  };
}
