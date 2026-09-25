import { param } from 'express-validator';

export const idParamRules = [
  param('id').isInt({ min: 1 }).withMessage('El id debe ser un número entero positivo').toInt(),
];
