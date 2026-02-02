import jwt from 'jsonwebtoken'

export default function authSocket(socket, next) {
  const token = socket.handshake.auth?.token
  if (!token) return next(new Error('No token'))

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    socket.user = { id: payload.userId }
    next()
  } catch {
    next(new Error('Invalid token'))
  }
}
