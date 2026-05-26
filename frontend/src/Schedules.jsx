import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { useAuth } from './auth'
import Layout from './Layout'
import Modal from './Modal'
import ManageMenu from './ManageMenu'
import PickerInput from './PickerInput'
import ProjectPickerModal from './ProjectPickerModal'
import CrewPickerModal from './CrewPickerModal'
import { notyfSuccess, notyfError } from './notyf'

const SCHEDULE_MENU_ITEMS = [
  { key: 'update', label: 'Update Schedule',       icon: 'icon-[tabler--pencil]', roles: ['ADMIN', 'STAFF'] },
  { key: 'crew',   label: 'Manage Crew Assignment', icon: 'icon-[tabler--users]',  roles: null },
]

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const STATUS_OPTIONS = ['pending', 'confirmed', 'completed', 'cancelled']
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

/** Returns Tailwind bg color for calendar dot based on status */
function statusDotColor(status) {
  const map = { pending: 'bg-warning', confirmed: 'bg-info', completed: 'bg-success', cancelled: 'bg-error' }
  return map[status?.toLowerCase()] ?? 'bg-neutral'
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
  const projNum = projNumParam ? Number(projNumParam) : null
  const projectName = location.state?.projectName ?? null
  const isProjectView = projNum !== null

  const canEdit = hasRole('ADMIN', 'STAFF')
  const today = new Date()

  // Project name lookup map, fetched once
  const [projectMap, setProjectMap] = useState({})

  // Calendar data: all schedules for the month view (large fetch, not paginated)
  const [calSchedules, setCalSchedules] = useState([])
  const [calLoading, setCalLoading] = useState(true)
  const [calError, setCalError] = useState(null)

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

  // Calendar navigation
  const [calYear, setCalYear] = useState(today.getFullYear())
  const [calMonth, setCalMonth] = useState(today.getMonth())
  const [highlightDate, setHighlightDate] = useState(null)

  // Add schedule modal
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState({})
  const [submitting, setSubmitting] = useState(false)

  // Update schedule modal
  const [updateOpen, setUpdateOpen] = useState(false)
  const [updateForm, setUpdateForm] = useState(EMPTY_FORM)
  const [updateFormError, setUpdateFormError] = useState({})
  const [updateSubmitting, setUpdateSubmitting] = useState(false)
  const [editingSchedId, setEditingSchedId] = useState(null)

  // Selected schedule for ManageMenu
  const [selectedSched, setSelectedSched] = useState(null)

  // Crew assignment modal
  const [crewOpen, setCrewOpen] = useState(false)
  const [crewSched, setCrewSched] = useState(null)
  const [crewList, setCrewList] = useState([])      // working copy
  const [crewInitial, setCrewInitial] = useState([]) // snapshot from server
  const [crewLoading, setCrewLoading] = useState(false)
  const [crewSaving, setCrewSaving] = useState(false)
  const [crewPickerOpen, setCrewPickerOpen] = useState(false)

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

  /** Fetches schedules for the calendar, scoped to the currently viewed month */
  async function fetchCalendar() {
    setCalLoading(true)
    setCalError(null)
    setCalSchedules([])
    try {
      const dateFrom = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-01`
      const lastDay = new Date(calYear, calMonth + 1, 0).getDate()
      const dateTo = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
      const params = new URLSearchParams({ dateFrom, dateTo })
      if (projNum) params.set('projNum', String(projNum))
      const res = await apiFetch(`/api/service-schedules/calendar?${params}`)
      if (!res.ok) throw new Error(`Failed to load schedules (${res.status})`)
      const data = await res.json()
      setCalSchedules(data)
    } catch (err) {
      setCalError(err.message)
    } finally {
      setCalLoading(false)
    }
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

  // Calendar refetches when month, year, or hideFinished changes
  useEffect(() => { fetchCalendar() }, [apiFetch, calYear, calMonth, hideFinished])

  // List refetches when page, search, filter, or project scope changes
  useEffect(() => { fetchList() }, [apiFetch, listPage, appliedSearch, hideFinished, projNum])

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

  // Calendar helpers
  const calDays = useMemo(() => {
    const firstDay = new Date(calYear, calMonth, 1).getDay()
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
    const cells = []
    for (let i = 0; i < firstDay; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)
    return cells
  }, [calYear, calMonth])

  const schedByDate = useMemo(() => {
    const map = {}
    for (const s of calSchedules) {
      if (!map[s.date]) map[s.date] = []
      map[s.date].push(s)
    }
    return map
  }, [calSchedules])

  function prevMonth() {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1) }
    else setCalMonth(m => m - 1)
  }
  function nextMonth() {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1) }
    else setCalMonth(m => m + 1)
  }
  function dateStr(day) {
    return `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  // Add modal handlers
  function openAdd() { setForm(EMPTY_FORM); setFormError({}); setAddOpen(true) }
  function closeAdd() { setAddOpen(false); setForm(EMPTY_FORM); setFormError({}) }

  /** Submits a new schedule */
  async function handleAdd(e) {
    e.preventDefault()
    setFormError({})
    setSubmitting(true)
    try {
      const res = await apiFetch('/api/service-schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projNum: Number(form.projNum), purpose: form.purpose, date: form.date, status: form.status }),
      })
      if (!res.ok) { setFormError(await parseApiError(res)); notyfError('Add failed'); return }
      closeAdd()
      setTimeout(() => notyfSuccess('Schedule added successfully.'), 150)
      fetchCalendar()
      fetchList()
    } catch (err) {
      setFormError({ _general: err.message })
    } finally {
      setSubmitting(false)
    }
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

  const initialLoading = calLoading && listSchedules.length === 0

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
            <button type="button" className="btn btn-primary h-full min-h-0" onClick={openAdd}>
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
        <div className="flex gap-6 items-start">

          {/* Left: Paginated schedule list (1/3) */}
          <div className="w-1/3 flex flex-col gap-3">

            {/* Search bar */}
            <div className="relative">
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
            <div className="flex items-center justify-between">
              <p className="text-xs text-base-content/50">
                {listTotal} schedule{listTotal !== 1 ? 's' : ''}
              </p>
              <button
                className={`btn btn-xs gap-1 ${hideFinished ? 'btn-primary' : 'btn-ghost border border-base-300'}`}
                onClick={toggleHideFinished}
                title={hideFinished ? 'Click to show completed and cancelled schedules' : 'Click to hide completed and cancelled schedules'}
              >
                <span className="icon-[tabler--filter] size-3.5"></span>
                {hideFinished ? 'Show Pending Only' : 'Show All Statuses'}
              </button>
            </div>

            {/* List error */}
            {listError && (
              <div className="alert alert-error py-2 text-sm">
                <span className="icon-[tabler--alert-circle] size-4"></span>
                <span>{listError}</span>
              </div>
            )}

            {/* Schedule cards */}
            <div className={`flex flex-col gap-3 transition-opacity ${listLoading ? 'opacity-50 pointer-events-none' : ''}`}>
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
              <div className="flex items-center justify-center gap-2 mt-1">
                <button
                  className="btn btn-ghost btn-sm btn-square"
                  disabled={listPage === 0 || listLoading}
                  onClick={() => setListPage(p => p - 1)}
                >
                  <span className="icon-[tabler--chevron-left] size-4"></span>
                </button>
                <span className="text-xs text-base-content/60">
                  Page {listPage + 1} of {listTotalPages}
                </span>
                <button
                  className="btn btn-ghost btn-sm btn-square"
                  disabled={listPage >= listTotalPages - 1 || listLoading}
                  onClick={() => setListPage(p => p + 1)}
                >
                  <span className="icon-[tabler--chevron-right] size-4"></span>
                </button>
              </div>
            )}
          </div>

          {/* Right: Calendar (2/3) */}
          <div className="flex-1 card bg-base-100 border border-base-300">
            <div className="card-body p-4">

              {/* Month navigation */}
              <div className="flex items-center justify-between mb-3">
                <button className="btn btn-ghost btn-sm btn-square" onClick={prevMonth}>
                  <span className="icon-[tabler--chevron-left] size-4"></span>
                </button>
                <h2 className="font-semibold text-base">{MONTH_NAMES[calMonth]} {calYear}</h2>
                <button className="btn btn-ghost btn-sm btn-square" onClick={nextMonth}>
                  <span className="icon-[tabler--chevron-right] size-4"></span>
                </button>
              </div>

              {/* Day-of-week headers */}
              <div className="grid grid-cols-7 mb-1">
                {DAYS.map(d => (
                  <div key={d} className="text-center text-xs font-medium text-base-content/50 py-1">{d}</div>
                ))}
              </div>

              {/* Day cells */}
              <div className={`grid grid-cols-7 gap-px bg-base-300 border border-base-300 rounded-box overflow-hidden transition-opacity ${calLoading ? 'opacity-50' : ''}`}>
                {calDays.map((day, idx) => {
                  const ds = day ? dateStr(day) : null
                  const dayScheds = ds ? (schedByDate[ds] ?? []) : []
                  const isToday = day &&
                    calYear === today.getFullYear() &&
                    calMonth === today.getMonth() &&
                    day === today.getDate()
                  const isHighlighted = ds && ds === highlightDate

                  return (
                    <div
                      key={idx}
                      className={`bg-base-100 min-h-20 p-1.5 transition-colors
                        ${day ? 'cursor-pointer hover:bg-base-200' : ''}
                        ${isHighlighted ? 'ring-2 ring-primary ring-inset' : ''}`}
                      onClick={() => day && setHighlightDate(isHighlighted ? null : ds)}
                    >
                      {day && (
                        <>
                          <div className={`text-xs font-medium mb-1 w-5 h-5 flex items-center justify-center rounded-full
                            ${isToday ? 'bg-primary text-primary-content' : 'text-base-content/70'}`}>
                            {day}
                          </div>
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
                        </>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Status legend */}
              <div className="flex items-center gap-4 mt-3 flex-wrap">
                {STATUS_OPTIONS.map(s => (
                  <div key={s} className="flex items-center gap-1.5">
                    <span className={`size-2 rounded-full ${statusDotColor(s)}`}></span>
                    <span className="text-xs text-base-content/60 capitalize">{s}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add New Schedule Modal */}
      <Modal
        isOpen={addOpen}
        onClose={closeAdd}
        title="Add New Schedule"
        footer={
          <>
            <button type="button" className="btn btn-soft btn-secondary" onClick={closeAdd}>
              Cancel
            </button>
            <button type="submit" form="add-schedule-form" className="btn btn-primary" disabled={submitting}>
              {submitting
                ? <span className="loading loading-spinner loading-sm"></span>
                : <span className="icon-[tabler--plus] size-4"></span>
              }
              Add Schedule
            </button>
          </>
        }
      >
        <form id="add-schedule-form" onSubmit={handleAdd}>
          <div className="flex flex-col gap-4">
            <PickerInput
              label="Project"
              displayValue={form.projName}
              placeholder="Select a project..."
              buttonLabel="Browse"
              required
              error={formError.projNum}
              Picker={ProjectPickerModal}
              onSelect={p => setForm(f => ({ ...f, projNum: p.projNum, projName: p.name }))}
            />

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

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Status</label>
              <select
                className={`select select-bordered w-full${formError.status ? ' is-invalid' : ''}`}
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              >
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
              {formError.status && <span className="helper-text">{formError.status}</span>}
            </div>

            {formError._general && (
              <div className="alert alert-error py-2">
                <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                <span className="text-sm">{formError._general}</span>
              </div>
            )}
          </div>
        </form>
      </Modal>

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
            <PickerInput
              label="Project"
              displayValue={updateForm.projName}
              placeholder="Select a project..."
              buttonLabel="Browse"
              required
              error={updateFormError.projNum}
              Picker={ProjectPickerModal}
              onSelect={p => setUpdateForm(f => ({ ...f, projNum: p.projNum, projName: p.name }))}
            />

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
                          <button
                            type="button"
                            className="btn btn-error btn-xs btn-square shrink-0"
                            title="Un-assign crew"
                            onClick={() => removeCrew(c.employeeId)}
                          >
                            <span className="icon-[tabler--x] size-3.5"></span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add crew button */}
              <button
                type="button"
                className="btn btn-soft btn-primary btn-sm w-full"
                onClick={() => setCrewPickerOpen(true)}
              >
                <span className="icon-[tabler--user-plus] size-4"></span>
                Add Crew
              </button>
            </>
          )}
        </div>
      </Modal>

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
        menuItems={SCHEDULE_MENU_ITEMS}
        onMenuSelect={(key, sched) => {
          if (key === 'update') {
            setSelectedSched(null)
            openUpdate(sched)
          } else if (key === 'crew') {
            setSelectedSched(null)
            openCrew(sched)
          }
        }}
        details={selectedSched ? [
          { label: 'Project',  value: projectMap[selectedSched.projNum] ?? `Project #${selectedSched.projNum}` },
          { label: 'Purpose',  value: selectedSched.purpose },
          { label: 'Date',     value: formatDate(selectedSched.date) },
          { label: 'Status',   value: selectedSched.status?.charAt(0).toUpperCase() + selectedSched.status?.slice(1) },
          { label: 'Added On', value: formatDateTime(selectedSched.addedOn) },
        ] : []}
      />
    </Layout>
  )
}
