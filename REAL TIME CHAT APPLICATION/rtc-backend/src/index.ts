import express from 'express';
import http from 'http';
import { Server as SocketServer } from 'socket.io';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const server = http.createServer(app);
const prisma = new PrismaClient();

app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());

const io = new SocketServer(server, {
  cors: { origin: 'http://localhost:3000', credentials: true }
});

const SECRET = process.env.JWT_SECRET || 'MON_SECRET_SUPER_SECURE';

// ─── ONLINE TRACKING ──────────────────────────────────────────────────────────
// serverId → Map<socketId, {userId, username}>
const serverOnlineMap = new Map<number, Map<string, { userId: number; username: string }>>();
// socketId → [{serverId, userId, username}]
const socketData = new Map<string, { serverId: number; userId: number; username: string }[]>();

function getUniqueOnlineUsers(serverId: number) {
  const m = serverOnlineMap.get(serverId);
  if (!m) return [];
  const seen = new Set<number>();
  const users: { userId: number; username: string }[] = [];
  for (const u of m.values()) {
    if (!seen.has(u.userId)) { seen.add(u.userId); users.push(u); }
  }
  return users;
}

// ─── MIDDLEWARES ──────────────────────────────────────────────────────────────

const authMiddleware = async (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try { req.user = jwt.verify(token, SECRET); next(); }
  catch { res.status(401).json({ error: 'Invalid token' }); }
};

const getUserRole = async (userId: number, serverId: number): Promise<string | null> => {
  const member = await prisma.member.findFirst({ where: { userId, serverId } });
  return member?.role ?? null;
};

// ─── AUTH ─────────────────────────────────────────────────────────────────────

app.post('/auth/signup', async (req: any, res: any) => {
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

app.post('/auth/login', async (req: any, res: any) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.password)))
    return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ userId: user.id }, SECRET);
  res.json({ token, user: { id: user.id, username: user.username } });
});

// ─── SERVERS ──────────────────────────────────────────────────────────────────

app.post('/servers', authMiddleware, async (req: any, res: any) => {
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

app.get('/servers', authMiddleware, async (req: any, res: any) => {
  const servers = await prisma.server.findMany({
    where: { members: { some: { userId: req.user.userId } } },
    include: { channels: true, members: { where: { userId: req.user.userId } } }
  });
  res.json(servers.map(s => ({ ...s, userRole: s.members[0]?.role ?? 'MEMBER' })));
});

// Rejoindre via code d'invitation
app.post('/servers/join', authMiddleware, async (req: any, res: any) => {
  const { inviteCode } = req.body;
  try {
    const srv = await prisma.server.findUnique({ where: { inviteCode } });
    if (!srv) return res.status(404).json({ error: 'Code invalide' });

    // Vérifier si l'utilisateur est banni
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
      // Ban expiré : le supprimer automatiquement
      await (prisma as any).ban.delete({ where: { id: ban.id } });
    }

    const existing = await prisma.member.findFirst({
      where: { userId: req.user.userId, serverId: srv.id }
    });
    if (existing) return res.status(400).json({ error: 'Already a member' });

    await prisma.member.create({
      data: { userId: req.user.userId, serverId: srv.id, role: 'MEMBER' }
    });

    // Message système dans le premier channel
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
      io.to(String(firstCh.id)).emit('receive_message', sysMsg);
    }

    const full = await prisma.server.findUnique({
      where: { id: srv.id }, include: { channels: true }
    });
    res.json({ ...full, userRole: 'MEMBER' });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error joining server' }); }
});

// Supprimer un serveur (OWNER ou ADMIN)
app.delete('/servers/:id', authMiddleware, async (req: any, res: any) => {
  const serverId = Number(req.params.id);
  const role = await getUserRole(req.user.userId, serverId);
  if (role !== 'OWNER' && role !== 'ADMIN')
    return res.status(403).json({ error: 'Forbidden' });
  try {
    const channels = await prisma.channel.findMany({ where: { serverId } });
    for (const ch of channels)
      await prisma.message.deleteMany({ where: { channelId: ch.id } });
    await prisma.channel.deleteMany({ where: { serverId } });
    await prisma.member.deleteMany({ where: { serverId } });
    await prisma.server.delete({ where: { id: serverId } });
    io.to(`server:${serverId}`).emit('server_deleted', { serverId });
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error deleting server' }); }
});

// Quitter un serveur (MEMBER ou ADMIN — OWNER doit supprimer)
app.delete('/servers/:id/leave', authMiddleware, async (req: any, res: any) => {
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

// ─── MEMBERS ──────────────────────────────────────────────────────────────────

// Liste des membres d'un serveur
app.get('/servers/:id/members', authMiddleware, async (req: any, res: any) => {
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

// Changer le rôle d'un membre (OWNER seulement)
app.patch('/servers/:id/members/:userId/role', authMiddleware, async (req: any, res: any) => {
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
  io.to(`server:${serverId}`).emit('member_role_updated', { serverId, userId: targetUserId, role });
  res.json({ success: true });
});

// Kick un membre (OWNER peut kick ADMIN/MEMBER, ADMIN peut kick MEMBER)
app.delete('/servers/:id/members/:userId/kick', authMiddleware, async (req: any, res: any) => {
  const serverId = Number(req.params.id);
  const targetUserId = Number(req.params.userId);

  if (targetUserId === req.user.userId)
    return res.status(400).json({ error: 'Vous ne pouvez pas vous kick vous-même' });

  const myRole = await getUserRole(req.user.userId, serverId);
  if (!myRole) return res.status(403).json({ error: 'Not a member' });

  const target = await prisma.member.findFirst({ where: { userId: targetUserId, serverId } });
  if (!target) return res.status(404).json({ error: 'Member not found' });

  const roleOrder: Record<string, number> = { OWNER: 3, ADMIN: 2, MEMBER: 1 };
  const myLevel = roleOrder[myRole] ?? 0;
  const targetLevel = roleOrder[target.role] ?? 0;

  if (myLevel <= targetLevel)
    return res.status(403).json({ error: 'Permissions insuffisantes' });

  try {
    await prisma.member.delete({ where: { id: target.id } });

    const firstCh = await prisma.channel.findFirst({
      where: { serverId }, orderBy: { id: 'asc' }
    });
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
      io.to(String(firstCh.id)).emit('receive_message', sysMsg);
    }

    io.to(`server:${serverId}`).emit('user_kicked', { serverId, userId: targetUserId });
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error kicking member' }); }
});

// Bannir un membre (OWNER peut ban ADMIN/MEMBER, ADMIN peut ban MEMBER)
app.post('/servers/:id/members/:userId/ban', authMiddleware, async (req: any, res: any) => {
  const serverId = Number(req.params.id);
  const targetUserId = Number(req.params.userId);
  const { duration } = req.body; // durée en minutes, null/absent = ban définitif

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

    // Expulser le membre du serveur
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
      io.to(String(firstCh.id)).emit('receive_message', sysMsg);
    }

    io.to(`server:${serverId}`).emit('user_banned', { serverId, userId: targetUserId });
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error banning member' }); }
});

// Débannir un utilisateur (OWNER ou ADMIN, même hiérarchie que pour ban)
app.delete('/servers/:id/bans/:userId', authMiddleware, async (req: any, res: any) => {
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

    // ADMIN ne peut pas débannir un ban posé par un OWNER (sécurité)
    if (myRole === 'ADMIN') {
      const bannerRole = await getUserRole(ban.bannedById, serverId);
      if (bannerRole === 'OWNER')
        return res.status(403).json({ error: 'Seul le propriétaire peut débannir cet utilisateur' });
    }

    await (prisma as any).ban.delete({ where: { id: ban.id } });
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error unbanning member' }); }
});

// Liste des bans d'un serveur (OWNER ou ADMIN)
app.get('/servers/:id/bans', authMiddleware, async (req: any, res: any) => {
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

// Transférer l'ownership (OWNER seulement)
app.post('/servers/:id/transfer', authMiddleware, async (req: any, res: any) => {
  const serverId = Number(req.params.id);
  const { userId: targetUserId } = req.body;

  const myRole = await getUserRole(req.user.userId, serverId);
  if (myRole !== 'OWNER') return res.status(403).json({ error: 'OWNER seulement' });

  const myMember = await prisma.member.findFirst({ where: { userId: req.user.userId, serverId } });
  const target = await prisma.member.findFirst({ where: { userId: targetUserId, serverId } });
  if (!target || !myMember) return res.status(404).json({ error: 'Member not found' });

  // L'ancien OWNER devient ADMIN, le cible devient OWNER
  await prisma.member.update({ where: { id: myMember.id }, data: { role: 'ADMIN' } });
  await prisma.member.update({ where: { id: target.id }, data: { role: 'OWNER' } });

  io.to(`server:${serverId}`).emit('ownership_transferred', {
    serverId, newOwnerId: targetUserId, oldOwnerId: req.user.userId
  });
  res.json({ success: true });
});

// ─── CHANNELS ─────────────────────────────────────────────────────────────────

// Créer un channel (OWNER ou ADMIN)
app.post('/servers/:id/channels', authMiddleware, async (req: any, res: any) => {
  const serverId = Number(req.params.id);
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const role = await getUserRole(req.user.userId, serverId);
  if (role !== 'OWNER' && role !== 'ADMIN')
    return res.status(403).json({ error: 'Forbidden' });
  try {
    const channel = await prisma.channel.create({ data: { name, serverId } });
    io.to(`server:${serverId}`).emit('channel_created', channel);
    res.json(channel);
  } catch { res.status(500).json({ error: 'Error creating channel' }); }
});

// Supprimer un channel (OWNER ou ADMIN)
app.delete('/channels/:id', authMiddleware, async (req: any, res: any) => {
  const channelId = Number(req.params.id);
  try {
    const channel = await prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    const role = await getUserRole(req.user.userId, channel.serverId);
    if (role !== 'OWNER' && role !== 'ADMIN')
      return res.status(403).json({ error: 'Forbidden' });
    await prisma.message.deleteMany({ where: { channelId } });
    await prisma.channel.delete({ where: { id: channelId } });
    io.to(`server:${channel.serverId}`).emit('channel_deleted', {
      channelId, serverId: channel.serverId
    });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Error deleting channel' }); }
});

// ─── MESSAGES ─────────────────────────────────────────────────────────────────

app.get('/channels/:id/messages', authMiddleware, async (req: any, res: any) => {
  try {
    const messages = await prisma.message.findMany({
      where: { channelId: Number(req.params.id) },
      include: { user: { select: { id: true, username: true } } },
      orderBy: { createdAt: 'asc' }
    });
    res.json(messages);
  } catch { res.status(500).json({ error: 'Error fetching messages' }); }
});

// Modifier un message (auteur seulement)
app.put('/messages/:id', authMiddleware, async (req: any, res: any) => {
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
    io.to(String(message.channelId)).emit('message_updated', updated);
    res.json(updated);
  } catch { res.status(500).json({ error: 'Error updating message' }); }
});

// Supprimer un message (auteur OU OWNER/ADMIN)
app.delete('/messages/:id', authMiddleware, async (req: any, res: any) => {
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
    await prisma.message.delete({ where: { id: messageId } });
    io.to(String(message.channelId)).emit('message_deleted', {
      messageId, channelId: message.channelId
    });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Error deleting message' }); }
});

// ─── SOCKET.IO ────────────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Rejoindre un serveur (avec authentification pour l'online tracking)
  socket.on('join_server', async (data: { serverId: number; token: string }) => {
    try {
      const decoded: any = jwt.verify(data.token, SECRET);
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, username: true }
      });
      if (!user) return;

      const { serverId } = data;
      socket.join(`server:${serverId}`);

      // Tracking online
      if (!serverOnlineMap.has(serverId)) serverOnlineMap.set(serverId, new Map());
      serverOnlineMap.get(serverId)!.set(socket.id, { userId: user.id, username: user.username });

      const existing = socketData.get(socket.id) ?? [];
      socketData.set(socket.id, [...existing, { serverId, userId: user.id, username: user.username }]);

      // Notifier les autres membres du serveur
      socket.to(`server:${serverId}`).emit('user_online', { userId: user.id, username: user.username });
      // Envoyer la liste courante au connecté
      socket.emit('online_users', { serverId, users: getUniqueOnlineUsers(serverId) });
    } catch (e) { console.error('join_server error:', e); }
  });

  socket.on('join_channel', (channelId: number) => { socket.join(String(channelId)); });
  socket.on('leave_channel', (channelId: number) => { socket.leave(String(channelId)); });

  socket.on('send_message', async (data: any) => {
    try {
      const decoded: any = jwt.verify(data.token, SECRET);
      const newMessage = await prisma.message.create({
        data: {
          content: data.content,
          channelId: Number(data.channelId),
          userId: decoded.userId
        },
        include: { user: { select: { id: true, username: true } } }
      });
      io.to(String(data.channelId)).emit('receive_message', newMessage);
    } catch (e) { console.error('send_message error:', e); }
  });

  socket.on('typing_start', (data: { channelId: number; username: string }) => {
    socket.to(String(data.channelId)).emit('user_typing', data);
  });

  socket.on('typing_stop', (data: { channelId: number; username: string }) => {
    socket.to(String(data.channelId)).emit('user_stopped_typing', data);
  });

  socket.on('disconnect', () => {
    const entries = socketData.get(socket.id) ?? [];
    for (const { serverId, userId, username } of entries) {
      const m = serverOnlineMap.get(serverId);
      if (m) {
        m.delete(socket.id);
        // Ne notifier "offline" que si plus aucun autre socket de cet user est connecté
        const stillOnline = Array.from(m.values()).some(u => u.userId === userId);
        if (!stillOnline) {
          io.to(`server:${serverId}`).emit('user_offline', { userId, username });
        }
        if (m.size === 0) serverOnlineMap.delete(serverId);
      }
    }
    socketData.delete(socket.id);
    console.log('User disconnected:', socket.id);
  });
});

// ─── GIF SEARCH ───────────────────────────────────────────────────────────────

app.get('/gif/search', authMiddleware, async (req: any, res: any) => {
  const q = String(req.query.q || '').trim();
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  if (!q) return res.status(400).json({ error: 'Missing query' });
  const apiKey = process.env.GIPHY_API_KEY;
  if (!apiKey || apiKey === 'your_giphy_api_key_here')
    return res.status(503).json({ error: 'GIF service not configured' });
  try {
    const url = `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(q)}&limit=${limit}&rating=g&lang=fr`;
    const response = await fetch(url);
    const data: any = await response.json();
    const gifs = (data.data || []).map((r: any) => ({
      id: r.id,
      url: r.images?.original?.url || '',
      preview: r.images?.fixed_height_small?.url || r.images?.original?.url || '',
      title: r.title || '',
    }));
    res.json({ gifs });
  } catch (e) {
    console.error('Giphy error:', e);
    res.status(500).json({ error: 'Failed to fetch GIFs' });
  }
});

// ─── START ────────────────────────────────────────────────────────────────────

server.listen(3001, () => {
  console.log('🚀 Server running on http://localhost:3001');
});
