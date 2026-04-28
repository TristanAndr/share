import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import prisma from '../db';
import { SECRET } from '../config';

const router = Router();

router.post('/auth/signup', async (req: any, res: any) => {
  const { email, username, password } = req.body;
  if (!email || !username || !password)
    return res.status(400).json({ error: 'Missing fields' });
  const hashed = await bcrypt.hash(password, 10);
  try {
    const user = await prisma.user.create({ data: { email, username, password: hashed } });
    const token = jwt.sign({ userId: user.id }, SECRET);
    res.json({ token, user: { id: user.id, username: user.username } });
  } catch { res.status(400).json({ error: 'Email already exists' }); }
});

router.post('/auth/login', async (req: any, res: any) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.password)))
    return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ userId: user.id }, SECRET);
  res.json({ token, user: { id: user.id, username: user.username } });
});

export default router;
