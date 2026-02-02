import { prisma } from '../config/postgres.js'

const RULES = {
  invite: ['OWNER', 'ADMIN'],
  createChannel: ['OWNER', 'ADMIN'],
  deleteChannel: ['OWNER', 'ADMIN'],
  leaveServer: ['MEMBER', 'ADMIN'],
  deleteServer: ['OWNER'],
  promote: ['OWNER']
}

export async function can(userId, action, serverId) {
  const membership = await prisma.membership.findUnique({
    where: {
      userId_serverId: { userId, serverId }
    }
  })

  if (!membership) return false

  const allowedRoles = RULES[action]
  if (!allowedRoles) return false

  return allowedRoles.includes(membership.role)
}
