import { Router } from 'express'
import {
  createServer,
  listServers,
  joinServer,
  leaveServer
} from '../controllers/server.controller.js'
import { authMiddleware } from '../middlewares/auth.middleware.js'

const router = Router()

router.post('/', authMiddleware, createServer)
router.get('/', authMiddleware, listServers)
router.post('/join', authMiddleware, joinServer)
import { requirePermission } from '../middlewares/permission.middleware.js'

router.post(
  '/:id/leave',
  authMiddleware,
  requirePermission('leaveServer'),
  leaveServer
)



export default router
