import 'dotenv/config'
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'

import app from './apps.js'
import { connectPostgres } from './config/postgres.js'
import { connectMongo } from './config/mongo.js'
import initSocket from './socket/index.js'

const PORT = process.env.PORT || 3001

async function start() {
  // 🗄 DB
  await connectPostgres()
  await connectMongo()

  // 🌐 HTTP
  const httpServer = createServer(app)

  // 🔌 Socket.IO
  const io = new Server(httpServer, {
    cors: {
      origin: 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  })

  // 🚀 init sockets
  initSocket(io)

  // ▶️ START
  httpServer.listen(PORT, () => {
    console.log(`🚀 API + Socket running on port ${PORT}`)
  })
}

start()
