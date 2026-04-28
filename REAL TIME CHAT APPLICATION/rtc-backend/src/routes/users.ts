import { Router } from 'express';
import prisma from '../db';
import { authMiddleware } from '../middleware';

const router = Router();

router.get('/users', authMiddleware, async (req: any, res: any) => {
  try {
    const users = await prisma.user.findMany({
      where: { id: { not: req.user.userId } },
      select: { id: true, username: true },
      orderBy: { username: 'asc' }
    });
    res.json(users);
  } catch { res.status(500).json({ error: 'Error fetching users' }); }
});

export default router;
