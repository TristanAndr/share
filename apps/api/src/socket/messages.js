import Message from '../models/message.model.js'

export default function initMessageSocket(io, socket) {
  // SEND MESSAGE
  socket.on('channel:message', async ({ channelId, serverId, content }) => {
    if (!content) return

    const message = await Message.create({
      channelId,
      serverId,
      userId: socket.userId,
      content,
    })

    io.to(`channel:${channelId}`).emit('message:new', message)
  })

  // TYPING EVENT
  socket.on('channel:typing', ({ channelId, typing }) => {
    socket.to(`channel:${channelId}`).emit('channel:typing', {
      userId: socket.userId,
      channelId,
      typing,
    })
  })
}
