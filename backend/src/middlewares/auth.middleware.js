import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/index.js';

// Verifica el token y carga al usuario. Como User es paranoid,
// findByPk NO encuentra usuarios dados de baja: solo pasan usuarios ACTIVOS.
export const verificarToken = async (req, res, next) => {
  try {
    const [tipo, token] = (req.headers.authorization || '').split(' ');
    if (tipo !== 'Bearer' || !token) {
      return res.status(401).json({ message: 'Tenés que iniciar sesión' });
    }
    const payload = jwt.verify(token, env.JWT_SECRET);
    const usuario = await User.findByPk(payload.id);
    if (!usuario) {
      return res.status(401).json({ message: 'El usuario ya no está activo' });
    }
    req.user = usuario;
    next();
  } catch {
    return res.status(401).json({ message: 'La sesión expiró o no es válida' });
  }
};

// Autorización por rol: requireRol('admin', 'editor')
export const requireRol = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.rol)) {
    return res.status(403).json({ message: 'Tu rol no tiene permiso para esta acción' });
  }
  next();
};
