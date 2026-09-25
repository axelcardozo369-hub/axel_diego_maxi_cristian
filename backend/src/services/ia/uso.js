// ============================================================
// Registro en memoria de cada llamada a la IA (se reinicia al
// reiniciar el servidor). Lo muestra la página "Cómo funciona la IA"
// para entender qué pasó: quién respondió, cuánto tardó, qué falló.
// ============================================================
const eventos = [];
const contadores = new Map(); // "gemini" → { llamadas, exitos, cuota, errores }
let dia = new Date().toDateString();

function reiniciarSiCambioElDia() {
  const hoy = new Date().toDateString();
  if (hoy !== dia) { dia = hoy; contadores.clear(); }
}

export function registrarLlamada({ proveedor, modelo, tarea, ok, ms, error }) {
  reiniciarSiCambioElDia();
  const c = contadores.get(proveedor) || { llamadas: 0, exitos: 0, cuota: 0, errores: 0 };
  c.llamadas += 1;
  if (ok) c.exitos += 1;
  else if (error?.status === 429) c.cuota += 1;
  else c.errores += 1;
  contadores.set(proveedor, c);

  eventos.unshift({
    fecha: new Date().toISOString(),
    proveedor, modelo, tarea, ok, ms,
    error: ok ? null : error?.message?.slice(0, 200) || 'Error desconocido',
    status: error?.status ?? null,
  });
  eventos.length = Math.min(eventos.length, 25);
}

export function resumenDeUso() {
  reiniciarSiCambioElDia();
  return { hoy: Object.fromEntries(contadores), ultimos: eventos.slice(0, 15) };
}
