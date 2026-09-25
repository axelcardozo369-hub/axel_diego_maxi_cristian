// Rutas de la API que no existen → 404 en JSON
export const notFound = (req, res) => {
  res.status(404).json({ message: `La ruta ${req.method} ${req.originalUrl} no existe` });
};

// Red de seguridad global para errores que escapan de los controladores
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'El cuerpo de la petición no es un JSON válido' });
  }
  if (err.name === 'MulterError') {
    return res.status(400).json({ message: `Error al recibir el archivo: ${err.message}` });
  }
  console.error(err);
  res.status(500).json({ message: 'Error interno del servidor', error: err.message });
};
