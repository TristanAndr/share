import prisma from "../config/prisma.js"

export default function initChannelSocket(io, socket) {


socket.on('channel:join', async (channelId) => {
  const cid = Number(channelId)
  if (!cid) return

    // 1. récupérer le channel
    const channel = await prisma.channel.findUnique({
      where: { id: cid },
    })

    if (!channel) return

      // 2. vérifier que l'utilisateur est membre du server du channel
      const member = await prisma.membership.findUnique({
        where: {
          userId_serverId: {
            userId: socket.userId,
            serverId: channel.serverId,
          },
        },
      })

      if (!member) return

        // 3. rejoindre le channel
        socket.join(`channel:${cid}`)
        console.log(`🟢 user ${socket.userId} joined channel ${cid}`)
})
}
