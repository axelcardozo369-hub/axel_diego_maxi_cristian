import { body, query } from 'express-validator';
import { DataSource } from '../models/index.js';
import { ESTADOS_REPORTE, ORIGENES_REPORTE } from '../models/Report.js';

// Regla de negocio: todo reporte se vincula a una fuente existente
const fuenteExiste = async (id) => {
  const fuente = await DataSource.findByPk(id, { attributes: ['id'] });
  if (!fuente) throw new Error('La fuente de datos indicada no existe');
  return true;
};

const reglaFuente = (opcional = false) => {
  const cadena = body('data_source_id');
  return (opcional ? cadena.optional() : cadena.notEmpty().withMessage('Todo reporte debe estar vinculado a una fuente de datos').bail())
    .isInt({ min: 1 }).withMessage('data_source_id debe ser un número entero')
    .bail()
    .toInt()
    .custom(fuenteExiste);
};

// POST /reports/generar: qué quiere saber el usuario y sobre qué fuente
export const generarReportRules = [
  reglaFuente(),
  body('consulta')
    .trim()
    .notEmpty().withMessage('Escribí qué querés saber')
    .bail()
    .isLength({ min: 5, max: 1000 }).withMessage('La consulta debe tener entre 5 y 1000 caracteres'),
];

export const crearReportRules = [
  body('titulo').optional().trim().isLength({ max: 200 }).withMessage('El título no puede superar los 200 caracteres'),
  body('consulta').optional().trim().isLength({ max: 1000 }).withMessage('La consulta no puede superar los 1000 caracteres'),
  body('resumen_ejecutivo')
    .trim()
    .notEmpty().withMessage('El resumen ejecutivo es obligatorio')
    .bail()
    .isLength({ min: 10, max: 10000 }).withMessage('El resumen debe tener entre 10 y 10000 caracteres'),
  body('metricas_clave')
    .notEmpty().withMessage('Las métricas clave son obligatorias')
    .bail()
    .isObject().withMessage('metricas_clave debe ser un objeto JSON'),
  body('estado').optional().isIn(ESTADOS_REPORTE).withMessage(`El estado debe ser: ${ESTADOS_REPORTE.join(', ')}`),
  body('origen').optional().isIn(ORIGENES_REPORTE).withMessage('Origen inválido'),
  body('modelo_ia').optional({ values: 'null' }).isString().isLength({ max: 80 }),
  reglaFuente(),
];

export const actualizarReportRules = [
  body('titulo').optional().trim().isLength({ max: 200 }).withMessage('El título no puede superar los 200 caracteres'),
  body('resumen_ejecutivo')
    .optional()
    .trim()
    .isLength({ min: 10, max: 10000 }).withMessage('El resumen debe tener entre 10 y 10000 caracteres'),
  body('metricas_clave').optional().isObject().withMessage('metricas_clave debe ser un objeto JSON'),
  body('estado').optional().isIn(ESTADOS_REPORTE).withMessage(`El estado debe ser: ${ESTADOS_REPORTE.join(', ')}`),
  reglaFuente(true),
];

export const filtrarReportsRules = [
  query('estado').optional().isIn(ESTADOS_REPORTE).withMessage('Estado inválido'),
  query('data_source_id').optional().isInt({ min: 1 }).withMessage('data_source_id inválido').toInt(),
];
