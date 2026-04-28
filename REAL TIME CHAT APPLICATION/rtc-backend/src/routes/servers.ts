import { Router } from 'express';
import prisma from '../db';
import { authMiddleware, getUserRole } from '../middleware';
import { getIo } from '../io';

const router = Router();

router.post('/servers', authMiddleware, async (req: any, res: any) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  try {
    const srv = await prisma.server.create({
      data: {
        name,
        members: { create: { userId: req.user.userId, role: 'OWNER' } },
        channels: { create: { name: 'général' } }
      },
      include: { channels: true, members: true }
    });
    res.json({ ...srv, userRole: 'OWNER' });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error creating server' }); }
});

router.get('/servers', authMiddleware, async (req: any, res: any) => {
  const servers = await prisma.server.findMany({
    where: { members: { some: { userId: req.user.userId } } },
    include: { channels: true, members: { where: { userId: req.user.userId } } }
  });
  res.json(servers.map(s => ({ ...s, userRole: s.members[0]?.role ?? 'MEMBER' })));
});

router.post('/servers/join', authMiddleware, async (req: any, res: any) => {
  const { inviteCode } = req.body;
  try {
    const srv = await prisma.server.findUnique({ where: { inviteCode } });
    if (!srv) return res.status(404).json({ error: 'Code invalide' });

    const ban = await (prisma as any).ban.findUnique({
      where: { userId_serverId: { userId: req.user.userId, serverId: srv.id } }
    });
    if (ban) {
      if (!ban.expiresAt || ban.expiresAt > new Date()) {
        const errorCode = ban.expiresAt
          ? `ban_temporary:${ban.expiresAt.toISOString()}`
          : 'ban_permanent';
        return res.status(403).json({ error: errorCode });
      }
      await (prisma as any).ban.delete({ where: { id: ban.id } });
    }

    const existing = await prisma.member.findFirst({
      where: { userId: req.user.userId, serverId: srv.id }
    });
    if (existing) return res.status(400).json({ error: 'Already a member' });

    await prisma.member.create({
      data: { userId: req.user.userId, serverId: srv.id, role: 'MEMBER' }
    });

    const firstCh = await prisma.channel.findFirst({
      where: { serverId: srv.id }, orderBy: { id: 'asc' }
    });
    if (firstCh) {
      const sysMsg = await prisma.message.create({
        data: {
          content: 'system.joined',
          userId: req.user.userId,
          channelId: firstCh.id,
          isSystem: true
        },
        include: { user: { select: { id: true, username: true } } }
      });
      getIo().to(String(firstCh.id)).emit('receive_message', sysMsg);
    }

    const full = await prisma.server.findUnique({
      where: { id: srv.id }, include: { channels: true }
    });
    res.json({ ...full, userRole: 'MEMBER' });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error joining server' }); }
});

router.delete('/servers/:id', authMiddleware, async (req: any, res: any) => {
  const serverId = Number(req.params.id);
  const role = await getUserRole(req.user.userId, serverId);
  if (role !== 'OWNER' && role !== 'ADMIN')
    return res.status(403).json({ error: 'Forbidden' });
  try {
    const channels = await prisma.channel.findMany({ where: { serverId } });
    for (const ch of channels) {
      await (prisma as any).reaction.deleteMany({ where: { message: { channelId: ch.id } } });
      await prisma.message.deleteMany({ where: { channelId: ch.id } });
    }
    await prisma.channel.deleteMany({ where: { serverId } });
    await prisma.member.deleteMany({ where: { serverId } });
    await prisma.server.delete({ where: { id: serverId } });
    getIo().to(`server:${serverId}`).emit('server_deleted', { serverId });
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error deleting server' }); }
});

router.delete('/servers/:id/leave', authMiddleware, async (req: any, res: any) => {
  const serverId = Number(req.params.id);
  const role = await getUserRole(req.user.userId, serverId);
  if (!role) return res.status(404).json({ error: 'Not a member' });
  if (role === 'OWNER')
    return res.status(403).json({ error: 'Le propriétaire doit supprimer le serveur' });
  try {
    await prisma.member.deleteMany({ where: { userId: req.user.userId, serverId } });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Error leaving server' }); }
});

// ─── Members ──────────────────────────────────────────────────────────────────

router.get('/servers/:id/members', authMiddleware, async (req: any, res: any) => {
  const serverId = Number(req.params.id);
  const role = await getUserRole(req.user.userId, serverId);
  if (!role) return res.status(403).json({ error: 'Not a member' });
  const members = await prisma.member.findMany({
    where: { serverId },
    include: { user: { select: { id: true, username: true } } },
    orderBy: { id: 'asc' }
  });
  res.json(members);
});

router.patch('/servers/:id/members/:userId/role', authMiddleware, async (req: any, res: any) => {
  const serverId = Number(req.params.id);
  const targetUserId = Number(req.params.userId);
  const { role } = req.body;

  const myRole = await getUserRole(req.user.userId, serverId);
  if (myRole !== 'OWNER') return res.status(403).json({ error: 'OWNER seulement' });
  if (!['ADMIN', 'MEMBER'].includes(role))
    return res.status(400).json({ error: 'Rôle invalide' });

  const target = await prisma.member.findFirst({ where: { userId: targetUserId, serverId } });
  if (!target) return res.status(404).json({ error: 'Member not found' });
  if (target.role === 'OWNER') return res.status(403).json({ error: 'Cannot change OWNER role' });

  await prisma.member.update({ where: { id: target.id }, data: { role } });
  getIo().to(`server:${serverId}`).emit('member_role_updated', { serverId, userId: targetUserId, role });
  res.json({ success: true });
});

router.delete('/servers/:id/members/:userId/kick', authMiddleware, async (req: any, res: any) => {
  const serverId = Number(req.params.id);
  const targetUserId = Number(req.params.userId);

  if (targetUserId === req.user.userId)
    return res.status(400).json({ error: 'Vous ne pouvez pas vous kick vous-même' });

  const myRole = await getUserRole(req.user.userId, serverId);
  if (!myRole) return res.status(403).json({ error: 'Not a member' });

  const target = await prisma.member.findFirst({ where: { userId: targetUserId, serverId } });
  if (!target) return res.status(404).json({ error: 'Member not found' });

  const roleOrder: Record<string, number> = { OWNER: 3, ADMIN: 2, MEMBER: 1 };
  if ((roleOrder[myRole] ?? 0) <= (roleOrder[target.role] ?? 0))
    return res.status(403).json({ error: 'Permissions insuffisantes' });

  try {
    await prisma.member.delete({ where: { id: target.id } });

    const firstCh = await prisma.channel.findFirst({ where: { serverId }, orderBy: { id: 'asc' } });
    if (firstCh) {
      const sysMsg = await prisma.message.create({
        data: {
          content: 'system.kicked',
          userId: targetUserId,
          channelId: firstCh.id,
          isSystem: true
        },
        include: { user: { select: { id: true, username: true } } }
      });
      getIo().to(String(firstCh.id)).emit('receive_message', sysMsg);
    }

    getIo().to(`server:${serverId}`).emit('user_kicked', { serverId, userId: targetUserId });
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error kicking member' }); }
});

router.post('/servers/:id/members/:userId/ban', authMiddleware, async (req: any, res: any) => {
  const serverId = Number(req.params.id);
  const targetUserId = Number(req.params.userId);
  const { duration } = req.body;

  if (targetUserId === req.user.userId)
    return res.status(400).json({ error: 'Vous ne pouvez pas vous bannir vous-même' });

  const myRole = await getUserRole(req.user.userId, serverId);
  if (!myRole) return res.status(403).json({ error: 'Not a member' });

  const target = await prisma.member.findFirst({ where: { userId: targetUserId, serverId } });
  if (!target) return res.status(404).json({ error: 'Member not found' });

  const roleOrder: Record<string, number> = { OWNER: 3, ADMIN: 2, MEMBER: 1 };
  if ((roleOrder[myRole] ?? 0) <= (roleOrder[target.role] ?? 0))
    return res.status(403).json({ error: 'Permissions insuffisantes' });

  try {
    const expiresAt = duration ? new Date(Date.now() + duration * 60 * 1000) : null;

    await (prisma as any).ban.upsert({
      where: { userId_serverId: { userId: targetUserId, serverId } },
      update: { expiresAt, bannedById: req.user.userId, createdAt: new Date() },
      create: { userId: targetUserId, serverId, bannedById: req.user.userId, expiresAt }
    });

    await prisma.member.delete({ where: { id: target.id } });

    const firstCh = await prisma.channel.findFirst({ where: { serverId }, orderBy: { id: 'asc' } });
    if (firstCh) {
      const sysMsg = await prisma.message.create({
        data: {
          content: expiresAt
            ? `system.banned_temporary:${expiresAt.toISOString()}`
            : 'system.banned_permanent',
          userId: targetUserId,
          channelId: firstCh.id,
          isSystem: true
        },
        include: { user: { select: { id: true, username: true } } }
      });
      getIo().to(String(firstCh.id)).emit('receive_message', sysMsg);
    }

    getIo().to(`server:${serverId}`).emit('user_banned', { serverId, userId: targetUserId });
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error banning member' }); }
});

router.delete('/servers/:id/bans/:userId', authMiddleware, async (req: any, res: any) => {
  const serverId = Number(req.params.id);
  const targetUserId = Number(req.params.userId);

  const myRole = await getUserRole(req.user.userId, serverId);
  if (myRole !== 'OWNER' && myRole !== 'ADMIN')
    return res.status(403).json({ error: 'Permissions insuffisantes' });

  try {
    const ban = await (prisma as any).ban.findUnique({
      where: { userId_serverId: { userId: targetUserId, serverId } },
      include: { user: true }
    });
    if (!ban) return res.status(404).json({ error: 'Ban not found' });

    if (myRole === 'ADMIN') {
      const bannerRole = await getUserRole(ban.bannedById, serverId);
      if (bannerRole === 'OWNER')
        return res.status(403).json({ error: 'Seul le propriétaire peut débannir cet utilisateur' });
    }

    await (prisma as any).ban.delete({ where: { id: ban.id } });
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error unbanning member' }); }
});

router.get('/servers/:id/bans', authMiddleware, async (req: any, res: any) => {
  const serverId = Number(req.params.id);
  const myRole = await getUserRole(req.user.userId, serverId);
  if (myRole !== 'OWNER' && myRole !== 'ADMIN')
    return res.status(403).json({ error: 'Permissions insuffisantes' });

  try {
    const bans = await (prisma as any).ban.findMany({
      where: { serverId },
      include: {
        user: { select: { id: true, username: true } },
        banner: { select: { id: true, username: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(bans);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error fetching bans' }); }
});

router.post('/servers/:id/transfer', authMiddleware, async (req: any, res: any) => {
  const serverId = Number(req.params.id);
  const { userId: targetUserId } = req.body;

  const myRole = await getUserRole(req.user.userId, serverId);
  if (myRole !== 'OWNER') return res.status(403).json({ error: 'OWNER seulement' });

  const myMember = await prisma.member.findFirst({ where: { userId: req.user.userId, serverId } });
  const target = await prisma.member.findFirst({ where: { userId: targetUserId, serverId } });
  if (!target || !myMember) return res.status(404).json({ error: 'Member not found' });

  await prisma.member.update({ where: { id: myMember.id }, data: { role: 'ADMIN' } });
  await prisma.member.update({ where: { id: target.id }, data: { role: 'OWNER' } });

  getIo().to(`server:${serverId}`).emit('ownership_transferred', {
    serverId, newOwnerId: targetUserId, oldOwnerId: req.user.userId
  });
  res.json({ success: true });
});

export default router;
