import { io } from 'socket.io-client'

const socket = io('http://localhost:3001', {
  auth: { token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImlhdCI6MTc2OTQ0MzkxMywiZXhwIjoxNzcwMDQ4NzEzfQ.lsMAZJLCgbSuHdDxx0SwbOjISXow0EmCcHxRcd93sFQ' }
})

socket.on('connect', () => {
  console.log('🟢 CLIENT 2 CONNECTED')
  socket.emit('server:join', 1)
  socket.emit('channel:join', 1)
})

socket.on('channel:typing', (data) => {
  console.log('✍️ TYPING RECEIVED', data)
})
