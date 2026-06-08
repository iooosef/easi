import { useState, useEffect, useMemo } from 'react'
import { useParams, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from './auth'
import { useModal } from './modals/index.js'
import Layout from './Layout'
import ModalNav from './modals/ModalNav.jsx'
import ProjectPickerModal from './ProjectPickerModal'
import PickerInput from './PickerInput'
import CrewPickerModal from './CrewPickerModal'
import EquipmentPickerModal from './EquipmentPickerModal'
import { notyfSuccess, notyfError } from './notyf'
import CalendarPanel, { statusDotColor } from './CalendarPanel'
import { ManageSRModal } from './ServiceReports'

const STATUS_OPTIONS = ['pending', 'confirmed', 'completed', 'cancelled']
const LIST_SIZE = 8

const STEPS = [
  { number: 1, label: 'Project & Purpose' },
  { number: 2, label: 'Select Date' },
  { number: 3, label: 'Select Crew Members' },
  { number: 4, label: 'Select Equipment' },
]

const EMPTY_FORM = { projNum: '', projName: '', purpose: '', date: '', status: 'pending' }

/** Parses a failed API response into field-level or general error object */
async function parseApiError(res) {
  const data = await res.json().catch(() => ({}))
  if (data.errors) return data.errors
  return { _general: data.message ?? data.error ?? `Error ${res.status}` }
}

/** Returns FlyonUI badge classes for a given schedule status */
function statusBadge(status) {
  const map = { pending: 'badge-warning', confirmed: 'badge-info', completed: 'badge-success', cancelled: 'badge-error' }
  return `badge badge-soft ${map[status?.toLowerCase()] ?? 'badge-neutral'}`
}

/** Formats a LocalDate string (yyyy-MM-dd) into a readable date */
function formatDate(d) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return new Date(+y, +m - 1, +day).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

/** Formats a LocalDateTime ISO string into a readable date-time */
function formatDateTime(dt) {
  if (!dt) return '—'
  return new Date(dt).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/**
 * Level 1 modal for managing a schedule.
 * Shows schedule details and a ModalNav for available actions.
 */
function ManageSchedModal({ sched: initialSched, projectMap, onRefresh }) {
  const { pushModal, popModal } = useModal()
  const { apiFetch, hasRole } = useAuth()
  const navigate = useNavigate()
  const [sched, setSched] = useState(initialSched)
  const [crew, setCrew] = useState([])
  const [crewLoading, setCrewLoading] = useState(true)
  const [sr, setSr] = useState(null) // null=loading, false=not found, object=found

  /** Re-fetches the latest schedule data to reflect updates made in sub-modals */
  async function refreshSched() {
    try {
      const res = await apiFetch(`/api/service-schedules/${sched.schedId}`)
      if (res.ok) setSched(await res.json())
    } catch (_) {}
    onRefresh?.()
  }

  /** Fetches assigned crew for display in the detail panel */
  function refreshCrew() {
    setCrewLoading(true)
    apiFetch(`/api/service-assignments/schedule/${sched.schedId}`)
      .then(r => r.ok ? r.json() : []).catch(() => [])
      .then(data => { setCrew(data); setCrewLoading(false) })
  }

  useEffect(() => {
    let cancelled = false
    apiFetch(`/api/service-assignments/schedule/${sched.schedId}`)
      .then(r => r.ok ? r.json() : []).catch(() => [])
      .then(data => { if (!cancelled) { setCrew(data); setCrewLoading(false) } })
    return () => { cancelled = true }
  }, [sched.schedId, apiFetch])

  /** Preloads the service report linked to this schedule to conditionally show the SR menu item */
  useEffect(() => {
    let cancelled = false
    apiFetch(`/api/service-reports?projNum=${sched.projNum}&size=200&sort=srNumber,asc`)
      .then(r => r.ok ? r.json() : { content: [] }).catch(() => ({ content: [] }))
      .then(data => {
        if (cancelled) return
        const found = (data.content ?? []).find(r => r.schedId === sched.schedId)
        setSr(found ?? false)
      })
    return () => { cancelled = true }
  }, [sched.schedId, sched.projNum, apiFetch])

  const srPaid = sr && sr.status === 'paid'

  const menuItems = [
    { key: 'update',    label: 'Update Schedule',        icon: 'icon-[tabler--pencil]',      roles: ['ADMIN', 'STAFF'] },
    { key: 'crew',      label: 'Manage Crew Assignment', icon: 'icon-[tabler--users]',        roles: ['ADMIN', 'STAFF', 'HR', 'ACCOUNTING'] },
    { key: 'equipment', label: 'Equipment Used',         icon: 'icon-[tabler--tool]',         roles: null },
    ...(sr && sched.status !== 'cancelled' ? [{ key: 'service-report', label: 'Manage Service Report', icon: 'icon-[tabler--file-report]', roles: null }] : []),
  ]

  function handleAction(key) {
    if (key === 'update') pushModal(<UpdateSchedModal sched={sched} lockStatus={srPaid} onSuccess={refreshSched} />)
    if (key === 'crew')           pushModal(<ManageCrewModal sched={sched} onSuccess={refreshCrew} />)
    if (key === 'equipment')      pushModal(<EquipUsedModal sched={sched} />)
    if (key === 'service-report') pushModal(<ManageSRModal report={sr} onRefresh={refreshSched} onNavigate={(path, opts) => navigate(path, opts)} />)
  }

  const projName = projectMap[sched.projNum] ?? `Project #${sched.projNum}`

  return (
    <div className="modal-content w-full max-w-lg my-auto">
      <div className="modal-header">
        <div>
          <h3 className="modal-title">{projName}</h3>
          <span className="text-sm text-base-content/50">Schedule #{sched.schedId}</span>
        </div>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-base-content/50 text-xs uppercase tracking-wide block">Purpose</span>
            {sched.purpose}
          </div>
          <div>
            <span className="text-base-content/50 text-xs uppercase tracking-wide block">Date</span>
            {formatDate(sched.date)}
          </div>
          <div>
            <span className="text-base-content/50 text-xs uppercase tracking-wide block">Status</span>
            <span className={statusBadge(sched.status)}>{sched.status}</span>
          </div>
          <div>
            <span className="text-base-content/50 text-xs uppercase tracking-wide block">Added On</span>
            {formatDateTime(sched.addedOn)}
          </div>
          <div className="col-span-2">
            <span className="text-base-content/50 text-xs uppercase tracking-wide block mb-1">Crew Assigned</span>
            {crewLoading ? (
              <span className="loading loading-spinner loading-xs text-primary"></span>
            ) : crew.length === 0 ? (
              <span className="text-sm text-base-content/40">No crew assigned.</span>
            ) : (
              <div className="flex flex-wrap gap-2">
                {crew.map(c => (
                  <span key={c.employeeId} className="badge badge-soft badge-neutral text-xs">
                    {c.lastName}, {c.firstName}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <ModalNav items={menuItems} hasRole={hasRole} onSelect={handleAction} cols={4} title="Actions" />
        {sr === null && (
          <p className="text-xs text-base-content/40 text-center">Checking for linked service report...</p>
        )}
      </div>
    </div>
  )
}

/**
 * Level 2 modal for updating schedule details.
 * Pushed from ManageSchedModal.
 */
function UpdateSchedModal({ sched, lockStatus, onSuccess }) {
  const { popModal } = useModal()
  const { apiFetch } = useAuth()
  const [form, setForm] = useState({
    purpose: sched.purpose ?? '',
    date: sched.date ?? '',
    status: sched.status ?? 'pending',
  })
  const [formError, setFormError] = useState({})
  const [submitting, setSubmitting] = useState(false)

  /** Submits the updated schedule fields */
  async function handleSubmit(e) {
    e.preventDefault()
    setFormError({})
    setSubmitting(true)
    try {
      const res = await apiFetch(`/api/service-schedules/${sched.schedId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projNum: sched.projNum, purpose: form.purpose, date: form.date, status: form.status }),
      })
      if (!res.ok) { setFormError(await parseApiError(res)); notyfError('Update failed'); return }
      notyfSuccess('Schedule updated successfully.')
      popModal()
      onSuccess?.()
    } catch (err) {
      setFormError({ _general: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-content w-full max-w-md my-auto">
      <div className="modal-header">
        <h3 className="modal-title">Update Schedule #{sched.schedId}</h3>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="modal-body flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="label-text font-medium">Purpose <span className="text-error">*</span></label>
            <input
              type="text"
              className={`input input-bordered w-full${formError.purpose ? ' is-invalid' : ''}`}
              placeholder="e.g. Quarterly maintenance"
              maxLength={30}
              required
              value={form.purpose}
              onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}
            />
            {formError.purpose && <span className="helper-text">{formError.purpose}</span>}
          </div>

          {form.status === 'pending' && (
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Date <span className="text-error">*</span></label>
              <input
                type="date"
                className={`input input-bordered w-full${formError.date ? ' is-invalid' : ''}`}
                required
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              />
              {formError.date && <span className="helper-text">{formError.date}</span>}
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="label-text font-medium">Status</label>
            <select
              className={`select select-bordered w-full${formError.status ? ' is-invalid' : ''}`}
              value={form.status}
              disabled={lockStatus}
              onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
            >
              {STATUS_OPTIONS.map(s => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
            {lockStatus && <span className="helper-text">Status is locked because the service report is paid.</span>}
            {formError.status && <span className="helper-text">{formError.status}</span>}
          </div>

          {formError._general && (
            <div className="alert alert-error py-2">
              <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
              <span className="text-sm">{formError._general}</span>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-soft btn-secondary" onClick={popModal}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting
              ? <span className="loading loading-spinner loading-sm"></span>
              : <span className="icon-[tabler--pencil] size-4"></span>
            }
            Save Changes
          </button>
        </div>
      </form>
    </div>
  )
}

/**
 * Level 2 modal for managing crew assignments on a schedule.
 * Pushed from ManageSchedModal.
 */
function ManageCrewModal({ sched, onSuccess }) {
  const { popModal } = useModal()
  const { apiFetch, hasRole } = useAuth()
  const canManageCrew = hasRole('ADMIN', 'STAFF', 'HR')

  const [crewList, setCrewList] = useState([])
  const [crewInitial, setCrewInitial] = useState([])
  const [crewLoading, setCrewLoading] = useState(true)
  const [crewSaving, setCrewSaving] = useState(false)
  const [crewPickerOpen, setCrewPickerOpen] = useState(false)
  const [busyEmployeeIds, setBusyEmployeeIds] = useState(new Set())

  /** Fetches employee IDs assigned to other schedules on the same date (informational only) */
  useEffect(() => {
    if (!sched.date) return
    let cancelled = false
    async function fetchBusy() {
      try {
        const res = await apiFetch(`/api/service-schedules/calendar?dateFrom=${sched.date}&dateTo=${sched.date}`)
        if (!res.ok || cancelled) return
        const schedules = (await res.json()).filter(s => s.schedId !== sched.schedId)
        if (cancelled) return
        const crewResults = await Promise.all(
          schedules.map(s => apiFetch(`/api/service-assignments/schedule/${s.schedId}`).then(r => r.ok ? r.json() : []).catch(() => []))
        )
        if (cancelled) return
        const ids = new Set()
        for (const crew of crewResults) for (const c of crew) ids.add(c.employeeId)
        setBusyEmployeeIds(ids)
      } catch (_) {}
    }
    fetchBusy()
    return () => { cancelled = true }
  }, [sched.schedId, sched.date, apiFetch])

  /** Fetches current crew assignments for the schedule */
  useEffect(() => {
    let cancelled = false
    apiFetch(`/api/service-assignments/schedule/${sched.schedId}`)
      .then(r => r.ok ? r.json() : []).catch(() => [])
      .then(data => { if (!cancelled) { setCrewList(data); setCrewInitial(data); setCrewLoading(false) } })
    return () => { cancelled = true }
  }, [sched.schedId, apiFetch])

  const crewDirty = useMemo(() => {
    const currentIds = new Set(crewList.filter(c => c.servAssgnId).map(c => c.servAssgnId))
    const hasRemovals = crewInitial.some(c => !currentIds.has(c.servAssgnId))
    const hasAdditions = crewList.some(c => !c.servAssgnId)
    return hasRemovals || hasAdditions
  }, [crewInitial, crewList])

  function removeCrew(employeeId) { setCrewList(l => l.filter(c => c.employeeId !== employeeId)) }

  function addCrewFromPicker(emp) {
    if (crewList.some(c => c.employeeId === emp.employeeId)) { setCrewPickerOpen(false); return }
    setCrewList(l => [...l, { servAssgnId: null, employeeId: emp.employeeId, firstName: emp.firstName, lastName: emp.lastName, position: emp.position }])
    setCrewPickerOpen(false)
  }

  /** Applies added and removed crew members via API */
  async function handleCrewUpdate() {
    setCrewSaving(true)
    try {
      const currentIds = new Set(crewList.filter(c => c.servAssgnId).map(c => c.servAssgnId))
      const toDelete = crewInitial.filter(c => !currentIds.has(c.servAssgnId))
      const toAdd = crewList.filter(c => !c.servAssgnId)
      for (const c of toDelete) {
        await apiFetch(`/api/service-assignments/${c.servAssgnId}`, { method: 'DELETE' })
      }
      for (const c of toAdd) {
        await apiFetch('/api/service-assignments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ employeeId: c.employeeId, schedId: sched.schedId }),
        })
      }
      notyfSuccess('Crew assignment updated.')
      popModal()
      onSuccess?.()
    } catch {
      notyfError('Update failed')
    } finally {
      setCrewSaving(false)
    }
  }

  return (
    <div className="modal-content w-full max-w-lg my-auto">
      <div className="modal-header">
        <h3 className="modal-title">Crew Assignment — Schedule #{sched.schedId}</h3>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body flex flex-col gap-4">
        {crewLoading ? (
          <div className="flex justify-center py-8">
            <span className="loading loading-spinner loading-md text-primary"></span>
          </div>
        ) : (
          <>
            {crewList.length === 0 ? (
              <div className="text-center py-8 text-base-content/40">
                <span className="icon-[tabler--users-minus] size-10 mx-auto mb-2 block"></span>
                <p className="text-sm">No crew assigned to this schedule.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {crewList.map(c => (
                  <div key={c.employeeId} className="card bg-base-100 border border-base-300">
                    <div className="card-body py-3 px-4 gap-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm line-clamp-1">{c.lastName}, {c.firstName}</p>
                          <p className="text-xs text-base-content/50">Emp #{c.employeeId} · {c.position ?? '—'}</p>
                          <div className="flex gap-1 flex-wrap mt-0.5">
                            {!c.servAssgnId && (
                              <span className="badge badge-soft badge-warning badge-xs">New</span>
                            )}
                            {busyEmployeeIds.has(c.employeeId) && (
                              <span className="badge badge-soft badge-info badge-xs">Also assigned today</span>
                            )}
                          </div>
                        </div>
                        {canManageCrew && (
                          <button type="button" className="btn btn-error btn-xs btn-square shrink-0" onClick={() => removeCrew(c.employeeId)}>
                            <span className="icon-[tabler--x] size-3.5"></span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {canManageCrew && (
              <button type="button" className="btn btn-soft btn-primary btn-sm w-full" onClick={() => setCrewPickerOpen(true)}>
                <span className="icon-[tabler--user-plus] size-4"></span>
                Add Crew
              </button>
            )}
          </>
        )}
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-soft btn-secondary" onClick={popModal}>Cancel</button>
        {canManageCrew && (
          <button type="button" className="btn btn-primary" disabled={!crewDirty || crewSaving} onClick={handleCrewUpdate}>
            {crewSaving
              ? <span className="loading loading-spinner loading-sm"></span>
              : <span className="icon-[tabler--users] size-4"></span>
            }
            Update Crew Assignment
          </button>
        )}
      </div>
      <CrewPickerModal
        isOpen={crewPickerOpen}
        onClose={() => setCrewPickerOpen(false)}
        onSelect={addCrewFromPicker}
        excludeIds={new Set(crewList.map(c => c.employeeId))}
      />
    </div>
  )
}

/**
 * Level 3 confirmation modal for un-assigning an equipment usage record.
 * Pushed from EquipUsedModal.
 */
function ConfirmUnassignModal({ equipmentName, onConfirm }) {
  const { popModal } = useModal()
  return (
    <div className="modal-content w-full max-w-sm my-auto">
      <div className="modal-header">
        <h3 className="modal-title">Un-assign Equipment</h3>
      </div>
      <div className="modal-body">
        <p className="text-sm">
          Are you sure you want to un-assign <span className="font-semibold">{equipmentName}</span> from this schedule?
        </p>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-soft btn-secondary" onClick={popModal}>Cancel</button>
        <button type="button" className="btn btn-error" onClick={() => { popModal(); onConfirm() }}>Un-assign</button>
      </div>
    </div>
  )
}

/**
 * Level 2 modal for viewing and managing equipment used on a schedule.
 * Pushed from ManageSchedModal.
 */
function EquipUsedModal({ sched }) {
  const { popModal, pushModal } = useModal()
  const { apiFetch } = useAuth()

  const [equipUsages, setEquipUsages] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState({ equipmentId: '', equipmentName: '', notes: '' })
  const [addFormError, setAddFormError] = useState({})
  const [addSubmitting, setAddSubmitting] = useState(false)
  const [equipPickerOpen, setEquipPickerOpen] = useState(false)
  const [deletingUsageId, setDeletingUsageId] = useState(null)

  const [updateUsageOpen, setUpdateUsageOpen] = useState(false)
  const [updatingUsage, setUpdatingUsage] = useState(null)
  const [updateNotes, setUpdateNotes] = useState('')
  const [updateFormError, setUpdateFormError] = useState({})
  const [updateSubmitting, setUpdateSubmitting] = useState(false)

  /** Fetches equipment usages for the schedule */
  useEffect(() => {
    let active = true
    setLoading(true)
    apiFetch(`/api/equipment-usages?schedId=${sched.schedId}&size=100&sort=usageId,asc`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => { if (active) setEquipUsages(data.content ?? []) })
      .catch(() => { if (active) setEquipUsages([]) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [apiFetch, sched.schedId, refreshKey])

  /** Submits a new equipment usage record */
  async function handleAddEquipUsage(e) {
    e.preventDefault()
    setAddFormError({})
    if (!addForm.equipmentId) { setAddFormError({ equipmentId: 'Please select an equipment.' }); return }
    setAddSubmitting(true)
    try {
      const res = await apiFetch('/api/equipment-usages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ equipmentId: Number(addForm.equipmentId), schedId: sched.schedId, notes: addForm.notes || null }),
      })
      if (!res.ok) { setAddFormError(await parseApiError(res)); notyfError('Add failed'); return }
      setAddOpen(false)
      setAddForm({ equipmentId: '', equipmentName: '', notes: '' })
      notyfSuccess('Equipment usage logged.')
      setRefreshKey(k => k + 1)
    } catch (err) {
      setAddFormError({ _general: err.message })
    } finally {
      setAddSubmitting(false)
    }
  }

  /** Deletes an equipment usage record */
  async function handleDeleteEquipUsage(usageId) {
    setDeletingUsageId(usageId)
    try {
      const res = await apiFetch(`/api/equipment-usages/${usageId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        notyfError(data.error ?? data.message ?? 'Delete failed')
        return
      }
      notyfSuccess(`Usage #${usageId} deleted.`)
      setRefreshKey(k => k + 1)
    } catch {
      notyfError('Delete failed — server error')
    } finally {
      setDeletingUsageId(null)
    }
  }

  function openUpdateUsage(usage) {
    setUpdatingUsage(usage)
    setUpdateNotes(usage.notes ?? '')
    setUpdateFormError({})
    setUpdateUsageOpen(true)
  }

  function closeUpdateUsage() {
    setUpdateUsageOpen(false)
    setUpdatingUsage(null)
    setUpdateNotes('')
    setUpdateFormError({})
  }

  /** Submits updated notes for an equipment usage record */
  async function handleUpdateUsageSubmit(e) {
    e.preventDefault()
    setUpdateFormError({})
    setUpdateSubmitting(true)
    try {
      const res = await apiFetch(`/api/equipment-usages/${updatingUsage.usageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedId: updatingUsage.schedId, notes: updateNotes || null }),
      })
      if (!res.ok) { setUpdateFormError(await parseApiError(res)); notyfError('Update failed'); return }
      closeUpdateUsage()
      notyfSuccess(`Usage #${updatingUsage.usageId} updated.`)
      setRefreshKey(k => k + 1)
    } catch (err) {
      setUpdateFormError({ _general: err.message })
    } finally {
      setUpdateSubmitting(false)
    }
  }

  return (
    <div className="modal-content w-full max-w-2xl my-auto">
      <div className="modal-header">
        <h3 className="modal-title">Equipment Used — Schedule #{sched.schedId}</h3>
        {!addOpen && (
          <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
            <span className="icon-[tabler--x] size-4"></span>
          </button>
        )}
      </div>
      {addOpen ? (
        <form onSubmit={handleAddEquipUsage}>
          <div className="modal-body flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Equipment <span className="text-error">*</span></label>
              <div className="flex gap-2">
                <input type="text" readOnly
                  className={`input input-bordered flex-1${addFormError.equipmentId ? ' is-invalid' : ''}`}
                  placeholder="No equipment selected"
                  value={addForm.equipmentName}
                />
                <button type="button" className="btn btn-soft btn-secondary shrink-0" onClick={() => setEquipPickerOpen(true)}>Pick</button>
              </div>
              {addFormError.equipmentId && <span className="helper-text">{addFormError.equipmentId}</span>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Notes</label>
              <input type="text"
                className="input input-bordered w-full"
                placeholder="Optional notes about this deployment"
                maxLength={255}
                value={addForm.notes}
                onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>
            {addFormError._general && (
              <div className="alert alert-error py-2">
                <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                <span className="text-sm">{addFormError._general}</span>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-soft btn-secondary"
              onClick={() => { setAddOpen(false); setAddForm({ equipmentId: '', equipmentName: '', notes: '' }); setAddFormError({}) }}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={addSubmitting}>
              {addSubmitting ? <span className="loading loading-spinner loading-sm"></span> : <span className="icon-[tabler--plus] size-4"></span>}
              Add Equipment to this Schedule
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="modal-body">
            {loading ? (
              <div className="flex justify-center py-6">
                <span className="loading loading-spinner loading-sm text-primary"></span>
              </div>
            ) : equipUsages.length === 0 ? (
              <div className="text-center py-8 text-base-content/40">
                <span className="icon-[tabler--tool-off] size-10 mx-auto mb-2 block"></span>
                <p className="text-sm">No equipment logged for this schedule.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-box border border-base-300">
                <table className="table table-zebra table-sm w-full">
                  <thead>
                    <tr>
                      <th>ID</th><th>Equipment</th><th>Type</th><th>Notes</th><th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {equipUsages.map(u => (
                      <tr key={u.usageId}>
                        <td className="font-mono text-xs">{u.usageId}</td>
                        <td className="text-sm max-w-48">
                          <span className="line-clamp-1" title={u.equipmentName}>{u.equipmentName}</span>
                        </td>
                        <td>
                          <span className={`badge badge-soft text-xs ${u.equipmentType === 'durable' ? 'badge-info' : 'badge-warning'}`}>
                            {u.equipmentType}
                          </span>
                        </td>
                        <td className="text-sm text-base-content/60 max-w-40">
                          <span className="line-clamp-2">{u.notes || '—'}</span>
                        </td>
                        <td>
                          <div className="flex gap-1">
                            <button className="btn btn-soft btn-primary btn-xs" onClick={() => openUpdateUsage(u)}>
                              <span className="icon-[tabler--pencil] size-3"></span> Edit
                            </button>
                            <button className="btn btn-soft btn-error btn-xs" disabled={deletingUsageId === u.usageId} onClick={() => pushModal(<ConfirmUnassignModal equipmentName={u.equipmentName} onConfirm={() => handleDeleteEquipUsage(u.usageId)} />)}>
                              {deletingUsageId === u.usageId
                                ? <span className="loading loading-spinner loading-xs"></span>
                                : <span className="icon-[tabler--x] size-3"></span>
                              }
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-soft btn-secondary" onClick={popModal}>Close</button>
            <button type="button" className="btn btn-primary"
              onClick={() => { setAddForm({ equipmentId: '', equipmentName: '', notes: '' }); setAddFormError({}); setAddOpen(true) }}>
              <span className="icon-[tabler--plus] size-4"></span>
              Add Equipment
            </button>
          </div>
        </>
      )}

      {/* Edit usage notes — inline sub-modal above the equipment modal */}
      {updateUsageOpen && (
        <>
          <div className="fixed inset-0 bg-base-300/40 z-[55]" onClick={closeUpdateUsage} />
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="modal-content w-full max-w-sm shadow-xl">
              <div className="modal-header">
                <div>
                  <h3 className="modal-title">Edit Usage #{updatingUsage?.usageId}</h3>
                  <span className="text-sm text-base-content/50">{updatingUsage?.equipmentName}</span>
                </div>
                <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={closeUpdateUsage}>
                  <span className="icon-[tabler--x] size-4"></span>
                </button>
              </div>
              <form onSubmit={handleUpdateUsageSubmit}>
                <div className="modal-body flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="label-text font-medium">Notes</label>
                    <input type="text"
                      className={`input input-bordered w-full${updateFormError.notes ? ' is-invalid' : ''}`}
                      placeholder="Optional notes about this deployment"
                      maxLength={255}
                      value={updateNotes}
                      onChange={e => setUpdateNotes(e.target.value)}
                    />
                    {updateFormError.notes && <span className="helper-text">{updateFormError.notes}</span>}
                  </div>
                  {updateFormError._general && (
                    <div className="alert alert-error py-2">
                      <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                      <span className="text-sm">{updateFormError._general}</span>
                    </div>
                  )}
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-soft btn-secondary btn-sm" onClick={closeUpdateUsage}>Cancel</button>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={updateSubmitting}>
                    {updateSubmitting
                      ? <span className="loading loading-spinner loading-xs"></span>
                      : <span className="icon-[tabler--device-floppy] size-4"></span>
                    }
                    Save
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      <EquipmentPickerModal
        isOpen={equipPickerOpen}
        onClose={() => setEquipPickerOpen(false)}
        onSelect={eq => {
          setAddForm(f => ({ ...f, equipmentId: eq.equipmentId, equipmentName: eq.name }))
          setAddFormError(err => ({ ...err, equipmentId: undefined }))
          setEquipPickerOpen(false)
        }}
        excludeIds={new Set(equipUsages.map(u => u.equipmentId))}
      />
    </div>
  )
}

/**
 * Modal wizard for creating a new service schedule.
 * Steps: Project & Purpose → Date → Crew → Equipment.
 * On success calls popModal() and onSuccess().
 */
function NewScheduleModal({ onSuccess }) {
  const { popModal } = useModal()
  const { apiFetch } = useAuth()

  const [step, setStep] = useState(1)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState({})
  const [submitting, setSubmitting] = useState(false)

  const [crewList, setCrewList] = useState([])
  const [crewPickerOpen, setCrewPickerOpen] = useState(false)

  const [equipmentList, setEquipmentList] = useState([])
  const [equipmentPickerOpen, setEquipmentPickerOpen] = useState(false)

  const [busyDurableIds, setBusyDurableIds] = useState(new Set())
  const [loadingEquipment, setLoadingEquipment] = useState(false)
  const [projectConflict, setProjectConflict] = useState(false)
  const [loadingConflict, setLoadingConflict] = useState(false)
  const [busyEmployeeIds, setBusyEmployeeIds] = useState(new Set())

  const excludeEquipmentIds = useMemo(
    () => new Set([...equipmentList.map(e => e.equipmentId), ...busyDurableIds]),
    [equipmentList, busyDurableIds]
  )

  /** Checks if this project already has a schedule on the selected date */
  useEffect(() => {
    if (!form.date || !form.projNum) { setProjectConflict(false); return }
    let cancelled = false
    async function check() {
      setLoadingConflict(true)
      try {
        const res = await apiFetch(`/api/service-schedules/calendar?dateFrom=${form.date}&dateTo=${form.date}&projNum=${form.projNum}`)
        if (!res.ok || cancelled) return
        const schedules = await res.json()
        if (!cancelled) setProjectConflict(schedules.length > 0)
      } catch (_) {}
      finally { if (!cancelled) setLoadingConflict(false) }
    }
    check()
    return () => { cancelled = true }
  }, [form.date, form.projNum, apiFetch])

  /** Fetches employee IDs already assigned to any schedule on the selected date (informational only) */
  useEffect(() => {
    if (!form.date) { setBusyEmployeeIds(new Set()); return }
    let cancelled = false
    async function fetchCrewAvail() {
      try {
        const res = await apiFetch(`/api/service-schedules/calendar?dateFrom=${form.date}&dateTo=${form.date}`)
        if (!res.ok || cancelled) return
        const schedules = await res.json()
        if (cancelled) return
        const crewResults = await Promise.all(
          schedules.map(s => apiFetch(`/api/service-assignments/schedule/${s.schedId}`).then(r => r.ok ? r.json() : []).catch(() => []))
        )
        if (cancelled) return
        const ids = new Set()
        for (const crew of crewResults) for (const c of crew) ids.add(c.employeeId)
        setBusyEmployeeIds(ids)
      } catch (_) { if (!cancelled) setBusyEmployeeIds(new Set()) }
    }
    fetchCrewAvail()
    return () => { cancelled = true }
  }, [form.date, apiFetch])

  /** Fetches durable equipment IDs already deployed on the selected date */
  useEffect(() => {
    if (!form.date) { setBusyDurableIds(new Set()); return }
    let cancelled = false
    async function fetchEquipAvail() {
      setLoadingEquipment(true)
      try {
        const res = await apiFetch(`/api/service-schedules/calendar?dateFrom=${form.date}&dateTo=${form.date}`)
        if (!res.ok || cancelled) return
        const schedules = await res.json()
        if (cancelled) return
        const usageResults = await Promise.all(
          schedules.map(s => apiFetch(`/api/equipment-usages?schedId=${s.schedId}&size=100`).then(r => r.ok ? r.json() : { content: [] }).catch(() => ({ content: [] })))
        )
        if (cancelled) return
        const ids = new Set()
        for (const page of usageResults) for (const u of page.content) if (u.equipmentType === 'durable') ids.add(u.equipmentId)
        setBusyDurableIds(ids)
      } catch (_) { if (!cancelled) setBusyDurableIds(new Set()) }
      finally { if (!cancelled) setLoadingEquipment(false) }
    }
    fetchEquipAvail()
    return () => { cancelled = true }
  }, [form.date, apiFetch])

  function removeCrew(employeeId) { setCrewList(l => l.filter(c => c.employeeId !== employeeId)) }

  function addCrewFromPicker(emp) {
    if (crewList.some(c => c.employeeId === emp.employeeId)) { setCrewPickerOpen(false); return }
    setCrewList(l => [...l, { employeeId: emp.employeeId, firstName: emp.firstName, lastName: emp.lastName, position: emp.position }])
    setCrewPickerOpen(false)
  }

  function removeEquipment(equipmentId) { setEquipmentList(l => l.filter(e => e.equipmentId !== equipmentId)) }

  function addEquipmentFromPicker(eq) {
    if (equipmentList.some(e => e.equipmentId === eq.equipmentId)) { setEquipmentPickerOpen(false); return }
    setEquipmentList(l => [...l, { equipmentId: eq.equipmentId, name: eq.name, type: eq.type, model: eq.model, serialNumber: eq.serialNumber, notes: '' }])
    setEquipmentPickerOpen(false)
  }

  function updateEquipmentNotes(equipmentId, notes) {
    setEquipmentList(l => l.map(e => e.equipmentId === equipmentId ? { ...e, notes } : e))
  }

  /** Validates the current step and advances if valid */
  function handleNext() {
    setFormError({})
    if (step === 1) {
      const errors = {}
      if (!form.projNum) errors.projNum = 'Please select a project.'
      if (!form.purpose.trim()) errors.purpose = 'Purpose is required.'
      if (Object.keys(errors).length > 0) { setFormError(errors); return }
      setStep(2)
    } else if (step === 2) {
      if (!form.date) { setFormError({ date: 'Please select a date.' }); return }
      if (loadingConflict) return
      if (projectConflict) { setFormError({ date: 'This project already has a schedule on the selected date.' }); return }
      setStep(3)
    } else if (step === 3) {
      if (crewList.length === 0) { setFormError({ _general: 'At least one crew member must be selected.' }); return }
      setStep(4)
    }
  }

  /** Creates schedule, service report, crew assignments, and equipment usages */
  async function handleSubmit() {
    setFormError({})
    setSubmitting(true)
    try {
      const res = await apiFetch('/api/service-schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projNum: Number(form.projNum), purpose: form.purpose, date: form.date, status: 'pending' }),
      })
      if (!res.ok) { setFormError(await parseApiError(res)); notyfError('Add failed'); return }
      const created = await res.json()

      const reportRes = await apiFetch('/api/service-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projNum: Number(form.projNum), complaint: form.purpose, workDone: 'add work done here', location: 'same as project location', schedId: created.schedId }),
      })
      if (!reportRes.ok) notyfError('Schedule created but service report could not be generated.')

      for (const c of crewList) {
        const assignRes = await apiFetch('/api/service-assignments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ employeeId: c.employeeId, schedId: created.schedId }),
        })
        if (!assignRes.ok) {
          const err = await parseApiError(assignRes)
          notyfError(err._general ?? `Employee #${c.employeeId} could not be assigned.`)
        }
      }


      for (const eq of equipmentList) {
        const eqRes = await apiFetch('/api/equipment-usages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ equipmentId: eq.equipmentId, schedId: created.schedId, notes: eq.notes || null }),
        })
        if (!eqRes.ok) {
          const err = await parseApiError(eqRes)
          notyfError(err._general ?? `Equipment #${eq.equipmentId} could not be logged.`)
        }
      }

      notyfSuccess('Schedule added successfully.')
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
        <div>
          <h3 className="modal-title">New Schedule</h3>
          <span className="text-sm text-base-content/50">Step {step} of {STEPS.length} — {STEPS[step - 1].label}</span>
        </div>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>

      <div className="modal-body flex flex-col gap-4">
        {/* Step progress bar */}
        <div className="flex items-center gap-x-1">
          {STEPS.map(s => (
            <div
              key={s.number}
              className={`progress-step transition-colors ${step >= s.number ? 'bg-primary' : 'bg-primary/10'}`}
              role="progressbar"
              aria-label={s.label}
              aria-valuenow={step >= s.number ? 100 : 0}
              aria-valuemin="0"
              aria-valuemax="100"
            />
          ))}
          <p className="text-xs text-primary ms-1 font-medium">{step}/{STEPS.length}</p>
        </div>

        {/* Step 1: Project & Purpose */}
        {step === 1 && (
          <div className="flex flex-col gap-4">
            <p className="text-xs font-semibold text-base-content/40 uppercase tracking-wide">Step 1 — Select Project and Purpose of Scheduling</p>
            <PickerInput
              label="Project"
              displayValue={form.projName}
              placeholder="Select a project..."
              buttonLabel="Browse"
              required
              error={formError.projNum}
              Picker={ProjectPickerModal}
              onSelect={p => { setForm(f => ({ ...f, projNum: p.projNum, projName: p.name })); setFormError({}) }}
            />
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Purpose <span className="text-error">*</span></label>
              <textarea
                className={`textarea textarea-bordered w-full${formError.purpose ? ' is-invalid' : ''}`}
                placeholder="e.g. Quarterly maintenance"
                maxLength={300}
                rows={3}
                required
                value={form.purpose}
                onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}
              />
              <div className="flex justify-between">
                {formError.purpose ? <span className="helper-text">{formError.purpose}</span> : <span />}
                <span className="text-xs text-base-content/40">{form.purpose.length}/300</span>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Select Date */}
        {step === 2 && (
          <div className="flex flex-col gap-4">
            <p className="text-xs font-semibold text-base-content/40 uppercase tracking-wide">Step 2 — Select Date</p>
            <div className="flex items-center gap-2 text-sm text-base-content/60 bg-base-200 rounded-lg px-3 py-2">
              <span className="icon-[tabler--folder] size-4 shrink-0"></span>
              <span className="line-clamp-1">{form.projName}</span>
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Date <span className="text-error">*</span></label>
              <input
                type="date"
                className={`input input-bordered w-full${formError.date || projectConflict ? ' is-invalid' : ''}`}
                required
                value={form.date}
                onChange={e => { setForm(f => ({ ...f, date: e.target.value })); setFormError({}) }}
              />
              {loadingConflict ? (
                <span className="text-xs text-base-content/50 flex items-center gap-1 mt-0.5">
                  <span className="loading loading-spinner loading-xs"></span>
                  Checking availability...
                </span>
              ) : projectConflict ? (
                <span className="helper-text">This project already has a schedule on this date. Please choose a different date.</span>
              ) : formError.date ? (
                <span className="helper-text">{formError.date}</span>
              ) : form.date ? (
                <span className="text-xs text-success flex items-center gap-1 mt-0.5">
                  <span className="icon-[tabler--circle-check] size-3.5"></span>
                  Date is available for this project.
                </span>
              ) : null}
            </div>
          </div>
        )}

        {/* Step 3: Select Crew */}
        {step === 3 && (
          <div className="flex flex-col gap-4">
            <p className="text-xs font-semibold text-base-content/40 uppercase tracking-wide">Step 3 — Select Crew Members</p>
            <div className="flex flex-col gap-1 text-sm text-base-content/60 bg-base-200 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="icon-[tabler--folder] size-4 shrink-0"></span>
                <span className="line-clamp-1">{form.projName}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="icon-[tabler--calendar] size-4 shrink-0"></span>
                <span>{form.date}</span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="label-text font-medium">Crew Members</label>
              {crewList.length === 0 ? (
                <p className="text-sm text-base-content/40">No crew members added yet.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {crewList.map(c => (
                    <div key={c.employeeId} className="card border bg-base-100 border-base-300">
                      <div className="card-body py-2 px-3 gap-0.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm line-clamp-1">{c.lastName}, {c.firstName}</p>
                            <p className="text-xs text-base-content/50">Emp #{c.employeeId} · {c.position ?? '—'}</p>
                            {busyEmployeeIds.has(c.employeeId) && (
                              <span className="badge badge-soft badge-warning badge-xs mt-0.5">Also assigned today</span>
                            )}
                          </div>
                          <button type="button" className="btn btn-error btn-xs btn-square shrink-0" onClick={() => removeCrew(c.employeeId)}>
                            <span className="icon-[tabler--x] size-3.5"></span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button type="button" className="btn btn-soft btn-primary btn-sm w-full" onClick={() => setCrewPickerOpen(true)}>
                <span className="icon-[tabler--user-plus] size-4"></span>
                Add Crew Member
              </button>
            </div>
            {formError._general && (
              <div className="alert alert-error py-2">
                <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                <span className="text-sm">{formError._general}</span>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Select Equipment */}
        {step === 4 && (
          <div className="flex flex-col gap-4">
            <p className="text-xs font-semibold text-base-content/40 uppercase tracking-wide">Step 4 — Select Equipment to Bring</p>
            <div className="flex flex-col gap-1 text-sm text-base-content/60 bg-base-200 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="icon-[tabler--folder] size-4 shrink-0"></span>
                <span className="line-clamp-1">{form.projName}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="icon-[tabler--calendar] size-4 shrink-0"></span>
                <span>{form.date}</span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="label-text font-medium">Equipment</label>
              <p className="text-xs text-base-content/40">Optional — add equipment that will be brought to this schedule.</p>
              {equipmentList.length === 0 ? (
                <p className="text-sm text-base-content/40">No equipment added yet.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {equipmentList.map(eq => (
                    <div key={eq.equipmentId} className="card bg-base-100 border border-base-300">
                      <div className="card-body py-2 px-3 gap-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm line-clamp-1">{eq.name}</p>
                            <p className="text-xs text-base-content/50">#{eq.equipmentId} · {eq.type}{eq.model ? ` · ${eq.model}` : ''}</p>
                            {eq.serialNumber && <p className="text-xs text-base-content/40">SN: {eq.serialNumber}</p>}
                          </div>
                          <button type="button" className="btn btn-error btn-xs btn-square shrink-0" onClick={() => removeEquipment(eq.equipmentId)}>
                            <span className="icon-[tabler--x] size-3.5"></span>
                          </button>
                        </div>
                        <input
                          type="text"
                          className="input input-bordered input-sm w-full"
                          placeholder="Notes (optional)"
                          maxLength={255}
                          value={eq.notes}
                          onChange={e => updateEquipmentNotes(eq.equipmentId, e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {loadingEquipment && (
                <span className="text-xs text-base-content/50 flex items-center gap-1">
                  <span className="loading loading-spinner loading-xs"></span>
                  Checking equipment availability...
                </span>
              )}
              <button type="button" className="btn btn-soft btn-primary btn-sm w-full" disabled={loadingEquipment} onClick={() => setEquipmentPickerOpen(true)}>
                <span className="icon-[tabler--tool] size-4"></span>
                Add Equipment
              </button>
            </div>
            {formError._general && (
              <div className="alert alert-error py-2">
                <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                <span className="text-sm">{formError._general}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="modal-footer justify-between">
        {step > 1 ? (
          <button type="button" className="btn btn-soft btn-secondary" onClick={() => setStep(s => s - 1)}>
            <span className="icon-[tabler--arrow-left] size-4"></span> Back
          </button>
        ) : <span />}
        {step < 4 ? (
          <button type="button" className="btn btn-primary" disabled={step === 2 && loadingConflict} onClick={handleNext}>
            Next <span className="icon-[tabler--arrow-right] size-4"></span>
          </button>
        ) : (
          <button type="button" className="btn btn-primary" disabled={submitting} onClick={handleSubmit}>
            {submitting ? <span className="loading loading-spinner loading-sm"></span> : <span className="icon-[tabler--plus] size-4"></span>}
            Add Schedule
          </button>
        )}
      </div>

      <CrewPickerModal
        isOpen={crewPickerOpen}
        onClose={() => setCrewPickerOpen(false)}
        onSelect={addCrewFromPicker}
        excludeIds={new Set(crewList.map(c => c.employeeId))}
      />
      <EquipmentPickerModal
        isOpen={equipmentPickerOpen}
        onClose={() => setEquipmentPickerOpen(false)}
        onSelect={addEquipmentFromPicker}
        excludeIds={excludeEquipmentIds}
      />
    </div>
  )
}

export default function Schedules() {
  const { apiFetch, hasRole } = useAuth()
  const { pushModal } = useModal()
  const { projNum: projNumParam } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const projNum = projNumParam ? Number(projNumParam) : null
  const projectName = location.state?.projectName ?? null
  const isProjectView = projNum !== null

  const canEdit = hasRole('ADMIN', 'STAFF')
  const [searchParams] = useSearchParams()

  const [projectMap, setProjectMap] = useState({})

  const [listSchedules, setListSchedules] = useState([])
  const [listPage, setListPage] = useState(0)
  const [listTotalPages, setListTotalPages] = useState(0)
  const [listTotal, setListTotal] = useState(0)
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState(null)

  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')

  const [hideFinished, setHideFinished] = useState(searchParams.get('hideFinished') === '1')
  const [showToday, setShowToday] = useState(searchParams.get('showToday') === '1')
  const [highlightDate, setHighlightDate] = useState(null)

  const calToday = new Date()
  const [calViewYear, setCalViewYear] = useState(calToday.getFullYear())
  const [calViewMonth, setCalViewMonth] = useState(calToday.getMonth())
  const [calSchedules, setCalSchedules] = useState([])

  /** Fetches schedules for the given year/month and updates calSchedules */
  async function fetchCalendar(year, month) {
    try {
      const mm = String(month + 1).padStart(2, '0')
      const lastDay = new Date(year, month + 1, 0).getDate()
      const params = new URLSearchParams({
        dateFrom: `${year}-${mm}-01`,
        dateTo: `${year}-${mm}-${String(lastDay).padStart(2, '0')}`,
      })
      if (projNum) params.set('projNum', String(projNum))
      const res = await apiFetch(`/api/service-schedules/calendar?${params}`)
      if (!res.ok) return
      const data = await res.json()
      setCalSchedules(data)
    } catch (_) {}
  }

  /** Fetches project names once for the lookup map */
  async function fetchProjects() {
    try {
      const res = await apiFetch('/api/projects?size=500&sort=name,asc')
      if (!res.ok) return
      const data = await res.json()
      const map = {}
      for (const p of (data.content ?? [])) map[p.projNum] = p.name
      setProjectMap(map)
    } catch (_) {}
  }

  /** Fetches the paginated list with current search and hideFinished state, or today's schedules when showToday is active */
  async function fetchList() {
    setListLoading(true)
    setListError(null)
    try {
      if (showToday) {
        const today = new Date().toISOString().split('T')[0]
        const params = new URLSearchParams({ dateFrom: today, dateTo: today })
        if (projNum) params.set('projNum', String(projNum))
        const res = await apiFetch(`/api/service-schedules/calendar?${params}`)
        if (!res.ok) throw new Error(`Failed to load schedules (${res.status})`)
        let data = await res.json()
        if (hideFinished) data = data.filter(s => s.status !== 'completed' && s.status !== 'cancelled')
        setListSchedules(data)
        setListTotalPages(0)
        setListTotal(data.length)
      } else {
        const params = new URLSearchParams({
          page: String(listPage),
          size: String(LIST_SIZE),
          sort: hideFinished ? 'date,desc' : 'schedId,desc',
          hideFinished: String(hideFinished),
        })
        if (appliedSearch) params.set('search', appliedSearch)
        if (projNum) params.set('projNum', String(projNum))
        const res = await apiFetch(`/api/service-schedules?${params}`)
        if (!res.ok) throw new Error(`Failed to load schedules (${res.status})`)
        const data = await res.json()
        setListSchedules(data.content ?? [])
        setListTotalPages(data.totalPages ?? 0)
        setListTotal(data.totalElements ?? 0)
      }
    } catch (err) {
      setListError(err.message)
    } finally {
      setListLoading(false)
    }
  }

  useEffect(() => { fetchProjects() }, [apiFetch])
  useEffect(() => { fetchList() }, [apiFetch, listPage, appliedSearch, hideFinished, showToday, projNum])
  useEffect(() => { fetchCalendar(calViewYear, calViewMonth) }, [apiFetch, calViewYear, calViewMonth, projNum])

  // Debounce search input: apply after 400ms of no typing, reset to page 0
  useEffect(() => {
    const timer = setTimeout(() => {
      setListPage(0)
      setAppliedSearch(searchInput)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchInput])

  /** Toggles hideFinished and resets list to first page */
  function toggleHideFinished() {
    setListPage(0)
    setHideFinished(h => !h)
  }

  /** Toggles today-only filter and resets list to first page */
  function toggleShowToday() {
    setListPage(0)
    setShowToday(t => !t)
  }

  /** Opens the manage modal for a schedule */
  function openManage(sched) {
    pushModal(
      <ManageSchedModal
        sched={sched}
        projectMap={projectMap}
        onRefresh={() => { fetchList(); fetchCalendar(calViewYear, calViewMonth) }}
      />
    )
  }

  const initialLoading = listLoading && listSchedules.length === 0

  return (
    <Layout activePage="schedules">
      {/* Header row */}
      <div className="flex items-stretch justify-between h-16 mb-6">
        <div>
          <h1 className="text-3xl font-semibold">
            {isProjectView ? `Schedules of ${projectName ?? `Project #${projNum}`}` : 'Schedules'}
          </h1>
          <p className="text-base-content/60 mt-1">
            {isProjectView ? 'Service schedules for this project' : hasRole('CREW') ? 'View your schedules' : 'View and manage service schedules'}
          </p>
        </div>
        <div className="flex gap-2 items-center h-full">
          {canEdit && (
            <button type="button" className="btn btn-primary h-full min-h-0" onClick={() => pushModal(<NewScheduleModal onSuccess={() => { fetchList(); fetchCalendar(calViewYear, calViewMonth) }} />)}>
              <span className="icon-[tabler--plus] size-4"></span>
              Add New Schedule
            </button>
          )}
        </div>
      </div>

      {/* Initial full-page spinner */}
      {initialLoading && (
        <div className="flex justify-center py-20">
          <span className="loading loading-spinner loading-lg text-primary"></span>
        </div>
      )}

      {/* Main content */}
      {!initialLoading && (
        <div className="flex gap-6 items-stretch h-[calc(100vh-14rem)]">

          {/* Left: Paginated schedule list (1/3) */}
          <div className="w-1/3 flex flex-col gap-3 h-full">

            {/* Search bar */}
            <div className="relative shrink-0">
              <span className="icon-[tabler--search] size-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none"></span>
              <input
                type="text"
                className="input input-bordered w-full pl-9"
                placeholder="Search by project or purpose..."
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
              />
            </div>

            {/* Count + filter toggles */}
            <div className="flex items-center justify-between shrink-0">
              <p className="text-sm font-medium text-base-content">
                {listTotal} schedule{listTotal !== 1 ? 's' : ''}
              </p>
              <div className="flex gap-1">
                <button
                  className={`btn btn-xs flex-col h-auto py-1.5 px-3 gap-0.5 min-w-[72px] ${showToday ? 'btn-primary' : 'btn-secondary border border-base-300'}`}
                  onClick={toggleShowToday}
                  title={showToday ? 'Click to show all dates' : 'Click to show only today\'s schedules'}
                >
                  <span className="icon-[tabler--filter] size-3.5"></span>
                  <span className="text-[10px] font-medium leading-tight text-center whitespace-normal">
                    {showToday ? <>Showing Today<br/>Only</> : <>Showing Any<br/>Dates</>}
                  </span>
                </button>
                <button
                  className={`btn btn-xs flex-col h-auto py-1.5 px-3 gap-0.5 min-w-[72px] ${hideFinished ? 'btn-primary' : 'btn-secondary border border-base-300'}`}
                  onClick={toggleHideFinished}
                  title={hideFinished ? 'Click to show completed and cancelled schedules' : 'Click to hide completed and cancelled schedules'}
                >
                  <span className="icon-[tabler--filter] size-3.5"></span>
                  <span className="text-[10px] font-medium leading-tight text-center whitespace-normal">
                    {hideFinished ? <>Showing Pending Only</> : <>Showing All Statuses</>}
                  </span>
                </button>
              </div>
            </div>

            {/* List error */}
            {listError && (
              <div className="alert alert-error py-2 text-sm shrink-0">
                <span className="icon-[tabler--alert-circle] size-4"></span>
                <span>{listError}</span>
              </div>
            )}

            {/* Schedule cards */}
            <div className={`flex-1 overflow-y-auto flex flex-col gap-3 pr-1 transition-opacity ${listLoading ? 'opacity-50 pointer-events-none' : ''}`}>
              {!listError && listSchedules.length === 0 ? (
                <div className="text-center py-12 text-base-content/40">
                  <span className="icon-[tabler--calendar-off] size-10 mx-auto mb-2 block"></span>
                  <p className="text-sm">No schedules found.</p>
                </div>
              ) : (
                listSchedules.map(sched => (
                  <div
                    key={sched.schedId}
                    className={`card bg-base-100 border transition-colors ${highlightDate === sched.date ? 'border-primary shadow-sm' : 'border-base-300'}`}
                  >
                    <div className="card-body py-3 px-4 gap-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-sm line-clamp-1">
                          {projectMap[sched.projNum] ?? `Project #${sched.projNum}`}
                        </p>
                        <span className={`${statusBadge(sched.status)} text-xs shrink-0`}>
                          {sched.status}
                        </span>
                      </div>
                      <p className="text-xs text-base-content/70">{sched.purpose}</p>
                      <p className="text-xs text-base-content/50 flex items-center gap-1">
                        <span className="icon-[tabler--calendar] size-3.5"></span>
                        {formatDate(sched.date)}
                      </p>
                      <div className="card-actions mt-1">
                        <button
                          className="btn btn-soft btn-primary btn-xs w-full"
                          onClick={() => openManage(sched)}
                        >
                          <span className="icon-[tabler--settings] size-3.5"></span>
                          Manage Schedule
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Pagination controls */}
            {listTotalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-1 shrink-0">
                <button
                  className="btn btn-secondary btn-sm btn-square"
                  disabled={listPage === 0 || listLoading}
                  onClick={() => setListPage(p => p - 1)}
                >
                  <span className="icon-[tabler--chevron-left] size-4"></span>
                </button>
                <span className="text-xs text-base-content/60">
                  Page {listPage + 1} of {listTotalPages}
                </span>
                <button
                  className="btn btn-secondary btn-sm btn-square"
                  disabled={listPage >= listTotalPages - 1 || listLoading}
                  onClick={() => setListPage(p => p + 1)}
                >
                  <span className="icon-[tabler--chevron-right] size-4"></span>
                </button>
              </div>
            )}
          </div>

          {/* Right: Calendar (2/3) */}
          <div className="flex-1 h-full">
            <CalendarPanel
              selectedDate={highlightDate}
              onDateSelect={ds => setHighlightDate(h => h === ds ? null : ds)}
              projNum={projNum}
              fillHeight
              externalSchedules={calSchedules}
              onMonthChange={(y, m) => { setCalViewYear(y); setCalViewMonth(m) }}
              renderCellSchedules={(dayScheds) => (
                <div className="flex flex-col gap-0.5">
                  {dayScheds.slice(0, 3).map(s => (
                    <div
                      key={s.schedId}
                      className="flex items-center gap-1 px-1 py-0.5 rounded text-xs bg-base-200 hover:bg-base-300 cursor-pointer"
                      title={`${projectMap[s.projNum] ?? `Project #${s.projNum}`} — ${s.purpose}`}
                      onClick={e => { e.stopPropagation(); openManage(s) }}
                    >
                      <span className={`size-1.5 rounded-full shrink-0 ${statusDotColor(s.status)}`}></span>
                      <span className="truncate leading-tight">
                        {projectMap[s.projNum] ?? `#${s.projNum}`}
                      </span>
                    </div>
                  ))}
                  {dayScheds.length > 3 && (
                    <p className="text-xs text-base-content/40 px-1">+{dayScheds.length - 3} more</p>
                  )}
                </div>
              )}
            />
          </div>

        </div>
      )}

    </Layout>
  )
}
