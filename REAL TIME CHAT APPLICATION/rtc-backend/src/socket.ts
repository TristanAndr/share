import { Server as SocketServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import prisma from './db';
import { dmRoom, getUniqueOnlineUsers } from './utils';
import { SECRET } from './config';

const serverOnlineMap = new Map<number, Map<string, { userId: number; username: string }>>();
const socketData = new Map<string, { serverId: number; userId: number; username: string }[]>();

export function setupSocket(io: SocketServer): void {
  io.on('connection', (socket) => {
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

        if (!serverOnlineMap.has(serverId)) serverOnlineMap.set(serverId, new Map());
        serverOnlineMap.get(serverId)!.set(socket.id, { userId: user.id, username: user.username });

        const existing = socketData.get(socket.id) ?? [];
        socketData.set(socket.id, [...existing, { serverId, userId: user.id, username: user.username }]);

        socket.to(`server:${serverId}`).emit('user_online', { userId: user.id, username: user.username });
        socket.emit('online_users', { serverId, users: getUniqueOnlineUsers(serverOnlineMap, serverId) });
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

    socket.on('join_dm', (data: { token: string; otherUserId: number }) => {
      try {
        const decoded: any = jwt.verify(data.token, SECRET);
        socket.join(dmRoom(decoded.userId, data.otherUserId));
      } catch (e) { console.error('join_dm error:', e); }
    });

    socket.on('send_dm', async (data: { token: string; content: string; receiverId: number }) => {
      try {
        const decoded: any = jwt.verify(data.token, SECRET);
        const newDM = await (prisma as any).directMessage.create({
          data: { content: data.content, senderId: decoded.userId, receiverId: data.receiverId },
          include: {
            sender: { select: { id: true, username: true } },
            receiver: { select: { id: true, username: true } }
          }
        });
        io.to(dmRoom(decoded.userId, data.receiverId)).emit('receive_dm', newDM);
      } catch (e) { console.error('send_dm error:', e); }
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
          const stillOnline = Array.from(m.values()).some(u => u.userId === userId);
          if (!stillOnline) {
            io.to(`server:${serverId}`).emit('user_offline', { userId, username });
          }
          if (m.size === 0) serverOnlineMap.delete(serverId);
        }
      }
      socketData.delete(socket.id);
    });
  });
}
