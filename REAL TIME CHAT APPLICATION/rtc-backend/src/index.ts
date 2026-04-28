import express from 'express';
import http from 'http';
import { Server as SocketServer } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { setIo } from './io';
import { setupSocket } from './socket';
import authRoutes from './routes/auth';
import serverRoutes from './routes/servers';
import channelRoutes from './routes/channels';
import messageRoutes from './routes/messages';
import userRoutes from './routes/users';
import dmRoutes from './routes/dm';
import gifRoutes from './routes/gif';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new SocketServer(server, {
  cors: { origin: 'http://localhost:3000', credentials: true }
});

setIo(io);

app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());

app.use(authRoutes);
app.use(serverRoutes);
app.use(channelRoutes);
app.use(messageRoutes);
app.use(userRoutes);
app.use(dmRoutes);
app.use(gifRoutes);

setupSocket(io);

server.listen(3001, () => {
  console.log('🚀 Server running on http://localhost:3001');
});
