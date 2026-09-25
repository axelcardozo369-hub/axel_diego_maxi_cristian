import { Router } from 'express';
import { validateRequest } from '../middlewares/validator.middleware.js';
import { requireRol } from '../middlewares/auth.middleware.js';
import { idParamRules } from '../validators/common.validator.js';
import { actualizarUserRules } from '../validators/user.validator.js';
import { getUsers, getUserById, updateUser, deleteUser } from '../controllers/user.controller.js';

const router = Router();

// Los usuarios se crean con /api/auth/register
router.get('/', requireRol('admin'), getUsers);
router.get('/:id', idParamRules, validateRequest, getUserById);
router.put('/:id', idParamRules, actualizarUserRules, validateRequest, updateUser);
router.delete('/:id', requireRol('admin'), idParamRules, validateRequest, deleteUser);

export default router;
