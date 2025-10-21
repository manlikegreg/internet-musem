import { Router } from 'express';
import { listDreams, addDream } from '../controllers/dreamController';

const router = Router();

router.get('/', listDreams);
router.post('/', addDream);

export default router;
