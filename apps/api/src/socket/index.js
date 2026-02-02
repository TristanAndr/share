import jwt from 'jsonwebtoken'
import initChannelSocket from './channels.js'
import initMessageSocket from './messages.js'

export default function initSocket(io) {
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token
      if (!token) throw new Error('No token')

      const payload = jwt.verify(token, process.env.JWT_SECRET)
      socket.userId = payload.userId
      next()
    } catch {
      next(new Error('Unauthorized'))
    }
  })

  io.on('connection', (socket) => {
    console.log('🔌 socket connected', socket.userId)

    // PRESENCE ONLINE
    io.emit('presence:update', {
      userId: socket.userId,
      status: 'online',
    })

    initChannelSocket(io, socket)
    initMessageSocket(io, socket)

    socket.on('disconnect', () => {
      io.emit('presence:update', {
        userId: socket.userId,
        status: 'offline',
      })
    })
  })
}
