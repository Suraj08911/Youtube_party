import { Router } from 'express';
import * as ctrl from './history.controller';
import { requireAuth } from '../auth/auth.middleware';

const router = Router();
router.use(requireAuth);
router.get('/me', ctrl.getMyHistory);

export default router;