import { Router } from 'express';
import { createBattle, vote } from '../controllers/promptBattleController';

const router = Router();

router.post('/', createBattle);
router.post('/:id/vote', vote);

export default router;
