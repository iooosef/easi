import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './auth'
import Layout from './Layout'
import Modal from './Modal'
import ManageMenu from './ManageMenu'
import PickerInput from './PickerInput'
import CrewPickerModal from './CrewPickerModal'
import EquipmentPickerModal from './EquipmentPickerModal'
import SchedulePickerModal from './SchedulePickerModal'
import EmployeePickerModal from './EmployeePickerModal'
import { notyfSuccess, notyfError } from './notyf'
import CalendarPanel, { statusDotColor } from './CalendarPanel'
import { ManageBillingModal } from './Billing'

const SCHEDULE_MENU_ITEMS = [
  { key: 'update',          label: 'Update Schedule',        icon: 'icon-[tabler--pencil]',       roles: ['ADMIN', 'STAFF'] },
  { key: 'crew',            label: 'Manage Crew Assignment', icon: 'icon-[tabler--users]',         roles: null },
  { key: 'equipment',       label: 'Equipment Used',         icon: 'icon-[tabler--tool]',          roles: null },
  { key: 'service-report',  label: 'Manage Service Report',  icon: 'icon-[tabler--file-report]',  roles: null },
]

const SR_MENU_ITEMS = [
  { key: 'update',         label: 'Update Details',         icon: 'icon-[tabler--pencil]',        roles: ['ADMIN', 'STAFF'] },
  { key: 'findings',       label: 'Add & Manage Findings',        icon: 'icon-[tabler--checklist]',     roles: null },
  { key: 'billing',        label: 'Add & Manage Billing Items',   icon: 'icon-[tabler--receipt]',       roles: null },
  { key: 'purchase-order', label: 'Add & Manage Purchase Order',  icon: 'icon-[tabler--file-invoice]',  roles: null },
  { key: 'documents',      label: 'Add & Manage Documents',       icon: 'icon-[tabler--files]',         roles: null },
]

const STATUS_OPTIONS = ['pending', 'confirmed', 'completed', 'cancelled']
const SR_PAYMENT_OPTIONS = ['unset', 'cash', 'check', 'gcash', 'bank']
const SR_STATUS_OPTIONS = ['unpaid', 'paid', 'partial']
const EMPTY_SR_EDIT_FORM = {
  schedId: '', _scheduleDisplay: '',
  engineerEmployeeId: '', _engineerDisplay: '',
  complaint: '', workDone: '', location: '',
}
const LIST_SIZE = 8

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

export default function Schedules() {
  const { apiFetch, hasRole } = useAuth()
  const { projNum: projNumParam } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const projNum = projNumParam ? Number(projNumParam) : null
  const projectName = location.state?.projectName ?? null
  const isProjectView = projNum !== null

  const canEdit = hasRole('ADMIN', 'STAFF')
  const canManageCrew = hasRole('ADMIN', 'STAFF')
  const today = new Date()

  // Project name lookup map, fetched once
  const [projectMap, setProjectMap] = useState({})

  // List data: paginated, searchable
  const [listSchedules, setListSchedules] = useState([])
  const [listPage, setListPage] = useState(0)
  const [listTotalPages, setListTotalPages] = useState(0)
  const [listTotal, setListTotal] = useState(0)
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState(null)

  // Search: typed value is debounced before triggering a fetch
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')

  // Toggle: hide completed + cancelled schedules
  const [hideFinished, setHideFinished] = useState(false)

  // Highlighted date — set by clicking a calendar day, used to highlight matching list cards
  const [highlightDate, setHighlightDate] = useState(null)

  // Update schedule modal
  const [updateOpen, setUpdateOpen] = useState(false)
  const [updateForm, setUpdateForm] = useState(EMPTY_FORM)
  const [updateFormError, setUpdateFormError] = useState({})
  const [updateSubmitting, setUpdateSubmitting] = useState(false)
  const [editingSchedId, setEditingSchedId] = useState(null)

  // Selected schedule for ManageMenu
  const [selectedSched, setSelectedSched] = useState(null)
  const [selectedSchedCrew, setSelectedSchedCrew] = useState([])
  const [selectedSchedCrewLoading, setSelectedSchedCrewLoading] = useState(false)

  // SR linked to the selected schedule — preloaded when ManageMenu opens
  // null = loading, false = none found, object = found
  const [selectedSchedSr, setSelectedSchedSr] = useState(null)

  // Service report manage modal (opened from schedule ManageMenu)
  const [srForSched, setSrForSched] = useState(null)
  const [billingReport, setBillingReport] = useState(null)

  // Edit SR modal
  const [editSrOpen, setEditSrOpen] = useState(false)
  const [editingSr, setEditingSr] = useState(null)
  const [editSrForm, setEditSrForm] = useState(EMPTY_SR_EDIT_FORM)
  const [editSrFormError, setEditSrFormError] = useState({})
  const [editSrSubmitting, setEditSrSubmitting] = useState(false)

  // Crew assignment modal
  const [crewOpen, setCrewOpen] = useState(false)
  const [crewSched, setCrewSched] = useState(null)
  const [crewList, setCrewList] = useState([])      // working copy
  const [crewInitial, setCrewInitial] = useState([]) // snapshot from server
  const [crewLoading, setCrewLoading] = useState(false)
  const [crewSaving, setCrewSaving] = useState(false)
  const [crewPickerOpen, setCrewPickerOpen] = useState(false)

  // Equipment Used modal
  const [equipUsedOpen, setEquipUsedOpen]           = useState(false)
  const [equipUsedSched, setEquipUsedSched]         = useState(null)
  const [equipUsages, setEquipUsages]               = useState([])
  const [equipUsagesLoading, setEquipUsagesLoading] = useState(false)
  const [equipUsagesRefresh, setEquipUsagesRefresh] = useState(0)
  const [addEquipOpen, setAddEquipOpen]             = useState(false)
  const [addEquipForm, setAddEquipForm]             = useState({ equipmentId: '', equipmentName: '', notes: '' })
  const [addEquipFormError, setAddEquipFormError]   = useState({})
  const [addEquipSubmitting, setAddEquipSubmitting] = useState(false)
  const [deletingUsageId, setDeletingUsageId]       = useState(null)
  const [equipPickerOpen, setEquipPickerOpen]       = useState(false)

  // Update usage notes sub-modal
  const [updateUsageOpen, setUpdateUsageOpen]           = useState(false)
  const [updatingUsage, setUpdatingUsage]               = useState(null)
  const [updateUsageNotes, setUpdateUsageNotes]         = useState('')
  const [updateUsageFormError, setUpdateUsageFormError] = useState({})
  const [updateUsageSubmitting, setUpdateUsageSubmitting] = useState(false)

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

  /** Fetches the paginated list with current search and hideFinished state */
  async function fetchList() {
    setListLoading(true)
    setListError(null)
    try {
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
    } catch (err) {
      setListError(err.message)
    } finally {
      setListLoading(false)
    }
  }

  // Projects fetched once on mount
  useEffect(() => { fetchProjects() }, [apiFetch])

  // List refetches when page, search, filter, or project scope changes
  useEffect(() => { fetchList() }, [apiFetch, listPage, appliedSearch, hideFinished, projNum])

  // Fetch crew for the selected schedule shown in ManageMenu
  useEffect(() => {
    if (!selectedSched) { setSelectedSchedCrew([]); return }
    let cancelled = false
    setSelectedSchedCrewLoading(true)
    apiFetch(`/api/service-assignments/schedule/${selectedSched.schedId}`)
      .then(r => r.ok ? r.json() : [])
      .catch(() => [])
      .then(data => { if (!cancelled) { setSelectedSchedCrew(data); setSelectedSchedCrewLoading(false) } })
    return () => { cancelled = true }
  }, [selectedSched, apiFetch])

  // Preload the service report linked to the selected schedule
  useEffect(() => {
    if (!selectedSched) { setSelectedSchedSr(null); return }
    let cancelled = false
    setSelectedSchedSr(null)
    apiFetch(`/api/service-reports?projNum=${selectedSched.projNum}&size=200&sort=srNumber,asc`)
      .then(r => r.ok ? r.json() : { content: [] })
      .catch(() => ({ content: [] }))
      .then(data => {
        if (cancelled) return
        const sr = (data.content ?? []).find(r => r.schedId === selectedSched.schedId)
        setSelectedSchedSr(sr ?? false)
      })
    return () => { cancelled = true }
  }, [selectedSched, apiFetch])

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

  // Update modal handlers
  function openUpdate(sched) {
    setEditingSchedId(sched.schedId)
    setUpdateForm({
      projNum:  String(sched.projNum),
      projName: projectMap[sched.projNum] ?? `Project #${sched.projNum}`,
      purpose:  sched.purpose  ?? '',
      date:     sched.date     ?? '',
      status:   sched.status   ?? 'pending',
    })
    setUpdateFormError({})
    setUpdateOpen(true)
  }

  function closeUpdate() {
    setUpdateOpen(false)
    setUpdateForm(EMPTY_FORM)
    setUpdateFormError({})
    setEditingSchedId(null)
  }

  /** Submits the update for an existing schedule */
  async function handleUpdate(e) {
    e.preventDefault()
    setUpdateFormError({})
    setUpdateSubmitting(true)
    try {
      const res = await apiFetch(`/api/service-schedules/${editingSchedId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projNum: Number(updateForm.projNum), purpose: updateForm.purpose, date: updateForm.date, status: updateForm.status }),
      })
      if (!res.ok) { setUpdateFormError(await parseApiError(res)); notyfError('Update failed'); return }
      closeUpdate()
      setSelectedSched(null)
      setTimeout(() => notyfSuccess('Schedule updated successfully.'), 150)
      fetchCalendar()
      fetchList()
    } catch (err) {
      setUpdateFormError({ _general: err.message })
    } finally {
      setUpdateSubmitting(false)
    }
  }

  /** Opens the ManageMenu for a schedule */
  function openManage(sched) { setSelectedSched(sched) }

  /** Opens the edit SR modal pre-populated with the given report's data */
  function openEditSr(sr) {
    setEditSrForm({
      schedId: sr.schedId ?? '',
      _scheduleDisplay: sr.schedId ? `Sched #${sr.schedId}` : '',
      engineerEmployeeId: sr.engineerEmployeeId ?? '',
      _engineerDisplay: sr.engineerEmployeeId ? `Employee #${sr.engineerEmployeeId}` : '',
      complaint: sr.complaint ?? '',
      workDone: sr.workDone ?? '',
      location: sr.location ?? '',
    })
    setEditingSr(sr)
    setEditSrFormError({})
    setEditSrOpen(true)
  }

  function closeEditSr() {
    setEditSrOpen(false)
    setEditingSr(null)
    setEditSrForm(EMPTY_SR_EDIT_FORM)
    setEditSrFormError({})
  }

  /** Submits the update for an existing service report */
  async function handleSrUpdate(e) {
    e.preventDefault()
    setEditSrFormError({})
    setEditSrSubmitting(true)
    try {
      const res = await apiFetch(`/api/service-reports/${editingSr.srNumber}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          complaint: editSrForm.complaint,
          workDone: editSrForm.workDone,
          engineerEmployeeId: editSrForm.engineerEmployeeId ? Number(editSrForm.engineerEmployeeId) : null,
          location: editSrForm.location || null,
          schedId: editSrForm.schedId ? Number(editSrForm.schedId) : null,
        }),
      })
      if (!res.ok) { setEditSrFormError(await parseApiError(res)); notyfError('Update failed'); return }
      closeEditSr()
      setTimeout(() => notyfSuccess(`SR #${editingSr.srNumber} updated successfully.`), 150)
    } catch (err) {
      setEditSrFormError({ _general: err.message })
    } finally {
      setEditSrSubmitting(false)
    }
  }

  // Crew modal handlers
  const fetchCrew = useCallback(async (schedId) => {
    setCrewLoading(true)
    try {
      const res = await apiFetch(`/api/service-assignments/schedule/${schedId}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setCrewList(data)
      setCrewInitial(data)
    } catch {
      setCrewList([])
      setCrewInitial([])
    } finally {
      setCrewLoading(false)
    }
  }, [apiFetch])

  function openCrew(sched) {
    setCrewSched(sched)
    setCrewList([])
    setCrewInitial([])
    setCrewOpen(true)
    fetchCrew(sched.schedId)
  }

  function closeCrew() {
    setCrewOpen(false)
    setCrewSched(null)
    setCrewList([])
    setCrewInitial([])
  }

  function removeCrew(employeeId) {
    setCrewList(list => list.filter(c => c.employeeId !== employeeId))
  }

  function addCrewFromPicker(emp) {
    if (crewList.some(c => c.employeeId === emp.employeeId)) {
      setCrewPickerOpen(false)
      return
    }
    setCrewList(list => [...list, {
      servAssgnId: null,
      employeeId: emp.employeeId,
      firstName: emp.firstName,
      lastName: emp.lastName,
      position: emp.position,
    }])
    setCrewPickerOpen(false)
  }

  const crewDirty = useMemo(() => {
    const currentIds = new Set(crewList.filter(c => c.servAssgnId).map(c => c.servAssgnId))
    const hasRemovals = crewInitial.some(c => !currentIds.has(c.servAssgnId))
    const hasAdditions = crewList.some(c => !c.servAssgnId)
    return hasRemovals || hasAdditions
  }, [crewInitial, crewList])

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
          body: JSON.stringify({ employeeId: c.employeeId, schedId: crewSched.schedId }),
        })
      }
      closeCrew()
      setTimeout(() => notyfSuccess('Crew assignment updated.'), 150)
    } catch {
      notyfError('Update failed')
    } finally {
      setCrewSaving(false)
    }
  }

  // Fetch equipment usages whenever the Equipment Used modal opens or refreshes
  useEffect(() => {
    if (!equipUsedOpen || !equipUsedSched) { setEquipUsages([]); return }
    let active = true
    setEquipUsagesLoading(true)
    apiFetch(`/api/equipment-usages?schedId=${equipUsedSched.schedId}&size=100&sort=usageId,asc`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => { if (active) setEquipUsages(data.content ?? []) })
      .catch(() => { if (active) setEquipUsages([]) })
      .finally(() => { if (active) setEquipUsagesLoading(false) })
    return () => { active = false }
  }, [apiFetch, equipUsedOpen, equipUsedSched, equipUsagesRefresh])

  function openEquipUsed(sched) {
    setEquipUsedSched(sched)
    setEquipUsedOpen(true)
    setAddEquipOpen(false)
    setAddEquipForm({ equipmentId: '', equipmentName: '', notes: '' })
    setAddEquipFormError({})
  }

  function closeEquipUsed() {
    setEquipUsedOpen(false)
    setEquipUsedSched(null)
    setEquipUsages([])
    setAddEquipOpen(false)
    setAddEquipForm({ equipmentId: '', equipmentName: '', notes: '' })
    setAddEquipFormError({})
  }

  /** Submits a new equipment usage record for the current schedule */
  async function handleAddEquipUsage(e) {
    e.preventDefault()
    setAddEquipFormError({})
    if (!addEquipForm.equipmentId) { setAddEquipFormError({ equipmentId: 'Please select an equipment.' }); return }
    setAddEquipSubmitting(true)
    try {
      const res = await apiFetch('/api/equipment-usages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equipmentId: Number(addEquipForm.equipmentId),
          schedId: equipUsedSched.schedId,
          notes: addEquipForm.notes || null,
        }),
      })
      if (!res.ok) { setAddEquipFormError(await parseApiError(res)); notyfError('Add failed'); return }
      setAddEquipOpen(false)
      setAddEquipForm({ equipmentId: '', equipmentName: '', notes: '' })
      setAddEquipFormError({})
      notyfSuccess('Equipment usage logged.')
      setEquipUsagesRefresh(k => k + 1)
    } catch (err) {
      setAddEquipFormError({ _general: err.message })
    } finally {
      setAddEquipSubmitting(false)
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
      setEquipUsagesRefresh(k => k + 1)
    } catch {
      notyfError('Delete failed — server error')
    } finally {
      setDeletingUsageId(null)
    }
  }

  function openUpdateUsage(usage) {
    setUpdatingUsage(usage)
    setUpdateUsageNotes(usage.notes ?? '')
    setUpdateUsageFormError({})
    setUpdateUsageOpen(true)
  }

  function closeUpdateUsage() {
    setUpdateUsageOpen(false)
    setUpdatingUsage(null)
    setUpdateUsageNotes('')
    setUpdateUsageFormError({})
  }

  /** Submits updated notes for an equipment usage record */
  async function handleUpdateUsageSubmit(e) {
    e.preventDefault()
    setUpdateUsageFormError({})
    setUpdateUsageSubmitting(true)
    try {
      const res = await apiFetch(`/api/equipment-usages/${updatingUsage.usageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedId: updatingUsage.schedId, notes: updateUsageNotes || null }),
      })
      if (!res.ok) { setUpdateUsageFormError(await parseApiError(res)); notyfError('Update failed'); return }
      closeUpdateUsage()
      notyfSuccess(`Usage #${updatingUsage.usageId} updated.`)
      setEquipUsagesRefresh(k => k + 1)
    } catch (err) {
      setUpdateUsageFormError({ _general: err.message })
    } finally {
      setUpdateUsageSubmitting(false)
    }
  }

  const initialLoading = listLoading && listSchedules.length === 0

  return (
    <Layout activePage={isProjectView ? 'projects' : 'schedules'}>
      {/* Header row */}
      <div className="flex items-stretch justify-between h-16 mb-6">
        <div>
          <h1 className="text-3xl font-semibold">
            {isProjectView ? `Schedules of ${projectName ?? `Project #${projNum}`}` : 'Schedules'}
          </h1>
          <p className="text-base-content/60 mt-1">
            {isProjectView ? 'Service schedules for this project' : 'View and manage service schedules'}
          </p>
        </div>
        <div className="flex gap-2 items-center h-full">
          {canEdit && (
            <button type="button" className="btn btn-primary h-full min-h-0" onClick={() => navigate('/schedules/new')}>
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

            {/* Count + hide-finished toggle */}
            <div className="flex items-center justify-between shrink-0">
              <p className="text-xs text-base-content/50">
                {listTotal} schedule{listTotal !== 1 ? 's' : ''}
              </p>
              <button
                className={`btn btn-xs gap-1 ${hideFinished ? 'btn-primary' : 'btn-secondary border border-base-300'}`}
                onClick={toggleHideFinished}
                title={hideFinished ? 'Click to show completed and cancelled schedules' : 'Click to hide completed and cancelled schedules'}
              >
                <span className="icon-[tabler--filter] size-3.5"></span>
                {hideFinished ? 'Show Pending Only' : 'Show All Statuses'}
              </button>
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

      {/* Update Schedule Modal */}
      <Modal
        isOpen={updateOpen}
        onClose={closeUpdate}
        title="Update Schedule"
        footer={
          <>
            <button type="button" className="btn btn-soft btn-secondary" onClick={closeUpdate}>
              Cancel
            </button>
            <button type="submit" form="update-schedule-form" className="btn btn-primary" disabled={updateSubmitting}>
              {updateSubmitting
                ? <span className="loading loading-spinner loading-sm"></span>
                : <span className="icon-[tabler--pencil] size-4"></span>
              }
              Save Changes
            </button>
          </>
        }
      >
        <form id="update-schedule-form" onSubmit={handleUpdate}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Purpose <span className="text-error">*</span></label>
              <input
                type="text"
                className={`input input-bordered w-full${updateFormError.purpose ? ' is-invalid' : ''}`}
                placeholder="e.g. Quarterly maintenance"
                maxLength={30}
                required
                value={updateForm.purpose}
                onChange={e => setUpdateForm(f => ({ ...f, purpose: e.target.value }))}
              />
              {updateFormError.purpose && <span className="helper-text">{updateFormError.purpose}</span>}
            </div>

            {updateForm.status === 'pending' && (
              <div className="flex flex-col gap-1">
                <label className="label-text font-medium">Date <span className="text-error">*</span></label>
                <input
                  type="date"
                  className={`input input-bordered w-full${updateFormError.date ? ' is-invalid' : ''}`}
                  required
                  value={updateForm.date}
                  onChange={e => setUpdateForm(f => ({ ...f, date: e.target.value }))}
                />
                {updateFormError.date && <span className="helper-text">{updateFormError.date}</span>}
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Status</label>
              <select
                className={`select select-bordered w-full${updateFormError.status ? ' is-invalid' : ''}`}
                value={updateForm.status}
                onChange={e => setUpdateForm(f => ({ ...f, status: e.target.value }))}
              >
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
              {updateFormError.status && <span className="helper-text">{updateFormError.status}</span>}
            </div>

            {updateFormError._general && (
              <div className="alert alert-error py-2">
                <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                <span className="text-sm">{updateFormError._general}</span>
              </div>
            )}
          </div>
        </form>
      </Modal>

      {/* Crew Assignment Modal */}
      <Modal
        isOpen={crewOpen}
        onClose={closeCrew}
        title={crewSched ? `Crew Assignment — Schedule #${crewSched.schedId}` : 'Crew Assignment'}
        footer={
          <>
            <button type="button" className="btn btn-soft btn-secondary" onClick={closeCrew}>
              Cancel
            </button>
            {canManageCrew && (
              <button
                type="button"
                className="btn btn-primary"
                disabled={!crewDirty || crewSaving}
                onClick={handleCrewUpdate}
              >
                {crewSaving
                  ? <span className="loading loading-spinner loading-sm"></span>
                  : <span className="icon-[tabler--users] size-4"></span>
                }
                Update Crew Assignment
              </button>
            )}
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {/* Loading */}
          {crewLoading && (
            <div className="flex justify-center py-8">
              <span className="loading loading-spinner loading-md text-primary"></span>
            </div>
          )}

          {/* Crew grid */}
          {!crewLoading && (
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
                            <p className="font-medium text-sm line-clamp-1">
                              {c.lastName}, {c.firstName}
                            </p>
                            <p className="text-xs text-base-content/50">
                              Emp #{c.employeeId} · {c.position ?? '—'}
                            </p>
                            {!c.servAssgnId && (
                              <span className="badge badge-soft badge-warning badge-xs mt-0.5">New</span>
                            )}
                          </div>
                          {canManageCrew && (
                            <button
                              type="button"
                              className="btn btn-error btn-xs btn-square shrink-0"
                              title="Un-assign crew"
                              onClick={() => removeCrew(c.employeeId)}
                            >
                              <span className="icon-[tabler--x] size-3.5"></span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add crew button */}
              {canManageCrew && (
                <button
                  type="button"
                  className="btn btn-soft btn-primary btn-sm w-full"
                  onClick={() => setCrewPickerOpen(true)}
                >
                  <span className="icon-[tabler--user-plus] size-4"></span>
                  Add Crew
                </button>
              )}
            </>
          )}
        </div>
      </Modal>

      {/* Equipment Used Modal */}
      <Modal
        isOpen={equipUsedOpen}
        onClose={addEquipOpen ? undefined : closeEquipUsed}
        hideClose={addEquipOpen}
        title={`Equipment Used — Schedule #${equipUsedSched?.schedId ?? ''}`}
        size="max-w-4xl"
        footer={!addEquipOpen && (
          <button type="button" className="btn btn-soft btn-secondary" onClick={closeEquipUsed}>
            Close
          </button>
        )}
      >
        {addEquipOpen ? (
          <form onSubmit={handleAddEquipUsage}>
            <div className="flex flex-col gap-4 mb-4">
              <div className="flex flex-col gap-1">
                <label className="label-text font-medium">Equipment <span className="text-error">*</span></label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    className={`input input-bordered flex-1${addEquipFormError.equipmentId ? ' is-invalid' : ''}`}
                    placeholder="No equipment selected"
                    value={addEquipForm.equipmentName}
                  />
                  <button type="button" className="btn btn-soft btn-secondary shrink-0" onClick={() => setEquipPickerOpen(true)}>
                    Pick
                  </button>
                </div>
                {addEquipFormError.equipmentId && <span className="helper-text">{addEquipFormError.equipmentId}</span>}
              </div>

              <div className="flex flex-col gap-1">
                <label className="label-text font-medium">Notes</label>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  placeholder="Optional notes about this deployment"
                  maxLength={255}
                  value={addEquipForm.notes}
                  onChange={e => setAddEquipForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>

              {addEquipFormError._general && (
                <div className="alert alert-error py-2">
                  <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                  <span className="text-sm">{addEquipFormError._general}</span>
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end">
              <button type="button" className="btn btn-soft btn-secondary btn-sm"
                onClick={() => { setAddEquipOpen(false); setAddEquipForm({ equipmentId: '', equipmentName: '', notes: '' }); setAddEquipFormError({}) }}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={addEquipSubmitting}>
                {addEquipSubmitting
                  ? <span className="loading loading-spinner loading-xs"></span>
                  : <span className="icon-[tabler--plus] size-4"></span>
                }
                Log Equipment
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="flex justify-end mb-3">
              <button type="button" className="btn btn-primary btn-sm"
                onClick={() => { setAddEquipForm({ equipmentId: '', equipmentName: '', notes: '' }); setAddEquipFormError({}); setAddEquipOpen(true) }}>
                <span className="icon-[tabler--plus] size-4"></span>
                Add Equipment
              </button>
            </div>

            {equipUsagesLoading ? (
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
                      <th>ID</th>
                      <th>Equipment</th>
                      <th>Type</th>
                      <th>Notes</th>
                      <th>Logged On</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {equipUsages.map(u => (
                      <tr key={u.usageId}>
                        <td className="font-mono text-xs">{u.usageId}</td>
                        <td className="text-sm max-w-48">
                          <span className="line-clamp-1" title={u.equipmentName}>{u.equipmentName}</span>
                          <span className="text-xs text-base-content/40">#{u.equipmentId}</span>
                        </td>
                        <td>
                          <span className={`badge badge-soft text-xs ${u.equipmentType === 'durable' ? 'badge-info' : 'badge-warning'}`}>
                            {u.equipmentType}
                          </span>
                        </td>
                        <td className="text-sm text-base-content/60 max-w-40">
                          <span className="line-clamp-2">{u.notes || '—'}</span>
                        </td>
                        <td className="text-xs text-base-content/50 whitespace-nowrap">
                          {formatDateTime(u.loggedOn)}
                        </td>
                        <td>
                          <div className="flex gap-1">
                            <button
                              className="btn btn-soft btn-primary btn-xs"
                              onClick={() => openUpdateUsage(u)}
                            >
                              <span className="icon-[tabler--pencil] size-3"></span>
                              Edit
                            </button>
                            <button
                              className="btn btn-soft btn-error btn-xs"
                              disabled={deletingUsageId === u.usageId}
                              onClick={() => handleDeleteEquipUsage(u.usageId)}
                            >
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
          </>
        )}
      </Modal>

      {/* Update Usage Notes sub-modal — sits above Equipment Used modal */}
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
                    <input
                      type="text"
                      className={`input input-bordered w-full${updateUsageFormError.notes ? ' is-invalid' : ''}`}
                      placeholder="Optional notes about this deployment"
                      maxLength={255}
                      value={updateUsageNotes}
                      onChange={e => setUpdateUsageNotes(e.target.value)}
                    />
                    {updateUsageFormError.notes && <span className="helper-text">{updateUsageFormError.notes}</span>}
                  </div>
                  {updateUsageFormError._general && (
                    <div className="alert alert-error py-2">
                      <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                      <span className="text-sm">{updateUsageFormError._general}</span>
                    </div>
                  )}
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-soft btn-secondary btn-sm" onClick={closeUpdateUsage}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={updateUsageSubmitting}>
                    {updateUsageSubmitting
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

      {/* Equipment picker for logging new usage — excludes already-logged equipment */}
      <EquipmentPickerModal
        isOpen={equipPickerOpen}
        onClose={() => setEquipPickerOpen(false)}
        onSelect={eq => {
          setAddEquipForm(f => ({ ...f, equipmentId: eq.equipmentId, equipmentName: eq.name }))
          setAddEquipFormError(err => ({ ...err, equipmentId: undefined }))
          setEquipPickerOpen(false)
        }}
        excludeIds={new Set(equipUsages.map(u => u.equipmentId))}
      />

      {/* Employee picker for adding crew — excludes already-assigned members */}
      <CrewPickerModal
        isOpen={crewPickerOpen}
        onClose={() => setCrewPickerOpen(false)}
        onSelect={addCrewFromPicker}
        excludeIds={new Set(crewList.map(c => c.employeeId))}
      />

      {/* Manage Schedule — ManageMenu */}
      <ManageMenu
        title={selectedSched ? (projectMap[selectedSched.projNum] ?? `Project #${selectedSched.projNum}`) : ''}
        subtitle={selectedSched ? `Schedule #${selectedSched.schedId}` : ''}
        item={selectedSched}
        isOpen={!!selectedSched}
        onClose={() => setSelectedSched(null)}
        hasRole={hasRole}
        menuItems={[
          ...SCHEDULE_MENU_ITEMS.filter(i => i.key !== 'service-report'),
          ...(selectedSchedSr ? [{ key: 'service-report', label: 'Manage Service Report', icon: 'icon-[tabler--file-report]', roles: null }] : []),
        ]}
        onMenuSelect={(key, sched) => {
          if (key === 'update') {
            setSelectedSched(null)
            openUpdate(sched)
          } else if (key === 'crew') {
            setSelectedSched(null)
            openCrew(sched)
          } else if (key === 'equipment') {
            setSelectedSched(null)
            openEquipUsed(sched)
          } else if (key === 'service-report') {
            setSelectedSched(null)
            setSrForSched(selectedSchedSr || null)
          }
        }}
        details={selectedSched ? [
          { label: 'Project',  value: projectMap[selectedSched.projNum] ?? `Project #${selectedSched.projNum}` },
          { label: 'Purpose',  value: selectedSched.purpose },
          { label: 'Date',     value: formatDate(selectedSched.date) },
          { label: 'Status',   value: selectedSched.status?.charAt(0).toUpperCase() + selectedSched.status?.slice(1) },
          { label: 'Added On', value: formatDateTime(selectedSched.addedOn) },
          {
            fullWidth: true,
            component: (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-base-content/50 uppercase tracking-wide">Crew Assigned</span>
                {selectedSchedCrewLoading ? (
                  <span className="loading loading-spinner loading-xs text-primary"></span>
                ) : selectedSchedCrew.length === 0 ? (
                  <span className="text-sm text-base-content/40">No crew assigned.</span>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {selectedSchedCrew.map(c => (
                      <span key={c.employeeId} className="badge badge-soft badge-neutral text-xs">
                        {c.lastName}, {c.firstName}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ),
          },
        ] : []}
      />

      {/* Service Report ManageMenu — opened from schedule ManageMenu */}
      <ManageMenu
        title={srForSched ? `SR #${srForSched.srNumber}` : ''}
        subtitle={srForSched ? (projectMap[srForSched.projNum] ?? `Project #${srForSched.projNum}`) : ''}
        item={srForSched}
        isOpen={!!srForSched}
        onClose={() => setSrForSched(null)}
        hasRole={hasRole}
        menuItems={SR_MENU_ITEMS}
        onMenuSelect={(key, sr) => {
          setSrForSched(null)
          if (key === 'findings') navigate(`/service-report/${sr.srNumber}/findings`, {
            state: { projectName: sr.projectName, projNum: sr.projNum },
          })
          else if (key === 'purchase-order') navigate(`/service-report/${sr.srNumber}/purchase-orders`, {
            state: { projectName: sr.projectName, srNumber: sr.srNumber, projNum: sr.projNum },
          })
          else if (key === 'billing') setBillingReport(sr)
          else if (key === 'documents') navigate(`/service-report/${sr.srNumber}/documents`, {
            state: {
              entityType: 'service-report',
              entityId:   sr.srNumber,
              entityLabel: `SR #${sr.srNumber}`,
              parentLabel: sr.projectName,
              docuId:     sr.docuId ?? null,
            },
          })
          else if (key === 'update') openEditSr(sr)
        }}
        details={srForSched ? [
          { label: 'Complaint',      value: srForSched.complaint,      fullWidth: true },
          { label: 'Work Done',      value: srForSched.workDone,       fullWidth: true },
          { label: 'Location',       value: srForSched.location },
          { label: 'Status',        value: srForSched.status },
          { label: 'Schedule Date', value: srForSched.scheduleDate ? String(srForSched.scheduleDate).slice(0, 10) : '—' },
        ] : []}
      />

      <ManageBillingModal
        report={billingReport}
        apiFetch={apiFetch}
        onClose={() => setBillingReport(null)}
      />

      {/* Edit Service Report Modal */}
      <Modal
        isOpen={editSrOpen}
        onClose={closeEditSr}
        title={`Update SR #${editingSr?.srNumber}`}
        footer={
          <>
            <button type="button" className="btn btn-soft btn-secondary" onClick={closeEditSr}>
              Cancel
            </button>
            <button type="submit" form="edit-sr-form" className="btn btn-primary" disabled={editSrSubmitting}>
              {editSrSubmitting
                ? <span className="loading loading-spinner loading-sm"></span>
                : <span className="icon-[tabler--device-floppy] size-4"></span>
              }
              Save Changes
            </button>
          </>
        }
      >
        <form id="edit-sr-form" onSubmit={handleSrUpdate}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Location <span className="text-error">*</span></label>
              <input type="text" maxLength={255}
                className={`input input-bordered w-full${editSrFormError.location ? ' is-invalid' : ''}`}
                placeholder="e.g. 3rd Floor East Wing" required
                value={editSrForm.location}
                onChange={e => setEditSrForm(f => ({ ...f, location: e.target.value }))} />
              {editSrFormError.location && <span className="helper-text">{editSrFormError.location}</span>}
            </div>

            <PickerInput
              label="Schedule"
              displayValue={editSrForm._scheduleDisplay}
              placeholder="None selected"
              buttonLabel="Change Schedule"
              required
              error={editSrFormError.schedId}
              Picker={SchedulePickerModal}
              onSelect={s => setEditSrForm(f => ({ ...f, schedId: s.schedId, _scheduleDisplay: `Sched #${s.schedId} — ${s.purpose ?? ''}` }))}
            />

            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="label-text font-medium">Complaint <span className="text-error">*</span></label>
              <textarea rows={3} maxLength={900}
                className={`textarea textarea-bordered w-full${editSrFormError.complaint ? ' is-invalid' : ''}`}
                placeholder="Describe the complaint..." required
                value={editSrForm.complaint}
                onChange={e => setEditSrForm(f => ({ ...f, complaint: e.target.value }))} />
              {editSrFormError.complaint && <span className="helper-text">{editSrFormError.complaint}</span>}
            </div>

            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="label-text font-medium">Work Done <span className="text-error">*</span></label>
              <textarea rows={3} maxLength={900}
                className={`textarea textarea-bordered w-full${editSrFormError.workDone ? ' is-invalid' : ''}`}
                placeholder="Describe the work performed..." required
                value={editSrForm.workDone}
                onChange={e => setEditSrForm(f => ({ ...f, workDone: e.target.value }))} />
              {editSrFormError.workDone && <span className="helper-text">{editSrFormError.workDone}</span>}
            </div>

            <PickerInput
              label="Assigned Engineer"
              displayValue={editSrForm._engineerDisplay}
              placeholder="None assigned"
              buttonLabel="Select Engineer"
              error={editSrFormError.engineerEmployeeId}
              Picker={EmployeePickerModal}
              onSelect={emp => setEditSrForm(f => ({ ...f, engineerEmployeeId: emp.employeeId, _engineerDisplay: `${emp.lastName}, ${emp.firstName} (#${emp.employeeId})` }))}
              className="sm:col-span-2"
            />

            {editSrFormError._general && (
              <div className="sm:col-span-2 alert alert-error py-2">
                <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                <span className="text-sm">{editSrFormError._general}</span>
              </div>
            )}
          </div>
        </form>
      </Modal>
    </Layout>
  )
}
