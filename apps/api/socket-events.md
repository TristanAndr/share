# Socket Events — Real-Time Chat

## Auth

JWT is sent during socket handshake.

```js
import { io } from 'socket.io-client'

const socket = io('http://localhost:3001', {
  auth: {
    token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImlhdCI6MTc2OTQ0MzkxMywiZXhwIjoxNzcwMDQ4NzEzfQ.lsMAZJLCgbSuHdDxx0SwbOjISXow0EmCcHxRcd93sFQ
  }
})
