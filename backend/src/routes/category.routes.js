import { Router } from 'express';
import { validateRequest } from '../middlewares/validator.middleware.js';
import { requireRol } from '../middlewares/auth.middleware.js';
import { idParamRules } from '../validators/common.validator.js';
import { crearCategoryRules, actualizarCategoryRules } from '../validators/category.validator.js';
import { getCategories, createCategory, updateCategory, deleteCategory } from '../controllers/category.controller.js';

const router = Router();
const puedeEditar = requireRol('admin', 'editor');

router.get('/', getCategories);
router.post('/', puedeEditar, crearCategoryRules, validateRequest, createCategory);
router.put('/:id', puedeEditar, idParamRules, actualizarCategoryRules, validateRequest, updateCategory);
router.delete('/:id', puedeEditar, idParamRules, validateRequest, deleteCategory);

export default router;
