import { useState, useEffect } from 'react'
import { useAuth } from './auth'
import Layout from './Layout'
import ManageMenu from './ManageMenu'
import Modal from './Modal'
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

const EMPTY_USER_FORM = {
  email: '', role: 'STAFF', status: 1, password: '',
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

export default function Employees() {
  const { apiFetch, hasRole } = useAuth()

  // Table state
  const [employees, setEmployees]         = useState([])
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState(null)
  const [search, setSearch]               = useState('')
  const [statusFilter, setStatusFilter]   = useState('All Status')
  const [page, setPage]                   = useState(0)
  const [totalPages, setTotalPages]       = useState(0)
  const [totalElements, setTotalElements] = useState(0)

  // Manage menu
  const [selectedEmployee, setSelectedEmployee] = useState(null)

  // Update Employee modal
  const [empModalOpen, setEmpModalOpen]   = useState(false)
  const [empForm, setEmpForm]             = useState(EMPTY_EMP_FORM)
  const [empFormError, setEmpFormError]   = useState({})
  const [empSubmitting, setEmpSubmitting] = useState(false)
  const [editingEmpId, setEditingEmpId]   = useState(null)

  // Update User Account modal
  const [userModalOpen, setUserModalOpen]   = useState(false)
  const [userForm, setUserForm]             = useState(EMPTY_USER_FORM)
  const [userFormError, setUserFormError]   = useState({})
  const [userSubmitting, setUserSubmitting] = useState(false)
  const [editingUserId, setEditingUserId]   = useState(null)
  const [showUserPassword, setShowUserPassword] = useState(false)

  // New Employee modal
  const [newEmpModalOpen, setNewEmpModalOpen]   = useState(false)
  const [newEmpForm, setNewEmpForm]             = useState(EMPTY_EMP_FORM)
  const [newEmpFormError, setNewEmpFormError]   = useState({})
  const [newEmpSubmitting, setNewEmpSubmitting] = useState(false)

  // Register User Account modal
  const [regModalOpen, setRegModalOpen]     = useState(false)
  const [regForm, setRegForm]               = useState(EMPTY_REG_FORM)
  const [regFormError, setRegFormError]     = useState({})
  const [regSubmitting, setRegSubmitting]   = useState(false)
  const [regEmpId, setRegEmpId]             = useState(null)
  const [showRegPassword, setShowRegPassword] = useState(false)

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

  // --- New Employee modal handlers ---
  function openNewEmpModal() {
    setNewEmpForm(EMPTY_EMP_FORM)
    setNewEmpFormError({})
    setNewEmpModalOpen(true)
  }

  function closeNewEmpModal() {
    setNewEmpModalOpen(false)
    setNewEmpForm(EMPTY_EMP_FORM)
    setNewEmpFormError({})
  }

  function handleNewEmpFormChange(e) {
    const { name, value } = e.target
    setNewEmpForm(prev => ({ ...prev, [name]: value }))
  }

  async function handleNewEmpSubmit(e) {
    e.preventDefault()
    setNewEmpFormError({})
    setNewEmpSubmitting(true)
    try {
      const res = await apiFetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEmpForm),
      })
      if (!res.ok) {
        setNewEmpFormError(await parseApiError(res))
        notyfError('Failed to add employee')
        return
      }
      const data = await res.json().catch(() => ({}))
      closeNewEmpModal()
      setTimeout(() => notyfSuccess(`Employee "${fullName(data)}" added successfully.`), 150)
      setPage(0)
      await fetchEmployees()
    } catch (err) {
      setNewEmpFormError({ _general: err.message })
    } finally {
      setNewEmpSubmitting(false)
    }
  }

  // --- Update Employee modal handlers ---
  function openEmpModal(emp) {
    setEditingEmpId(emp.employeeId)
    setEmpForm({
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
    setEmpFormError({})
    setEmpModalOpen(true)
  }

  function closeEmpModal() {
    setEmpModalOpen(false)
    setEditingEmpId(null)
    setEmpForm(EMPTY_EMP_FORM)
    setEmpFormError({})
  }

  function handleEmpFormChange(e) {
    const { name, value } = e.target
    setEmpForm(prev => ({ ...prev, [name]: value }))
  }

  async function handleEmpSubmit(e) {
    e.preventDefault()
    setEmpFormError({})
    setEmpSubmitting(true)
    try {
      const res = await apiFetch(`/api/employees/${editingEmpId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(empForm),
      })
      if (!res.ok) {
        setEmpFormError(await parseApiError(res))
        notyfError('Update failed')
        return
      }
      const updated = await res.json().catch(() => ({}))
      closeEmpModal()
      setSelectedEmployee(null)
      setTimeout(() => notyfSuccess(`Employee "${fullName(updated)}" updated.`), 150)
      await fetchEmployees()
    } catch (err) {
      setEmpFormError({ _general: err.message })
    } finally {
      setEmpSubmitting(false)
    }
  }

  // --- Update User Account modal handlers ---
  function openUserModal(emp) {
    setEditingUserId(emp.userId)
    setUserForm({
      email:  emp.userEmail  ?? '',
      role:   emp.userRole   ?? 'STAFF',
      status: emp.userStatus ?? 1,
    })
    setUserFormError({})
    setUserModalOpen(true)
  }

  function closeUserModal() {
    setUserModalOpen(false)
    setEditingUserId(null)
    setUserForm(EMPTY_USER_FORM)
    setUserFormError({})
    setShowUserPassword(false)
  }

  function handleUserFormChange(e) {
    const { name, value, type } = e.target
    setUserForm(prev => ({ ...prev, [name]: type === 'number' ? Number(value) : value }))
  }

  async function handleUserSubmit(e) {
    e.preventDefault()
    setUserFormError({})
    setUserSubmitting(true)
    try {
      const res = await apiFetch(`/api/users/${editingUserId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...userForm, status: Number(userForm.status) }),
      })
      if (!res.ok) {
        setUserFormError(await parseApiError(res))
        notyfError('Update failed')
        return
      }
      closeUserModal()
      setSelectedEmployee(null)
      setTimeout(() => notyfSuccess('User account updated.'), 150)
      await fetchEmployees()
    } catch (err) {
      setUserFormError({ _general: err.message })
    } finally {
      setUserSubmitting(false)
    }
  }

  // --- Register User Account modal handlers ---
  function openRegModal(emp) {
    setRegEmpId(emp.employeeId)
    setRegForm(EMPTY_REG_FORM)
    setRegFormError({})
    setRegModalOpen(true)
  }

  function closeRegModal() {
    setRegModalOpen(false)
    setRegEmpId(null)
    setRegForm(EMPTY_REG_FORM)
    setRegFormError({})
    setShowRegPassword(false)
  }

  function handleRegFormChange(e) {
    const { name, value } = e.target
    setRegForm(prev => ({ ...prev, [name]: value }))
  }

  async function handleRegSubmit(e) {
    e.preventDefault()
    setRegFormError({})
    setRegSubmitting(true)
    try {
      const res = await apiFetch('/api/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: regEmpId, ...regForm }),
      })
      if (!res.ok) {
        setRegFormError(await parseApiError(res))
        notyfError('Registration failed')
        return
      }
      closeRegModal()
      setSelectedEmployee(null)
      setTimeout(() => notyfSuccess('User account registered successfully.'), 150)
      await fetchEmployees()
    } catch (err) {
      setRegFormError({ _general: err.message })
    } finally {
      setRegSubmitting(false)
    }
  }

  // --- ManageMenu config ---
  const empMenuItems = selectedEmployee ? [
    { key: 'update-employee', label: 'Update Employee Details', icon: 'icon-[tabler--user-edit]',    roles: ['ADMIN', 'HR'] },
    selectedEmployee.hasUserAccount
      ? { key: 'update-user',   label: 'Update User Account',     icon: 'icon-[tabler--user-cog]',    roles: ['ADMIN', 'HR'] }
      : { key: 'register-user', label: 'Register User Account',   icon: 'icon-[tabler--user-plus]',   roles: ['ADMIN', 'HR'] },
  ] : []

  function buildDetails(emp) {
    if (!emp) return []
    const details = [
      { label: 'Employee ID', value: `#${emp.employeeId}` },
      { label: 'Gender',      value: emp.gender },
      { label: 'Birthdate',   value: formatDate(emp.birthdate) },
      { label: 'Contact No.', value: emp.contactNumber },
      { label: 'Position',    value: emp.position },
      { label: 'Status',      value: emp.status ? emp.status.charAt(0).toUpperCase() + emp.status.slice(1) : '—' },
      { label: 'Added On',    value: formatDate(emp.addedOn) },
    ]

    if (emp.hasUserAccount) {
      details.push({
        fullWidth: true,
        component: (
          <div className="border-t border-base-300 pt-4 mt-2">
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
        ),
      })
    }

    return details
  }

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
              onClick={openNewEmpModal}
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
                            onClick={() => setSelectedEmployee(emp)}
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
              <button className="btn btn-sm btn-ghost" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                <span className="icon-[tabler--chevron-left] size-4"></span>
                Prev
              </button>
              <span className="text-sm text-base-content/60">Page {page + 1} of {totalPages}</span>
              <button className="btn btn-sm btn-ghost" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                Next
                <span className="icon-[tabler--chevron-right] size-4"></span>
              </button>
            </div>
          )}
        </>
      )}

      {/* New Employee Modal */}
      <Modal
        isOpen={newEmpModalOpen}
        onClose={closeNewEmpModal}
        title="New Employee"
        footer={
          <>
            <button type="button" className="btn btn-soft btn-secondary" onClick={closeNewEmpModal}>Cancel</button>
            <button type="submit" form="new-emp-form" className="btn btn-primary" disabled={newEmpSubmitting}>
              {newEmpSubmitting
                ? <span className="loading loading-spinner loading-sm"></span>
                : <span className="icon-[tabler--plus] size-4"></span>
              }
              Add Employee
            </button>
          </>
        }
      >
        <form id="new-emp-form" onSubmit={handleNewEmpSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">First Name <span className="text-error">*</span></label>
              <input type="text" name="firstName"
                className={`input input-bordered w-full${newEmpFormError.firstName ? ' is-invalid' : ''}`}
                maxLength={255} required value={newEmpForm.firstName} onChange={handleNewEmpFormChange} />
              {newEmpFormError.firstName && <span className="helper-text">{newEmpFormError.firstName}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Last Name <span className="text-error">*</span></label>
              <input type="text" name="lastName"
                className={`input input-bordered w-full${newEmpFormError.lastName ? ' is-invalid' : ''}`}
                maxLength={255} required value={newEmpForm.lastName} onChange={handleNewEmpFormChange} />
              {newEmpFormError.lastName && <span className="helper-text">{newEmpFormError.lastName}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Middle Name</label>
              <input type="text" name="middleName"
                className={`input input-bordered w-full${newEmpFormError.middleName ? ' is-invalid' : ''}`}
                maxLength={255} value={newEmpForm.middleName} onChange={handleNewEmpFormChange} />
              {newEmpFormError.middleName && <span className="helper-text">{newEmpFormError.middleName}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Suffix</label>
              <input type="text" name="suffixName"
                className={`input input-bordered w-full${newEmpFormError.suffixName ? ' is-invalid' : ''}`}
                maxLength={255} placeholder="e.g. Jr., III" value={newEmpForm.suffixName} onChange={handleNewEmpFormChange} />
              {newEmpFormError.suffixName && <span className="helper-text">{newEmpFormError.suffixName}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Gender <span className="text-error">*</span></label>
              <select name="gender"
                className={`select select-bordered w-full${newEmpFormError.gender ? ' is-invalid' : ''}`}
                required value={newEmpForm.gender} onChange={handleNewEmpFormChange}>
                {GENDER_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              {newEmpFormError.gender && <span className="helper-text">{newEmpFormError.gender}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Birthdate <span className="text-error">*</span></label>
              <input type="date" name="birthdate"
                className={`input input-bordered w-full${newEmpFormError.birthdate ? ' is-invalid' : ''}`}
                required value={newEmpForm.birthdate} onChange={handleNewEmpFormChange} />
              {newEmpFormError.birthdate && <span className="helper-text">{newEmpFormError.birthdate}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Contact Number <span className="text-error">*</span></label>
              <input type="tel" name="contactNumber"
                className={`input input-bordered w-full${newEmpFormError.contactNumber ? ' is-invalid' : ''}`}
                maxLength={16} required value={newEmpForm.contactNumber} onChange={handleNewEmpFormChange} />
              {newEmpFormError.contactNumber && <span className="helper-text">{newEmpFormError.contactNumber}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Position <span className="text-error">*</span></label>
              <input type="text" name="position"
                className={`input input-bordered w-full${newEmpFormError.position ? ' is-invalid' : ''}`}
                maxLength={30} required value={newEmpForm.position} onChange={handleNewEmpFormChange} />
              {newEmpFormError.position && <span className="helper-text">{newEmpFormError.position}</span>}
            </div>

            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="label-text font-medium">Status</label>
              <select name="status"
                className={`select select-bordered w-full${newEmpFormError.status ? ' is-invalid' : ''}`}
                value={newEmpForm.status} onChange={handleNewEmpFormChange}>
                {EMP_STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
              {newEmpFormError.status && <span className="helper-text">{newEmpFormError.status}</span>}
            </div>

            {newEmpFormError._general && (
              <div className="sm:col-span-2 alert alert-error py-2">
                <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                <span className="text-sm">{newEmpFormError._general}</span>
              </div>
            )}
          </div>
        </form>
      </Modal>

      {/* Manage Employee Menu */}
      <ManageMenu
        title={selectedEmployee ? fullName(selectedEmployee) : ''}
        subtitle={selectedEmployee ? `Employee #${selectedEmployee.employeeId}` : ''}
        item={selectedEmployee}
        details={buildDetails(selectedEmployee)}
        isOpen={!!selectedEmployee}
        onClose={() => setSelectedEmployee(null)}
        hasRole={hasRole}
        menuItems={empMenuItems}
        onMenuSelect={(key, emp) => {
          if (key === 'update-employee') {
            setSelectedEmployee(null)
            openEmpModal(emp)
          } else if (key === 'update-user') {
            setSelectedEmployee(null)
            openUserModal(emp)
          } else if (key === 'register-user') {
            setSelectedEmployee(null)
            openRegModal(emp)
          }
        }}
      />

      {/* Update Employee Details Modal */}
      <Modal
        isOpen={empModalOpen}
        onClose={closeEmpModal}
        title="Update Employee Details"
        footer={
          <>
            <button type="button" className="btn btn-soft btn-secondary" onClick={closeEmpModal}>Cancel</button>
            <button type="submit" form="edit-emp-form" className="btn btn-primary" disabled={empSubmitting}>
              {empSubmitting
                ? <span className="loading loading-spinner loading-sm"></span>
                : <span className="icon-[tabler--device-floppy] size-4"></span>
              }
              Save Changes
            </button>
          </>
        }
      >
        <form id="edit-emp-form" onSubmit={handleEmpSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">First Name <span className="text-error">*</span></label>
              <input type="text" name="firstName"
                className={`input input-bordered w-full${empFormError.firstName ? ' is-invalid' : ''}`}
                maxLength={255} required value={empForm.firstName} onChange={handleEmpFormChange} />
              {empFormError.firstName && <span className="helper-text">{empFormError.firstName}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Last Name <span className="text-error">*</span></label>
              <input type="text" name="lastName"
                className={`input input-bordered w-full${empFormError.lastName ? ' is-invalid' : ''}`}
                maxLength={255} required value={empForm.lastName} onChange={handleEmpFormChange} />
              {empFormError.lastName && <span className="helper-text">{empFormError.lastName}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Middle Name</label>
              <input type="text" name="middleName"
                className={`input input-bordered w-full${empFormError.middleName ? ' is-invalid' : ''}`}
                maxLength={255} value={empForm.middleName} onChange={handleEmpFormChange} />
              {empFormError.middleName && <span className="helper-text">{empFormError.middleName}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Suffix</label>
              <input type="text" name="suffixName"
                className={`input input-bordered w-full${empFormError.suffixName ? ' is-invalid' : ''}`}
                maxLength={255} placeholder="e.g. Jr., III" value={empForm.suffixName} onChange={handleEmpFormChange} />
              {empFormError.suffixName && <span className="helper-text">{empFormError.suffixName}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Gender <span className="text-error">*</span></label>
              <select name="gender"
                className={`select select-bordered w-full${empFormError.gender ? ' is-invalid' : ''}`}
                required value={empForm.gender} onChange={handleEmpFormChange}>
                {GENDER_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              {empFormError.gender && <span className="helper-text">{empFormError.gender}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Birthdate <span className="text-error">*</span></label>
              <input type="date" name="birthdate"
                className={`input input-bordered w-full${empFormError.birthdate ? ' is-invalid' : ''}`}
                required value={empForm.birthdate} onChange={handleEmpFormChange} />
              {empFormError.birthdate && <span className="helper-text">{empFormError.birthdate}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Contact Number <span className="text-error">*</span></label>
              <input type="tel" name="contactNumber"
                className={`input input-bordered w-full${empFormError.contactNumber ? ' is-invalid' : ''}`}
                maxLength={16} required value={empForm.contactNumber} onChange={handleEmpFormChange} />
              {empFormError.contactNumber && <span className="helper-text">{empFormError.contactNumber}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Position <span className="text-error">*</span></label>
              <input type="text" name="position"
                className={`input input-bordered w-full${empFormError.position ? ' is-invalid' : ''}`}
                maxLength={30} required value={empForm.position} onChange={handleEmpFormChange} />
              {empFormError.position && <span className="helper-text">{empFormError.position}</span>}
            </div>

            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="label-text font-medium">Status</label>
              <select name="status"
                className={`select select-bordered w-full${empFormError.status ? ' is-invalid' : ''}`}
                value={empForm.status} onChange={handleEmpFormChange}>
                {EMP_STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
              {empFormError.status && <span className="helper-text">{empFormError.status}</span>}
            </div>

            {empFormError._general && (
              <div className="sm:col-span-2 alert alert-error py-2">
                <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                <span className="text-sm">{empFormError._general}</span>
              </div>
            )}
          </div>
        </form>
      </Modal>

      {/* Register User Account Modal */}
      <Modal
        isOpen={regModalOpen}
        onClose={closeRegModal}
        title="Register User Account"
        footer={
          <>
            <button type="button" className="btn btn-soft btn-secondary" onClick={closeRegModal}>Cancel</button>
            <button type="submit" form="reg-user-form" className="btn btn-primary" disabled={regSubmitting}>
              {regSubmitting
                ? <span className="loading loading-spinner loading-sm"></span>
                : <span className="icon-[tabler--user-plus] size-4"></span>
              }
              Register
            </button>
          </>
        }
      >
        <form id="reg-user-form" onSubmit={handleRegSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="label-text font-medium">Email <span className="text-error">*</span></label>
              <input type="email" name="email"
                className={`input input-bordered w-full${regFormError.email ? ' is-invalid' : ''}`}
                maxLength={255} required value={regForm.email} onChange={handleRegFormChange} />
              {regFormError.email && <span className="helper-text">{regFormError.email}</span>}
            </div>

            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="label-text font-medium">Password <span className="text-error">*</span></label>
              <div className="relative">
                <input
                  type={showRegPassword ? 'text' : 'password'}
                  name="password"
                  className={`input input-bordered w-full pr-10${regFormError.password ? ' is-invalid' : ''}`}
                  minLength={8} required value={regForm.password} onChange={handleRegFormChange}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content"
                  onClick={() => setShowRegPassword(v => !v)}
                  tabIndex={-1}
                >
                  <span className={`size-4 ${showRegPassword ? 'icon-[tabler--eye-off]' : 'icon-[tabler--eye]'}`}></span>
                </button>
              </div>
              {regFormError.password && <span className="helper-text">{regFormError.password}</span>}
            </div>

            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="label-text font-medium">Role <span className="text-error">*</span></label>
              <select name="role"
                className={`select select-bordered w-full${regFormError.role ? ' is-invalid' : ''}`}
                required value={regForm.role} onChange={handleRegFormChange}>
                {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              {regFormError.role && <span className="helper-text">{regFormError.role}</span>}
            </div>

            {regFormError._general && (
              <div className="sm:col-span-2 alert alert-error py-2">
                <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                <span className="text-sm">{regFormError._general}</span>
              </div>
            )}
          </div>
        </form>
      </Modal>

      {/* Update User Account Modal */}
      <Modal
        isOpen={userModalOpen}
        onClose={closeUserModal}
        title="Update User Account"
        footer={
          <>
            <button type="button" className="btn btn-soft btn-secondary" onClick={closeUserModal}>Cancel</button>
            <button type="submit" form="edit-user-form" className="btn btn-primary" disabled={userSubmitting}>
              {userSubmitting
                ? <span className="loading loading-spinner loading-sm"></span>
                : <span className="icon-[tabler--device-floppy] size-4"></span>
              }
              Save Changes
            </button>
          </>
        }
      >
        <form id="edit-user-form" onSubmit={handleUserSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="label-text font-medium">Email <span className="text-error">*</span></label>
              <input type="email" name="email"
                className={`input input-bordered w-full${userFormError.email ? ' is-invalid' : ''}`}
                maxLength={255} required value={userForm.email} onChange={handleUserFormChange} />
              {userFormError.email && <span className="helper-text">{userFormError.email}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Role <span className="text-error">*</span></label>
              <select name="role"
                className={`select select-bordered w-full${userFormError.role ? ' is-invalid' : ''}`}
                required value={userForm.role} onChange={handleUserFormChange}>
                {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              {userFormError.role && <span className="helper-text">{userFormError.role}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Account Status <span className="text-error">*</span></label>
              <select name="status"
                className={`select select-bordered w-full${userFormError.status ? ' is-invalid' : ''}`}
                value={userForm.status} onChange={handleUserFormChange}>
                <option value={1}>Active</option>
                <option value={0}>Inactive</option>
              </select>
              {userFormError.status && <span className="helper-text">{userFormError.status}</span>}
            </div>

            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="label-text font-medium">New Password</label>
              <div className="relative">
                <input
                  type={showUserPassword ? 'text' : 'password'}
                  name="password"
                  className={`input input-bordered w-full pr-10${userFormError.password ? ' is-invalid' : ''}`}
                  placeholder="Leave blank to keep current password"
                  minLength={8}
                  value={userForm.password}
                  onChange={handleUserFormChange}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content"
                  onClick={() => setShowUserPassword(v => !v)}
                  tabIndex={-1}
                >
                  <span className={`size-4 ${showUserPassword ? 'icon-[tabler--eye-off]' : 'icon-[tabler--eye]'}`}></span>
                </button>
              </div>
              {userFormError.password && <span className="helper-text">{userFormError.password}</span>}
            </div>

            {userFormError._general && (
              <div className="sm:col-span-2 alert alert-error py-2">
                <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                <span className="text-sm">{userFormError._general}</span>
              </div>
            )}
          </div>
        </form>
      </Modal>
    </Layout>
  )
}
