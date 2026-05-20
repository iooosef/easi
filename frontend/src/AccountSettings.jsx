import { useState } from 'react'
import { useAuth } from './auth'
import Layout from './Layout'

async function parseApiError(res) {
  const data = await res.json().catch(() => ({}))
  if (data.errors) return data.errors
  return { _general: data.message ?? data.error ?? `Error ${res.status}` }
}

/** Step 1 — verify the OTP */
function VerifyOtpStep({ email, onVerified, onBack }) {
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
      onVerified(otp)
    } catch {
      setFormError({ _general: 'Network error. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p className="text-base-content/60 text-sm">
        Enter the OTP sent to <span className="font-medium text-base-content">{email}</span>.
      </p>
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
      {formError._general && <div className="alert alert-error text-sm py-2">{formError._general}</div>}
      <div className="flex gap-2">
        <button type="button" className="btn btn-ghost flex-1" onClick={onBack}>Back</button>
        <button type="submit" className="btn btn-primary flex-1" disabled={loading}>
          {loading ? <span className="loading loading-spinner loading-sm" /> : 'Verify OTP'}
        </button>
      </div>
    </form>
  )
}

/** Step 2 — set the new password */
function NewPasswordStep({ email, otp, onSuccess }) {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [formError, setFormError] = useState({})
  const [loading, setLoading] = useState(false)

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
      onSuccess()
    } catch {
      setFormError({ _general: 'Network error. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  return (
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
          <button type="button" className="absolute inset-y-0 right-3 flex items-center text-base-content/50 hover:text-base-content" onClick={() => setShowNew(v => !v)} tabIndex={-1}>
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
          <button type="button" className="absolute inset-y-0 right-3 flex items-center text-base-content/50 hover:text-base-content" onClick={() => setShowConfirm(v => !v)} tabIndex={-1}>
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

      {formError._general && <div className="alert alert-error text-sm py-2">{formError._general}</div>}

      <button type="submit" className="btn btn-primary w-full" disabled={loading}>
        {loading ? <span className="loading loading-spinner loading-sm" /> : 'Reset Password'}
      </button>
    </form>
  )
}

const STEP_LABELS = ['Verify OTP', 'New Password']

/** Account Settings page — allows the logged-in user to change their password via OTP */
export default function AccountSettings() {
  const { user } = useAuth()
  // step: 'idle' | 'sending' | 'otp' | 'password' | 'done'
  const [step, setStep] = useState('idle')
  const [otp, setOtp] = useState('')
  const [sendError, setSendError] = useState('')

  async function handleResetPasswordClick() {
    setSendError('')
    setStep('sending')
    try {
      const res = await fetch('/api/users/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setSendError(data.message ?? data.error ?? 'Failed to send OTP.')
        setStep('idle')
        return
      }
      setStep('otp')
    } catch {
      setSendError('Network error. Please try again.')
      setStep('idle')
    }
  }

  return (
    <Layout activePage="account-settings">
      <h1 className="text-3xl font-semibold mb-1">Account Settings</h1>
      <p className="text-base-content/60 mb-8">Manage your account preferences.</p>

      {step === 'idle' || step === 'sending' ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            <div
              className={`group card bg-base-100 border border-base-300 transition-transform duration-300 cursor-pointer${step === 'sending' ? ' opacity-60 pointer-events-none' : ' hover:-translate-y-2'}`}
              onClick={handleResetPasswordClick}
            >
              <div className="card-body items-center justify-center text-center gap-3 py-8">
                {step === 'sending'
                  ? <span className="loading loading-spinner loading-md text-primary" />
                  : <span className="icon-[tabler--lock-password] size-10 text-primary" />
                }
                <p className="font-medium text-base-content">Reset Password</p>
              </div>
            </div>
          </div>
          {sendError && <p className="text-error text-sm mt-4">{sendError}</p>}
        </>
      ) : (
        <div className="card bg-base-100 shadow-sm max-w-md">
          <div className="card-body gap-6">
            <div>
              <h2 className="card-title text-lg">Change Password</h2>
            </div>

            {step !== 'done' && (
              <ul className="steps w-full text-xs">
                {STEP_LABELS.map((label, i) => (
                  <li key={label} className={`step${(step === 'otp' ? 0 : 1) >= i ? ' step-primary' : ''}`}>{label}</li>
                ))}
              </ul>
            )}

            {step === 'otp' && (
              <VerifyOtpStep
                email={user}
                onVerified={verifiedOtp => { setOtp(verifiedOtp); setStep('password') }}
                onBack={() => setStep('idle')}
              />
            )}
            {step === 'password' && (
              <NewPasswordStep email={user} otp={otp} onSuccess={() => setStep('done')} />
            )}
            {step === 'done' && (
              <div className="flex flex-col gap-4 items-center text-center">
                <span className="icon-[tabler--circle-check] size-12 text-success" />
                <p className="font-medium">Password changed successfully!</p>
                <button className="btn btn-ghost btn-sm" onClick={() => { setStep('idle'); setOtp('') }}>
                  Back to Account Settings
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  )
}
