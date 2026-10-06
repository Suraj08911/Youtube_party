import { Router } from 'express';
import * as ctrl from './playlist.controller';
import { requireAuth } from '../auth/auth.middleware';

const router = Router();
router.use(requireAuth);

router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);
router.post('/:id/items', ctrl.addItem);   // ⭐ NEW

export default router;