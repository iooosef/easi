import { useState } from 'react'
import { Button, Field, Input, Link } from '@fluentui/react-components'

export default function LoginPage({ onLogin, onForgotPassword }) {
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
      onLogin(data.accessToken, data.refreshToken)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, width: 320 }}>
        <h2 style={{ margin: 0 }}>Sign in to EASI</h2>
        <Field label="Email">
          <Input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </Field>
        <Field label="Password">
          <Input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </Field>
        {error && <span style={{ color: 'red', fontSize: 14 }}>{error}</span>}
        <Button type="submit" appearance="primary" disabled={loading}>
          {loading ? 'Signing in...' : 'Login'}
        </Button>
        <Link onClick={onForgotPassword} style={{ textAlign: 'center', cursor: 'pointer' }}>
          Forgot password?
        </Link>
      </form>
    </div>
  )
}
