'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { socket } from '@/lib/socket'

type Message = {
  id: number
  content: string
  userId: number
}

export default function ChannelPage() {
  const { serverId, channelId } = useParams()
  const [messages, setMessages] = useState<Message[]>([])
  const [content, setContent] = useState('')

  useEffect(() => {
    if (!channelId) return

    socket.connect()

    // ⚠️ envoyer UNIQUEMENT channelId
    socket.emit('channel:join', channelId)

    socket.on('message:new', (message: Message) => {
      setMessages(prev => [...prev, message])
    })

    return () => {
      socket.off('message:new')
      socket.disconnect()
    }
  }, [channelId])


  function sendMessage() {
    if (!content.trim()) return

    socket.emit('channel:message', {
      channelId,
      serverId,
      content,
    })

    setContent('')
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>Channel {channelId}</h1>

      <div style={{ marginBottom: 16 }}>
        {messages.map((m,index) => (
          <div key={m.id ?? index}>💬 {m.content}</div>
        ))}
      </div>

      <input
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Message..."
      />
      <button onClick={sendMessage}>Envoyer</button>
    </div>
  )
}
