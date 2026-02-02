import { Router } from 'express'
import { PrismaClient, Prisma } from '@prisma/client'
import { authMiddleware } from '../middlewares/auth.middleware.js'
import { requirePermission } from '../middlewares/permission.middleware.js'


const prisma = new PrismaClient()
const router = Router()

// LIST CHANNELS (MEMBER+)
router.get('/servers/:serverId/channels', authMiddleware, async (req, res) => {
  const serverId = Number(req.params.serverId)

  if (!serverId) {
    return res.status(400).json({ message: 'Missing serverId' })
  }

  const channels = await prisma.channel.findMany({
    where: { serverId }
  })

  res.json(channels)
})

// CREATE CHANNEL (ADMIN+)
router.post(
  '/servers/:serverId/channels',
  authMiddleware,
  requirePermission('manage_channels'),
  async (req, res) => {
    try {
      const serverId = Number(req.params.serverId)
      const { name } = req.body

      if (!name) {
        return res.status(400).json({ message: 'Missing channel name' })
      }

      const channel = await prisma.channel.create({
        data: {
          name,
          serverId,
        },
      })

      return res.status(201).json(channel)
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        return res.status(409).json({ message: 'Channel already exists' })
      }

      console.error(err)
      return res.status(500).json({
        message: err.message || 'Internal error'
      })
    }
  }
)


// DELETE CHANNEL (ADMIN+)
router.delete(
  '/channels/:id',
  authMiddleware,
  requirePermission('deleteChannel'),
  async (req, res) => {
    const id = Number(req.params.id)

    await prisma.channel.delete({ where: { id } })
    res.sendStatus(204)
  }
)

export default router
