import { useState, useEffect } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { useAuth } from './auth'
import Layout from './Layout'
import ModalNav from './modals/ModalNav.jsx'
import { useModal } from './modals/index.js'
import { notyfSuccess, notyfError } from './notyf'

const FINDING_MENU_ITEMS_MODAL = [
  { key: 'update', label: 'Update Details', icon: 'icon-[tabler--pencil]', roles: ['ADMIN', 'STAFF', 'CREW'] },
]

/**
 * Layer 2 — findings list for a service report, pushed from ManageSRModal.
 * Fetches its own findings and AC units; pushes add/manage layers on top.
 */
export function FindingsModal({ report, onRefresh }) {
  const { pushModal, popModal } = useModal()
  const { apiFetch, hasRole } = useAuth()
  const srNumber = report.srNumber
  const projNum  = report.projNum

  const [findings, setFindings]           = useState([])
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState(null)
  const [page, setPage]                   = useState(0)
  const [totalPages, setTotalPages]       = useState(0)
  const [totalElements, setTotalElements] = useState(0)
  const [refreshKey, setRefreshKey]       = useState(0)
  const [acUnits, setAcUnits]             = useState([])

  const canEdit = hasRole('ADMIN', 'STAFF', 'CREW')

  function refresh() { setRefreshKey(k => k + 1); onRefresh?.() }

  /** Loads AC units for the dropdown in add/edit forms. */
  useEffect(() => {
    if (!projNum) return
    apiFetch(`/api/ac-units?projNum=${projNum}&size=100&sort=acNum,asc`)
      .then(res => res.json())
      .then(data => setAcUnits(data.content ?? []))
      .catch(() => {})
  }, [apiFetch, projNum])

  /** Fetches findings for this service report. */
  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ page: String(page), size: '20', sort: 'srFindingsNumber,asc', srNumber: String(srNumber) })
    apiFetch(`/api/service-report-findings?${params}`)
      .then(res => { if (!res.ok) throw new Error(`Failed to load findings (${res.status})`); return res.json() })
      .then(data => { if (!active) return; setFindings(data.content ?? []); setTotalPages(data.totalPages ?? 0); setTotalElements(data.totalElements ?? 0) })
      .catch(err => { if (active) setError(err.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [apiFetch, page, srNumber, refreshKey])

  return (
    <div className="modal-content w-full max-w-4xl my-auto">
      <div className="modal-header">
        <div>
          <h3 className="modal-title">Findings — SR #{srNumber}</h3>
          <span className="text-sm text-base-content/50">{report.projectName}</span>
        </div>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body flex flex-col gap-4">
        <div className="p-3 rounded-box bg-base-200 text-sm flex flex-wrap gap-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-base-content/50 text-xs uppercase tracking-wide">Project</span>
            <span className="font-medium">{report.projectName}</span>
          </div>
          <div className="flex flex-col gap-0.5 flex-1 min-w-0">
            <span className="text-base-content/50 text-xs uppercase tracking-wide">Complaint</span>
            <span className="line-clamp-1">{report.complaint ?? '—'}</span>
          </div>
        </div>

        {loading && <div className="flex justify-center py-12"><span className="loading loading-spinner loading-lg text-primary"></span></div>}
        {error && <div className="alert alert-error py-2"><span className="icon-[tabler--alert-circle] size-4 shrink-0"></span><span className="text-sm">{error}</span></div>}
        {!loading && !error && (
          <>
            <p className="text-sm text-base-content/50">{totalElements} finding{totalElements !== 1 ? 's' : ''} total</p>
            {findings.length === 0 ? (
              <div className="text-center py-10 text-base-content/40">
                <span className="icon-[tabler--checklist] size-10 mx-auto mb-2 block"></span>
                <p>No findings recorded. Click <strong>New Finding</strong> to add one.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-box border border-base-300">
                <table className="table table-zebra table-sm w-full">
                  <thead>
                    <tr><th>Finding #</th><th>AC Unit #</th><th>Type</th><th>Part / Model</th><th>Remarks</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {findings.map(f => (
                      <tr key={f.srFindingsNumber}>
                        <td className="font-mono font-semibold">{f.srFindingsNumber}</td>
                        <td className="font-mono">{f.acNum ?? '—'}</td>
                        <td><span className={`badge badge-soft ${findingTypeBadgeClass(f.findingType)} text-xs`}>{f.findingType ?? '—'}</span></td>
                        <td className="text-sm">{f.partModel ?? '—'}</td>
                        <td className="max-w-48"><span className="line-clamp-2 text-sm" title={f.remarks}>{f.remarks ?? '—'}</span></td>
                        <td>
                          <button className="btn btn-soft btn-primary btn-sm"
                            onClick={() => pushModal(<ManageFindingModal finding={f} srNumber={srNumber} acUnits={acUnits} onRefresh={refresh} />)}>
                            <span className="icon-[tabler--settings] size-4"></span>Manage
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <button className="btn btn-sm btn-secondary" disabled={page === 0} onClick={() => setPage(p => p - 1)}><span className="icon-[tabler--chevron-left] size-4"></span>Prev</button>
                <span className="text-sm text-base-content/60">Page {page + 1} of {totalPages}</span>
                <button className="btn btn-sm btn-secondary" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next<span className="icon-[tabler--chevron-right] size-4"></span></button>
              </div>
            )}
          </>
        )}
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-soft btn-secondary" onClick={popModal}>Close</button>
        {canEdit && (
          <button type="button" className="btn btn-primary"
            onClick={() => pushModal(<AddFindingModal srNumber={srNumber} acUnits={acUnits} onSuccess={() => { setPage(0); refresh() }} />)}>
            <span className="icon-[tabler--plus] size-4"></span>New Finding
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * Layer 3 — detail and action menu for a single finding.
 * Pushed from FindingsModal; pushes UpdateFindingModal on top.
 */
function ManageFindingModal({ finding: initialFinding, srNumber, acUnits, onRefresh }) {
  const { pushModal, popModal } = useModal()
  const { hasRole, apiFetch } = useAuth()
  const [finding, setFinding] = useState(initialFinding)

  async function refreshFinding() {
    try {
      const res = await apiFetch(`/api/service-report-findings/${finding.srFindingsNumber}`)
      if (res.ok) setFinding(await res.json())
    } catch (_) {}
    onRefresh?.()
  }

  function handleAction(key) {
    if (key === 'update') pushModal(<UpdateFindingModal finding={finding} srNumber={srNumber} acUnits={acUnits} onSuccess={refreshFinding} />)
  }

  return (
    <div className="modal-content w-full max-w-lg my-auto">
      <div className="modal-header">
        <div>
          <h3 className="modal-title">Finding #{finding.srFindingsNumber}</h3>
          <span className="text-sm text-base-content/50">AC Unit #{finding.acNum}</span>
        </div>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-base-content/50 uppercase tracking-wide">Finding Type</span>
            <span className={`badge badge-soft ${findingTypeBadgeClass(finding.findingType)} text-xs w-fit`}>{finding.findingType ?? '—'}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-base-content/50 uppercase tracking-wide">AC Unit #</span>
            <span className="font-medium">{finding.acNum}</span>
          </div>
          <div className="col-span-2 flex flex-col gap-0.5">
            <span className="text-xs text-base-content/50 uppercase tracking-wide">Part / Model</span>
            <span className="font-medium">{finding.partModel ?? '—'}</span>
          </div>
          <div className="col-span-2 flex flex-col gap-0.5">
            <span className="text-xs text-base-content/50 uppercase tracking-wide">Remarks</span>
            <span className="font-medium">{finding.remarks ?? '—'}</span>
          </div>
        </div>
        <ModalNav
          title="Manage"
          items={FINDING_MENU_ITEMS_MODAL}
          hasRole={hasRole}
          onSelect={handleAction}
        />
      </div>
    </div>
  )
}

/**
 * Layer 4 — edit form for an existing finding.
 * Pushed from ManageFindingModal; calls popModal on success or cancel.
 */
function UpdateFindingModal({ finding, srNumber, acUnits, onSuccess }) {
  const { popModal } = useModal()
  const { apiFetch } = useAuth()
  const [form, setForm] = useState({
    findingType: finding.findingType ?? 'GOOD',
    partModel:   finding.partModel ?? '',
    acNum:       finding.acNum ?? '',
    remarks:     finding.remarks ?? '',
  })
  const [formError, setFormError] = useState({})
  const [submitting, setSubmitting] = useState(false)

  /** Submits the update and closes this layer on success. */
  async function handleSubmit(e) {
    e.preventDefault()
    setFormError({})
    setSubmitting(true)
    try {
      const res = await apiFetch(`/api/service-report-findings/${finding.srFindingsNumber}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          srNumber,
          findingType: form.findingType || null,
          partModel:   form.partModel   || null,
          acNum:       form.acNum       ? Number(form.acNum) : null,
          remarks:     form.remarks     || null,
        }),
      })
      if (!res.ok) { setFormError(await parseApiError(res)); notyfError('Update failed'); return }
      popModal()
      setTimeout(() => notyfSuccess(`Finding #${finding.srFindingsNumber} updated successfully.`), 150)
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
        <h3 className="modal-title">Update Finding #{finding.srFindingsNumber}</h3>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body">
        <form id="update-finding-form" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">AC Unit <span className="text-error">*</span></label>
              <select name="acNum" required
                className={`select select-bordered w-full${formError.acNum ? ' is-invalid' : ''}`}
                value={form.acNum} onChange={e => setForm(p => ({ ...p, acNum: e.target.value }))}>
                <option value="">Select AC unit...</option>
                {acUnits.map(u => <option key={u.acNum} value={u.acNum}>#{u.acNum} — {u.brand} {u.model}</option>)}
              </select>
              {formError.acNum && <span className="helper-text">{formError.acNum}</span>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Finding Type</label>
              <select name="findingType"
                className={`select select-bordered w-full${formError.findingType ? ' is-invalid' : ''}`}
                value={form.findingType} onChange={e => setForm(p => ({ ...p, findingType: e.target.value }))}>
                {FINDING_TYPE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              {formError.findingType && <span className="helper-text">{formError.findingType}</span>}
            </div>
            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="label-text font-medium">Part / Model</label>
              <input type="text" name="partModel" maxLength={60}
                className={`input input-bordered w-full${formError.partModel ? ' is-invalid' : ''}`}
                placeholder="e.g. Capacitor 35/5 MFD"
                value={form.partModel} onChange={e => setForm(p => ({ ...p, partModel: e.target.value }))} />
              {formError.partModel && <span className="helper-text">{formError.partModel}</span>}
            </div>
            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="label-text font-medium">Remarks</label>
              <textarea name="remarks" rows={4} maxLength={1200}
                className={`textarea textarea-bordered w-full${formError.remarks ? ' is-invalid' : ''}`}
                placeholder="Describe the finding in detail..."
                value={form.remarks} onChange={e => setForm(p => ({ ...p, remarks: e.target.value }))} />
              {formError.remarks && <span className="helper-text">{formError.remarks}</span>}
            </div>
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
        <button type="submit" form="update-finding-form" className="btn btn-primary" disabled={submitting}>
          {submitting ? <span className="loading loading-spinner loading-sm"></span> : <span className="icon-[tabler--device-floppy] size-4"></span>}
          Save Changes
        </button>
      </div>
    </div>
  )
}

/**
 * Add new finding form pushed from FindingsModal.
 * Calls popModal on success or cancel.
 */
function AddFindingModal({ srNumber, acUnits, onSuccess }) {
  const { popModal } = useModal()
  const { apiFetch } = useAuth()
  const [form, setForm] = useState({ findingType: 'GOOD', partModel: '', acNum: '', remarks: '' })
  const [formError, setFormError] = useState({})
  const [submitting, setSubmitting] = useState(false)

  /** Submits the new finding and closes this layer on success. */
  async function handleSubmit(e) {
    e.preventDefault()
    setFormError({})
    setSubmitting(true)
    try {
      const res = await apiFetch('/api/service-report-findings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          srNumber,
          findingType: form.findingType || null,
          partModel:   form.partModel   || null,
          acNum:       form.acNum       ? Number(form.acNum) : null,
          remarks:     form.remarks     || null,
        }),
      })
      if (!res.ok) { setFormError(await parseApiError(res)); notyfError('Add failed'); return }
      const data = await res.json().catch(() => ({}))
      popModal()
      setTimeout(() => notyfSuccess(`Finding #${data.srFindingsNumber} added successfully.`), 150)
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
        <h3 className="modal-title">New Finding</h3>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body">
        <form id="add-finding-form" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">AC Unit <span className="text-error">*</span></label>
              <select name="acNum" required
                className={`select select-bordered w-full${formError.acNum ? ' is-invalid' : ''}`}
                value={form.acNum} onChange={e => setForm(p => ({ ...p, acNum: e.target.value }))}>
                <option value="">Select AC unit...</option>
                {acUnits.map(u => <option key={u.acNum} value={u.acNum}>#{u.acNum} — {u.brand} {u.model}</option>)}
              </select>
              {formError.acNum && <span className="helper-text">{formError.acNum}</span>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Finding Type</label>
              <select name="findingType"
                className={`select select-bordered w-full${formError.findingType ? ' is-invalid' : ''}`}
                value={form.findingType} onChange={e => setForm(p => ({ ...p, findingType: e.target.value }))}>
                {FINDING_TYPE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              {formError.findingType && <span className="helper-text">{formError.findingType}</span>}
            </div>
            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="label-text font-medium">Part / Model</label>
              <input type="text" name="partModel" maxLength={60}
                className={`input input-bordered w-full${formError.partModel ? ' is-invalid' : ''}`}
                placeholder="e.g. Capacitor 35/5 MFD"
                value={form.partModel} onChange={e => setForm(p => ({ ...p, partModel: e.target.value }))} />
              {formError.partModel && <span className="helper-text">{formError.partModel}</span>}
            </div>
            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="label-text font-medium">Remarks</label>
              <textarea name="remarks" rows={4} maxLength={1200}
                className={`textarea textarea-bordered w-full${formError.remarks ? ' is-invalid' : ''}`}
                placeholder="Describe the finding in detail..."
                value={form.remarks} onChange={e => setForm(p => ({ ...p, remarks: e.target.value }))} />
              {formError.remarks && <span className="helper-text">{formError.remarks}</span>}
            </div>
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
        <button type="submit" form="add-finding-form" className="btn btn-primary" disabled={submitting}>
          {submitting ? <span className="loading loading-spinner loading-sm"></span> : <span className="icon-[tabler--plus] size-4"></span>}
          Add Finding
        </button>
      </div>
    </div>
  )
}

const FINDING_TYPE_OPTIONS = ['GOOD', 'DEFECT', 'WORN', 'DIRTY', 'LEAK', 'FAIL']

/**
 * Parses a failed API response into field-level or general error object.
 */
async function parseApiError(res) {
  const data = await res.json().catch(() => ({}))
  if (data.errors) return data.errors
  return { _general: data.message ?? data.error ?? `Error ${res.status}` }
}

/** Returns badge class for finding type */
function findingTypeBadgeClass(type) {
  if (type === 'GOOD')                    return 'badge-success'
  if (type === 'DEFECT' || type === 'FAIL') return 'badge-error'
  if (type === 'LEAK')                    return 'badge-warning'
  return 'badge-neutral'
}

const PAGE_SIZE = 10

export default function ServiceReportFindings() {
  const { apiFetch, hasRole } = useAuth()
  const { pushModal } = useModal()
  const { srNumber } = useParams()
  const srNumberInt = Number(srNumber)
  const location = useLocation()
  const projectName = location.state?.projectName ?? '...'
  const projNum = location.state?.projNum

  const [findings, setFindings]           = useState([])
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState(null)
  const [search, setSearch]               = useState('')
  const [page, setPage]                   = useState(0)
  const [totalPages, setTotalPages]       = useState(0)
  const [totalElements, setTotalElements] = useState(0)
  const [refreshKey, setRefreshKey]       = useState(0)
  const [acUnits, setAcUnits]             = useState([])

  const canEdit = hasRole('ADMIN', 'STAFF', 'CREW')

  /** Loads AC units for the project to populate the AC unit selector. */
  useEffect(() => {
    if (!projNum) return
    apiFetch(`/api/ac-units?projNum=${projNum}&size=100&sort=acNum,asc`)
      .then(res => res.json())
      .then(data => setAcUnits(data.content ?? []))
      .catch(() => {})
  }, [apiFetch, projNum])

  /** Fetches findings for this service report. */
  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({
      page:     String(page),
      size:     String(PAGE_SIZE),
      sort:     'srFindingsNumber,asc',
      srNumber: String(srNumberInt),
    })
    apiFetch(`/api/service-report-findings?${params}`)
      .then(res => {
        if (!res.ok) throw new Error(`Failed to load findings (${res.status})`)
        return res.json()
      })
      .then(data => {
        if (!active) return
        setFindings(data.content ?? [])
        setTotalPages(data.totalPages ?? 0)
        setTotalElements(data.totalElements ?? 0)
      })
      .catch(err => { if (active) setError(err.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [apiFetch, page, srNumberInt, refreshKey])

  const filtered = findings.filter(f => {
    if (search === '') return true
    const q = search.toLowerCase()
    return (
      String(f.srFindingsNumber).includes(q) ||
      (f.findingType ?? '').toLowerCase().includes(q) ||
      (f.partModel ?? '').toLowerCase().includes(q) ||
      (f.remarks ?? '').toLowerCase().includes(q)
    )
  })

  function handleRefresh() { setRefreshKey(k => k + 1) }

  return (
    <Layout activePage="service-report">
      {/* Header row */}
      <div className="flex items-stretch justify-between h-16 mb-6">
        <div>
          <h1 className="text-3xl font-semibold">
            Findings of SR #{srNumberInt}
          </h1>
          <p className="text-base-content/60 mt-1">
            {projectName} — View and manage service report findings
          </p>
        </div>

        <div className="flex gap-2 items-center h-full">
          {canEdit && (
            <button
              type="button"
              className="btn btn-primary h-full min-h-0"
              onClick={() => pushModal(<AddFindingModal srNumber={srNumberInt} acUnits={acUnits} onSuccess={() => { setPage(0); handleRefresh() }} />)}
            >
              <span className="icon-[tabler--plus] size-4"></span>
              New Finding
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
            placeholder="Search by type, part, or remarks..."
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
            {totalElements} finding{totalElements !== 1 ? 's' : ''} total
            {search && ` · ${filtered.length} shown`}
          </p>

          {filtered.length === 0 ? (
            <div className="text-center py-20 text-base-content/40">
              <span className="icon-[tabler--checklist] size-12 mx-auto mb-3 block"></span>
              <p>No findings recorded for this service report.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
              <table className="table table-zebra w-full">
                <thead>
                  <tr>
                    <th>Finding #</th>
                    <th>AC Unit #</th>
                    <th>Type</th>
                    <th>Part / Model</th>
                    <th>Remarks</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(f => (
                    <tr key={f.srFindingsNumber}>
                      <td className="font-mono font-semibold">{f.srFindingsNumber}</td>
                      <td className="font-mono">{f.acNum}</td>
                      <td>
                        <span className={`badge badge-soft ${findingTypeBadgeClass(f.findingType)} text-xs`}>
                          {f.findingType ?? '—'}
                        </span>
                      </td>
                      <td className="text-sm">{f.partModel ?? '—'}</td>
                      <td className="max-w-64">
                        <span className="line-clamp-2 text-sm" title={f.remarks}>{f.remarks ?? '—'}</span>
                      </td>
                      <td>
                        <button
                          className="btn btn-soft btn-primary btn-sm"
                          onClick={() => pushModal(<ManageFindingModal finding={f} srNumber={srNumberInt} acUnits={acUnits} onRefresh={handleRefresh} />)}
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
