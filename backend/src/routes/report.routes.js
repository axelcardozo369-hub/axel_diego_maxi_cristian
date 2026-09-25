import { Router } from 'express';
import { validateRequest } from '../middlewares/validator.middleware.js';
import { requireRol } from '../middlewares/auth.middleware.js';
import { idParamRules } from '../validators/common.validator.js';
import {
  crearReportRules, actualizarReportRules, filtrarReportsRules, generarReportRules,
} from '../validators/report.validator.js';
import {
  getReports, getReportById, createReport, updateReport, deleteReport, generarReporte,
} from '../controllers/report.controller.js';

const router = Router();
const puedeEditar = requireRol('admin', 'editor');

router.get('/', filtrarReportsRules, validateRequest, getReports);
// /generar va ANTES de /:id para que Express no lo confunda con un id
router.post('/generar', puedeEditar, generarReportRules, validateRequest, generarReporte);
router.get('/:id', idParamRules, validateRequest, getReportById);
router.post('/', puedeEditar, crearReportRules, validateRequest, createReport);
router.put('/:id', puedeEditar, idParamRules, actualizarReportRules, validateRequest, updateReport);
router.delete('/:id', puedeEditar, idParamRules, validateRequest, deleteReport);

export default router;
