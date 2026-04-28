import { Router } from 'express';
import prisma from '../db';
import { authMiddleware, getUserRole } from '../middleware';
import { getIo } from '../io';

const router = Router();

router.get('/channels/:id/messages', authMiddleware, async (req: any, res: any) => {
  try {
    const messages = await (prisma as any).message.findMany({
      where: { channelId: Number(req.params.id) },
      include: {
        user: { select: { id: true, username: true } },
        reactions: { include: { user: { select: { id: true, username: true } } } }
      },
      orderBy: { createdAt: 'asc' }
    });
    res.json(messages);
  } catch { res.status(500).json({ error: 'Error fetching messages' }); }
});

router.put('/messages/:id', authMiddleware, async (req: any, res: any) => {
  const messageId = Number(req.params.id);
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'Content required' });
  try {
    const message = await prisma.message.findUnique({ where: { id: messageId } });
    if (!message) return res.status(404).json({ error: 'Message not found' });
    if (message.userId !== req.user.userId)
      return res.status(403).json({ error: 'Forbidden' });
    const updated = await prisma.message.update({
      where: { id: messageId },
      data: { content, isEdited: true },
      include: { user: { select: { id: true, username: true } } }
    });
    getIo().to(String(message.channelId)).emit('message_updated', updated);
    res.json(updated);
  } catch { res.status(500).json({ error: 'Error updating message' }); }
});

router.delete('/messages/:id', authMiddleware, async (req: any, res: any) => {
  const messageId = Number(req.params.id);
  try {
    const message = await prisma.message.findUnique({
      where: { id: messageId }, include: { channel: true }
    });
    if (!message) return res.status(404).json({ error: 'Message not found' });
    const isOwn = message.userId === req.user.userId;
    const role = await getUserRole(req.user.userId, message.channel.serverId);
    if (!isOwn && role !== 'OWNER' && role !== 'ADMIN')
      return res.status(403).json({ error: 'Forbidden' });
    await (prisma as any).reaction.deleteMany({ where: { messageId } });
    await prisma.message.delete({ where: { id: messageId } });
    getIo().to(String(message.channelId)).emit('message_deleted', {
      messageId, channelId: message.channelId
    });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Error deleting message' }); }
});

router.post('/messages/:id/reactions', authMiddleware, async (req: any, res: any) => {
  const messageId = Number(req.params.id);
  const { emoji } = req.body;
  if (!emoji) return res.status(400).json({ error: 'Emoji required' });
  try {
    const message = await prisma.message.findUnique({ where: { id: messageId } });
    if (!message) return res.status(404).json({ error: 'Message not found' });

    const existing = await (prisma as any).reaction.findUnique({
      where: { userId_messageId_emoji: { userId: req.user.userId, messageId, emoji } }
    });

    if (existing) {
      await (prisma as any).reaction.delete({ where: { id: existing.id } });
    } else {
      await (prisma as any).reaction.create({
        data: { emoji, userId: req.user.userId, messageId }
      });
    }

    const reactions = await (prisma as any).reaction.findMany({
      where: { messageId },
      include: { user: { select: { id: true, username: true } } }
    });

    getIo().to(String(message.channelId)).emit('reaction_updated', { messageId, reactions });
    res.json({ reactions });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error updating reaction' }); }
});

export default router;
