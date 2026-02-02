import express from 'express'
import cors from 'cors'
import messageRoutes from './routes/messages.routes.js'
import cookieParser from 'cookie-parser'
import authRoutes from './routes/auth.routes.js'
import serverRoutes from './routes/server.routes.js'
import channelRoutes from './routes/channels.routes.js'
console.log('🔥 importing messages routes')
const app = express()

// ✅ TOUJOURS AVANT LES ROUTES
app.use(cookieParser())
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
}))
app.use(express.json())
app.use(messageRoutes)
// routes
app.use('/auth', authRoutes)
app.use('/servers', serverRoutes)
app.use(channelRoutes)

app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

export default app
