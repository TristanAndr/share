'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { setToken } from '@/lib/auth'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const data = await apiFetch('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })

    setToken(data.token)
    router.push('/')
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>Register</h1>

      <input placeholder="email" onChange={e => setEmail(e.target.value)} />
      <input type="password" placeholder="password" onChange={e => setPassword(e.target.value)} />

      <button>Register</button>
    </form>
  )
}
