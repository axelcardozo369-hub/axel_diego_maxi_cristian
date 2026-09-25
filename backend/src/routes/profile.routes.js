import { Router } from 'express';
import { validateRequest } from '../middlewares/validator.middleware.js';
import { actualizarProfileRules } from '../validators/profile.validator.js';
import { getMiPerfil, updateMiPerfil } from '../controllers/profile.controller.js';

const router = Router();

router.get('/', getMiPerfil);
router.put('/', actualizarProfileRules, validateRequest, updateMiPerfil);

export default router;
