import { io } from 'socket.io-client'

const socket = io('http://localhost:3001', {
  auth: {
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImlhdCI6MTc2OTQ0MzkxMywiZXhwIjoxNzcwMDQ4NzEzfQ.lsMAZJLCgbSuHdDxx0SwbOjISXow0EmCcHxRcd93sFQ'
  }
})

socket.on('connect', () => {
  console.log('✅ CONNECTED', socket.id)
  socket.emit('server:join', 1)
  socket.emit('channel:join', 1)
  socket.emit('channel:message', {
    channelId: 1,
    serverId: 1,
    content: 'hello realtime'
  })
  socket.on('message:new', (msg) => {
    console.log('📩 NEW MESSAGE', msg)
  })
  socket.emit('channel:typing', {
    channelId: 1,
    typing: true
  })
  socket.on('channel:typing', (data) => {
    console.log('✍️ TYPING', data)
  })
  socket.on('presence:update', (data) => {
    console.log('🟢 PRESENCE', data)
  })

})

socket.on('connect_error', (err) => {
  console.error('❌ AUTH FAILED', err.message)
})
