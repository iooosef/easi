import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import logoImg from './assets/logo.png'

async function parseApiError(res) {
  const data = await res.json().catch(() => ({}))
  if (data.errors) return data.errors
  return { _general: data.message ?? data.error ?? `Error ${res.status}` }
}

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [formError, setFormError] = useState({})
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError({})
    setLoading(true)
    try {
      const res = await fetch('/api/users/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) {
        setFormError(await parseApiError(res))
        return
      }
      navigate('/reset-otp', { state: { email } })
    } catch {
      setFormError({ _general: 'Network error. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-base-200">
      <div className="card w-full max-w-sm bg-base-100 shadow-md">
        <div className="card-body gap-4">
          <div>
            <img src={logoImg} alt="EASI Logo" className="h-24 mx-auto mb-2" />
          </div>
          <div>
            <h2 className="card-title text-2xl">Forgot Password</h2>
            <p className="text-sm text-base-content/60 mt-1">
              Enter your account email and we'll send you a reset OTP.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="label-text">Email</label>
              <input
                type="email"
                className={`input input-bordered w-full${formError.email ? ' is-invalid' : ''}`}
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
              {formError.email && <span className="helper-text">{formError.email}</span>}
            </div>

            {formError._general && (
              <div className="alert alert-error text-sm py-2">{formError._general}</div>
            )}

            <button type="submit" className="btn btn-primary w-full" disabled={loading}>
              {loading ? <span className="loading loading-spinner loading-sm" /> : 'Send OTP'}
            </button>
          </form>

          <p className="text-center text-sm">
            <a className="link link-primary cursor-pointer" onClick={() => navigate('/login')}>
              Back to Sign in
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
