import { Router } from 'express';
import { validateRequest } from '../middlewares/validator.middleware.js';
import { requireRol } from '../middlewares/auth.middleware.js';
import { subirArchivo, descartarArchivoSiHayErrores } from '../middlewares/upload.middleware.js';
import { idParamRules } from '../validators/common.validator.js';
import {
  crearDataSourceRules, actualizarDataSourceRules, filtrarDataSourcesRules,
} from '../validators/dataSource.validator.js';
import {
  getDataSources, getDataSourceById, createDataSource, updateDataSource, deleteDataSource,
  analizarDataSource, reprocesarDataSource, descargarArchivo,
} from '../controllers/dataSource.controller.js';

const router = Router();
const puedeEditar = requireRol('admin', 'editor');

router.get('/', filtrarDataSourcesRules, validateRequest, getDataSources);
router.get('/:id', idParamRules, validateRequest, getDataSourceById);
router.get('/:id/archivo', idParamRules, validateRequest, descargarArchivo);
// Alta: [rol] → archivo a disco → reglas → (borra el archivo si hay errores) → 400 o controlador
router.post('/', puedeEditar, subirArchivo, crearDataSourceRules, descartarArchivoSiHayErrores, validateRequest, createDataSource);
router.put('/:id', puedeEditar, idParamRules, actualizarDataSourceRules, validateRequest, updateDataSource);
router.delete('/:id', puedeEditar, idParamRules, validateRequest, deleteDataSource);
router.post('/:id/procesar', puedeEditar, idParamRules, validateRequest, reprocesarDataSource);
router.post('/:id/analizar', idParamRules, validateRequest, analizarDataSource);

export default router;
