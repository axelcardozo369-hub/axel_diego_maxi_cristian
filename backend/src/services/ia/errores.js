// Error de IA con código HTTP, mensaje claro y (si se conoce) cuántos
// segundos pide el proveedor esperar antes de reintentar.
export class ErrorIA extends Error {
  constructor(mensaje, status = 502, { retryAfterSec = null, proveedor = null } = {}) {
    super(mensaje);
    this.status = status;
    this.retryAfterSec = retryAfterSec;
    this.proveedor = proveedor;
  }
}

// Google indica la espera como "retryDelay":"37s" dentro del mensaje de error
function segundosDeEspera(error) {
  if (error?.retryAfterSec) return error.retryAfterSec;
  const m = String(error?.message || '').match(/retry(?:Delay|[ _-]after)?["':\s]+(\d+(?:\.\d+)?)s?/i);
  return m ? Math.ceil(Number(m[1])) : null;
}

export function traducirError(error, proveedor = 'IA') {
  if (error instanceof ErrorIA) return error;
  const status = Number(error?.status ?? error?.code) || null;
  const texto = String(error?.message || '');
  const opciones = { retryAfterSec: segundosDeEspera(error), proveedor };

  if (status === 429 || /quota|rate.?limit|too many requests|resource.?exhausted/i.test(texto)) {
    const espera = opciones.retryAfterSec ? ` (pide esperar ${opciones.retryAfterSec} s)` : '';
    return new ErrorIA(`${proveedor}: se agotó la cuota gratuita${espera}`, 429, opciones);
  }
  if (status === 402) return new ErrorIA(`${proveedor}: la cuenta no tiene saldo para este modelo.`, 402, opciones);
  if (status === 400 && /api key|authentication|token/i.test(texto)) return new ErrorIA(`${proveedor}: la clave no es válida.`, 401, opciones);
  if (status === 401 || status === 403) return new ErrorIA(`${proveedor}: la clave no tiene permiso.`, 401, opciones);
  if (status === 404) return new ErrorIA(`${proveedor}: el modelo configurado no existe o no está disponible.`, 404, opciones);
  if (/fetch failed|ENOTFOUND|ECONNRESET|ETIMEDOUT|EAI_AGAIN/i.test(texto)) {
    return new ErrorIA(`${proveedor}: no hay conexión a internet desde el servidor.`, 503, opciones);
  }
  if ([408, 500, 502, 503, 504].includes(status)) return new ErrorIA(`${proveedor}: el servicio está saturado momentáneamente.`, status, opciones);
  return new ErrorIA(`${proveedor}: ${texto.slice(0, 200) || 'error desconocido'}`, 502, opciones);
}
