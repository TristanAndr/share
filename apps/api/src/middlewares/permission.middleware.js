import { can } from '../services/permissions.service.js'

export function requirePermission(action) {
  return async (req, res, next) => {
    if (!req.userId) {
      return res.status(401).json({ message: 'Unauthorized (no user)' })
    }

    const serverId =
      Number(req.params.serverId) ||
      Number(req.params.id) ||
      Number(req.body.serverId)

    if (!serverId) {
      return res.status(400).json({ message: 'Missing serverId' })
    }

    const ok = await can(req.userId, action, serverId)

    if (!ok) {
      return res.status(403).json({ message: 'Forbidden' })
    }

    next()
  }
}
