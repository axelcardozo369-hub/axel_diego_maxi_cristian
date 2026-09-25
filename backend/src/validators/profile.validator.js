import { body } from 'express-validator';
import { TIPOS_ORGANIZACION } from '../models/Profile.js';

export const actualizarProfileRules = [
  body('organizacion')
    .optional()
    .trim()
    .isLength({ max: 150 }).withMessage('La organización no puede superar los 150 caracteres'),
  body('tipo_organizacion')
    .optional()
    .isIn(TIPOS_ORGANIZACION).withMessage(`El tipo debe ser: ${TIPOS_ORGANIZACION.join(', ')}`),
  body('moneda')
    .optional()
    .trim()
    .isLength({ min: 3, max: 3 }).withMessage('La moneda es un código de 3 letras (ej: ARS)')
    .bail()
    .toUpperCase(),
];
