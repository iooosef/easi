import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

function parseJwt(token) {
  const payload = token.split('.')[1]
  return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
}

const AuthContext = createContext(null)

/** Provides shared auth state and an apiFetch helper to the entire app */
export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem('accessToken'))
  const [officeAddress, setOfficeAddress] = useState('')

  useEffect(() => {
    fetch('/api/config')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setOfficeAddress(d.officeAddress ?? ''))
      .catch(() => {})
  }, [])
  const navigate = useNavigate()

  // Ref always holds the latest token — prevents stale closures in apiFetch
  const tokenRef = useRef(accessToken)
  useEffect(() => { tokenRef.current = accessToken }, [accessToken])

  // Shared in-flight refresh promise — deduplicates concurrent refresh calls
  const refreshPromiseRef = useRef(null)

  const payload = accessToken ? parseJwt(accessToken) : {}
  const user = payload.sub ?? null
  const fullName = payload.firstName && payload.lastName
    ? `${payload.firstName} ${payload.lastName}`
    : user
  const role = payload.role ?? null
  /** Returns true if the current user's role matches any of the given roles */
  const hasRole = (...allowed) => allowed.includes(role)

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenRef.current}` },
      })
    } catch { /* ignore network errors on logout */ }
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    tokenRef.current = null
    setAccessToken(null)
    navigate('/login', { replace: true })
  }, [navigate])

  /** Calls POST /api/auth/refresh, stores new tokens, returns the new access token */
  const refreshAccessToken = useCallback(async () => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current

    const storedRefresh = localStorage.getItem('refreshToken')
    if (!storedRefresh) {
      await handleLogout()
      throw new Error('No refresh token')
    }

    refreshPromiseRef.current = fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: storedRefresh }),
    })
      .then(async res => {
        if (!res.ok) {
          await handleLogout()
          throw new Error('Session expired')
        }
        const data = await res.json()
        localStorage.setItem('accessToken', data.accessToken)
        if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken)
        tokenRef.current = data.accessToken
        setAccessToken(data.accessToken)
        return data.accessToken
      })
      .finally(() => { refreshPromiseRef.current = null })

    return refreshPromiseRef.current
  }, [handleLogout])

  /**
   * Drop-in replacement for fetch() — automatically attaches the Bearer token
   * and retries once with a refreshed token on 401/403.
   */
  const apiFetch = useCallback(async (url, options = {}) => {
    const doRequest = (token) => fetch(url, {
      ...options,
      headers: { ...options.headers, Authorization: `Bearer ${token}` },
    })

    let res = await doRequest(tokenRef.current)

    if (res.status === 401) {
      const newToken = await refreshAccessToken()
      res = await doRequest(newToken)
    }

    return res
  }, [refreshAccessToken])

  function handleLogin(token, refreshToken) {
    localStorage.setItem('accessToken', token)
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken)
    tokenRef.current = token
    setAccessToken(token)
    navigate('/', { replace: true })
  }

  return (
    <AuthContext.Provider value={{ user, fullName, role, hasRole, accessToken, apiFetch, handleLogin, handleLogout, officeAddress }}>
      {children}
    </AuthContext.Provider>
  )
}

/** Hook to access shared auth state */
export function useAuth() {
  return useContext(AuthContext)
}

/** Calls logout and redirects to /login */
export function LogoutPage() {
  const { handleLogout } = useAuth()
  useEffect(() => { handleLogout() }, [])
  return null
}
