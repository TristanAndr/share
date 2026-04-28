import { Server as SocketServer } from 'socket.io';

let _io: SocketServer;

export function setIo(io: SocketServer): void { _io = io; }
export function getIo(): SocketServer { return _io; }
