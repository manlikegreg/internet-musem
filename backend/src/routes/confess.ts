import { Router } from 'express';
import { getConfessions, addConfession } from '../controllers/confessController';

const router = Router();

router.get('/', getConfessions);
router.post('/', addConfession);

export default router;
