import { Router } from 'express';
import { reflect } from '../controllers/moodMirrorController';

const router = Router();

router.post('/', reflect);

export default router;
