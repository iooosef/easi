import { createContext, useContext, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

function parseJwt(token) {
  const payload = token.split('.')[1]
  return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
}

const AuthContext = createContext(null)

/** Provides shared auth state to the entire app */
export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem('accessToken'))
  const navigate = useNavigate()

  const user = accessToken ? parseJwt(accessToken).sub : null

  function handleLogin(token, refreshToken) {
    localStorage.setItem('accessToken', token)
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken)
    setAccessToken(token)
    navigate('/', { replace: true })
  }

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
    } catch { /* ignore network errors on logout */ }
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    setAccessToken(null)
    navigate('/login', { replace: true })
  }

  return (
    <AuthContext.Provider value={{ user, accessToken, handleLogin, handleLogout }}>
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
