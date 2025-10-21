import express from 'express';
import cors from 'cors';
import path from 'path';
import { env } from './config/env';
import { initDb } from './config/db';

// Routes
import graveyardRoutes from './routes/graveyard';
import confessRoutes from './routes/confess';
import confessionBoothRoutes from './routes/confession';
import voidRoutes from './routes/void';
import promptBattleRoutes from './routes/promptBattle';
import oracleRoutes from './routes/oracle';
import timeCapsuleRoutes from './routes/timeCapsule';
import timeCapsuleV2Routes from './routes/timecapsule';
import { unlockCapsules } from './jobs/capsuleUnlocker';
import apologyRoutes from './routes/apology';
import complimentRoutes from './routes/compliment';
import dreamsRoutesLegacy from './routes/dreams';
import moodMirrorRoutesLegacy from './routes/moodMirror';
import dreamRoutes from './routes/dream';
import moodRoutes from './routes/mood';
import presenceRoutes from './routes/presence';
import visitRoutes from './routes/visit';
import narratorRoutes from './routes/narrator';
import secretRoutes from './routes/secret';
import adminRoutes from './routes/admin';
import configRoutes from './routes/config';
import battleRoutes from './routes/battle';
import userRoutes from './routes/users';

const app = express();

app.use(express.json());
app.use(
  cors({
    origin: env.FRONTEND_ORIGIN || '*',
  })
);

// Serve uploaded files (local dev)
const uploadsDir = path.resolve(process.cwd(), 'uploads');
app.use('/uploads', express.static(uploadsDir));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', env: env.NODE_ENV });
});

app.use('/api/graveyard', graveyardRoutes);
app.use('/api/confess', confessRoutes);
app.use('/api/confession', confessionBoothRoutes);
app.use('/api/void', voidRoutes);
app.use('/api/prompt-battle', promptBattleRoutes);
app.use('/api/oracle', oracleRoutes);
app.use('/api/timecapsule', timeCapsuleRoutes);
app.use('/api/timecapsule', timeCapsuleV2Routes);
app.use('/api/apology', apologyRoutes);
app.use('/api/compliment', complimentRoutes);
app.use('/api/dreams', dreamsRoutesLegacy);
app.use('/api/dream', dreamRoutes);
app.use('/api/mood-mirror', moodMirrorRoutesLegacy);
app.use('/api/mood', moodRoutes);
app.use('/api/presence', presenceRoutes);
app.use('/api', visitRoutes);
app.use('/api/narrator', narratorRoutes);
app.use('/api/secret', secretRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/config', configRoutes);
app.use('/api/battle', battleRoutes);
app.use('/api/users', userRoutes);

(async () => {
  try {
    await initDb();
    app.listen(env.PORT, () => {
      console.log(`API running on http://localhost:${env.PORT}/api`);
    });
    // Schedule capsule unlocker (every minute)
    setInterval(unlockCapsules, 60_000);
    // Run once at startup
    unlockCapsules().catch(()=>{})
  } catch (err) {
    console.error('Failed to init DB', err);
    process.exit(1);
  }
})();
