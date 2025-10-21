import { Router } from 'express';
import { addCompliment, listCompliments } from '../controllers/complimentsController';

const router = Router();

router.get('/', listCompliments);
router.post('/', addCompliment);

export default router;
