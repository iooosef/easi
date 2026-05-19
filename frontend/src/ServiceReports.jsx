import { useState, useEffect } from 'react'
import { useAuth } from './auth'
import Layout from './Layout'
import Modal from './Modal'
import { notyfSuccess, notyfError } from './notyf'

const PAYMENT_OPTIONS = ['unset', 'cash', 'check', 'gcash', 'bank']
const STATUS_OPTIONS  = ['unpaid', 'paid', 'partial']

const EMPTY_FORM = {
  projNum: '',
  complaint: '',
  workDone: '',
  engineerEmployeeId: '',
  location: '',
  schedId: '',
  paymentMethod: 'unset',
  receiptReceiveDate: '',
  docuId: '',
  status: 'unpaid',
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
  if (status === 'paid')    return 'badge-success'
  if (status === 'partial') return 'badge-warning'
  return 'badge-neutral'
}

/** Formats a date string to YYYY-MM-DD */
function formatDate(dt) {
  if (!dt) return '—'
  return String(dt).slice(0, 10)
}

const PAGE_SIZE = 10

export default function ServiceReports() {
  const { apiFetch, hasRole } = useAuth()
  const [reports, setReports]           = useState([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState(null)
  const [search, setSearch]             = useState('')
  const [page, setPage]                 = useState(0)
  const [totalPages, setTotalPages]     = useState(0)
  const [totalElements, setTotalElements] = useState(0)

  // Add modal state
  const [modalOpen, setModalOpen]   = useState(false)
  const [form, setForm]             = useState(EMPTY_FORM)
  const [formError, setFormError]   = useState({})
  const [submitting, setSubmitting] = useState(false)

  const canEdit = hasRole('ADMIN', 'STAFF')

  function openModal() { setModalOpen(true) }

  function closeModal() {
    setModalOpen(false)
    setForm(EMPTY_FORM)
    setFormError({})
  }

  /** Fetches one page of service reports from the API */
  async function fetchReports() {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        page: String(page),
        size: String(PAGE_SIZE),
        sort: 'srNumber,asc',
      })
      const res = await apiFetch(`/api/service-reports?${params}`)
      if (!res.ok) throw new Error(`Failed to load service reports (${res.status})`)
      const data = await res.json()
      setReports(data.content ?? [])
      setTotalPages(data.totalPages ?? 0)
      setTotalElements(data.totalElements ?? 0)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchReports() }, [apiFetch, page])

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
          projNum:            form.projNum           ? Number(form.projNum)           : null,
          complaint:          form.complaint,
          workDone:           form.workDone,
          engineerEmployeeId: form.engineerEmployeeId ? Number(form.engineerEmployeeId) : null,
          location:           form.location || null,
          schedId:            form.schedId            ? Number(form.schedId)            : null,
          paymentMethod:      form.paymentMethod || 'unset',
          receiptReceiveDate: form.receiptReceiveDate || null,
          docuId:             form.docuId             ? Number(form.docuId)             : null,
          status:             form.status || 'unpaid',
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
      await fetchReports()
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
          <h1 className="text-3xl font-semibold">Service Reports</h1>
          <p className="text-base-content/60 mt-1">View and manage Project Service Reports (PSR)</p>
        </div>

        <div className="flex gap-2 items-center h-full">
          {canEdit && (
            <button
              type="button"
              className="btn btn-primary h-full min-h-0"
              onClick={openModal}
            >
              <span className="icon-[tabler--plus] size-4"></span>
              New Report
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
                    <th>Schedule Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.srNumber}>
                      <td className="font-mono font-semibold">{r.srNumber}</td>
                      <td className="max-w-48">
                        <span className="line-clamp-1 text-sm" title={r.projectName}>{r.projectName}</span>
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
                          onClick={() => {/* manage action wired up later */}}
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
              <label className="label-text font-medium">Project # <span className="text-error">*</span></label>
              <input type="number" name="projNum" min={1}
                className={`input input-bordered w-full${formError.projNum ? ' is-invalid' : ''}`}
                placeholder="e.g. 1" required
                value={form.projNum} onChange={handleFormChange} />
              {formError.projNum && <span className="helper-text">{formError.projNum}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Location <span className="text-error">*</span></label>
              <input type="text" name="location" maxLength={255}
                className={`input input-bordered w-full${formError.location ? ' is-invalid' : ''}`}
                placeholder="e.g. 3rd Floor East Wing, ABC Corp" required
                value={form.location} onChange={handleFormChange} />
              {formError.location && <span className="helper-text">{formError.location}</span>}
            </div>

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

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Schedule ID <span className="text-error">*</span></label>
              <input type="number" name="schedId" min={1}
                className={`input input-bordered w-full${formError.schedId ? ' is-invalid' : ''}`}
                placeholder="e.g. 1" required
                value={form.schedId} onChange={handleFormChange} />
              {formError.schedId && <span className="helper-text">{formError.schedId}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Engineer Employee ID</label>
              <input type="number" name="engineerEmployeeId" min={1}
                className={`input input-bordered w-full${formError.engineerEmployeeId ? ' is-invalid' : ''}`}
                placeholder="Optional"
                value={form.engineerEmployeeId} onChange={handleFormChange} />
              {formError.engineerEmployeeId && <span className="helper-text">{formError.engineerEmployeeId}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Payment Method</label>
              <select name="paymentMethod"
                className={`select select-bordered w-full${formError.paymentMethod ? ' is-invalid' : ''}`}
                value={form.paymentMethod} onChange={handleFormChange}>
                {PAYMENT_OPTIONS.map(o => (
                  <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>
                ))}
              </select>
              {formError.paymentMethod && <span className="helper-text">{formError.paymentMethod}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Status</label>
              <select name="status"
                className={`select select-bordered w-full${formError.status ? ' is-invalid' : ''}`}
                value={form.status} onChange={handleFormChange}>
                {STATUS_OPTIONS.map(o => (
                  <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>
                ))}
              </select>
              {formError.status && <span className="helper-text">{formError.status}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Receipt Receive Date</label>
              <input type="date" name="receiptReceiveDate"
                className={`input input-bordered w-full${formError.receiptReceiveDate ? ' is-invalid' : ''}`}
                value={form.receiptReceiveDate} onChange={handleFormChange} />
              {formError.receiptReceiveDate && <span className="helper-text">{formError.receiptReceiveDate}</span>}
            </div>

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
