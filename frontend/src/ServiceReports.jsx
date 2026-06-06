import { useState, useEffect } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from './auth'
import Layout from './Layout'
import Modal from './Modal'
import PickerInput from './PickerInput'
import SchedulePickerModal from './SchedulePickerModal'
import EmployeePickerModal from './EmployeePickerModal'
import { notyfSuccess, notyfError } from './notyf'
import { useModal } from './modal/index.js'
import ModalNav from './ModalNav'
import { BillingManageModal } from './Billing'
import { FindingsModal } from './ServiceReportFindings'

const PAYMENT_OPTIONS = ['unset', 'cash', 'check', 'gcash', 'bank']
const STATUS_OPTIONS = ['unpaid', 'paid', 'partial']

const SR_MENU_ITEMS = [
  { key: 'update', label: 'Update Details', icon: 'icon-[tabler--pencil]', roles: ['ADMIN', 'STAFF'] },
  { key: 'findings', label: 'Add & Manage Findings', icon: 'icon-[tabler--checklist]', roles: ['ADMIN', 'STAFF', 'CREW'] },
  { key: 'billing', label: 'Add & Manage Billing Items', icon: 'icon-[tabler--receipt]', roles: null },
  { key: 'purchase-order', label: 'Add & Manage Purchase Order', icon: 'icon-[tabler--file-invoice]', roles: null },
  { key: 'documents', label: 'Add & Manage Documents', icon: 'icon-[tabler--files]', roles: ['ADMIN', 'STAFF', 'CREW'] },
]

const EMPTY_FORM = {
  schedId: '',
  _scheduleDisplay: '',
  engineerEmployeeId: '',
  _engineerDisplay: '',
  complaint: '',
  workDone: '',
  location: '',
  docuId: '',
}


/**
 * Parses a failed API response into field-level or general error object.
 */
async function parseApiError(res) {
  const data = await res.json().catch(() => ({}))
  if (data.errors) return data.errors
  return { _general: data.message ?? data.error ?? `Error ${res.status}` }
}

/** Returns badge class for report status */
function statusBadgeClass(status) {
  if (status === 'paid') return 'badge-success'
  if (status === 'partial') return 'badge-warning'
  return 'badge-neutral'
}

/** Formats a date string to YYYY-MM-DD */
function formatDate(dt) {
  if (!dt) return '—'
  return String(dt).slice(0, 10)
}

const PAGE_SIZE = 10

/** Self-contained manage panel rendered as a modal stack layer. */
function ManageSRModal({ report, onRefresh, onNavigate }) {
  const { pushModal, popModal } = useModal()
  const { hasRole } = useAuth()

  function handleAction(key) {
    if (key === 'update') pushModal(<UpdateSRModal report={report} onSuccess={onRefresh} />)
    if (key === 'findings') pushModal(<FindingsModal report={report} onRefresh={onRefresh} />)
    if (key === 'billing') pushModal(<BillingManageModal report={report} />)
    if (key === 'purchase-order') { popModal(); onNavigate(`/inventory/purchase-orders?srNum=${report.srNumber}`) }
    if (key === 'documents') {
      popModal()
      onNavigate(`/service-report/${report.srNumber}/documents`, {
        state: {
          entityType: 'service-report',
          entityId: report.srNumber,
          entityLabel: `SR #${report.srNumber}`,
          parentLabel: report.projectName,
          docuId: report.docuId ?? null,
        },
      })
    }
  }

  return (
    <div className="modal-content w-full max-w-2xl my-auto">
      <div className="modal-header">
        <div>
          <h3 className="modal-title">SR #{report.srNumber}</h3>
          <span className="text-sm text-base-content/50">{report.projectName}</span>
        </div>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div className="col-span-2 flex flex-col gap-0.5">
            <span className="text-xs text-base-content/50 uppercase tracking-wide">Complaint</span>
            <span className="font-medium">{report.complaint ?? '—'}</span>
          </div>
          <div className="col-span-2 flex flex-col gap-0.5">
            <span className="text-xs text-base-content/50 uppercase tracking-wide">Work Done</span>
            <span className="font-medium">{report.workDone ?? '—'}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-base-content/50 uppercase tracking-wide">Location</span>
            <span className="font-medium">{report.location ?? '—'}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-base-content/50 uppercase tracking-wide">Status</span>
            <span className={`badge badge-soft ${statusBadgeClass(report.status)} text-xs`}>{report.status}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-base-content/50 uppercase tracking-wide">Schedule Date</span>
            <span className="font-medium">{formatDate(report.scheduleDate)}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-base-content/50 uppercase tracking-wide">Engineer Emp. ID</span>
            <span className="font-medium">{report.engineerEmployeeId ?? '—'}</span>
          </div>
        </div>
        <ModalNav
          title="Manage"
          items={SR_MENU_ITEMS}
          hasRole={hasRole}
          onSelect={handleAction}
        />
      </div>
    </div>
  )
}

/** Self-contained edit form rendered as a modal stack layer. */
function UpdateSRModal({ report, onSuccess }) {
  const { apiFetch } = useAuth()
  const { popModal } = useModal()
  const [form, setForm] = useState({
    schedId: report.schedId ?? '',
    _scheduleDisplay: report.schedId ? `Sched #${report.schedId}` : '',
    engineerEmployeeId: report.engineerEmployeeId ?? '',
    _engineerDisplay: report.engineerEmployeeId ? `Employee #${report.engineerEmployeeId}` : '',
    complaint: report.complaint ?? '',
    workDone: report.workDone ?? '',
    location: report.location ?? '',
    docuId: report.docuId ?? '',
  })
  const [formError, setFormError] = useState({})
  const [submitting, setSubmitting] = useState(false)

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  /** Submits the update and calls onSuccess on completion. */
  async function handleSubmit(e) {
    e.preventDefault()
    setFormError({})
    setSubmitting(true)
    try {
      const res = await apiFetch(`/api/service-reports/${report.srNumber}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          complaint: form.complaint,
          workDone: form.workDone,
          engineerEmployeeId: form.engineerEmployeeId ? Number(form.engineerEmployeeId) : null,
          location: form.location || null,
          schedId: form.schedId ? Number(form.schedId) : null,
          docuId: form.docuId ? Number(form.docuId) : null,
        }),
      })
      if (!res.ok) {
        setFormError(await parseApiError(res))
        notyfError('Update failed')
        return
      }
      popModal()
      setTimeout(() => notyfSuccess(`Service Report #${report.srNumber} updated successfully.`), 150)
      onSuccess?.()
    } catch (err) {
      setFormError({ _general: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-content w-full max-w-2xl my-auto">
      <div className="modal-header">
        <h3 className="modal-title">Update SR #{report.srNumber}</h3>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body">
        <form id="update-sr-form" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Location <span className="text-error">*</span></label>
              <input type="text" name="location" maxLength={255}
                className={`input input-bordered w-full${formError.location ? ' is-invalid' : ''}`}
                placeholder="e.g. 3rd Floor East Wing, ABC Corp" required
                value={form.location} onChange={handleChange} />
              {formError.location && <span className="helper-text">{formError.location}</span>}
            </div>

            <PickerInput
              label="Schedule"
              displayValue={form._scheduleDisplay}
              placeholder="None selected"
              buttonLabel="Change Schedule"
              required
              error={formError.schedId}
              Picker={SchedulePickerModal}
              onSelect={s => setForm(prev => ({ ...prev, schedId: s.schedId, _scheduleDisplay: `Sched #${s.schedId} — ${s.purpose ?? ''}` }))}
            />

            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="label-text font-medium">Complaint <span className="text-error">*</span></label>
              <textarea name="complaint" rows={3} maxLength={900}
                className={`textarea textarea-bordered w-full${formError.complaint ? ' is-invalid' : ''}`}
                placeholder="Describe the complaint..." required
                value={form.complaint} onChange={handleChange} />
              {formError.complaint && <span className="helper-text">{formError.complaint}</span>}
            </div>

            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="label-text font-medium">Work Done <span className="text-error">*</span></label>
              <textarea name="workDone" rows={3} maxLength={900}
                className={`textarea textarea-bordered w-full${formError.workDone ? ' is-invalid' : ''}`}
                placeholder="Describe the work performed..." required
                value={form.workDone} onChange={handleChange} />
              {formError.workDone && <span className="helper-text">{formError.workDone}</span>}
            </div>

            <PickerInput
              label="Assigned Engineer"
              displayValue={form._engineerDisplay}
              placeholder="None assigned"
              buttonLabel="Select Engineer"
              error={formError.engineerEmployeeId}
              Picker={EmployeePickerModal}
              onSelect={e => setForm(prev => ({ ...prev, engineerEmployeeId: e.employeeId, _engineerDisplay: `${e.lastName}, ${e.firstName} (#${e.employeeId})` }))}
              className="sm:col-span-2"
            />

            {formError._general && (
              <div className="sm:col-span-2 alert alert-error py-2">
                <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                <span className="text-sm">{formError._general}</span>
              </div>
            )}
          </div>
        </form>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-soft btn-secondary" onClick={popModal}>Cancel</button>
        <button type="submit" form="update-sr-form" className="btn btn-primary" disabled={submitting}>
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

export default function ServiceReports() {
  const { apiFetch, hasRole } = useAuth()
  const { pushModal } = useModal()
  const { projNum: projNumParam } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const projNumFilter = projNumParam ? Number(projNumParam) : null
  const filterProjName = location.state?.projectName ?? null

  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [totalElements, setTotalElements] = useState(0)

  // Add modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState({})
  const [submitting, setSubmitting] = useState(false)

  const [refreshKey, setRefreshKey] = useState(0)

  const canEdit = hasRole('ADMIN', 'STAFF')


  function openModal() { setModalOpen(true) }

  function closeModal() {
    setModalOpen(false)
    setForm(EMPTY_FORM)
    setFormError({})
  }

  /** Pushes the SR manage panel onto the modal stack. */
  function openManageModal(r) {
    pushModal(
      <ManageSRModal
        report={r}
        onRefresh={() => setRefreshKey(k => k + 1)}
        onNavigate={(path, opts) => navigate(path, opts)}
      />
    )
  }

  // Reset to page 0 whenever the project filter changes
  useEffect(() => { setPage(0) }, [projNumFilter])

  /** Fetches service reports; re-runs whenever page, filter, or refreshKey changes. */
  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({
      page: String(page),
      size: String(PAGE_SIZE),
      sort: 'srNumber,desc',
    })
    if (projNumFilter) params.append('projNum', String(projNumFilter))
    apiFetch(`/api/service-reports?${params}`)
      .then(res => {
        if (!res.ok) throw new Error(`Failed to load service reports (${res.status})`)
        return res.json()
      })
      .then(data => {
        if (!active) return
        setReports(data.content ?? [])
        setTotalPages(data.totalPages ?? 0)
        setTotalElements(data.totalElements ?? 0)
      })
      .catch(err => { if (active) setError(err.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [apiFetch, page, projNumFilter, refreshKey])

  // Client-side search on complaint text or project/SR number
  const filtered = reports.filter(r => {
    if (search === '') return true
    const q = search.toLowerCase()
    return (
      String(r.srNumber).includes(q) ||
      (r.projectName ?? '').toLowerCase().includes(q)
    )
  })

  function handleFormChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  /** Submits the new service report form */
  async function handleSubmit(e) {
    e.preventDefault()
    setFormError({})
    setSubmitting(true)
    try {
      const res = await apiFetch('/api/service-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          complaint: form.complaint,
          workDone: form.workDone,
          engineerEmployeeId: form.engineerEmployeeId ? Number(form.engineerEmployeeId) : null,
          location: form.location || null,
          schedId: form.schedId ? Number(form.schedId) : null,
          docuId: form.docuId ? Number(form.docuId) : null,
        }),
      })
      if (!res.ok) {
        setFormError(await parseApiError(res))
        notyfError('Add failed')
        return
      }
      const data = await res.json().catch(() => ({}))
      closeModal()
      setTimeout(() => notyfSuccess(`Service Report #${data.srNumber} created successfully.`), 150)
      setPage(0)
      setRefreshKey(k => k + 1)
    } catch (err) {
      setFormError({ _general: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Layout activePage="service-report">
      {/* Header row */}
      <div className="flex items-stretch justify-between h-16 mb-6">
        <div>
          <h1 className="text-3xl font-semibold">
            {projNumFilter
              ? `Project Service Reports of ${filterProjName ?? '...'}`
              : 'All Project Service Reports'}
          </h1>
          <p className="text-base-content/60 mt-1">View and manage Project Service Reports (PSR)</p>
        </div>

        <div className="flex gap-2 items-center h-full">
          {canEdit && (
            <button
              type="button"
              className="btn btn-primary h-full min-h-0"
              onClick={() => navigate('/service-report/new')}
            >
              <span className="icon-[tabler--plus] size-4"></span>
              New Project Service Report
            </button>
          )}
        </div>
      </div>

      {/* Search bar */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <span className="icon-[tabler--search] size-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none"></span>
          <input
            type="text"
            className="input input-bordered w-full pl-9"
            placeholder="Search by SR # or project name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
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
            {totalElements} report{totalElements !== 1 ? 's' : ''} total
            {search && ` · ${filtered.length} shown`}
          </p>

          {filtered.length === 0 ? (
            <div className="text-center py-20 text-base-content/40">
              <span className="icon-[tabler--file-off] size-12 mx-auto mb-3 block"></span>
              <p>No service reports found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
              <table className="table table-zebra w-full">
                <thead>
                  <tr>
                    <th>SR #</th>
                    <th>Project</th>
                    <th>Complaint</th>
                    <th>Schedule Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.srNumber}>
                      <td className="font-mono font-semibold">{r.srNumber}</td>
                      <td className="max-w-36">
                        <span className="line-clamp-1 text-sm" title={r.projectName}>{r.projectName}</span>
                      </td>
                      <td className="max-w-56">
                        <span className="line-clamp-2 text-sm" title={r.complaint}>{r.complaint}</span>
                      </td>
                      <td className="text-sm">{formatDate(r.scheduleDate)}</td>
                      <td>
                        <span className={`badge badge-soft ${statusBadgeClass(r.status)} text-xs`}>
                          {r.status}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn-soft btn-primary btn-sm"
                          onClick={() => openManageModal(r)}
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
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              {projNumFilter ? (
                <button className="btn btn-sm btn-secondary" onClick={() => navigate('/service-report')}>
                  <span className="icon-[tabler--list] size-4"></span>
                  View All Reports
                </button>
              ) : (
                <>
                  <button className="btn btn-sm btn-secondary" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                    <span className="icon-[tabler--chevron-left] size-4"></span>
                    Prev
                  </button>
                  <span className="text-sm text-base-content/60">Page {page + 1} of {totalPages}</span>
                  <button className="btn btn-sm btn-secondary" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                    Next
                    <span className="icon-[tabler--chevron-right] size-4"></span>
                  </button>
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* New Report Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title="New Service Report"
        footer={
          <>
            <button type="button" className="btn btn-soft btn-secondary" onClick={closeModal}>
              Cancel
            </button>
            <button type="submit" form="new-report-form" className="btn btn-primary" disabled={submitting}>
              {submitting
                ? <span className="loading loading-spinner loading-sm"></span>
                : <span className="icon-[tabler--plus] size-4"></span>
              }
              Create Report
            </button>
          </>
        }
      >
        <form id="new-report-form" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Location <span className="text-error">*</span></label>
              <input type="text" name="location" maxLength={255}
                className={`input input-bordered w-full${formError.location ? ' is-invalid' : ''}`}
                placeholder="e.g. 3rd Floor East Wing, ABC Corp" required
                value={form.location} onChange={handleFormChange} />
              {formError.location && <span className="helper-text">{formError.location}</span>}
            </div>

            <PickerInput
              label="Schedule"
              displayValue={form._scheduleDisplay}
              placeholder="None selected"
              buttonLabel="Select Schedule"
              required
              error={formError.schedId}
              Picker={SchedulePickerModal}
              onSelect={s => setForm(prev => ({ ...prev, schedId: s.schedId, _scheduleDisplay: `Sched #${s.schedId} — ${s.purpose ?? ''}` }))}
            />

            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="label-text font-medium">Complaint <span className="text-error">*</span></label>
              <textarea name="complaint" rows={3} maxLength={900}
                className={`textarea textarea-bordered w-full${formError.complaint ? ' is-invalid' : ''}`}
                placeholder="Describe the complaint..." required
                value={form.complaint} onChange={handleFormChange} />
              {formError.complaint && <span className="helper-text">{formError.complaint}</span>}
            </div>

            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="label-text font-medium">Work Done <span className="text-error">*</span></label>
              <textarea name="workDone" rows={3} maxLength={900}
                className={`textarea textarea-bordered w-full${formError.workDone ? ' is-invalid' : ''}`}
                placeholder="Describe the work performed..." required
                value={form.workDone} onChange={handleFormChange} />
              {formError.workDone && <span className="helper-text">{formError.workDone}</span>}
            </div>

            <PickerInput
              label="Assigned Engineer"
              displayValue={form._engineerDisplay}
              placeholder="None assigned"
              buttonLabel="Select Engineer"
              error={formError.engineerEmployeeId}
              Picker={EmployeePickerModal}
              onSelect={e => setForm(prev => ({ ...prev, engineerEmployeeId: e.employeeId, _engineerDisplay: `${e.lastName}, ${e.firstName} (#${e.employeeId})` }))}
              className="sm:col-span-2"
            />

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Document ID</label>
              <input type="number" name="docuId" min={1}
                className={`input input-bordered w-full${formError.docuId ? ' is-invalid' : ''}`}
                placeholder="Optional"
                value={form.docuId} onChange={handleFormChange} />
              {formError.docuId && <span className="helper-text">{formError.docuId}</span>}
            </div>

            {formError._general && (
              <div className="sm:col-span-2 alert alert-error py-2">
                <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                <span className="text-sm">{formError._general}</span>
              </div>
            )}
          </div>
        </form>
      </Modal>
    </Layout>
  )
}
