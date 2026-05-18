import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './auth'

export default function LoginPage() {
  const { handleLogin } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.message || 'Invalid email or password.')
        return
      }
      const data = await res.json()
      handleLogin(data.accessToken, data.refreshToken)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-base-200">
      <div className="card w-full max-w-sm bg-base-100 shadow-md">
        <div className="card-body gap-4">
          <h2 className="card-title text-2xl">Sign in to EASI</h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="label-text">Email</label>
              <input
                type="email"
                className="input input-bordered w-full"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text">Password</label>
              <input
                type="password"
                className="input input-bordered w-full"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            {error && <p className="text-error text-sm">{error}</p>}

            <button type="submit" className="btn btn-primary w-full" disabled={loading}>
              {loading ? <span className="loading loading-spinner loading-sm" /> : 'Login'}
            </button>
          </form>

          <p className="text-center text-sm">
            <a className="link link-primary cursor-pointer" onClick={() => navigate('/forgot-password')}>
              Forgot password?
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
