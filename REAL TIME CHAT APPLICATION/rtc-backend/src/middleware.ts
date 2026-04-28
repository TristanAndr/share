import jwt from 'jsonwebtoken';
import prisma from './db';
import { SECRET } from './config';

export const authMiddleware = async (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

export const getUserRole = async (userId: number, serverId: number): Promise<string | null> => {
  const member = await prisma.member.findFirst({ where: { userId, serverId } });
  return member?.role ?? null;
};
