import jwt from 'jsonwebtoken'

export function authMiddleware(req, res, next) {
  const token =
    req.cookies?.token ||
    req.headers.authorization?.split(' ')[1]

  console.log('AUTH TOKEN:', token)

  if (!token) {
    return res.status(401).json({ message: 'No token' })
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    console.log('JWT PAYLOAD:', payload)

    req.userId = payload.userId
    next()
  } catch (err) {
    console.error('JWT VERIFY ERROR:', err.message)
    return res.status(401).json({ message: 'Unauthorized' })
  }
}
