'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'

export default function ServersList() {
  const [servers, setServers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch('/servers')
      .then(setServers)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p>Loading…</p>
  if (!servers.length) return <p>No servers</p>

  return (
    <ul>
      {servers.map(s => (
        <li key={s.id}>{s.name}</li>
      ))}
    </ul>
  )
}
