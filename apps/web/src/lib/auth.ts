const TOKEN_KEY = 'token'

export function setToken(token: string) {
  document.cookie = `token=${token}; path=/`
}

export function getToken() {
  if (typeof window === 'undefined') return null

  const match = document.cookie
    .split('; ')
    .find(row => row.startsWith(`${TOKEN_KEY}=`))

  return match ? match.split('=')[1] : null
}

export function removeToken() {
  document.cookie = `token=; path=/; max-age=0`
}
