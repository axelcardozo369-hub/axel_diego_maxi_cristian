import { body, query } from 'express-validator';
import { Op } from 'sequelize';
import { Category } from '../models/index.js';
import { TIPOS_FUENTE, ESTADOS_IA } from '../models/DataSource.js';

// Las categorías llegan distinto según el formato del pedido:
// JSON → [1, 2] · multipart → "1" o ["1", "2"] o "1,2". Se normalizan a [1, 2].
const normalizarCategorias = (valor) => {
  if (valor == null || valor === '') return [];
  const lista = Array.isArray(valor) ? valor : String(valor).split(',');
  return lista.map((v) => Number(String(v).trim()));
};

const categoriasValidas = async (ids) => {
  if (ids.some((id) => !Number.isInteger(id) || id < 1)) throw new Error('Cada categoría debe ser un id numérico');
  const unicos = [...new Set(ids)];
  if (unicos.length === 0) return true;
  const encontradas = await Category.count({ where: { id: { [Op.in]: unicos } } });
  if (encontradas !== unicos.length) throw new Error('Alguna de las categorías no existe');
  return true;
};

// El identificador ya NO se recibe: lo genera el sistema.
// El título es opcional: si no viene, se usa el nombre del archivo.
export const crearDataSourceRules = [
  body('titulo')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ min: 3, max: 200 }).withMessage('El título debe tener entre 3 y 200 caracteres'),
  body('texto')
    .custom((texto, { req }) => {
      if (!req.file && !String(texto ?? '').trim()) throw new Error('Subí un archivo o pegá el contenido');
      return true;
    }),
  body('categorias')
    .customSanitizer(normalizarCategorias)
    .custom(categoriasValidas),
];

export const actualizarDataSourceRules = [
  body('titulo')
    .optional()
    .trim()
    .isLength({ min: 3, max: 200 }).withMessage('El título debe tener entre 3 y 200 caracteres'),
  body('categorias')
    .optional()
    .customSanitizer(normalizarCategorias)
    .custom(categoriasValidas),
];

export const filtrarDataSourcesRules = [
  query('q').optional().trim().isLength({ max: 100 }),
  query('tipo_fuente').optional().isIn(TIPOS_FUENTE).withMessage('Tipo de fuente inválido'),
  query('estado_ia').optional().isIn(ESTADOS_IA).withMessage('Estado inválido'),
  query('category_id').optional().isInt({ min: 1 }).withMessage('category_id inválido').toInt(),
];
