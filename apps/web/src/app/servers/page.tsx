'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getToken } from '@/lib/auth'
import { apiFetch } from '@/lib/api'

export default function ServersPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [servers, setServers] = useState<any[]>([])

  useEffect(() => {
    const token = getToken()
    console.log('SERVERS PAGE TOKEN=', token)

    if (!token) {
      router.push('/login')
      return
    }

    apiFetch('/servers')
      .then(setServers)
      .catch(() => router.push('/login'))
      .finally(() => setReady(true))
  }, [router])

  if (!ready) {
    return <p>Loading...</p>
  }

  return (
    <div>
      <h1>Your servers</h1>

      {servers.length === 0 ? (
        <p>No servers</p>
      ) : (
        <ul>
          {servers.map((s) => (
            <li key={s.id}>{s.name}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
