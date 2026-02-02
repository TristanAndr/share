'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { useRouter } from 'next/navigation'

type Server = {
  id: number
  name: string
}

export default function HomePage() {
  const [servers, setServers] = useState<Server[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    // 1️⃣ vérifier l'utilisateur
    apiFetch('/auth/me')
      .then(() => {
        // 2️⃣ charger les serveurs
        return apiFetch('/servers')
      })
      .then((data) => {
        setServers(data)
      })
      .catch(() => {
        // pas connecté → login
        router.push('/login')
      })
      .finally(() => setLoading(false))
  }, [router])

  if (loading) return <p>Loading...</p>

  return (
    <div style={{ padding: 24 }}>
      <h1>📁 My Servers</h1>

      {servers.length === 0 && <p>No servers</p>}

      <ul>
        {servers.map((server) => (
          <li key={server.id}>{server.name}</li>
        ))}
      </ul>
    </div>
  )
}
