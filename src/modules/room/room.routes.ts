import { Router } from 'express';
import * as roomController from './room.controller';
import { requireAuth } from '../auth/auth.middleware';

const router = Router();

// All room routes require auth
router.use(requireAuth);

router.post('/create', roomController.create);
router.post('/join', roomController.join);
router.get('/my-rooms', roomController.myRooms);
router.get('/:code', roomController.getByCode);
router.delete('/:id', roomController.close);

export default router;