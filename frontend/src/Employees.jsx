import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from './auth'
import { useModal } from './modals/index.js'
import Layout from './Layout'
import ModalNav from './modals/ModalNav.jsx'
import { notyfSuccess, notyfError } from './notyf'

const PAGE_SIZE = 15

const STATUS_OPTIONS = ['All Status', 'active', 'inactive', 'unset']
const GENDER_OPTIONS = ['Male', 'Female', 'N/A']
const ROLE_OPTIONS   = ['ADMIN', 'ACCOUNTING', 'HR', 'STAFF', 'CREW']
const EMP_STATUS_OPTIONS = ['active', 'inactive', 'unset']

const EMPTY_EMP_FORM = {
  lastName: '', firstName: '', middleName: '', suffixName: '',
  gender: 'Male', birthdate: '', contactNumber: '', position: '', status: 'active',
}

const EMPTY_REG_FORM = {
  email: '', password: '', role: 'STAFF',
}

/**
 * Parses a failed API response into field-level or general error objects.
 */
async function parseApiError(res) {
  const data = await res.json().catch(() => ({}))
  if (data.errors) return data.errors
  return { _general: data.message ?? data.error ?? `Error ${res.status}` }
}

/** Returns badge class based on employee status */
function statusBadgeClass(status) {
  switch (status?.toLowerCase()) {
    case 'active':   return 'badge-success'
    case 'inactive': return 'badge-error'
    default:         return 'badge-neutral'
  }
}

/** Concatenates employee name parts into a display name */
function fullName(emp) {
  const parts = [emp.firstName, emp.middleName, emp.lastName].filter(Boolean)
  const name = parts.join(' ')
  return emp.suffixName ? `${name} ${emp.suffixName}` : name
}

/** Formats a LocalDateTime or LocalDate string to YYYY-MM-DD */
function formatDate(dt) {
  if (!dt) return '—'
  return String(dt).slice(0, 10)
}

/** Level 1 — employee manage panel: details view and action menu. */
function ManageEmployeeModal({ emp: initialEmp, onRefresh }) {
  const { pushModal, popModal } = useModal()
  const { hasRole, apiFetch } = useAuth()
  const [emp, setEmp] = useState(initialEmp)

  async function refreshEmp() {
    try {
      const res = await apiFetch(`/api/employees/${emp.employeeId}`)
      if (res.ok) setEmp(await res.json())
    } catch (_) {}
    onRefresh?.()
  }

  const menuItems = [
    { key: 'update-employee', label: 'Update Employee Details', icon: 'icon-[tabler--user-edit]', roles: ['ADMIN', 'HR'] },
    emp.hasUserAccount
      ? { key: 'update-user', label: 'Update User Account', icon: 'icon-[tabler--user-cog]',
          roles: emp.userRole === 'ADMIN' ? ['ADMIN'] : ['ADMIN', 'HR'] }
      : { key: 'register-user', label: 'Register User Account', icon: 'icon-[tabler--user-plus]', roles: ['ADMIN', 'HR'] },
    ...(emp.hasUserAccount ? [{
      key: 'update-password',
      label: 'Update Password',
      icon: 'icon-[tabler--lock]',
      roles: emp.userRole === 'ADMIN' ? ['ADMIN'] : ['ADMIN', 'HR'],
    }] : []),
  ]

  function handleAction(key) {
    if (key === 'update-employee') pushModal(<UpdateEmployeeModal emp={emp} onSuccess={refreshEmp} />)
    if (key === 'update-user')     pushModal(<UpdateUserAccountModal emp={emp} onSuccess={refreshEmp} />)
    if (key === 'register-user')   pushModal(<RegisterUserAccountModal emp={emp} onSuccess={refreshEmp} />)
    if (key === 'update-password') pushModal(<UpdatePasswordModal emp={emp} />)
  }

  return (
    <div className="modal-content w-full max-w-2xl my-auto">
      <div className="modal-header">
        <div>
          <h3 className="modal-title">{fullName(emp)}</h3>
          <p className="text-sm text-base-content/50">Employee #{emp.employeeId}</p>
        </div>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body flex flex-col gap-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
          {[
            { label: 'Gender',      value: emp.gender },
            { label: 'Birthdate',   value: formatDate(emp.birthdate) },
            { label: 'Contact No.', value: emp.contactNumber },
            { label: 'Position',    value: emp.position },
            { label: 'Status',      value: emp.status ? emp.status.charAt(0).toUpperCase() + emp.status.slice(1) : '—' },
            { label: 'Added On',    value: formatDate(emp.addedOn) },
          ].map(({ label, value }) => (
            <div key={label} className="flex flex-col gap-0.5">
              <span className="text-xs text-base-content/50 uppercase tracking-wide">{label}</span>
              <span className="text-sm font-medium">{value ?? '—'}</span>
            </div>
          ))}
        </div>
        {emp.hasUserAccount && (
          <div className="border-t border-base-300 pt-4">
            <p className="text-xs text-base-content/50 uppercase tracking-wide mb-3">User Account</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-base-content/50 uppercase tracking-wide">User ID</span>
                <span className="text-sm font-medium">#{emp.userId}</span>
              </div>
              <div className="flex flex-col gap-0.5 sm:col-span-2">
                <span className="text-xs text-base-content/50 uppercase tracking-wide">Email</span>
                <span className="text-sm font-medium">{emp.userEmail}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-base-content/50 uppercase tracking-wide">Role</span>
                <span className="text-sm font-medium">{emp.userRole}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-base-content/50 uppercase tracking-wide">Account Status</span>
                <span className={`badge badge-soft text-xs w-fit ${emp.userStatus === 1 ? 'badge-success' : 'badge-error'}`}>
                  {emp.userStatus === 1 ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-base-content/50 uppercase tracking-wide">Registered On</span>
                <span className="text-sm font-medium">{formatDate(emp.userAddedOn)}</span>
              </div>
            </div>
          </div>
        )}
        <ModalNav items={menuItems} hasRole={hasRole} onSelect={handleAction} title="Actions" cols={4} />
      </div>
    </div>
  )
}

/** Level 2 — update employee details form. */
function UpdateEmployeeModal({ emp, onSuccess }) {
  const { popModal } = useModal()
  const { apiFetch } = useAuth()
  const [form, setForm] = useState({
    lastName:      emp.lastName      ?? '',
    firstName:     emp.firstName     ?? '',
    middleName:    emp.middleName    ?? '',
    suffixName:    emp.suffixName    ?? '',
    gender:        emp.gender        ?? 'Male',
    birthdate:     emp.birthdate     ? String(emp.birthdate).slice(0, 10) : '',
    contactNumber: emp.contactNumber ?? '',
    position:      emp.position      ?? '',
    status:        emp.status        ?? 'active',
  })
  const [formError, setFormError] = useState({})
  const [submitting, setSubmitting] = useState(false)

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  /** Submits updated employee details and pops this layer on success. */
  async function handleSubmit(e) {
    e.preventDefault()
    setFormError({})
    setSubmitting(true)
    try {
      const res = await apiFetch(`/api/employees/${emp.employeeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) { setFormError(await parseApiError(res)); notyfError('Update failed'); return }
      const updated = await res.json().catch(() => ({}))
      notyfSuccess(`Employee "${fullName(updated)}" updated.`)
      popModal()
      onSuccess?.()
    } catch (err) {
      setFormError({ _general: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-content w-full max-w-lg my-auto">
      <div className="modal-header">
        <h3 className="modal-title">Update Employee Details</h3>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="modal-body">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">First Name <span className="text-error">*</span></label>
              <input type="text" name="firstName"
                className={`input input-bordered w-full${formError.firstName ? ' is-invalid' : ''}`}
                maxLength={255} required value={form.firstName} onChange={handleChange} />
              {formError.firstName && <span className="helper-text">{formError.firstName}</span>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Last Name <span className="text-error">*</span></label>
              <input type="text" name="lastName"
                className={`input input-bordered w-full${formError.lastName ? ' is-invalid' : ''}`}
                maxLength={255} required value={form.lastName} onChange={handleChange} />
              {formError.lastName && <span className="helper-text">{formError.lastName}</span>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Middle Name</label>
              <input type="text" name="middleName"
                className={`input input-bordered w-full${formError.middleName ? ' is-invalid' : ''}`}
                maxLength={255} value={form.middleName} onChange={handleChange} />
              {formError.middleName && <span className="helper-text">{formError.middleName}</span>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Suffix</label>
              <input type="text" name="suffixName"
                className={`input input-bordered w-full${formError.suffixName ? ' is-invalid' : ''}`}
                maxLength={255} placeholder="e.g. Jr., III" value={form.suffixName} onChange={handleChange} />
              {formError.suffixName && <span className="helper-text">{formError.suffixName}</span>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Gender <span className="text-error">*</span></label>
              <select name="gender"
                className={`select select-bordered w-full${formError.gender ? ' is-invalid' : ''}`}
                required value={form.gender} onChange={handleChange}>
                {GENDER_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              {formError.gender && <span className="helper-text">{formError.gender}</span>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Birthdate <span className="text-error">*</span></label>
              <input type="date" name="birthdate"
                className={`input input-bordered w-full${formError.birthdate ? ' is-invalid' : ''}`}
                required value={form.birthdate} onChange={handleChange} />
              {formError.birthdate && <span className="helper-text">{formError.birthdate}</span>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Contact Number <span className="text-error">*</span></label>
              <input type="tel" name="contactNumber"
                className={`input input-bordered w-full${formError.contactNumber ? ' is-invalid' : ''}`}
                maxLength={16} required value={form.contactNumber} onChange={handleChange} />
              {formError.contactNumber && <span className="helper-text">{formError.contactNumber}</span>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Position <span className="text-error">*</span></label>
              <input type="text" name="position"
                className={`input input-bordered w-full${formError.position ? ' is-invalid' : ''}`}
                maxLength={30} required value={form.position} onChange={handleChange} />
              {formError.position && <span className="helper-text">{formError.position}</span>}
            </div>
            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="label-text font-medium">Status</label>
              <select name="status"
                className={`select select-bordered w-full${formError.status ? ' is-invalid' : ''}`}
                value={form.status} onChange={handleChange}>
                {EMP_STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
              {formError.status && <span className="helper-text">{formError.status}</span>}
            </div>
            {formError._general && (
              <div className="sm:col-span-2 alert alert-error py-2">
                <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                <span className="text-sm">{formError._general}</span>
              </div>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-soft btn-secondary" onClick={popModal}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting
              ? <span className="loading loading-spinner loading-sm"></span>
              : <span className="icon-[tabler--device-floppy] size-4"></span>
            }
            Save Changes
          </button>
        </div>
      </form>
    </div>
  )
}

/** Level 2 — update user account form. */
function UpdateUserAccountModal({ emp, onSuccess }) {
  const { popModal } = useModal()
  const { apiFetch } = useAuth()
  const [form, setForm] = useState({
    email:    emp.userEmail  ?? '',
    role:     emp.userRole   ?? 'STAFF',
    status:   emp.userStatus ?? 1,
    password: '',
  })
  const [formError, setFormError] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  function handleChange(e) {
    const { name, value, type } = e.target
    setForm(prev => ({ ...prev, [name]: type === 'number' ? Number(value) : value }))
  }

  /** Submits updated user account and pops this layer on success. */
  async function handleSubmit(e) {
    e.preventDefault()
    setFormError({})
    setSubmitting(true)
    try {
      const res = await apiFetch(`/api/users/${emp.userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, status: Number(form.status) }),
      })
      if (!res.ok) { setFormError(await parseApiError(res)); notyfError('Update failed'); return }
      notyfSuccess('User account updated.')
      popModal()
      onSuccess?.()
    } catch (err) {
      setFormError({ _general: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-content w-full max-w-lg my-auto">
      <div className="modal-header">
        <h3 className="modal-title">Update User Account</h3>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="modal-body">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="label-text font-medium">Email <span className="text-error">*</span></label>
              <input type="email" name="email"
                className={`input input-bordered w-full${formError.email ? ' is-invalid' : ''}`}
                maxLength={255} required value={form.email} onChange={handleChange} />
              {formError.email && <span className="helper-text">{formError.email}</span>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Role <span className="text-error">*</span></label>
              <select name="role"
                className={`select select-bordered w-full${formError.role ? ' is-invalid' : ''}`}
                required value={form.role} onChange={handleChange}>
                {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              {formError.role && <span className="helper-text">{formError.role}</span>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Account Status <span className="text-error">*</span></label>
              <select name="status"
                className={`select select-bordered w-full${formError.status ? ' is-invalid' : ''}`}
                value={form.status} onChange={handleChange}>
                <option value={1}>Active</option>
                <option value={0}>Inactive</option>
              </select>
              {formError.status && <span className="helper-text">{formError.status}</span>}
            </div>
            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="label-text font-medium">New Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  className={`input input-bordered w-full pr-10${formError.password ? ' is-invalid' : ''}`}
                  placeholder="Leave blank to keep current password"
                  minLength={8}
                  value={form.password}
                  onChange={handleChange}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content"
                  onClick={() => setShowPassword(v => !v)}
                  tabIndex={-1}
                >
                  <span className={`size-4 ${showPassword ? 'icon-[tabler--eye-off]' : 'icon-[tabler--eye]'}`}></span>
                </button>
              </div>
              {formError.password && <span className="helper-text">{formError.password}</span>}
            </div>
            {formError._general && (
              <div className="sm:col-span-2 alert alert-error py-2">
                <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                <span className="text-sm">{formError._general}</span>
              </div>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-soft btn-secondary" onClick={popModal}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting
              ? <span className="loading loading-spinner loading-sm"></span>
              : <span className="icon-[tabler--device-floppy] size-4"></span>
            }
            Save Changes
          </button>
        </div>
      </form>
    </div>
  )
}

/** Level 2 — register a new user account for an employee. */
function RegisterUserAccountModal({ emp, onSuccess }) {
  const { popModal } = useModal()
  const { apiFetch } = useAuth()
  const [form, setForm] = useState(EMPTY_REG_FORM)
  const [formError, setFormError] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  /** Submits user account registration and pops this layer on success. */
  async function handleSubmit(e) {
    e.preventDefault()
    setFormError({})
    setSubmitting(true)
    try {
      const res = await apiFetch('/api/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: emp.employeeId, ...form }),
      })
      if (!res.ok) { setFormError(await parseApiError(res)); notyfError('Registration failed'); return }
      notyfSuccess('User account registered successfully.')
      popModal()
      onSuccess?.()
    } catch (err) {
      setFormError({ _general: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-content w-full max-w-lg my-auto">
      <div className="modal-header">
        <h3 className="modal-title">Register User Account</h3>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="modal-body">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="label-text font-medium">Email <span className="text-error">*</span></label>
              <input type="email" name="email"
                className={`input input-bordered w-full${formError.email ? ' is-invalid' : ''}`}
                maxLength={255} required value={form.email} onChange={handleChange} />
              {formError.email && <span className="helper-text">{formError.email}</span>}
            </div>
            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="label-text font-medium">Password <span className="text-error">*</span></label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  className={`input input-bordered w-full pr-10${formError.password ? ' is-invalid' : ''}`}
                  minLength={8} required value={form.password} onChange={handleChange}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content"
                  onClick={() => setShowPassword(v => !v)}
                  tabIndex={-1}
                >
                  <span className={`size-4 ${showPassword ? 'icon-[tabler--eye-off]' : 'icon-[tabler--eye]'}`}></span>
                </button>
              </div>
              {formError.password && <span className="helper-text">{formError.password}</span>}
            </div>
            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="label-text font-medium">Role <span className="text-error">*</span></label>
              <select name="role"
                className={`select select-bordered w-full${formError.role ? ' is-invalid' : ''}`}
                required value={form.role} onChange={handleChange}>
                {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              {formError.role && <span className="helper-text">{formError.role}</span>}
            </div>
            {formError._general && (
              <div className="sm:col-span-2 alert alert-error py-2">
                <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                <span className="text-sm">{formError._general}</span>
              </div>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-soft btn-secondary" onClick={popModal}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting
              ? <span className="loading loading-spinner loading-sm"></span>
              : <span className="icon-[tabler--user-plus] size-4"></span>
            }
            Register
          </button>
        </div>
      </form>
    </div>
  )
}

/** Level 2 — update the password of an employee's user account. */
function UpdatePasswordModal({ emp }) {
  const { popModal } = useModal()
  const { apiFetch } = useAuth()
  const [form, setForm] = useState({ password: '', confirm: '' })
  const [formError, setFormError] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  /** Submits a new password for the employee's user account. */
  async function handleSubmit(e) {
    e.preventDefault()
    setFormError({})
    if (form.password !== form.confirm) {
      setFormError({ confirm: 'Passwords do not match.' })
      return
    }
    setSubmitting(true)
    try {
      const res = await apiFetch('/api/users/admin-reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: emp.userId, newPassword: form.password }),
      })
      if (!res.ok) { setFormError(await parseApiError(res)); notyfError('Password update failed'); return }
      notyfSuccess('Password updated successfully.')
      popModal()
    } catch (err) {
      setFormError({ _general: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-content w-full max-w-sm my-auto">
      <div className="modal-header">
        <h3 className="modal-title">Update Password</h3>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="modal-body">
          <div className="flex flex-col gap-4">
            <p className="text-sm text-base-content/60">
              Updating password for <span className="font-medium">{emp.userEmail}</span>
            </p>
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">New Password <span className="text-error">*</span></label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  className={`input input-bordered w-full pr-10${formError.password ? ' is-invalid' : ''}`}
                  minLength={8} required value={form.password} onChange={handleChange}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content"
                  onClick={() => setShowPassword(v => !v)}
                  tabIndex={-1}
                >
                  <span className={`size-4 ${showPassword ? 'icon-[tabler--eye-off]' : 'icon-[tabler--eye]'}`}></span>
                </button>
              </div>
              {formError.password && <span className="helper-text">{formError.password}</span>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Confirm Password <span className="text-error">*</span></label>
              <input
                type={showPassword ? 'text' : 'password'}
                name="confirm"
                className={`input input-bordered w-full${formError.confirm ? ' is-invalid' : ''}`}
                minLength={8} required value={form.confirm} onChange={handleChange}
              />
              {formError.confirm && <span className="helper-text">{formError.confirm}</span>}
            </div>
            {formError._general && (
              <div className="alert alert-error py-2">
                <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                <span className="text-sm">{formError._general}</span>
              </div>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-soft btn-secondary" onClick={popModal}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting
              ? <span className="loading loading-spinner loading-sm"></span>
              : <span className="icon-[tabler--lock] size-4"></span>
            }
            Update Password
          </button>
        </div>
      </form>
    </div>
  )
}

/** Modal for creating a new employee record. */
function NewEmployeeModal({ onSuccess }) {
  const { popModal } = useModal()
  const { apiFetch } = useAuth()
  const [form, setForm]         = useState(EMPTY_EMP_FORM)
  const [formError, setFormError] = useState({})
  const [submitting, setSubmitting] = useState(false)

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  /** Submits the new employee and closes this layer on success. */
  async function handleSubmit(e) {
    e.preventDefault()
    setFormError({})
    setSubmitting(true)
    try {
      const res = await apiFetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) { setFormError(await parseApiError(res)); notyfError('Failed to add employee'); return }
      const data = await res.json().catch(() => ({}))
      notyfSuccess(`Employee "${fullName(data)}" added successfully.`)
      popModal()
      onSuccess?.()
    } catch (err) {
      setFormError({ _general: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-content w-full max-w-lg my-auto">
      <div className="modal-header">
        <h3 className="modal-title">New Employee</h3>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="modal-body">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">First Name <span className="text-error">*</span></label>
              <input type="text" name="firstName"
                className={`input input-bordered w-full${formError.firstName ? ' is-invalid' : ''}`}
                maxLength={255} required value={form.firstName} onChange={handleChange} />
              {formError.firstName && <span className="helper-text">{formError.firstName}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Last Name <span className="text-error">*</span></label>
              <input type="text" name="lastName"
                className={`input input-bordered w-full${formError.lastName ? ' is-invalid' : ''}`}
                maxLength={255} required value={form.lastName} onChange={handleChange} />
              {formError.lastName && <span className="helper-text">{formError.lastName}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Middle Name</label>
              <input type="text" name="middleName"
                className={`input input-bordered w-full${formError.middleName ? ' is-invalid' : ''}`}
                maxLength={255} value={form.middleName} onChange={handleChange} />
              {formError.middleName && <span className="helper-text">{formError.middleName}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Suffix</label>
              <input type="text" name="suffixName"
                className={`input input-bordered w-full${formError.suffixName ? ' is-invalid' : ''}`}
                maxLength={255} placeholder="e.g. Jr., III" value={form.suffixName} onChange={handleChange} />
              {formError.suffixName && <span className="helper-text">{formError.suffixName}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Gender <span className="text-error">*</span></label>
              <select name="gender"
                className={`select select-bordered w-full${formError.gender ? ' is-invalid' : ''}`}
                required value={form.gender} onChange={handleChange}>
                {GENDER_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              {formError.gender && <span className="helper-text">{formError.gender}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Birthdate <span className="text-error">*</span></label>
              <input type="date" name="birthdate"
                className={`input input-bordered w-full${formError.birthdate ? ' is-invalid' : ''}`}
                required value={form.birthdate} onChange={handleChange} />
              {formError.birthdate && <span className="helper-text">{formError.birthdate}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Contact Number <span className="text-error">*</span></label>
              <input type="tel" name="contactNumber"
                className={`input input-bordered w-full${formError.contactNumber ? ' is-invalid' : ''}`}
                maxLength={16} required value={form.contactNumber} onChange={handleChange} />
              {formError.contactNumber && <span className="helper-text">{formError.contactNumber}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Position <span className="text-error">*</span></label>
              <input type="text" name="position"
                className={`input input-bordered w-full${formError.position ? ' is-invalid' : ''}`}
                maxLength={30} required value={form.position} onChange={handleChange} />
              {formError.position && <span className="helper-text">{formError.position}</span>}
            </div>

            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="label-text font-medium">Status</label>
              <select name="status"
                className={`select select-bordered w-full${formError.status ? ' is-invalid' : ''}`}
                value={form.status} onChange={handleChange}>
                {EMP_STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
              {formError.status && <span className="helper-text">{formError.status}</span>}
            </div>

            {formError._general && (
              <div className="sm:col-span-2 alert alert-error py-2">
                <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                <span className="text-sm">{formError._general}</span>
              </div>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-soft btn-secondary" onClick={popModal}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting
              ? <span className="loading loading-spinner loading-sm"></span>
              : <span className="icon-[tabler--plus] size-4"></span>
            }
            Add Employee
          </button>
        </div>
      </form>
    </div>
  )
}

export default function Employees() {
  const { apiFetch, hasRole } = useAuth()
  const { pushModal } = useModal()
  const [searchParams] = useSearchParams()

  // Table state
  const [employees, setEmployees]         = useState([])
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState(null)
  const [search, setSearch]               = useState('')
  const [statusFilter, setStatusFilter]   = useState('All Status')
  const [page, setPage]                   = useState(0)
  const [totalPages, setTotalPages]       = useState(0)
  const [totalElements, setTotalElements] = useState(0)


  async function fetchEmployees() {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(page), size: String(PAGE_SIZE), sort: 'lastName,asc' })
      const res = await apiFetch(`/api/employees?${params}`)
      if (!res.ok) throw new Error(`Failed to load employees (${res.status})`)
      const data = await res.json()
      setEmployees(data.content ?? [])
      setTotalPages(data.totalPages ?? 0)
      setTotalElements(data.totalElements ?? 0)
    } catch (err) {
      setError(err.message)
      notyfError('Failed to load employees')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchEmployees() }, [apiFetch, page])

  const filtered = employees.filter(emp => {
    const matchesSearch =
      search === '' ||
      fullName(emp).toLowerCase().includes(search.toLowerCase()) ||
      emp.position?.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'All Status' || emp.status === statusFilter
    return matchesSearch && matchesStatus
  })

  // Auto-open New Employee modal when ?addEmployee=1 is in the URL
  useEffect(() => {
    if (searchParams.get('addEmployee') === '1')
      pushModal(<NewEmployeeModal onSuccess={() => { setPage(0); fetchEmployees() }} />)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Layout activePage="employees">
      {/* Header */}
      <div className="flex items-stretch justify-between h-16 mb-6">
        <div>
          <h1 className="text-3xl font-semibold">Employees</h1>
          <p className="text-base-content/60 mt-1">View and manage employee records</p>
        </div>
        <div className="flex gap-2 items-center h-full">
          {hasRole('ADMIN', 'HR') && (
            <button
              type="button"
              className="btn btn-primary h-full min-h-0"
              onClick={() => pushModal(<NewEmployeeModal onSuccess={() => { setPage(0); fetchEmployees() }} />)}
            >
              <span className="icon-[tabler--plus] size-4"></span>
              New Employee
            </button>
          )}
        </div>
      </div>

      {/* Search and filter */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-3">
          <span className="icon-[tabler--search] size-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none"></span>
          <input
            type="text"
            className="input input-bordered w-full pl-9"
            placeholder="Search by name or position..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 flex-1 border border-base-300 rounded-field bg-base-100 px-3">
          <span className="icon-[tabler--filter] size-4 text-base-content/40 shrink-0"></span>
          <select
            className="select select-ghost w-full border-none outline-none bg-transparent p-0 focus:outline-none"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            {STATUS_OPTIONS.map(s => (
              <option key={s} value={s}>
                {s === 'All Status' ? 'All Status' : s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-20">
          <span className="loading loading-spinner loading-lg text-primary"></span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="alert alert-error">
          <span className="icon-[tabler--alert-circle] size-5"></span>
          <span>{error}</span>
        </div>
      )}

      {/* Table */}
      {!loading && !error && (
        <>
          <p className="text-sm text-base-content/50 mb-3">
            {totalElements} employee{totalElements !== 1 ? 's' : ''} total
            {(search || statusFilter !== 'All Status') && ` · ${filtered.length} shown`}
          </p>

          {filtered.length === 0 ? (
            <div className="text-center py-20 text-base-content/40">
              <span className="icon-[tabler--user-off] size-12 mx-auto mb-3 block"></span>
              <p>No employees found.</p>
            </div>
          ) : (
            <div className="card bg-base-100 border border-base-300 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="table table-zebra w-full">
                  <thead>
                    <tr>
                      <th className="w-16">ID</th>
                      <th>Full Name</th>
                      <th>Position</th>
                      <th>Status</th>
                      <th>User Account</th>
                      <th className="w-28 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(emp => (
                      <tr key={emp.employeeId}>
                        <td className="text-base-content/50 font-mono text-sm">#{emp.employeeId}</td>
                        <td className="font-medium">{fullName(emp)}</td>
                        <td className="text-base-content/70">{emp.position || '—'}</td>
                        <td>
                          <span className={`badge badge-soft ${statusBadgeClass(emp.status)} text-xs`}>
                            {emp.status ? emp.status.charAt(0).toUpperCase() + emp.status.slice(1) : 'Unset'}
                          </span>
                        </td>
                        <td>
                          {emp.hasUserAccount
                            ? <span className="badge badge-soft badge-success text-xs"><span className="icon-[tabler--check] size-3 me-1"></span>Yes</span>
                            : <span className="badge badge-soft badge-neutral text-xs"><span className="icon-[tabler--x] size-3 me-1"></span>No</span>
                          }
                        </td>
                        <td className="text-center">
                          <button
                            type="button"
                            className="btn btn-soft btn-primary btn-sm"
                            onClick={() => pushModal(<ManageEmployeeModal emp={emp} onRefresh={fetchEmployees} />)}
                          >
                            <span className="icon-[tabler--settings] size-4"></span>
                            Manage
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button className="btn btn-sm btn-secondary" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                <span className="icon-[tabler--chevron-left] size-4"></span>
                Prev
              </button>
              <span className="text-sm text-base-content/60">Page {page + 1} of {totalPages}</span>
              <button className="btn btn-sm btn-secondary" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                Next
                <span className="icon-[tabler--chevron-right] size-4"></span>
              </button>
            </div>
          )}
        </>
      )}

    </Layout>
  )
}
