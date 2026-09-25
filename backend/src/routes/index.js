import { Router } from 'express';
import { getResumen } from '../controllers/dashboard.controller.js';
import { getEstadoIA, probarIA } from '../controllers/ia.controller.js';
import { verificarToken, requireRol } from '../middlewares/auth.middleware.js';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import profileRoutes from './profile.routes.js';
import categoryRoutes from './category.routes.js';
import dataSourceRoutes from './dataSource.routes.js';
import reportRoutes from './report.routes.js';

const router = Router();

// Públicas
router.use('/auth', authRoutes);

// Todo lo demás requiere sesión de un usuario activo
router.use(verificarToken);
router.get('/dashboard', getResumen);
router.get('/ia/estado', getEstadoIA);
router.post('/ia/probar', requireRol('admin'), probarIA);
router.use('/users', userRoutes);
router.use('/profile', profileRoutes);
router.use('/categories', categoryRoutes);
router.use('/data-sources', dataSourceRoutes);
router.use('/reports', reportRoutes);

export default router;
