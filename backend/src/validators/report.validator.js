import { body, query } from 'express-validator';
import { Op } from 'sequelize';
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
// (data_source_ids se agrega en las rutas: ver crearReportConFuentesRules)

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

// ---------- Reportes sobre VARIAS fuentes ----------
const fuentesValidas = async (ids) => {
  const unicos = [...new Set(ids)];
  if (unicos.length !== ids.length) throw new Error('Hay fuentes repetidas');
  const encontradas = await DataSource.count({ where: { id: { [Op.in]: unicos } } });
  if (encontradas !== unicos.length) throw new Error('Alguna de las fuentes no existe');
  return true;
};

const reglaVariasFuentes = (campo = 'data_source_ids', opcional = false) => {
  const cadena = body(campo);
  return [
    (opcional ? cadena.optional() : cadena)
      .isArray({ min: 2, max: 10 }).withMessage('Elegí entre 2 y 10 fuentes')
      .bail()
      .custom((ids) => ids.every((id) => Number.isInteger(Number(id)) && Number(id) > 0)).withMessage('Cada fuente debe ser un id numérico')
      .bail()
      .customSanitizer((ids) => ids.map(Number))
      .custom(fuentesValidas),
  ];
};

export const generarMultipleRules = [
  ...reglaVariasFuentes(),
  body('modo')
    .notEmpty().withMessage('Elegí qué querés hacer: comparar, consolidar o consultar')
    .bail()
    .isIn(['comparacion', 'consolidacion', 'consulta']).withMessage('El modo debe ser comparacion, consolidacion o consulta')
    .bail()
    .custom((modo, { req }) => {
      if (modo === 'comparacion' && req.body.data_source_ids?.length !== 2) throw new Error('Para comparar elegí exactamente 2 fuentes');
      return true;
    }),
  body('consulta')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ min: 5, max: 1000 }).withMessage('La consulta debe tener entre 5 y 1000 caracteres'),
  // En la consulta libre la pregunta es obligatoria; en comparar/consolidar es opcional
  body('consulta').custom((consulta, { req }) => {
    if (req.body.modo === 'consulta' && !String(consulta ?? '').trim()) throw new Error('Escribí qué querés saber');
    return true;
  }),
];

// Al guardar: data_source_ids es opcional (solo en reportes de varias fuentes)
export const variasFuentesOpcional = reglaVariasFuentes('data_source_ids', true);
