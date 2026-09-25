import { env } from '../../config/env.js';
import { crearProveedorGemini } from './gemini.proveedor.js';
import { crearProveedorOpenRouter } from './openrouter.proveedor.js';
import { crearProveedorSimulado } from './simulado.proveedor.js';
import { ErrorIA } from './errores.js';
import { registrarLlamada, resumenDeUso } from './uso.js';

// ============================================================
// CADENA DE PROVEEDORES
//   IA_PROVEEDOR=auto       → Gemini → OpenRouter (los que tengan clave)
//   IA_PROVEEDOR=gemini     → solo Gemini
//   IA_PROVEEDOR=openrouter → solo OpenRouter
//   IA_PROVEEDOR=simulado   → respuestas de ejemplo (sin internet)
//   IA_PROVEEDOR=ninguno    → sin IA: todo con el motor local
// Si todos fallan, quien llama usa el motor LOCAL: el sistema nunca se traba.
// ============================================================
function armarCadena() {
  const gemini = env.GEMINI_API_KEY
    ? crearProveedorGemini({ apiKey: env.GEMINI_API_KEY, modelos: env.GEMINI_MODELOS, baseUrl: env.GEMINI_BASE_URL })
    : null;
  const openrouter = env.OPENROUTER_API_KEY
    ? crearProveedorOpenRouter({ apiKey: env.OPENROUTER_API_KEY, modelo: env.OPENROUTER_MODEL, siteUrl: env.OPENROUTER_SITE_URL, siteName: env.OPENROUTER_SITE_NAME, baseUrl: env.OPENROUTER_BASE_URL })
    : null;

  switch (env.IA_PROVEEDOR) {
    case 'simulado': return [crearProveedorSimulado()];
    case 'gemini': return [gemini].filter(Boolean);
    case 'openrouter': return [openrouter].filter(Boolean);
    case 'auto': return [gemini, openrouter].filter(Boolean);
    default: return [];
  }
}

const cadena = armarCadena();
const NOMBRES = { gemini: 'Gemini', openrouter: 'OpenRouter', simulado: 'Simulado' };
const nombreVisible = (p) => NOMBRES[p.nombre] || p.nombre;

// Espera anti-429: si un proveedor respondió "sin cuota", se lo saltea
// durante el tiempo que pidió (o 60 s) en vez de golpearlo de nuevo.
const pausadoHasta = new Map();
const estaPausado = (p) => (pausadoHasta.get(p.nombre) || 0) > Date.now();

export const hayIA = () => cadena.length > 0;
export const hayIAParaArchivos = () => cadena.some((p) => p.aceptaArchivos);

// Ejecuta una tarea ('identificar' | 'generarReporte') probando la cadena.
// Devuelve { resultado, proveedor, modelo } o lanza el último error.
export async function ejecutarConIA(tarea, args) {
  const candidatos = cadena.filter((p) => !args.usarArchivo || p.aceptaArchivos || args.texto);
  if (candidatos.length === 0) {
    throw new ErrorIA(args.usarArchivo
      ? 'Este archivo necesita una IA que lea archivos (configurá GEMINI_API_KEY).'
      : 'No hay ningún proveedor de IA configurado.', 503);
  }

  const errores = [];
  for (const proveedor of candidatos) {
    if (estaPausado(proveedor)) {
      const seg = Math.ceil((pausadoHasta.get(proveedor.nombre) - Date.now()) / 1000);
      errores.push(new ErrorIA(`${nombreVisible(proveedor)} está en pausa ${seg} s por límite de cuota`, 429, { retryAfterSec: seg }));
      continue;
    }
    const inicio = Date.now();
    try {
      // Si este proveedor no lee archivos pero hay texto, trabaja con el texto
      const argsProveedor = proveedor.aceptaArchivos ? args : { ...args, usarArchivo: false };
      const { resultado, modelo } = await proveedor[tarea](argsProveedor);
      registrarLlamada({ proveedor: proveedor.nombre, modelo, tarea, ok: true, ms: Date.now() - inicio });
      return { resultado, proveedor: proveedor.nombre, modelo };
    } catch (error) {
      registrarLlamada({ proveedor: proveedor.nombre, modelo: proveedor.modelo, tarea, ok: false, ms: Date.now() - inicio, error });
      if (error.status === 429) pausadoHasta.set(proveedor.nombre, Date.now() + (error.retryAfterSec || 60) * 1000);
      errores.push(error);
    }
  }
  // Un solo error que nombra a todos los proveedores que fallaron
  const todosSinCuota = errores.every((e) => e.status === 429);
  const espera = Math.min(...errores.map((e) => e.retryAfterSec || 60));
  throw new ErrorIA(errores.map((e) => e.message).join(' · '), todosSinCuota ? 429 : errores.at(-1).status, { retryAfterSec: espera });
}

// Pedido mínimo a cada proveedor para verificar clave, modelo y cuota
export async function probarProveedores() {
  const resultados = [];
  for (const p of cadena) {
    const inicio = Date.now();
    try {
      const { modelo } = await p.probar();
      registrarLlamada({ proveedor: p.nombre, modelo, tarea: 'probar', ok: true, ms: Date.now() - inicio });
      pausadoHasta.delete(p.nombre);
      resultados.push({ proveedor: p.nombre, ok: true, modelo, ms: Date.now() - inicio, mensaje: 'Responde correctamente' });
    } catch (error) {
      registrarLlamada({ proveedor: p.nombre, modelo: p.modelo, tarea: 'probar', ok: false, ms: Date.now() - inicio, error });
      resultados.push({ proveedor: p.nombre, ok: false, modelo: p.modelo, ms: Date.now() - inicio, status: error.status, mensaje: error.message });
    }
  }
  return resultados;
}

export const estadoIA = () => ({
  configurada: cadena.length > 0,
  modo: env.IA_PROVEEDOR,
  proveedor: cadena.map(nombreVisible).join(' → ') || 'ninguno',
  modelo: cadena[0]?.modelo ?? null,
  proveedores: cadena.map((p) => ({
    nombre: p.nombre,
    modelo: p.modelo,
    lee_archivos: p.aceptaArchivos,
    en_pausa_hasta: estaPausado(p) ? new Date(pausadoHasta.get(p.nombre)).toISOString() : null,
  })),
  uso: resumenDeUso(),
  motivo: cadena.length ? null
    : env.IA_PROVEEDOR === 'ninguno'
      ? 'IA desactivada (IA_PROVEEDOR=ninguno). Todo funciona con el motor local.'
      : 'No hay claves configuradas (GEMINI_API_KEY u OPENROUTER_API_KEY). Todo funciona con el motor local.',
});
