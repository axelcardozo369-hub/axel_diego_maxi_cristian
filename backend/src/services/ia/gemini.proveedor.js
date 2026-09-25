import { GoogleGenAI, FileState, createPartFromUri, createUserContent } from '@google/genai';
import { SISTEMA, ESQUEMA_IDENTIFICACION, ESQUEMA_REPORTE, promptIdentificacion, promptReporte } from './prompts.js';
import { ErrorIA, traducirError } from './errores.js';

const esperar = (ms) => new Promise((r) => { setTimeout(r, ms); });
const ESQUEMA_PRUEBA = { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] };

// ============================================================
// Google Gemini (tier gratuito de AI Studio).
// GEMINI_MODEL admite VARIOS modelos separados por coma: si uno responde
// 429 (sin cuota), se prueba el siguiente en vez de insistir con el mismo.
// ============================================================
export function crearProveedorGemini({ apiKey, modelos, baseUrl }) {
  const ai = new GoogleGenAI({ apiKey, ...(baseUrl ? { httpOptions: { baseUrl } } : {}) });
  const lista = modelos.length ? modelos : ['gemini-3.5-flash-lite'];

  // Un solo reintento, y solo ante saturación momentánea (500/503).
  // Ante 429 NO se reintenta: reintentar gasta más cuota y vuelve a fallar.
  async function unaVez(fn) {
    try {
      return await fn();
    } catch (error) {
      if ([500, 503].includes(Number(error?.status))) {
        await esperar(1500);
        try { return await fn(); } catch (e) { throw traducirError(e, 'Gemini'); }
      }
      throw traducirError(error, 'Gemini');
    }
  }

  async function subirArchivo({ ruta, mimeType, nombre }) {
    let archivo = await unaVez(() => ai.files.upload({ file: ruta, config: { mimeType, displayName: nombre } }));
    const inicio = Date.now();
    while (archivo.state === FileState.PROCESSING) {
      if (Date.now() - inicio > 15 * 60 * 1000) throw new ErrorIA('Gemini: el archivo tardó demasiado en procesarse.', 504);
      await esperar(3000);
      archivo = await unaVez(() => ai.files.get({ name: archivo.name }));
    }
    if (archivo.state === FileState.FAILED) throw new ErrorIA('Gemini: no pudo leer este archivo.', 422);
    return { name: archivo.name, uri: archivo.uri, mimeType: archivo.mimeType, expira: archivo.expirationTime };
  }

  async function referenciaVigente(fuente) {
    const ref = fuente.ia_archivo;
    const vigente = ref?.uri && ref.expira && new Date(ref.expira).getTime() - Date.now() > 10 * 60 * 1000;
    if (vigente) return { ref, renovada: false };
    if (!fuente.archivo_ruta) return { ref: null, renovada: false };
    return { ref: await subirArchivo({ ruta: fuente.archivo_ruta, mimeType: fuente.mime_type, nombre: fuente.archivo_nombre }), renovada: true };
  }

  // Prueba los modelos en orden; ante 429 o 404 pasa al siguiente
  async function generarJSON(partes, esquema) {
    let ultimo;
    for (const modelo of lista) {
      try {
        const respuesta = await unaVez(() => ai.models.generateContent({
          model: modelo,
          contents: createUserContent(partes),
          config: { systemInstruction: SISTEMA, responseMimeType: 'application/json', responseJsonSchema: esquema, temperature: 0.2 },
        }));
        try {
          return { datos: JSON.parse(respuesta.text), modelo };
        } catch {
          throw new ErrorIA('Gemini: devolvió una respuesta incompleta.', 502);
        }
      } catch (error) {
        ultimo = error;
        if (![429, 404].includes(error.status)) throw error;
      }
    }
    throw ultimo;
  }

  return {
    nombre: 'gemini',
    modelo: lista.join(' → '),
    aceptaArchivos: true,

    async identificar({ fuente, texto, usarArchivo }) {
      const partes = [];
      let ia_archivo = null;
      if (usarArchivo) {
        const { ref } = await referenciaVigente(fuente);
        ia_archivo = ref;
        partes.push(createPartFromUri(ref.uri, ref.mimeType));
      }
      partes.push(promptIdentificacion({ nombre: fuente.archivo_nombre || fuente.titulo, tipo: fuente.tipo_fuente, conTexto: Boolean(texto) }));
      if (texto) partes.push(`CONTENIDO (muestra):\n${texto}`);
      const { datos, modelo } = await generarJSON(partes, ESQUEMA_IDENTIFICACION);
      return { resultado: { ...datos, ia_archivo }, modelo };
    },

    async generarReporte({ fuente, consulta, texto, analisis, usarArchivo }) {
      const partes = [];
      let ia_archivo = null;
      if (usarArchivo) {
        const { ref, renovada } = await referenciaVigente(fuente);
        if (ref) {
          partes.push(createPartFromUri(ref.uri, ref.mimeType));
          if (renovada) ia_archivo = ref;
        }
      }
      partes.push(promptReporte({ consulta, fuente, analisis }));
      if (texto) partes.push(`FRAGMENTOS DE LA FUENTE:\n${texto}`);
      const { datos, modelo } = await generarJSON(partes, ESQUEMA_REPORTE);
      return { resultado: { reporte: datos, ia_archivo }, modelo };
    },

    // Pedido mínimo para verificar clave, modelo y cuota
    async probar() {
      const { modelo } = await generarJSON(['Respondé {"ok": true}'], ESQUEMA_PRUEBA);
      return { modelo };
    },
  };
}
