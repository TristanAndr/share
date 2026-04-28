import { Router } from 'express';
import prisma from '../db';
import { authMiddleware, getUserRole } from '../middleware';
import { getIo } from '../io';

const router = Router();

router.post('/servers/:id/channels', authMiddleware, async (req: any, res: any) => {
  const serverId = Number(req.params.id);
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const role = await getUserRole(req.user.userId, serverId);
  if (role !== 'OWNER' && role !== 'ADMIN')
    return res.status(403).json({ error: 'Forbidden' });
  try {
    const channel = await prisma.channel.create({ data: { name, serverId } });
    getIo().to(`server:${serverId}`).emit('channel_created', channel);
    res.json(channel);
  } catch { res.status(500).json({ error: 'Error creating channel' }); }
});

router.delete('/channels/:id', authMiddleware, async (req: any, res: any) => {
  const channelId = Number(req.params.id);
  try {
    const channel = await prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    const role = await getUserRole(req.user.userId, channel.serverId);
    if (role !== 'OWNER' && role !== 'ADMIN')
      return res.status(403).json({ error: 'Forbidden' });
    await (prisma as any).reaction.deleteMany({ where: { message: { channelId } } });
    await prisma.message.deleteMany({ where: { channelId } });
    await prisma.channel.delete({ where: { id: channelId } });
    getIo().to(`server:${channel.serverId}`).emit('channel_deleted', {
      channelId, serverId: channel.serverId
    });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Error deleting channel' }); }
});

export default router;
