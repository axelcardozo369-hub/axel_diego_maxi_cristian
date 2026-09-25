import { body } from 'express-validator';
import { User } from '../models/index.js';
import { TIPOS_ORGANIZACION } from '../models/Profile.js';

export const registerRules = [
  body('nombre')
    .trim()
    .notEmpty().withMessage('El nombre es obligatorio')
    .bail()
    .isLength({ min: 2, max: 100 }).withMessage('El nombre debe tener entre 2 y 100 caracteres'),
  body('email')
    .trim()
    .notEmpty().withMessage('El email es obligatorio')
    .bail()
    .isEmail().withMessage('El email no tiene un formato válido')
    .bail()
    .toLowerCase()
    // Unicidad asíncrona, incluyendo usuarios dados de baja (su fila sigue en la tabla)
    .custom(async (email) => {
      const existe = await User.findOne({ where: { email }, paranoid: false });
      if (existe) throw new Error('Ya existe una cuenta con ese email');
      return true;
    }),
  body('password')
    .notEmpty().withMessage('La contraseña es obligatoria')
    .bail()
    .isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres'),
  body('organizacion')
    .optional()
    .trim()
    .isLength({ max: 150 }).withMessage('La organización no puede superar los 150 caracteres'),
  body('tipo_organizacion')
    .optional()
    .isIn(TIPOS_ORGANIZACION).withMessage(`El tipo debe ser: ${TIPOS_ORGANIZACION.join(', ')}`),
];

export const loginRules = [
  body('email').trim().notEmpty().withMessage('El email es obligatorio').bail()
    .isEmail().withMessage('El email no tiene un formato válido').toLowerCase(),
  body('password').notEmpty().withMessage('La contraseña es obligatoria'),
];
