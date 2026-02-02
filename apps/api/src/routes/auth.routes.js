import { Router } from 'express'
import { signup, login, me } from '../controllers/auth.controller.js'
import { authMiddleware } from '../middlewares/auth.middleware.js'

const router = Router()

router.post('/signup', signup)
router.post('/login', login)
router.get('/me', authMiddleware, me)

export default router
