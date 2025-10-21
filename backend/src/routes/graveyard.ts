import express, { Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { pool } from '../config/db';

const router = express.Router();
let clients: Response[] = [];

// Multer config (25MB limit)
const uploadsDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
const upload = multer({ dest: uploadsDir, limits: { fileSize: 25 * 1024 * 1024 } });

router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM graveyard ORDER BY id DESC LIMIT 100');
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch graves' });
  }
});

router.post('/', upload.single('attachment'), async (req: Request, res: Response) => {
  try {
    const { title, epitaph, category } = req.body || {};
    if (!title || !epitaph) return res.status(400).json({ error: 'title and epitaph are required' });
    const randomId = Math.floor(Math.random() * 9999);
    const username = `Anonymous User #${randomId}`;

    let attachment_name: string | null = null;
    let attachment_path: string | null = null;
    let attachment_size: number | null = null;
    let attachment_type: string | null = null;
    if (req.file) {
      attachment_name = req.file.originalname;
      attachment_path = `/uploads/${path.basename(req.file.path)}`;
      attachment_size = req.file.size;
      attachment_type = req.file.mimetype;
    }

    const result = await pool.query(
      'INSERT INTO graveyard (username, title, epitaph, category, attachment_name, attachment_path, attachment_size, attachment_type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [username, title, epitaph, category ?? null, attachment_name, attachment_path, attachment_size, attachment_type]
    );
    const newGrave = result.rows[0];
    clients.forEach((client) => client.write(`data: ${JSON.stringify(newGrave)}\n\n`));
    res.status(201).json(newGrave);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create grave' });
  }
});

router.get('/stream', (req: Request, res: Response) => {
  res.set({
    'Cache-Control': 'no-cache',
    'Content-Type': 'text/event-stream',
    Connection: 'keep-alive',
  });
  (res as any).flushHeaders?.();
  res.write(': connected\n\n');
  clients.push(res);
  req.on('close', () => {
    clients = clients.filter((c) => c !== res);
  });
});

router.post('/:id/resurrect', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const result = await pool.query(
      'UPDATE graveyard SET resurrect_count = resurrect_count + 1 WHERE id = $1 RETURNING *',
      [id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: 'Failed to resurrect' });
  }
});

export default router;
