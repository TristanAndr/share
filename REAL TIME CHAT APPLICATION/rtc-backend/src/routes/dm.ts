import { Router } from 'express';
import prisma from '../db';
import { authMiddleware } from '../middleware';
import { getIo } from '../io';
import { dmRoom } from '../utils';

const router = Router();

router.get('/dm/:userId/messages', authMiddleware, async (req: any, res: any) => {
  const otherUserId = Number(req.params.userId);
  const myId = req.user.userId;
  try {
    const messages = await (prisma as any).directMessage.findMany({
      where: {
        OR: [
          { senderId: myId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: myId }
        ]
      },
      include: {
        sender: { select: { id: true, username: true } },
        receiver: { select: { id: true, username: true } }
      },
      orderBy: { createdAt: 'asc' }
    });
    res.json(messages);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error fetching DMs' }); }
});

router.put('/dm/messages/:id', authMiddleware, async (req: any, res: any) => {
  const id = Number(req.params.id);
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'Content required' });
  try {
    const dm = await (prisma as any).directMessage.findUnique({ where: { id } });
    if (!dm) return res.status(404).json({ error: 'Not found' });
    if (dm.senderId !== req.user.userId) return res.status(403).json({ error: 'Forbidden' });
    const updated = await (prisma as any).directMessage.update({
      where: { id },
      data: { content, isEdited: true },
      include: {
        sender: { select: { id: true, username: true } },
        receiver: { select: { id: true, username: true } }
      }
    });
    getIo().to(dmRoom(dm.senderId, dm.receiverId)).emit('dm_updated', updated);
    res.json(updated);
  } catch { res.status(500).json({ error: 'Error updating DM' }); }
});

router.delete('/dm/messages/:id', authMiddleware, async (req: any, res: any) => {
  const id = Number(req.params.id);
  try {
    const dm = await (prisma as any).directMessage.findUnique({ where: { id } });
    if (!dm) return res.status(404).json({ error: 'Not found' });
    if (dm.senderId !== req.user.userId) return res.status(403).json({ error: 'Forbidden' });
    await (prisma as any).directMessage.delete({ where: { id } });
    getIo().to(dmRoom(dm.senderId, dm.receiverId)).emit('dm_deleted', {
      messageId: id, senderId: dm.senderId, receiverId: dm.receiverId
    });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Error deleting DM' }); }
});

export default router;
