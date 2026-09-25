import { Router } from 'express';
import { validateRequest } from '../middlewares/validator.middleware.js';
import { verificarToken } from '../middlewares/auth.middleware.js';
import { registerRules, loginRules } from '../validators/auth.validator.js';
import { register, login, me } from '../controllers/auth.controller.js';

const router = Router();

router.post('/register', registerRules, validateRequest, register);
router.post('/login', loginRules, validateRequest, login);
router.get('/me', verificarToken, me);

export default router;
