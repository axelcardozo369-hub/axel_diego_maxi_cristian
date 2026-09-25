import { body } from 'express-validator';
import { ROLES } from '../models/User.js';

// PUT: todo opcional (actualización parcial)
export const actualizarUserRules = [
  body('nombre')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('El nombre debe tener entre 2 y 100 caracteres'),
  body('email')
    .optional()
    .trim()
    .isEmail().withMessage('El email no tiene un formato válido')
    .bail()
    .toLowerCase(),
  body('password')
    .optional()
    .isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres'),
  body('rol')
    .optional()
    .isIn(ROLES).withMessage(`El rol debe ser: ${ROLES.join(', ')}`),
];
