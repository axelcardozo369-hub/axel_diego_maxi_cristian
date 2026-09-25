import { body } from 'express-validator';
import { Category } from '../models/index.js';

export const crearCategoryRules = [
  body('nombre')
    .trim()
    .notEmpty().withMessage('El nombre es obligatorio')
    .bail()
    .isLength({ min: 2, max: 60 }).withMessage('El nombre debe tener entre 2 y 60 caracteres')
    .bail()
    .custom(async (nombre) => {
      const existe = await Category.findOne({ where: { nombre }, paranoid: false });
      if (existe) throw new Error('Ya existe una categoría con ese nombre');
      return true;
    }),
  body('color')
    .optional()
    .isHexColor().withMessage('El color debe ser hexadecimal (#RRGGBB)'),
];

export const actualizarCategoryRules = [
  body('nombre')
    .optional()
    .trim()
    .isLength({ min: 2, max: 60 }).withMessage('El nombre debe tener entre 2 y 60 caracteres'),
  body('color')
    .optional()
    .isHexColor().withMessage('El color debe ser hexadecimal (#RRGGBB)'),
];
