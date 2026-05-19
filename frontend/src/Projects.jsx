import { useState, useEffect, useRef } from 'react'
import { useAuth } from './auth'
import Layout from './Layout'
import ManageMenu from './ManageMenu'
import { notyfSuccess } from './notyf'

const STATUS_OPTIONS = ['All Status', 'active', 'completed', 'inactive']
const TYPE_OPTIONS   = ['ESTABLISHMENT', 'HOUSEHOLD']

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

export default function Projects() {
  const { apiFetch, hasRole } = useAuth()
  const [projects, setProjects]         = useState([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState(null)
  const [search, setSearch]             = useState('')
  const [statusFilter, setStatusFilter] = useState('All Status')
  const [page, setPage]                 = useState(0)
  const [totalPages, setTotalPages]     = useState(0)
  const [totalElements, setTotalElements] = useState(0)

  // Modal state
  const [form, setForm]             = useState(EMPTY_FORM)
  const [formError, setFormError]   = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const modalCloseBtnRef = useRef(null)
  const [selectedProject, setSelectedProject] = useState(null)

  function closeModal() {
    setForm(EMPTY_FORM)
    setFormError(null)
    // Directly tear down FlyonUI overlay — programmatic click is unreliable after async ops
    const modal    = document.getElementById('new-project-modal')
    const backdrop = document.getElementById('new-project-modal-backdrop')
    if (modal)    { modal.classList.remove('open'); modal.classList.add('hidden') }
    if (backdrop) backdrop.remove()
    document.body.classList.remove('overlay-body-open')
  }

  const canEdit = hasRole('ADMIN', 'STAFF')

  // Initialize FlyonUI overlay bindings after this component's DOM is ready
  useEffect(() => { window.HSStaticMethods?.autoInit() }, [])

  async function fetchProjects() {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        page: String(page),
        size: String(PAGE_SIZE),
        sort: 'addedOn,desc',
      })
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
    const matchesStatus =
      statusFilter === 'All Status' || p.status === statusFilter
    return matchesSearch && matchesStatus
  })

  function handleFormChange(e) {
    const { name, value, type } = e.target
    setForm(prev => ({ ...prev, [name]: type === 'number' ? Number(value) : value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError(null)
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
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message ?? `Error ${res.status}`)
      closeModal()
      setTimeout(() => notyfSuccess(`Project "${data.name}" created successfully.`), 150)
      setPage(0)
      await fetchProjects()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSubmitting(false)
    }
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
          <button
            type="button"
            className="btn btn-primary h-full min-h-0"
            aria-haspopup="dialog"
            aria-expanded="false"
            aria-controls="new-project-modal"
            data-overlay="#new-project-modal"
          >
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
                          onClick={() => setSelectedProject(project)}
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

      {/* Manage Project Modal */}
      <ManageMenu
        project={selectedProject}
        isOpen={!!selectedProject}
        onClose={() => setSelectedProject(null)}
        onMenuSelect={(key, project) => {
          // future: handle each action key
          console.log('menu action', key, project.projNum)
        }}
      />

      {/* New Project Modal */}
      <div id="new-project-modal" className="overlay modal overlay-open:opacity-100 hidden overlay-open:duration-300" role="dialog" tabIndex="-1">
        <div className="modal-dialog modal-dialog-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">New Project</h3>
              <button
                ref={modalCloseBtnRef}
                type="button"
                className="btn btn-text btn-circle btn-sm absolute end-3 top-3"
                aria-label="Close"
                data-overlay="#new-project-modal"
                onClick={() => { setForm(EMPTY_FORM); setFormError(null) }}
              >
                <span className="icon-[tabler--x] size-4"></span>
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-y-auto max-h-[60vh]">

                {/* Project Name */}
                <div className="sm:col-span-2 flex flex-col gap-1">
                  <label className="label-text font-medium">Project Name <span className="text-error">*</span></label>
                  <input
                    type="text"
                    name="name"
                    className="input input-bordered w-full"
                    placeholder="e.g. ABC Corporation HVAC"
                    maxLength={255}
                    required
                    value={form.name}
                    onChange={handleFormChange}
                  />
                </div>

                {/* Address */}
                <div className="sm:col-span-2 flex flex-col gap-1">
                  <label className="label-text font-medium">Address <span className="text-error">*</span></label>
                  <textarea
                    name="address"
                    className="textarea textarea-bordered w-full"
                    placeholder="Full project site address"
                    maxLength={600}
                    rows={2}
                    required
                    value={form.address}
                    onChange={handleFormChange}
                  />
                </div>

                {/* Type */}
                <div className="sm:col-span-2 flex flex-col gap-1">
                  <label className="label-text font-medium">Type <span className="text-error">*</span></label>
                  <select
                    name="type"
                    className="select select-bordered w-full"
                    required
                    value={form.type}
                    onChange={handleFormChange}
                  >
                    <option value="" disabled>Select type</option>
                    {TYPE_OPTIONS.map(t => (
                      <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>
                    ))}
                  </select>
                </div>

                {/* Contact Name */}
                <div className="flex flex-col gap-1">
                  <label className="label-text font-medium">Contact Name <span className="text-error">*</span></label>
                  <input
                    type="text"
                    name="contactName"
                    className="input input-bordered w-full"
                    placeholder="e.g. Juan Dela Cruz"
                    maxLength={300}
                    required
                    value={form.contactName}
                    onChange={handleFormChange}
                  />
                </div>

                {/* Contact Number */}
                <div className="flex flex-col gap-1">
                  <label className="label-text font-medium">Contact Number <span className="text-error">*</span></label>
                  <input
                    type="tel"
                    name="contactNumber"
                    className="input input-bordered w-full"
                    placeholder="e.g. +63 912 345 6789"
                    maxLength={16}
                    required
                    value={form.contactNumber}
                    onChange={handleFormChange}
                  />
                </div>

                {/* Contact Email */}
                <div className="sm:col-span-2 flex flex-col gap-1">
                  <label className="label-text font-medium">Contact Email <span className="text-error">*</span></label>
                  <input
                    type="email"
                    name="contactEmail"
                    className="input input-bordered w-full"
                    placeholder="e.g. contact@example.com"
                    maxLength={255}
                    required
                    value={form.contactEmail}
                    onChange={handleFormChange}
                  />
                </div>

                {/* Warranty Status */}
                <div className="flex flex-col gap-1">
                  <label className="label-text font-medium">Warranty Status <span className="text-error">*</span></label>
                  <select
                    name="warrantyStatus"
                    className="select select-bordered w-full"
                    value={form.warrantyStatus}
                    onChange={handleFormChange}
                  >
                    <option value={1}>Active</option>
                    <option value={0}>Expired</option>
                  </select>
                </div>

                {/* Warranty Date */}
                <div className="flex flex-col gap-1">
                  <label className="label-text font-medium">Warranty Date <span className="text-error">*</span></label>
                  <input
                    type="date"
                    name="warrantyDate"
                    className="input input-bordered w-full"
                    required
                    value={form.warrantyDate}
                    onChange={handleFormChange}
                  />
                </div>

                {/* Form error */}
                {formError && (
                  <div className="sm:col-span-2 alert alert-error py-2">
                    <span className="icon-[tabler--alert-circle] size-4"></span>
                    <span className="text-sm">{formError}</span>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-soft btn-secondary" data-overlay="#new-project-modal" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting
                    ? <span className="loading loading-spinner loading-sm"></span>
                    : <span className="icon-[tabler--plus] size-4"></span>
                  }
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </Layout>
  )
}
