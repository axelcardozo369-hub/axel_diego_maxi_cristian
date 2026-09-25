// ============================================================
// Servicio centralizado de API: el ÚNICO archivo que usa fetch.
// Agrega el token, serializa JSON y convierte errores en ApiError.
// ============================================================
const BASE_URL = import.meta.env.VITE_API_URL || '/api';
const CLAVE_TOKEN = 'infohub_token';

export const tokenStorage = {
  get: () => localStorage.getItem(CLAVE_TOKEN),
  set: (token) => localStorage.setItem(CLAVE_TOKEN, token),
  clear: () => localStorage.removeItem(CLAVE_TOKEN),
};

// Conserva el código HTTP y el array de errores de express-validator
export class ApiError extends Error {
  constructor(message, status, errors = []) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

async function request(endpoint, { method = 'GET', body } = {}) {
  const token = tokenStorage.get();
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${BASE_URL}${endpoint}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('No hay conexión con el servidor. Revisá que el backend esté encendido.', 0);
  }

  let data = null;
  try { data = await response.json(); } catch { /* respuesta sin cuerpo */ }

  if (!response.ok) {
    // Sesión vencida: avisamos a toda la app para que cierre sesión
    if (response.status === 401 && token) window.dispatchEvent(new Event('sesion:expirada'));
    const mensaje = data?.message
      || (data?.errors ? 'Revisá los datos marcados en el formulario' : 'No se pudo completar la operación');
    throw new ApiError(mensaje, response.status, data?.errors || []);
  }
  return data;
}

const queryString = (filtros = {}) => {
  const params = new URLSearchParams(
    Object.entries(filtros).filter(([, v]) => v !== '' && v !== null && v !== undefined)
  ).toString();
  return params ? `?${params}` : '';
};

export const authApi = {
  login: (datos) => request('/auth/login', { method: 'POST', body: datos }),
  register: (datos) => request('/auth/register', { method: 'POST', body: datos }),
  me: () => request('/auth/me'),
};

export const dashboardApi = {
  resumen: () => request('/dashboard'),
};

export const usersApi = {
  listar: () => request('/users'),
  actualizar: (id, datos) => request(`/users/${id}`, { method: 'PUT', body: datos }),
  eliminar: (id) => request(`/users/${id}`, { method: 'DELETE' }),
};

export const profileApi = {
  obtener: () => request('/profile'),
  actualizar: (datos) => request('/profile', { method: 'PUT', body: datos }),
};

export const categoriesApi = {
  listar: () => request('/categories'),
  crear: (datos) => request('/categories', { method: 'POST', body: datos }),
  eliminar: (id) => request(`/categories/${id}`, { method: 'DELETE' }),
};

// Subida de archivos con barra de progreso. fetch() no informa el avance
// de la subida, por eso acá se usa XMLHttpRequest.
function subirConProgreso(endpoint, formData, alAvanzar) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BASE_URL}${endpoint}`);
    const token = tokenStorage.get();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) alAvanzar?.(Math.round((e.loaded / e.total) * 100)); };
    xhr.onerror = () => reject(new ApiError('No hay conexión con el servidor. Revisá que el backend esté encendido.', 0));
    xhr.onload = () => {
      let data = null;
      try { data = JSON.parse(xhr.responseText); } catch { /* sin cuerpo */ }
      if (xhr.status >= 200 && xhr.status < 300) return resolve(data);
      if (xhr.status === 401 && token) window.dispatchEvent(new Event('sesion:expirada'));
      const mensaje = data?.message || (data?.errors ? 'Revisá los datos marcados en el formulario' : 'No se pudo subir el archivo');
      return reject(new ApiError(mensaje, xhr.status, data?.errors || []));
    };
    xhr.send(formData);
  });
}

// Descarga protegida por token: se pide como blob y se guarda con su nombre
async function descargar(endpoint, nombre) {
  const response = await fetch(`${BASE_URL}${endpoint}`, { headers: { Authorization: `Bearer ${tokenStorage.get()}` } });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new ApiError(data?.message || 'No se pudo descargar el archivo', response.status);
  }
  const url = URL.createObjectURL(await response.blob());
  const enlace = Object.assign(document.createElement('a'), { href: url, download: nombre });
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const iaApi = {
  estado: () => request('/ia/estado'),
  probar: () => request('/ia/probar', { method: 'POST' }),
};

export const dataSourcesApi = {
  listar: (filtros) => request(`/data-sources${queryString(filtros)}`),
  obtener: (id) => request(`/data-sources/${id}`),
  // { archivo, titulo, categorias } → multipart; { texto, titulo, categorias } → JSON
  crear: ({ archivo, titulo, texto, categorias = [] }, alAvanzar) => {
    if (!archivo) return request('/data-sources', { method: 'POST', body: { texto, titulo, categorias } });
    const datos = new FormData();
    datos.append('archivo', archivo);
    if (titulo) datos.append('titulo', titulo);
    categorias.forEach((c) => datos.append('categorias', c));
    return subirConProgreso('/data-sources', datos, alAvanzar);
  },
  actualizar: (id, datos) => request(`/data-sources/${id}`, { method: 'PUT', body: datos }),
  eliminar: (id) => request(`/data-sources/${id}`, { method: 'DELETE' }),
  reprocesar: (id) => request(`/data-sources/${id}/procesar`, { method: 'POST' }),
  descargar: (id, nombre) => descargar(`/data-sources/${id}/archivo`, nombre),
};

export const reportsApi = {
  listar: (filtros) => request(`/reports${queryString(filtros)}`),
  generar: (datos) => request('/reports/generar', { method: 'POST', body: datos }),
  crear: (datos) => request('/reports', { method: 'POST', body: datos }),
  actualizar: (id, datos) => request(`/reports/${id}`, { method: 'PUT', body: datos }),
  eliminar: (id) => request(`/reports/${id}`, { method: 'DELETE' }),
};
