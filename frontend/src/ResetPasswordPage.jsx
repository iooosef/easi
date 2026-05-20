import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import logoImg from './assets/logo.png'

async function parseApiError(res) {
  const data = await res.json().catch(() => ({}))
  if (data.errors) return data.errors
  return { _general: data.message ?? data.error ?? `Error ${res.status}` }
}

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const email = location.state?.email ?? ''
  const otp = location.state?.otp ?? ''

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [formError, setFormError] = useState({})
  const [loading, setLoading] = useState(false)

  if (!email || !otp) {
    navigate('/forgot-password', { replace: true })
    return null
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError({})
    if (newPassword !== confirmPassword) {
      setFormError({ confirmPassword: 'Passwords do not match' })
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/users/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, newPassword }),
      })
      if (!res.ok) {
        setFormError(await parseApiError(res))
        return
      }
      navigate('/login', { state: { message: 'Password reset successfully. Please sign in.' } })
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
            <h2 className="card-title text-2xl">Reset Password</h2>
            <p className="text-sm text-base-content/60 mt-1">
              Enter and confirm your new password.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="label-text">New Password</label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  className={`input input-bordered w-full pr-10${formError.newPassword ? ' is-invalid' : ''}`}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  minLength={8}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-3 flex items-center text-base-content/50 hover:text-base-content"
                  onClick={() => setShowNew(v => !v)}
                  tabIndex={-1}
                >
                  {showNew ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9-4-9-7s4-7 9-7a9.96 9.96 0 015.657 1.757M15 12a3 3 0 11-4.243-4.243M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {formError.newPassword && <span className="helper-text">{formError.newPassword}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text">Confirm Password</label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  className={`input input-bordered w-full pr-10${formError.confirmPassword ? ' is-invalid' : ''}`}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-3 flex items-center text-base-content/50 hover:text-base-content"
                  onClick={() => setShowConfirm(v => !v)}
                  tabIndex={-1}
                >
                  {showConfirm ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9-4-9-7s4-7 9-7a9.96 9.96 0 015.657 1.757M15 12a3 3 0 11-4.243-4.243M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {formError.confirmPassword && <span className="helper-text">{formError.confirmPassword}</span>}
            </div>

            {formError._general && (
              <div className="alert alert-error text-sm py-2">{formError._general}</div>
            )}

            <button type="submit" className="btn btn-primary w-full" disabled={loading}>
              {loading ? <span className="loading loading-spinner loading-sm" /> : 'Reset Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
