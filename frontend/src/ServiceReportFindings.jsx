import { useState, useEffect } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { useAuth } from './auth'
import Layout from './Layout'
import Modal from './Modal'
import ManageMenu from './ManageMenu'
import { notyfSuccess, notyfError } from './notyf'

const FINDING_MENU_ITEMS_MODAL = [
  { key: 'update', label: 'Update Details', icon: 'icon-[tabler--pencil]', roles: ['ADMIN', 'STAFF', 'CREW'] },
]

/**
 * Modal component for managing findings of a specific service report.
 * Opens when `report` is non-null; closes by calling `onClose`.
 */
export function ManageFindingsModal({ report, apiFetch, hasRole, onClose }) {
  const srNumberInt = report?.srNumber ?? null
  const projNum     = report?.projNum ?? null

  const [findings, setFindings]           = useState([])
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState(null)
  const [page, setPage]                   = useState(0)
  const [totalPages, setTotalPages]       = useState(0)
  const [totalElements, setTotalElements] = useState(0)
  const [refreshKey, setRefreshKey]       = useState(0)

  const [acUnits, setAcUnits] = useState([])

  const [modalOpen, setModalOpen]   = useState(false)
  const [form, setForm]             = useState(EMPTY_FORM)
  const [formError, setFormError]   = useState({})
  const [submitting, setSubmitting] = useState(false)

  const [selectedFinding, setSelectedFinding] = useState(null)

  const [editModalOpen, setEditModalOpen]   = useState(false)
  const [editingFinding, setEditingFinding] = useState(null)
  const [editForm, setEditForm]             = useState(EMPTY_FORM)
  const [editFormError, setEditFormError]   = useState({})
  const [editSubmitting, setEditSubmitting] = useState(false)

  const canEdit = hasRole('ADMIN', 'STAFF', 'CREW')

  // Reset page when report changes
  useEffect(() => { setPage(0); setRefreshKey(0) }, [srNumberInt])

  /** Loads AC units for the project. */
  useEffect(() => {
    if (!projNum) return
    apiFetch(`/api/ac-units?projNum=${projNum}&size=100&sort=acNum,asc`)
      .then(res => res.json())
      .then(data => setAcUnits(data.content ?? []))
      .catch(() => {})
  }, [apiFetch, projNum])

  /** Fetches findings for the current service report. */
  useEffect(() => {
    if (!srNumberInt) { setFindings([]); return }
    let active = true
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({
      page:     String(page),
      size:     '20',
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

  function openAdd() { setForm(EMPTY_FORM); setFormError({}); setModalOpen(true) }
  function closeAdd() { setModalOpen(false); setForm(EMPTY_FORM); setFormError({}) }

  function openEdit(finding) {
    setEditForm({ findingType: finding.findingType ?? 'GOOD', partModel: finding.partModel ?? '', acNum: finding.acNum ?? '', remarks: finding.remarks ?? '' })
    setEditingFinding(finding)
    setEditFormError({})
    setEditModalOpen(true)
  }
  function closeEdit() { setEditModalOpen(false); setEditingFinding(null); setEditForm(EMPTY_FORM); setEditFormError({}) }

  /** Submits the new finding form. */
  async function handleSubmit(e) {
    e.preventDefault()
    setFormError({})
    setSubmitting(true)
    try {
      const res = await apiFetch('/api/service-report-findings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          srNumber:    srNumberInt,
          findingType: form.findingType || null,
          partModel:   form.partModel   || null,
          acNum:       form.acNum       ? Number(form.acNum) : null,
          remarks:     form.remarks     || null,
        }),
      })
      if (!res.ok) { setFormError(await parseApiError(res)); notyfError('Add failed'); return }
      const data = await res.json().catch(() => ({}))
      closeAdd()
      notyfSuccess(`Finding #${data.srFindingsNumber} added successfully.`)
      setPage(0)
      setRefreshKey(k => k + 1)
    } catch (err) {
      setFormError({ _general: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  /** Submits the update finding form. */
  async function handleUpdate(e) {
    e.preventDefault()
    setEditFormError({})
    setEditSubmitting(true)
    try {
      const res = await apiFetch(`/api/service-report-findings/${editingFinding.srFindingsNumber}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          srNumber:    srNumberInt,
          findingType: editForm.findingType || null,
          partModel:   editForm.partModel   || null,
          acNum:       editForm.acNum       ? Number(editForm.acNum) : null,
          remarks:     editForm.remarks     || null,
        }),
      })
      if (!res.ok) { setEditFormError(await parseApiError(res)); notyfError('Update failed'); return }
      closeEdit()
      notyfSuccess(`Finding #${editingFinding.srFindingsNumber} updated successfully.`)
      setRefreshKey(k => k + 1)
    } catch (err) {
      setEditFormError({ _general: err.message })
    } finally {
      setEditSubmitting(false)
    }
  }

  return (
    <>
      {/* Main Findings Modal */}
      <Modal
        isOpen={!!report}
        onClose={onClose}
        title={`Findings — SR #${srNumberInt}`}
        size="max-w-4xl"
        footer={
          <div className="flex gap-2 w-full">
            <button type="button" className="btn btn-soft btn-secondary" onClick={onClose}>Close</button>
            {canEdit && (
              <button type="button" className="btn btn-primary ml-auto" onClick={openAdd}>
                <span className="icon-[tabler--plus] size-4"></span>
                New Finding
              </button>
            )}
          </div>
        }
      >
        {/* SR summary */}
        <div className="mb-4 p-3 rounded-box bg-base-200 text-sm flex flex-wrap gap-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-base-content/50 text-xs uppercase tracking-wide">Project</span>
            <span className="font-medium">{report?.projectName}</span>
          </div>
          <div className="flex flex-col gap-0.5 flex-1 min-w-0">
            <span className="text-base-content/50 text-xs uppercase tracking-wide">Complaint</span>
            <span className="line-clamp-1">{report?.complaint ?? '—'}</span>
          </div>
        </div>

        {loading && (
          <div className="flex justify-center py-12">
            <span className="loading loading-spinner loading-lg text-primary"></span>
          </div>
        )}
        {error && (
          <div className="alert alert-error py-2">
            <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
            <span className="text-sm">{error}</span>
          </div>
        )}
        {!loading && !error && (
          <>
            <p className="text-sm text-base-content/50 mb-3">
              {totalElements} finding{totalElements !== 1 ? 's' : ''} total
            </p>
            {findings.length === 0 ? (
              <div className="text-center py-10 text-base-content/40">
                <span className="icon-[tabler--checklist] size-10 mx-auto mb-2 block"></span>
                <p>No findings recorded. Click <strong>New Finding</strong> to add one.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-box border border-base-300">
                <table className="table table-zebra table-sm w-full">
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
                    {findings.map(f => (
                      <tr key={f.srFindingsNumber}>
                        <td className="font-mono font-semibold">{f.srFindingsNumber}</td>
                        <td className="font-mono">{f.acNum ?? '—'}</td>
                        <td>
                          <span className={`badge badge-soft ${findingTypeBadgeClass(f.findingType)} text-xs`}>
                            {f.findingType ?? '—'}
                          </span>
                        </td>
                        <td className="text-sm">{f.partModel ?? '—'}</td>
                        <td className="max-w-48">
                          <span className="line-clamp-2 text-sm" title={f.remarks}>{f.remarks ?? '—'}</span>
                        </td>
                        <td>
                          <button
                            className="btn btn-soft btn-primary btn-sm"
                            onClick={() => setSelectedFinding(f)}
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
              <div className="flex items-center justify-center gap-2 mt-4">
                <button className="btn btn-sm btn-secondary" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                  <span className="icon-[tabler--chevron-left] size-4"></span>Prev
                </button>
                <span className="text-sm text-base-content/60">Page {page + 1} of {totalPages}</span>
                <button className="btn btn-sm btn-secondary" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                  Next<span className="icon-[tabler--chevron-right] size-4"></span>
                </button>
              </div>
            )}
          </>
        )}
      </Modal>

      {/* Add Finding Sub-modal */}
      <Modal
        isOpen={modalOpen}
        onClose={closeAdd}
        title="New Finding"
        footer={
          <>
            <button type="button" className="btn btn-soft btn-secondary" onClick={closeAdd}>Cancel</button>
            <button type="submit" form="mfm-new-finding-form" className="btn btn-primary" disabled={submitting}>
              {submitting ? <span className="loading loading-spinner loading-sm"></span> : <span className="icon-[tabler--plus] size-4"></span>}
              Add Finding
            </button>
          </>
        }
      >
        <form id="mfm-new-finding-form" onSubmit={handleSubmit}>
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
      </Modal>

      {/* Edit Finding Sub-modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={closeEdit}
        title={`Update Finding #${editingFinding?.srFindingsNumber}`}
        footer={
          <>
            <button type="button" className="btn btn-soft btn-secondary" onClick={closeEdit}>Cancel</button>
            <button type="submit" form="mfm-edit-finding-form" className="btn btn-primary" disabled={editSubmitting}>
              {editSubmitting ? <span className="loading loading-spinner loading-sm"></span> : <span className="icon-[tabler--device-floppy] size-4"></span>}
              Save Changes
            </button>
          </>
        }
      >
        <form id="mfm-edit-finding-form" onSubmit={handleUpdate}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">AC Unit <span className="text-error">*</span></label>
              <select name="acNum" required
                className={`select select-bordered w-full${editFormError.acNum ? ' is-invalid' : ''}`}
                value={editForm.acNum} onChange={e => setEditForm(p => ({ ...p, acNum: e.target.value }))}>
                <option value="">Select AC unit...</option>
                {acUnits.map(u => <option key={u.acNum} value={u.acNum}>#{u.acNum} — {u.brand} {u.model}</option>)}
              </select>
              {editFormError.acNum && <span className="helper-text">{editFormError.acNum}</span>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Finding Type</label>
              <select name="findingType"
                className={`select select-bordered w-full${editFormError.findingType ? ' is-invalid' : ''}`}
                value={editForm.findingType} onChange={e => setEditForm(p => ({ ...p, findingType: e.target.value }))}>
                {FINDING_TYPE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              {editFormError.findingType && <span className="helper-text">{editFormError.findingType}</span>}
            </div>
            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="label-text font-medium">Part / Model</label>
              <input type="text" name="partModel" maxLength={60}
                className={`input input-bordered w-full${editFormError.partModel ? ' is-invalid' : ''}`}
                placeholder="e.g. Capacitor 35/5 MFD"
                value={editForm.partModel} onChange={e => setEditForm(p => ({ ...p, partModel: e.target.value }))} />
              {editFormError.partModel && <span className="helper-text">{editFormError.partModel}</span>}
            </div>
            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="label-text font-medium">Remarks</label>
              <textarea name="remarks" rows={4} maxLength={1200}
                className={`textarea textarea-bordered w-full${editFormError.remarks ? ' is-invalid' : ''}`}
                placeholder="Describe the finding in detail..."
                value={editForm.remarks} onChange={e => setEditForm(p => ({ ...p, remarks: e.target.value }))} />
              {editFormError.remarks && <span className="helper-text">{editFormError.remarks}</span>}
            </div>
            {editFormError._general && (
              <div className="sm:col-span-2 alert alert-error py-2">
                <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                <span className="text-sm">{editFormError._general}</span>
              </div>
            )}
          </div>
        </form>
      </Modal>

      {/* Finding Manage Menu Sub-modal */}
      <ManageMenu
        title={selectedFinding ? `Finding #${selectedFinding.srFindingsNumber}` : ''}
        subtitle={selectedFinding ? `AC Unit #${selectedFinding.acNum}` : ''}
        item={selectedFinding}
        details={selectedFinding ? [
          { label: 'Finding Type', value: selectedFinding.findingType ?? '—' },
          { label: 'AC Unit #',    value: selectedFinding.acNum },
          { label: 'Part / Model', value: selectedFinding.partModel ?? '—', fullWidth: true },
          { label: 'Remarks',      value: selectedFinding.remarks ?? '—',   fullWidth: true },
        ] : []}
        isOpen={!!selectedFinding}
        onClose={() => setSelectedFinding(null)}
        hasRole={hasRole}
        menuItems={FINDING_MENU_ITEMS_MODAL}
        onMenuSelect={(key, finding) => {
          setSelectedFinding(null)
          if (key === 'update') openEdit(finding)
        }}
      />
    </>
  )
}

const FINDING_TYPE_OPTIONS = ['GOOD', 'DEFECT', 'WORN', 'DIRTY', 'LEAK', 'FAIL']

const FINDING_MENU_ITEMS = [
  { key: 'update', label: 'Update Details', icon: 'icon-[tabler--pencil]', roles: ['ADMIN', 'STAFF', 'CREW'] },
]

const EMPTY_FORM = {
  findingType: 'GOOD',
  partModel: '',
  acNum: '',
  remarks: '',
}

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
  const { srNumber } = useParams()
  const srNumberInt = Number(srNumber)
  const location = useLocation()
  const projectName = location.state?.projectName ?? '...'
  const projNum = location.state?.projNum

  const [findings, setFindings]             = useState([])
  const [loading, setLoading]               = useState(true)
  const [error, setError]                   = useState(null)
  const [search, setSearch]                 = useState('')
  const [page, setPage]                     = useState(0)
  const [totalPages, setTotalPages]         = useState(0)
  const [totalElements, setTotalElements]   = useState(0)
  const [refreshKey, setRefreshKey]         = useState(0)

  const [acUnits, setAcUnits] = useState([])

  const [modalOpen, setModalOpen]   = useState(false)
  const [form, setForm]             = useState(EMPTY_FORM)
  const [formError, setFormError]   = useState({})
  const [submitting, setSubmitting] = useState(false)

  const [selectedFinding, setSelectedFinding] = useState(null)

  const [editModalOpen, setEditModalOpen]     = useState(false)
  const [editingFinding, setEditingFinding]   = useState(null)
  const [editForm, setEditForm]               = useState(EMPTY_FORM)
  const [editFormError, setEditFormError]     = useState({})
  const [editSubmitting, setEditSubmitting]   = useState(false)

  const canEdit = hasRole('ADMIN', 'STAFF', 'CREW')

  /** Loads AC units for the project to populate the AC unit selector. */
  useEffect(() => {
    if (!projNum) return
    apiFetch(`/api/ac-units?projNum=${projNum}&size=100&sort=acNum,asc`)
      .then(res => res.json())
      .then(data => setAcUnits(data.content ?? []))
      .catch(() => {})
  }, [apiFetch, projNum])

  function openModal() { setModalOpen(true) }

  function closeModal() {
    setModalOpen(false)
    setForm(EMPTY_FORM)
    setFormError({})
  }

  /** Opens the edit modal pre-populated with the given finding's data. */
  function openEditModal(finding) {
    setEditForm({
      findingType: finding.findingType ?? 'GOOD',
      partModel:   finding.partModel ?? '',
      acNum:       finding.acNum ?? '',
      remarks:     finding.remarks ?? '',
    })
    setEditingFinding(finding)
    setEditFormError({})
    setEditModalOpen(true)
  }

  function closeEditModal() {
    setEditModalOpen(false)
    setEditingFinding(null)
    setEditForm(EMPTY_FORM)
    setEditFormError({})
  }

  function handleFormChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  function handleEditFormChange(e) {
    const { name, value } = e.target
    setEditForm(prev => ({ ...prev, [name]: value }))
  }

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

  /** Submits the new finding form. */
  async function handleSubmit(e) {
    e.preventDefault()
    setFormError({})
    setSubmitting(true)
    try {
      const res = await apiFetch('/api/service-report-findings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          srNumber:    srNumberInt,
          findingType: form.findingType || null,
          partModel:   form.partModel   || null,
          acNum:       form.acNum       ? Number(form.acNum) : null,
          remarks:     form.remarks     || null,
        }),
      })
      if (!res.ok) {
        setFormError(await parseApiError(res))
        notyfError('Add failed')
        return
      }
      const data = await res.json().catch(() => ({}))
      closeModal()
      setTimeout(() => notyfSuccess(`Finding #${data.srFindingsNumber} added successfully.`), 150)
      setPage(0)
      setRefreshKey(k => k + 1)
    } catch (err) {
      setFormError({ _general: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  /** Submits the update finding form. */
  async function handleUpdate(e) {
    e.preventDefault()
    setEditFormError({})
    setEditSubmitting(true)
    try {
      const res = await apiFetch(`/api/service-report-findings/${editingFinding.srFindingsNumber}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          srNumber:    srNumberInt,
          findingType: editForm.findingType || null,
          partModel:   editForm.partModel   || null,
          acNum:       editForm.acNum       ? Number(editForm.acNum) : null,
          remarks:     editForm.remarks     || null,
        }),
      })
      if (!res.ok) {
        setEditFormError(await parseApiError(res))
        notyfError('Update failed')
        return
      }
      closeEditModal()
      setTimeout(() => notyfSuccess(`Finding #${editingFinding.srFindingsNumber} updated successfully.`), 150)
      setRefreshKey(k => k + 1)
    } catch (err) {
      setEditFormError({ _general: err.message })
    } finally {
      setEditSubmitting(false)
    }
  }

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
              onClick={openModal}
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
                          onClick={() => setSelectedFinding(f)}
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

      {/* New Finding Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title="New Finding"
        footer={
          <>
            <button type="button" className="btn btn-soft btn-secondary" onClick={closeModal}>
              Cancel
            </button>
            <button type="submit" form="new-finding-form" className="btn btn-primary" disabled={submitting}>
              {submitting
                ? <span className="loading loading-spinner loading-sm"></span>
                : <span className="icon-[tabler--plus] size-4"></span>
              }
              Add Finding
            </button>
          </>
        }
      >
        <form id="new-finding-form" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">AC Unit <span className="text-error">*</span></label>
              <select name="acNum" required
                className={`select select-bordered w-full${formError.acNum ? ' is-invalid' : ''}`}
                value={form.acNum} onChange={handleFormChange}>
                <option value="">Select AC unit...</option>
                {acUnits.map(u => (
                  <option key={u.acNum} value={u.acNum}>#{u.acNum} — {u.brand} {u.model}</option>
                ))}
              </select>
              {formError.acNum && <span className="helper-text">{formError.acNum}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Finding Type</label>
              <select name="findingType"
                className={`select select-bordered w-full${formError.findingType ? ' is-invalid' : ''}`}
                value={form.findingType} onChange={handleFormChange}>
                {FINDING_TYPE_OPTIONS.map(o => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
              {formError.findingType && <span className="helper-text">{formError.findingType}</span>}
            </div>

            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="label-text font-medium">Part / Model</label>
              <input type="text" name="partModel" maxLength={60}
                className={`input input-bordered w-full${formError.partModel ? ' is-invalid' : ''}`}
                placeholder="e.g. Capacitor 35/5 MFD"
                value={form.partModel} onChange={handleFormChange} />
              {formError.partModel && <span className="helper-text">{formError.partModel}</span>}
            </div>

            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="label-text font-medium">Remarks</label>
              <textarea name="remarks" rows={4} maxLength={1200}
                className={`textarea textarea-bordered w-full${formError.remarks ? ' is-invalid' : ''}`}
                placeholder="Describe the finding in detail..."
                value={form.remarks} onChange={handleFormChange} />
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
      </Modal>

      {/* Edit Finding Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={closeEditModal}
        title={`Update Finding #${editingFinding?.srFindingsNumber}`}
        footer={
          <>
            <button type="button" className="btn btn-soft btn-secondary" onClick={closeEditModal}>
              Cancel
            </button>
            <button type="submit" form="edit-finding-form" className="btn btn-primary" disabled={editSubmitting}>
              {editSubmitting
                ? <span className="loading loading-spinner loading-sm"></span>
                : <span className="icon-[tabler--device-floppy] size-4"></span>
              }
              Save Changes
            </button>
          </>
        }
      >
        <form id="edit-finding-form" onSubmit={handleUpdate}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">AC Unit <span className="text-error">*</span></label>
              <select name="acNum" required
                className={`select select-bordered w-full${editFormError.acNum ? ' is-invalid' : ''}`}
                value={editForm.acNum} onChange={handleEditFormChange}>
                <option value="">Select AC unit...</option>
                {acUnits.map(u => (
                  <option key={u.acNum} value={u.acNum}>#{u.acNum} — {u.brand} {u.model}</option>
                ))}
              </select>
              {editFormError.acNum && <span className="helper-text">{editFormError.acNum}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Finding Type</label>
              <select name="findingType"
                className={`select select-bordered w-full${editFormError.findingType ? ' is-invalid' : ''}`}
                value={editForm.findingType} onChange={handleEditFormChange}>
                {FINDING_TYPE_OPTIONS.map(o => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
              {editFormError.findingType && <span className="helper-text">{editFormError.findingType}</span>}
            </div>

            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="label-text font-medium">Part / Model</label>
              <input type="text" name="partModel" maxLength={60}
                className={`input input-bordered w-full${editFormError.partModel ? ' is-invalid' : ''}`}
                placeholder="e.g. Capacitor 35/5 MFD"
                value={editForm.partModel} onChange={handleEditFormChange} />
              {editFormError.partModel && <span className="helper-text">{editFormError.partModel}</span>}
            </div>

            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="label-text font-medium">Remarks</label>
              <textarea name="remarks" rows={4} maxLength={1200}
                className={`textarea textarea-bordered w-full${editFormError.remarks ? ' is-invalid' : ''}`}
                placeholder="Describe the finding in detail..."
                value={editForm.remarks} onChange={handleEditFormChange} />
              {editFormError.remarks && <span className="helper-text">{editFormError.remarks}</span>}
            </div>

            {editFormError._general && (
              <div className="sm:col-span-2 alert alert-error py-2">
                <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                <span className="text-sm">{editFormError._general}</span>
              </div>
            )}
          </div>
        </form>
      </Modal>

      {/* Finding Manage Menu */}
      <ManageMenu
        title={selectedFinding ? `Finding #${selectedFinding.srFindingsNumber}` : ''}
        subtitle={selectedFinding ? `AC Unit #${selectedFinding.acNum}` : ''}
        item={selectedFinding}
        details={selectedFinding ? [
          { label: 'Finding Type', value: selectedFinding.findingType ?? '—' },
          { label: 'AC Unit #',    value: selectedFinding.acNum },
          { label: 'Part / Model', value: selectedFinding.partModel ?? '—', fullWidth: true },
          { label: 'Remarks',      value: selectedFinding.remarks ?? '—',   fullWidth: true },
        ] : []}
        isOpen={!!selectedFinding}
        onClose={() => setSelectedFinding(null)}
        hasRole={hasRole}
        menuItems={FINDING_MENU_ITEMS}
        onMenuSelect={(key, finding) => {
          setSelectedFinding(null)
          if (key === 'update') openEditModal(finding)
        }}
      />
    </Layout>
  )
}
