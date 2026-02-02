'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'

type Channel = {
  id: number
  name: string
}

export default function ServerPage() {
  const params = useParams()
  const serverId = params?.serverId as string | undefined

  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!serverId) return

    apiFetch(`/servers/${serverId}/channels`)
      .then(setChannels)
      .catch((err) => {
        console.error(err)
        setError('Failed to load channels')
      })
      .finally(() => setLoading(false))
  }, [serverId])

  if (!serverId) return <p>No server selected</p>
  if (loading) return <p>Loading channels...</p>
  if (error) return <p>{error}</p>

  return (
    <div style={{ padding: 24 }}>
      <h1>Server {serverId}</h1>

      <ul>
        {channels.map(channel => (
          <li key={channel.id}># {channel.name}</li>
        ))}
      </ul>
    </div>
  )
}
