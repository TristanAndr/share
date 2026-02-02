import { prisma } from '../config/postgres.js'

/*
CREATE SERVER
 */
export async function createServer(req, res) {
  const { name } = req.body
  const userId = req.userId

  if (!name) {
    return res.status(400).json({ message: 'Missing name' })
  }

  const server = await prisma.server.create({
    data: {
      name,
      ownerId: userId,
      members: {
        create: {
          userId,
          role: 'OWNER'
        }
      },
      channels: {
        create: {
          name: 'general'
        }
      }
    }
  })

  res.status(201).json(server)
}

/*
  LIST MY SERVERS
 */
export async function listServers(req, res) {
  const userId = req.userId

  const servers = await prisma.server.findMany({
    where: {
      members: {
        some: { userId }
      }
    },
    select: {
      id: true,
      name: true,
      ownerId: true
    }
  })

  res.json(servers)
}

/*
  JOIN SERVER (INVITE)
 */
export async function joinServer(req, res) {
  const { code } = req.body
  const userId = req.userId

  const invite = await prisma.invitation.findUnique({
    where: { code }
  })

  if (!invite || invite.used || invite.expiresAt < new Date()) {
    return res.status(400).json({ message: 'Invalid invitation' })
  }

  await prisma.membership.create({
    data: {
      userId,
      serverId: invite.serverId,
      role: 'MEMBER'
    }
  })

  await prisma.invitation.update({
    where: { id: invite.id },
    data: { used: true }
  })

  res.json({ message: 'Joined server' })
}

/*
  LEAVE SERVER
 */
export async function leaveServer(req, res) {
  const userId = req.userId
  const serverId = Number(req.params.id)

  const membership = await prisma.membership.findUnique({
    where: {
      userId_serverId: { userId, serverId }
    }
  })

  if (!membership) {
    return res.status(404).json({ message: 'Not a member' })
  }

  if (membership.role === 'OWNER') {
    return res.status(403).json({ message: 'Owner cannot leave server' })
  }

  await prisma.membership.delete({
    where: { id: membership.id }
  })

  res.json({ message: 'Left server' })
}
