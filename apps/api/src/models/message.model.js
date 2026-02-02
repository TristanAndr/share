import mongoose from 'mongoose'

const messageSchema = new mongoose.Schema(
  {
    content: String,
    channelId: Number,
    serverId: Number,
    userId: Number
  },
  { timestamps: true }
)

export default mongoose.models.Message ||
  mongoose.model('Message', messageSchema)
