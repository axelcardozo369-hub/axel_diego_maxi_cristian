import { Router } from 'express';
import { validateRequest } from '../middlewares/validator.middleware.js';
import { requireRol } from '../middlewares/auth.middleware.js';
import { idParamRules } from '../validators/common.validator.js';
import {
  crearReportRules, actualizarReportRules, filtrarReportsRules, generarReportRules,
  generarMultipleRules, variasFuentesOpcional,
} from '../validators/report.validator.js';
import {
  getReports, getReportById, createReport, updateReport, deleteReport, generarReporte,
  generarReporteMultiple, descargarPDF,
} from '../controllers/report.controller.js';

const router = Router();
const puedeEditar = requireRol('admin', 'editor');

router.get('/', filtrarReportsRules, validateRequest, getReports);
// /generar va ANTES de /:id para que Express no lo confunda con un id
router.post('/generar', puedeEditar, generarReportRules, validateRequest, generarReporte);
// Comparar, consolidar o consultar VARIAS fuentes (devuelve un borrador)
router.post('/generar-multiple', puedeEditar, generarMultipleRules, validateRequest, generarReporteMultiple);
// Descargar cualquier reporte guardado en PDF
router.get('/:id/pdf', idParamRules, validateRequest, descargarPDF);
router.get('/:id', idParamRules, validateRequest, getReportById);
router.post('/', puedeEditar, crearReportRules, variasFuentesOpcional, validateRequest, createReport);
router.put('/:id', puedeEditar, idParamRules, actualizarReportRules, validateRequest, updateReport);
router.delete('/:id', puedeEditar, idParamRules, validateRequest, deleteReport);

export default router;
