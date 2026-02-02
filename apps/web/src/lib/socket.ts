import { io } from 'socket.io-client'

const token =
  typeof window !== 'undefined'
    ? document.cookie
        .split('; ')
        .find((c) => c.startsWith('token='))
        ?.split('=')[1]
    : null

export const socket = io('http://localhost:3001', {
  autoConnect: false,
  auth: {
    token,
  },
})
