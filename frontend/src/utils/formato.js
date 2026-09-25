export const fecha = (iso) =>
  new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });

export const haceDias = (iso) => {
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (dias <= 0) return 'hoy';
  if (dias === 1) return 'ayer';
  return `hace ${dias} días`;
};

export const numero = (n) => Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 });

export const tamano = (bytes) => {
  if (bytes == null) return '';
  const unidades = ['B', 'KB', 'MB', 'GB'];
  let valor = Number(bytes);
  let i = 0;
  while (valor >= 1024 && i < unidades.length - 1) { valor /= 1024; i += 1; }
  return `${valor.toLocaleString('es-AR', { maximumFractionDigits: i ? 1 : 0 })} ${unidades[i]}`;
};

export const TIPOS_FUENTE = {
  planilla: { texto: 'Planilla', icono: 'bi-table' },
  json: { texto: 'JSON', icono: 'bi-braces' },
  pdf: { texto: 'PDF', icono: 'bi-file-earmark-pdf' },
  imagen: { texto: 'Imagen', icono: 'bi-image' },
  audio: { texto: 'Audio', icono: 'bi-mic' },
  video: { texto: 'Video', icono: 'bi-camera-video' },
  documento: { texto: 'Documento', icono: 'bi-file-earmark-text' },
  texto: { texto: 'Texto', icono: 'bi-card-text' },
  otro: { texto: 'Otro', icono: 'bi-file-earmark' },
};

// Adivina el tipo en el navegador (solo para mostrarlo antes de subir; decide el servidor)
export function tipoPorNombre(nombre = '', mime = '') {
  const ext = nombre.split('.').pop().toLowerCase();
  if (['csv', 'tsv', 'xlsx', 'xls', 'ods'].includes(ext)) return 'planilla';
  if (ext === 'json') return 'json';
  if (ext === 'pdf' || mime === 'application/pdf') return 'pdf';
  if (ext === 'docx') return 'documento';
  if (mime.startsWith('image/')) return 'imagen';
  if (mime.startsWith('audio/') || ['opus', 'm4a'].includes(ext)) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('text/') || ['txt', 'md', 'xml', 'html'].includes(ext)) return 'texto';
  return 'otro';
}

export const ESTADOS_IA = {
  pendiente: { texto: 'En cola', clase: 'ia-proceso' },
  procesando: { texto: 'Identificando', clase: 'ia-proceso' },
  listo: { texto: 'Identificada', clase: 'ia-listo' },
  sin_ia: { texto: 'Sin IA', clase: 'ia-sin' },
  error: { texto: 'Error', clase: 'ia-error' },
};

export const ESTADOS = {
  borrador: { texto: 'Borrador', clase: 'estado-borrador' },
  publicado: { texto: 'Publicado', clase: 'estado-publicado' },
  archivado: { texto: 'Archivado', clase: 'estado-archivado' },
};

export const TIPOS_ORGANIZACION = {
  emprendimiento: 'Emprendimiento',
  organizacion: 'Organización',
  institucion: 'Institución',
  comunidad: 'Comunidad',
};

export const puedeEditar = (usuario) => ['admin', 'editor'].includes(usuario?.rol);

export const enProceso = (fuente) => ['pendiente', 'procesando'].includes(fuente?.estado_ia);

// Quién hizo el trabajo: el análisis local o un proveedor de IA
export const MOTORES = {
  local: { texto: 'Análisis local', icono: 'bi-cpu' },
  gemini: { texto: 'Gemini', icono: 'bi-stars' },
  openrouter: { texto: 'OpenRouter', icono: 'bi-stars' },
  simulado: { texto: 'Simulado', icono: 'bi-joystick' },
};

export const hora = (iso) => new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
