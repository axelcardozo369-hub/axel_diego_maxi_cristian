import { DataSource } from '../models/index.js';
import { detectarTipo } from '../utils/tiposArchivo.js';
import { analizarContenido, generarResumen } from '../utils/analizador.js';
import { describirLocalmente, muestra } from '../utils/textoLocal.js';
import { extraerTextoLocal, textoParaAnalizar } from './extractor.service.js';
import { ejecutarConIA, hayIA } from './ia/index.js';
import { MAX_MUESTRA_IDENTIFICACION } from './ia/prompts.js';
import { traducirError } from './ia/errores.js';

const enCurso = new Set();
const MAX_REINTENTOS = 3;

// Descripción y preguntas sugeridas SIN IA (siempre disponible)
function identificacionLocal(fuente, texto, detalle) {
  const analisis = analizarContenido(textoParaAnalizar({ ...fuente, contenido_crudo: texto }));
  if (analisis.tipo === 'tabla') {
    const numerica = analisis.numericas[0]?.columna;
    const categoria = analisis.categoricas[0]?.columna;
    return {
      descripcion: generarResumen(analisis, fuente.titulo),
      sugerencias: [
        numerica ? `¿Cuál es el total de ${numerica}?` : '¿Cuántos registros hay?',
        categoria ? `¿Qué valores de ${categoria} se repiten más?` : '¿Qué datos se repiten más?',
        '¿Hay registros duplicados o incompletos?',
      ],
    };
  }
  return describirLocalmente({ texto, tipo: fuente.tipo_fuente, titulo: fuente.titulo, detalle });
}

// ============================================================
// Procesa una fuente EN SEGUNDO PLANO. Orden:
//  1. LOCAL: extrae el texto (CSV, JSON, Excel, Word, PDF con texto).
//     Si hay texto, la fuente ya queda LISTA con una descripción local.
//  2. IA (opcional): mejora la descripción con una MUESTRA chica del texto.
//     Si la IA falla, no pasa nada: queda la versión local.
//  3. Solo los archivos sin texto (fotos, audio, video, PDF escaneado)
//     dependen de la IA. Si la cuota se agotó, se reintenta solo más tarde.
// ============================================================
export async function procesarFuente(id) {
  if (enCurso.has(id)) return;
  enCurso.add(id);
  try {
    const fuente = await DataSource.findByPk(id);
    if (!fuente) return;
    await fuente.update({ estado_ia: 'procesando', error_ia: null }, { silent: true });

    const deteccion = fuente.archivo_ruta ? detectarTipo(fuente.archivo_nombre, fuente.mime_type) : { modo: 'pegado' };
    const metadata = { ...(fuente.metadata || {}) };
    delete metadata.ia_aviso;
    delete metadata.proximo_reintento;
    const cambios = { metadata };

    // ---------- 1. Extracción local ----------
    let texto = fuente.contenido_crudo;
    if (fuente.archivo_ruta && deteccion.modo !== 'ia') {
      const extraido = await extraerTextoLocal(fuente.archivo_ruta, deteccion.modo);
      Object.assign(metadata, extraido.detalle);
      texto = extraido.texto;
      if (texto != null) cambios.contenido_crudo = texto;
    }

    if (texto) {
      const local = identificacionLocal(fuente.get(), texto, metadata);
      Object.assign(cambios, { descripcion_ia: local.descripcion, sugerencias: local.sugerencias, estado_ia: 'listo' });
      metadata.procesado_por = 'local';
    } else if (deteccion.modo === 'otro') {
      await fuente.update({ ...cambios, estado_ia: 'error', error_ia: 'Formato no reconocido: el archivo quedó guardado, pero no se puede leer su contenido.' }, { silent: true });
      return;
    }

    // ---------- 2 y 3. IA opcional ----------
    if (!hayIA()) {
      if (!texto) {
        cambios.estado_ia = 'sin_ia';
        cambios.error_ia = 'Este archivo no tiene texto legible (foto, audio, video o PDF escaneado): para leerlo hace falta configurar la IA.';
      }
      await fuente.update(cambios, { silent: true });
      return;
    }

    try {
      const { resultado, proveedor, modelo } = await ejecutarConIA('identificar', {
        fuente: { ...fuente.get(), ...cambios },
        texto: texto ? muestra(texto, MAX_MUESTRA_IDENTIFICACION) : null,
        usarArchivo: !texto,
      });
      cambios.descripcion_ia = resultado.descripcion;
      cambios.sugerencias = resultado.sugerencias?.slice(0, 5) ?? cambios.sugerencias;
      if (!texto && resultado.contenido_extraido) cambios.contenido_crudo = resultado.contenido_extraido;
      if (resultado.ia_archivo) cambios.ia_archivo = resultado.ia_archivo;
      Object.assign(metadata, { procesado_por: proveedor, modelo_ia: modelo, tipo_contenido: resultado.tipo_contenido, reintentos_ia: 0 });
      cambios.estado_ia = 'listo';
    } catch (error) {
      const e = traducirError(error);
      if (texto) {
        // La fuente YA sirve: solo se avisa que la IA no pudo mejorarla
        metadata.ia_aviso = `La IA no respondió (${e.message}). Se usó el análisis local.`;
      } else if (e.status === 429 && (metadata.reintentos_ia || 0) < MAX_REINTENTOS) {
        // Sin texto y sin cuota: se reintenta solo cuando el proveedor lo permita
        const espera = (e.retryAfterSec || 60) + 5;
        metadata.reintentos_ia = (metadata.reintentos_ia || 0) + 1;
        metadata.proximo_reintento = new Date(Date.now() + espera * 1000).toISOString();
        cambios.estado_ia = 'pendiente';
        cambios.error_ia = `${e.message}. Reintento automático ${metadata.reintentos_ia} de ${MAX_REINTENTOS}.`;
        setTimeout(() => { procesarFuente(id); }, espera * 1000);
      } else {
        cambios.estado_ia = 'error';
        cambios.error_ia = e.message;
      }
    }

    await fuente.update(cambios, { silent: true });
  } catch (error) {
    console.error(`✖ Error procesando fuente ${id}:`, error.message);
    await DataSource.update({ estado_ia: 'error', error_ia: traducirError(error).message }, { where: { id }, silent: true }).catch(() => {});
  } finally {
    enCurso.delete(id);
  }
}

export async function retomarPendientes() {
  const pendientes = await DataSource.findAll({ where: { estado_ia: ['pendiente', 'procesando'] }, attributes: ['id'] });
  pendientes.forEach((f) => { procesarFuente(f.id); });
  return pendientes.length;
}
