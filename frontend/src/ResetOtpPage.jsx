import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import logoImg from './assets/logo.png'

async function parseApiError(res) {
  const data = await res.json().catch(() => ({}))
  if (data.errors) return data.errors
  return { _general: data.message ?? data.error ?? `Error ${res.status}` }
}

export default function ResetOtpPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const email = location.state?.email ?? ''

  const [otp, setOtp] = useState('')
  const [formError, setFormError] = useState({})
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError({})
    setLoading(true)
    try {
      const res = await fetch('/api/users/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      })
      if (!res.ok) {
        setFormError(await parseApiError(res))
        return
      }
      navigate('/reset-password', { state: { email, otp } })
    } catch {
      setFormError({ _general: 'Network error. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    setFormError({})
    try {
      await fetch('/api/users/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
    } catch {
      setFormError({ _general: 'Network error. Please try again.' })
    }
  }

  if (!email) {
    navigate('/forgot-password', { replace: true })
    return null
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-base-200">
      <div className="card w-full max-w-sm bg-base-100 shadow-md">
        <div className="card-body gap-4">
          <div>
            <img src={logoImg} alt="EASI Logo" className="h-24 mx-auto mb-2" />
          </div>
          <div>
            <h2 className="card-title text-2xl">Enter OTP</h2>
            <p className="text-sm text-base-content/60 mt-1">
              An OTP was sent to <span className="font-medium text-base-content">{email}</span>.
              Enter it below to continue.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="label-text">One-Time Password</label>
              <input
                type="text"
                className={`input input-bordered w-full tracking-widest text-center text-lg${formError.otp ? ' is-invalid' : ''}`}
                value={otp}
                onChange={e => setOtp(e.target.value)}
                required
                autoComplete="one-time-code"
                maxLength={8}
                placeholder="••••••••"
              />
              {formError.otp && <span className="helper-text">{formError.otp}</span>}
            </div>

            {formError._general && (
              <div className="alert alert-error text-sm py-2">{formError._general}</div>
            )}

            <button type="submit" className="btn btn-primary w-full" disabled={loading}>
              {loading ? <span className="loading loading-spinner loading-sm" /> : 'Verify OTP'}
            </button>
          </form>

          <p className="text-center text-sm">
            Didn't receive it?{' '}
            <a className="link link-primary cursor-pointer" onClick={handleResend}>
              Resend OTP
            </a>
          </p>
          <p className="text-center text-sm">
            <a className="link link-primary cursor-pointer" onClick={() => navigate('/forgot-password')}>
              Change email
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
