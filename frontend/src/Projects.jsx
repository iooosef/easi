import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './auth'
import Layout from './Layout'
import { useModal } from './modal/index.js'
import { notyfSuccess, notyfError } from './notyf'

const STATUS_OPTIONS = ['All Status', 'active', 'completed', 'inactive']
const TYPE_OPTIONS   = ['ESTABLISHMENT', 'HOUSEHOLD']

const PROJECT_MENU_ITEMS = [
  { key: 'update',          label: 'Update Details',          icon: 'icon-[tabler--pencil]',      roles: ['ADMIN', 'STAFF'] },
  { key: 'service-reports', label: 'Project Service Reports', icon: 'icon-[tabler--file-report]', roles: ['ADMIN', 'STAFF', 'ACCOUNTING', 'CREW'] },
  { key: 'schedule',        label: 'Manage Schedule',         icon: 'icon-[tabler--calendar]',    roles: null },
  { key: 'documents',       label: 'Manage Documents',        icon: 'icon-[tabler--files]',       roles: null },
  { key: 'ac',              label: 'Manage Air Conditioners', icon: 'icon-[tabler--snowflake]',   roles: null },
]

const EMPTY_FORM = {
  name: '',
  address: '',
  type: '',
  contactName: '',
  contactNumber: '',
  contactEmail: '',
  installationProgress: 0,
  warrantyStatus: 1,
  warrantyDate: '',
  status: 'active',
}

/**
 * Parses a failed API response into a field-error map.
 * Returns { fieldName: message } for validation errors, { _general: message } otherwise.
 */
async function parseApiError(res) {
  const data = await res.json().catch(() => ({}))
  if (data.errors) return data.errors
  return { _general: data.message ?? data.error ?? `Error ${res.status}` }
}

/** Returns badge class based on project type */
function typeBadgeClass(type) {
  if (!type) return 'badge-neutral'
  const t = type.toLowerCase()
  if (t.includes('install')) return 'badge-info'
  if (t.includes('maint'))   return 'badge-success'
  if (t.includes('repair'))  return 'badge-warning'
  return 'badge-secondary'
}

/** Formats a LocalDateTime string to a readable date */
function formatDate(dt) {
  if (!dt) return '—'
  return new Date(dt).toISOString().slice(0, 10)
}

const PAGE_SIZE = 12

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

/** Label + value cell used in the Manage modal details grid */
function DetailField({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-base-content/50 uppercase tracking-wide">{label}</span>
      <span className="text-sm font-medium text-base-content">{value ?? '—'}</span>
    </div>
  )
}

/** Shared project form fields used by both New and Edit modals */
function ProjectFormFields({ form, formError, onChange }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

      <div className="sm:col-span-2 flex flex-col gap-1">
        <label className="label-text font-medium">Project Name <span className="text-error">*</span></label>
        <input type="text" name="name"
          className={`input input-bordered w-full${formError.name ? ' is-invalid' : ''}`}
          placeholder="e.g. ABC Corporation HVAC" maxLength={255} required
          value={form.name} onChange={onChange} />
        {formError.name && <span className="helper-text">{formError.name}</span>}
      </div>

      <div className="sm:col-span-2 flex flex-col gap-1">
        <label className="label-text font-medium">Address <span className="text-error">*</span></label>
        <textarea name="address"
          className={`textarea textarea-bordered w-full${formError.address ? ' is-invalid' : ''}`}
          placeholder="Full project site address" maxLength={600} rows={2} required
          value={form.address} onChange={onChange} />
        {formError.address && <span className="helper-text">{formError.address}</span>}
      </div>

      <div className="sm:col-span-2 flex flex-col gap-1">
        <label className="label-text font-medium">Type <span className="text-error">*</span></label>
        <select name="type"
          className={`select select-bordered w-full${formError.type ? ' is-invalid' : ''}`}
          required value={form.type} onChange={onChange}>
          <option value="" disabled>Select type</option>
          {TYPE_OPTIONS.map(t => (
            <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>
          ))}
        </select>
        {formError.type && <span className="helper-text">{formError.type}</span>}
      </div>

      <div className="flex flex-col gap-1">
        <label className="label-text font-medium">Contact Name <span className="text-error">*</span></label>
        <input type="text" name="contactName"
          className={`input input-bordered w-full${formError.contactName ? ' is-invalid' : ''}`}
          placeholder="e.g. Juan Dela Cruz" maxLength={300} required
          value={form.contactName} onChange={onChange} />
        {formError.contactName && <span className="helper-text">{formError.contactName}</span>}
      </div>

      <div className="flex flex-col gap-1">
        <label className="label-text font-medium">Contact Number <span className="text-error">*</span></label>
        <input type="tel" name="contactNumber"
          className={`input input-bordered w-full${formError.contactNumber ? ' is-invalid' : ''}`}
          placeholder="e.g. +63 912 345 6789" maxLength={16} required
          value={form.contactNumber} onChange={onChange} />
        {formError.contactNumber && <span className="helper-text">{formError.contactNumber}</span>}
      </div>

      <div className="sm:col-span-2 flex flex-col gap-1">
        <label className="label-text font-medium">Contact Email <span className="text-error">*</span></label>
        <input type="email" name="contactEmail"
          className={`input input-bordered w-full${formError.contactEmail ? ' is-invalid' : ''}`}
          placeholder="e.g. contact@example.com" maxLength={255} required
          value={form.contactEmail} onChange={onChange} />
        {formError.contactEmail && <span className="helper-text">{formError.contactEmail}</span>}
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <label className="label-text font-medium">Installation Progress</label>
          <span className="text-sm font-semibold text-primary">{form.installationProgress}%</span>
        </div>
        <input type="range" name="installationProgress"
          className="range range-primary range-sm"
          min={0} max={100} step={1}
          value={form.installationProgress} onChange={onChange} />
        {formError.installationProgress && <span className="helper-text">{formError.installationProgress}</span>}
      </div>

      <div className="flex flex-col gap-1">
        <label className="label-text font-medium">Status</label>
        <select name="status"
          className={`select select-bordered w-full${formError.status ? ' is-invalid' : ''}`}
          value={form.status} onChange={onChange}>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="inactive">Inactive</option>
        </select>
        {formError.status && <span className="helper-text">{formError.status}</span>}
      </div>

      <div className="flex flex-col gap-1">
        <label className="label-text font-medium">Warranty Status</label>
        <select name="warrantyStatus"
          className={`select select-bordered w-full${formError.warrantyStatus ? ' is-invalid' : ''}`}
          value={form.warrantyStatus} onChange={onChange}>
          <option value={1}>Active</option>
          <option value={0}>Expired</option>
        </select>
        {formError.warrantyStatus && <span className="helper-text">{formError.warrantyStatus}</span>}
      </div>

      <div className="flex flex-col gap-1">
        <label className="label-text font-medium">Warranty Date <span className="text-error">*</span></label>
        <input type="date" name="warrantyDate"
          className={`input input-bordered w-full${formError.warrantyDate ? ' is-invalid' : ''}`}
          required value={form.warrantyDate} onChange={onChange} />
        {formError.warrantyDate && <span className="helper-text">{formError.warrantyDate}</span>}
      </div>

      {formError._general && (
        <div className="sm:col-span-2 alert alert-error py-2">
          <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
          <span className="text-sm">{formError._general}</span>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Modal layer components
// ---------------------------------------------------------------------------

/** New Project — standalone layer 1 modal */
function NewProjectModal({ onSuccess }) {
  const { popModal } = useModal()
  const { apiFetch } = useAuth()
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState({})
  const [submitting, setSubmitting] = useState(false)

  function handleFormChange(e) {
    const { name, value, type } = e.target
    setForm(prev => ({ ...prev, [name]: type === 'number' ? Number(value) : value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError({})
    setSubmitting(true)
    try {
      const res = await apiFetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          installationProgress: Number(form.installationProgress),
          warrantyStatus: Number(form.warrantyStatus),
        }),
      })
      if (!res.ok) {
        setFormError(await parseApiError(res))
        notyfError('Add failed')
        return
      }
      const data = await res.json().catch(() => ({}))
      popModal()
      onSuccess(data.name)
    } catch (err) {
      setFormError({ _general: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-content w-full max-w-2xl my-auto">
      <div className="modal-header">
        <h3 className="modal-title">New Project</h3>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body overflow-y-auto max-h-[60vh]">
        <form id="new-project-form" onSubmit={handleSubmit}>
          <ProjectFormFields form={form} formError={formError} onChange={handleFormChange} />
        </form>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-soft btn-secondary" onClick={popModal}>Cancel</button>
        <button type="submit" form="new-project-form" className="btn btn-primary" disabled={submitting}>
          {submitting
            ? <span className="loading loading-spinner loading-sm"></span>
            : <span className="icon-[tabler--plus] size-4"></span>
          }
          Create Project
        </button>
      </div>
    </div>
  )
}

/**
 * Edit Project — layer 2, pushed from ManageProjectModal.
 * Pops itself on cancel; calls onSuccess on save.
 */
function EditProjectModal({ project, onSuccess }) {
  const { popModal } = useModal()
  const { apiFetch } = useAuth()
  const [form, setForm] = useState({
    name:                 project.name,
    address:              project.address,
    type:                 project.type,
    contactName:          project.contactName,
    contactNumber:        project.contactNumber,
    contactEmail:         project.contactEmail,
    installationProgress: project.installationProgress,
    warrantyStatus:       project.warrantyStatus,
    warrantyDate:         project.warrantyDate ? project.warrantyDate.slice(0, 10) : '',
    status:               project.status,
  })
  const [formError, setFormError] = useState({})
  const [submitting, setSubmitting] = useState(false)

  function handleFormChange(e) {
    const { name, value, type } = e.target
    setForm(prev => ({ ...prev, [name]: type === 'number' ? Number(value) : value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError({})
    setSubmitting(true)
    try {
      const res = await apiFetch(`/api/projects/${project.projNum}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          installationProgress: Number(form.installationProgress),
          warrantyStatus: Number(form.warrantyStatus),
        }),
      })
      if (!res.ok) {
        setFormError(await parseApiError(res))
        notyfError('Update failed')
        return
      }
      const data = await res.json().catch(() => ({}))
      popModal()
      onSuccess(data.name)
    } catch (err) {
      setFormError({ _general: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-content w-full max-w-2xl my-auto">
      <div className="modal-header">
        <h3 className="modal-title">Update Project</h3>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body overflow-y-auto max-h-[60vh]">
        <form id="edit-project-form" onSubmit={handleSubmit}>
          <ProjectFormFields form={form} formError={formError} onChange={handleFormChange} />
        </form>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-soft btn-secondary" onClick={popModal}>Cancel</button>
        <button type="submit" form="edit-project-form" className="btn btn-primary" disabled={submitting}>
          {submitting
            ? <span className="loading loading-spinner loading-sm"></span>
            : <span className="icon-[tabler--device-floppy] size-4"></span>
          }
          Save Changes
        </button>
      </div>
    </div>
  )
}

/**
 * Manage Project — layer 1 modal showing project details and action buttons.
 * Pushing Update Details opens EditProjectModal as layer 2.
 * Navigation actions clear all modals before navigating.
 */
function ManageProjectModal({ project, onRefresh }) {
  const { pushModal, popModal, clearModals } = useModal()
  const { hasRole } = useAuth()
  const navigate = useNavigate()

  function handleMenuSelect(key) {
    if (key === 'update') {
      pushModal(
        <EditProjectModal
          project={project}
          onSuccess={name => {
            clearModals()
            setTimeout(() => notyfSuccess(`Project "${name}" updated successfully.`), 150)
            onRefresh()
          }}
        />
      )
    } else if (key === 'service-reports') {
      clearModals()
      navigate(`/service-report/project/${project.projNum}`, { state: { projectName: project.name } })
    } else if (key === 'schedule') {
      clearModals()
      navigate(`/schedules/project/${project.projNum}`, { state: { projectName: project.name } })
    } else if (key === 'documents') {
      clearModals()
      navigate(`/projects/${project.projNum}/documents`, { state: { projectName: project.name } })
    } else if (key === 'ac') {
      clearModals()
      navigate(`/ac-units/project/${project.projNum}`, { state: { projectName: project.name } })
    }
  }

  return (
    <div className="modal-content w-full max-w-2xl my-auto">
      <div className="modal-header">
        <div>
          <h3 className="modal-title">{project.name}</h3>
          <span className="text-sm text-base-content/50">Project #{project.projNum}</span>
        </div>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>

      <div className="modal-body flex flex-col gap-6">
        {/* Details grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
          <DetailField label="Type"   value={project.type?.charAt(0) + project.type?.slice(1).toLowerCase()} />
          <DetailField label="Status" value={project.status?.charAt(0).toUpperCase() + project.status?.slice(1)} />
          <DetailField label="Started" value={formatDate(project.addedOn)} />
          <div className="col-span-2 sm:col-span-3 flex flex-col gap-0.5">
            <span className="text-xs text-base-content/50 uppercase tracking-wide">Address</span>
            <span className="text-sm font-medium text-base-content">{project.address ?? '—'}</span>
          </div>
          <DetailField label="Contact Name"   value={project.contactName} />
          <DetailField label="Contact Number" value={project.contactNumber} />
          <DetailField label="Contact Email"  value={project.contactEmail} />
          <DetailField label="Warranty Status" value={project.warrantyStatus === 1 ? 'Active' : 'Expired'} />
          <DetailField label="Warranty Date"   value={formatDate(project.warrantyDate)} />
          <div className="col-span-2 sm:col-span-3 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-base-content/50 uppercase tracking-wide">Installation Progress</span>
              <span className="text-xs font-semibold text-primary">{project.installationProgress}%</span>
            </div>
            <div className="w-full bg-base-300 rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-500"
                style={{ width: `${project.installationProgress}%` }}
              />
            </div>
          </div>
        </div>

        <div className="divider my-0"></div>

        {/* Action grid */}
        <div>
          <p className="text-xs text-base-content/50 uppercase tracking-wide mb-3">Manage</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {PROJECT_MENU_ITEMS
              .filter(({ roles }) => roles === null || hasRole(...roles))
              .map(({ key, label, icon }) => (
                <button key={key} type="button" className="group w-full"
                  onClick={() => handleMenuSelect(key)}>
                  <div className="card bg-base-100 border border-base-300 h-full transition-transform duration-300 group-hover:-translate-y-2">
                    <div className="card-body items-center justify-center text-center gap-2 py-5 px-3">
                      <span className={`${icon} size-8 text-primary`}></span>
                      <p className="text-xs font-medium text-base-content leading-tight">{label}</p>
                    </div>
                  </div>
                </button>
              ))
            }
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function Projects() {
  const { apiFetch, hasRole } = useAuth()
  const { pushModal } = useModal()
  const [projects, setProjects]           = useState([])
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState(null)
  const [search, setSearch]               = useState('')
  const [statusFilter, setStatusFilter]   = useState('All Status')
  const [page, setPage]                   = useState(0)
  const [totalPages, setTotalPages]       = useState(0)
  const [totalElements, setTotalElements] = useState(0)

  const canEdit = hasRole('ADMIN', 'STAFF')

  async function fetchProjects() {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(page), size: String(PAGE_SIZE), sort: 'addedOn,desc' })
      const res = await apiFetch(`/api/projects?${params}`)
      if (!res.ok) throw new Error(`Failed to load projects (${res.status})`)
      const data = await res.json()
      setProjects(data.content ?? [])
      setTotalPages(data.totalPages ?? 0)
      setTotalElements(data.totalElements ?? 0)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchProjects() }, [apiFetch, page])

  // Client-side filter — will be replaced by server-side search endpoint later
  const filtered = projects.filter(p => {
    const matchesSearch =
      search === '' ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.contactName.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'All Status' || p.status === statusFilter
    return matchesSearch && matchesStatus
  })

  function openNewProject() {
    pushModal(
      <NewProjectModal
        onSuccess={name => {
          setTimeout(() => notyfSuccess(`Project "${name}" created successfully.`), 150)
          setPage(0)
          fetchProjects()
        }}
      />
    )
  }

  function openManageProject(project) {
    pushModal(<ManageProjectModal project={project} onRefresh={fetchProjects} />)
  }

  return (
    <Layout activePage="projects">
      {/* Header row */}
      <div className="flex items-stretch justify-between h-16 mb-6">
        <div>
          <h1 className="text-3xl font-semibold">Projects</h1>
          <p className="text-base-content/60 mt-1">Manage client projects and service records</p>
        </div>
        <div className="flex gap-2 items-center h-full">
          {canEdit && (
            <button type="button" className="btn btn-primary h-full min-h-0" onClick={openNewProject}>
              <span className="icon-[tabler--plus] size-4"></span>
              New Project
            </button>
          )}
        </div>
      </div>

      {/* Search and filter row */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-3">
          <span className="icon-[tabler--search] size-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none"></span>
          <input
            type="text"
            className="input input-bordered w-full pl-9"
            placeholder="Search projects..."
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

      {/* Project grid */}
      {!loading && !error && (
        <>
          <p className="text-sm text-base-content/50 mb-3">
            {totalElements} project{totalElements !== 1 ? 's' : ''} total
            {(search || statusFilter !== 'All Status') && ` · ${filtered.length} shown`}
          </p>

          {filtered.length === 0 ? (
            <div className="text-center py-20 text-base-content/40">
              <span className="icon-[tabler--folder-off] size-12 mx-auto mb-3 block"></span>
              <p>No projects found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(project => (
                <div key={project.projNum} className="group">
                  <div className="card bg-base-100 border border-base-300 transition-transform duration-300 group-hover:-translate-y-2 h-full">
                    <div className="card-body gap-2">
                      <div className="flex items-start justify-between gap-2">
                        <h2 className="card-title text-base">{project.name}</h2>
                        <span className={`badge badge-soft ${typeBadgeClass(project.type)} shrink-0 text-xs`}>
                          {project.type}
                        </span>
                      </div>
                      <p className="text-sm text-primary line-clamp-2">{project.address}</p>
                      <div className="text-sm text-base-content/70 space-y-0.5">
                        <p>Contact: {project.contactName}</p>
                        <p>Started: {formatDate(project.addedOn)}</p>
                      </div>
                      <div className="card-actions mt-2">
                        <button
                          className="btn btn-soft btn-primary btn-sm flex-1"
                          onClick={() => openManageProject(project)}
                        >
                          <span className="icon-[tabler--settings] size-4"></span>
                          Manage
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
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
