import { validationResult } from 'express-validator';

// Middleware genérico: se ejecuta después de las reglas de cada ruta.
// Si alguna regla falló, corta la petición con 400 y la lista de errores.
export const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};
