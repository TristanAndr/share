import { Router } from 'express'
import mongoose from 'mongoose'
import { authMiddleware } from '../middlewares/auth.middleware.js'
import { can } from '../services/permissions.service.js'

const router = Router()

// Schema Mongo (simple)
const messageSchema = new mongoose.Schema(
  {
    channelId: Number,
    serverId: Number,
    userId: Number,
    content: String,
  },
  { timestamps: true }
)

const Message = mongoose.model('Message', messageSchema)

// ✅ SEND MESSAGE
router.post(
  '/channels/:channelId/messages',
  authMiddleware,
  async (req, res) => {
    const channelId = Number(req.params.channelId)
    const { content, serverId } = req.body

    if (!content) {
      return res.status(400).json({ message: 'Missing content' })
    }

    const message = await Message.create({
      channelId,
      serverId,
      userId: req.userId,
      content,
    })

    res.json(message)
  }
)

// ✅ GET MESSAGE HISTORY
router.get(
  '/channels/:channelId/messages',
  authMiddleware,
  async (req, res) => {
    const channelId = Number(req.params.channelId)

    const messages = await Message.find({ channelId }).sort({ createdAt: 1 })

    res.json(messages)
  }
)

// ✅ DELETE MESSAGE
router.delete(
  '/messages/:id',
  authMiddleware,
  async (req, res) => {
    const messageId = req.params.id

    // 1️⃣ id Mongo valide
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({ message: 'Invalid message id' })
    }

    // 2️⃣ récupérer le message
    const message = await Message.findById(messageId)
    if (!message) {
      return res.status(404).json({ message: 'Message not found' })
    }

    // 3️⃣ permissions
    const isOwner = message.userId === req.userId
    const isAdmin = await can(req.userId, 'deleteMessage', message.serverId)

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Forbidden' })
    }

    // 4️⃣ suppression
    await Message.findByIdAndDelete(messageId)

    res.json({ ok: true })
  }
)

export default router

console.log('🔥 messages routes loaded')
