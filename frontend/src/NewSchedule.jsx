import { useState, useEffect, useMemo } from 'react'
import CalendarPanel, { statusDotColor } from './CalendarPanel'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './auth'
import Layout from './Layout'
import PickerInput from './PickerInput'
import ProjectPickerModal from './ProjectPickerModal'
import CrewPickerModal from './CrewPickerModal'
import EquipmentPickerModal from './EquipmentPickerModal'
import { notyfSuccess, notyfError } from './notyf'

const EMPTY_FORM = { projNum: '', projName: '', purpose: '', date: '' }

const STEPS = [
  { number: 1, label: 'Project & Purpose' },
  { number: 2, label: 'Select Date' },
  { number: 3, label: 'Select Crew Members' },
  { number: 4, label: 'Select Equipment' },
]

/** Parses a failed API response into field-level or general error object */
async function parseApiError(res) {
  const data = await res.json().catch(() => ({}))
  if (data.errors) return data.errors
  return { _general: data.message ?? data.error ?? `Error ${res.status}` }
}

/** Page for creating a new service schedule with crew selection */
export default function NewSchedule() {
  const { apiFetch } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState(1)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState({})
  const [submitting, setSubmitting] = useState(false)

  // Crew selection
  const [crewList, setCrewList] = useState([])
  const [crewPickerOpen, setCrewPickerOpen] = useState(false)

  // Equipment selection
  const [equipmentList, setEquipmentList] = useState([])
  const [equipmentPickerOpen, setEquipmentPickerOpen] = useState(false)

  // Durable equipment IDs already deployed on the selected date (cannot be added again)
  const [busyDurableIds, setBusyDurableIds] = useState(new Set())
  const [loadingEquipment, setLoadingEquipment] = useState(false)

  // Server-side conflict flag: true when this project already has a schedule on the selected date
  const [projectConflict, setProjectConflict] = useState(false)
  const [loadingConflict, setLoadingConflict] = useState(false)

  // Employee IDs already assigned to any schedule on the selected date
  const [busyEmployeeIds, setBusyEmployeeIds] = useState(new Set())
  const [loadingCrew, setLoadingCrew] = useState(false)

  // Total crew employee count and per-day busy map for the viewed calendar month
  const [totalCrewCount, setTotalCrewCount] = useState(0)
  const [calViewYear, setCalViewYear] = useState(() => new Date().getFullYear())
  const [calViewMonth, setCalViewMonth] = useState(() => new Date().getMonth())
  const [monthBusyByDate, setMonthBusyByDate] = useState({})


  /** Set of employee IDs in crewList who are already assigned elsewhere on the date */
  const busyCrewInList = useMemo(
    () => new Set(crewList.filter(c => busyEmployeeIds.has(c.employeeId)).map(c => c.employeeId)),
    [crewList, busyEmployeeIds]
  )

  /** IDs excluded from the crew picker: already busy on date + already in the list */
  const excludeIdsForPicker = useMemo(
    () => new Set([...busyEmployeeIds, ...crewList.map(c => c.employeeId)]),
    [busyEmployeeIds, crewList]
  )

  /** IDs excluded from the equipment picker: already in the list + durable equipment busy on the selected date */
  const excludeEquipmentIds = useMemo(
    () => new Set([...equipmentList.map(e => e.equipmentId), ...busyDurableIds]),
    [equipmentList, busyDurableIds]
  )

  /** Dates in the viewed month where all crew are already assigned */
  const disabledDates = useMemo(() => {
    if (totalCrewCount === 0) return new Set()
    const disabled = new Set()
    for (const [ds, ids] of Object.entries(monthBusyByDate)) {
      if (ids.size >= totalCrewCount) disabled.add(ds)
    }
    return disabled
  }, [monthBusyByDate, totalCrewCount])

  /** True when every crew member is busy on the currently selected date */
  const noCrewOnDate = totalCrewCount > 0 && !loadingCrew && !!form.date && busyEmployeeIds.size >= totalCrewCount

  /**
   * When date or project changes, ask the backend whether this project already
   * has a schedule on that date (uses the existing projNum filter on the calendar endpoint).
   */
  useEffect(() => {
    if (!form.date || !form.projNum) {
      setProjectConflict(false)
      return
    }
    let cancelled = false
    async function checkConflict() {
      setLoadingConflict(true)
      try {
        const res = await apiFetch(
          `/api/service-schedules/calendar?dateFrom=${form.date}&dateTo=${form.date}&projNum=${form.projNum}`
        )
        if (!res.ok || cancelled) return
        const schedules = await res.json()
        if (!cancelled) setProjectConflict(schedules.length > 0)
      } catch (_) {
        // leave conflict as-is on error; backend will catch it on submit
      } finally {
        if (!cancelled) setLoadingConflict(false)
      }
    }
    checkConflict()
    return () => { cancelled = true }
  }, [form.date, form.projNum, apiFetch])

  /**
   * Whenever the date changes, fetch all schedules on that date and then
   * parallel-fetch their crew assignments to build the busyEmployeeIds set.
   */
  useEffect(() => {
    if (!form.date) {
      setBusyEmployeeIds(new Set())
      return
    }
    let cancelled = false
    async function fetchCrewAvailability() {
      setLoadingCrew(true)
      try {
        const res = await apiFetch(`/api/service-schedules/calendar?dateFrom=${form.date}&dateTo=${form.date}`)
        if (!res.ok || cancelled) return
        const schedules = await res.json()
        if (cancelled) return
        const crewResults = await Promise.all(
          schedules.map(s =>
            apiFetch(`/api/service-assignments/schedule/${s.schedId}`)
              .then(r => r.ok ? r.json() : [])
              .catch(() => [])
          )
        )
        if (cancelled) return
        const ids = new Set()
        for (const crew of crewResults)
          for (const c of crew) ids.add(c.employeeId)
        setBusyEmployeeIds(ids)
      } catch (_) {
        if (!cancelled) setBusyEmployeeIds(new Set())
      } finally {
        if (!cancelled) setLoadingCrew(false)
      }
    }
    fetchCrewAvailability()
    return () => { cancelled = true }
  }, [form.date, apiFetch])

  /**
   * When date changes, fetch all schedules on that date and collect the IDs of
   * durable equipment already deployed to any of them. Used to block double-booking.
   */
  useEffect(() => {
    if (!form.date) {
      setBusyDurableIds(new Set())
      return
    }
    let cancelled = false
    async function fetchEquipmentAvailability() {
      setLoadingEquipment(true)
      try {
        const res = await apiFetch(`/api/service-schedules/calendar?dateFrom=${form.date}&dateTo=${form.date}`)
        if (!res.ok || cancelled) return
        const schedules = await res.json()
        if (cancelled) return
        const usageResults = await Promise.all(
          schedules.map(s =>
            apiFetch(`/api/equipment-usages?schedId=${s.schedId}&size=100`)
              .then(r => r.ok ? r.json() : { content: [] })
              .catch(() => ({ content: [] }))
          )
        )
        if (cancelled) return
        const ids = new Set()
        for (const page of usageResults)
          for (const u of page.content)
            if (u.equipmentType === 'durable') ids.add(u.equipmentId)
        setBusyDurableIds(ids)
      } catch (_) {
        if (!cancelled) setBusyDurableIds(new Set())
      } finally {
        if (!cancelled) setLoadingEquipment(false)
      }
    }
    fetchEquipmentAvailability()
    return () => { cancelled = true }
  }, [form.date, apiFetch])

  /** Fetches the total count of CREW employees once on mount */
  useEffect(() => {
    apiFetch('/api/crew-employees?size=1')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setTotalCrewCount(data.totalElements) })
      .catch(() => {})
  }, [apiFetch])

  /** Fetches all crew assignments for every schedule in the viewed calendar month */
  useEffect(() => {
    let cancelled = false
    async function fetchMonthCrewAvailability() {
      try {
        const dateFrom = `${calViewYear}-${String(calViewMonth + 1).padStart(2, '0')}-01`
        const lastDay = new Date(calViewYear, calViewMonth + 1, 0).getDate()
        const dateTo = `${calViewYear}-${String(calViewMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
        const res = await apiFetch(`/api/service-schedules/calendar?dateFrom=${dateFrom}&dateTo=${dateTo}`)
        if (!res.ok || cancelled) return
        const schedules = await res.json()
        if (cancelled) return
        const crewResults = await Promise.all(
          schedules.map(s =>
            apiFetch(`/api/service-assignments/schedule/${s.schedId}`)
              .then(r => r.ok ? r.json() : [])
              .catch(() => [])
          )
        )
        if (cancelled) return
        const byDate = {}
        for (let i = 0; i < schedules.length; i++) {
          const key = schedules[i].date
          if (!byDate[key]) byDate[key] = new Set()
          for (const c of crewResults[i]) byDate[key].add(c.employeeId)
        }
        if (!cancelled) setMonthBusyByDate(byDate)
      } catch (_) {
        if (!cancelled) setMonthBusyByDate({})
      }
    }
    fetchMonthCrewAvailability()
    return () => { cancelled = true }
  }, [calViewYear, calViewMonth, apiFetch])

  function removeCrew(employeeId) {
    setCrewList(list => list.filter(c => c.employeeId !== employeeId))
  }

  function addCrewFromPicker(emp) {
    if (crewList.some(c => c.employeeId === emp.employeeId)) {
      setCrewPickerOpen(false)
      return
    }
    setCrewList(list => [...list, {
      employeeId: emp.employeeId,
      firstName: emp.firstName,
      lastName: emp.lastName,
      position: emp.position,
    }])
    setCrewPickerOpen(false)
  }

  function removeEquipment(equipmentId) {
    setEquipmentList(list => list.filter(e => e.equipmentId !== equipmentId))
  }

  function addEquipmentFromPicker(eq) {
    if (equipmentList.some(e => e.equipmentId === eq.equipmentId)) {
      setEquipmentPickerOpen(false)
      return
    }
    setEquipmentList(list => [...list, {
      equipmentId: eq.equipmentId,
      name: eq.name,
      type: eq.type,
      model: eq.model,
      serialNumber: eq.serialNumber,
      notes: '',
    }])
    setEquipmentPickerOpen(false)
  }

  function updateEquipmentNotes(equipmentId, notes) {
    setEquipmentList(list => list.map(e => e.equipmentId === equipmentId ? { ...e, notes } : e))
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
      if (loadingConflict || loadingCrew) return
      if (noCrewOnDate) { setFormError({ date: 'No crew members are available on this date.' }); return }
      if (projectConflict) { setFormError({ date: 'This project already has a schedule on the selected date.' }); return }
      setStep(3)
    } else if (step === 3) {
      if (crewList.length === 0) { setFormError({ _general: 'At least one crew member must be selected.' }); return }
      setStep(4)
    }
  }

  /** Creates the schedule then posts each crew assignment in sequence */
  async function handleSubmit() {
    if (busyCrewInList.size > 0) {
      setFormError({ _general: 'Remove crew members already assigned on the selected date before submitting.' })
      return
    }
    setFormError({})
    setSubmitting(true)
    try {
      const res = await apiFetch('/api/service-schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projNum: Number(form.projNum),
          purpose: form.purpose,
          date: form.date,
          status: 'pending',
        }),
      })
      if (!res.ok) {
        setFormError(await parseApiError(res))
        notyfError('Add failed')
        return
      }
      const created = await res.json()

      // Auto-create a corresponding service report for the new schedule
      const reportRes = await apiFetch('/api/service-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projNum: Number(form.projNum),
          complaint: form.purpose,
          workDone: 'add work done here',
          location: 'same as project location',
          schedId: created.schedId,
        }),
      })
      if (!reportRes.ok) {
        notyfError('Schedule created but service report could not be generated.')
      }

      const crewFailures = []
      for (const c of crewList) {
        const assignRes = await apiFetch('/api/service-assignments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ employeeId: c.employeeId, schedId: created.schedId }),
        })
        if (!assignRes.ok) {
          const err = await parseApiError(assignRes)
          crewFailures.push(err._general ?? `Employee #${c.employeeId} could not be assigned.`)
        }
      }

      const equipmentFailures = []
      for (const eq of equipmentList) {
        const eqRes = await apiFetch('/api/equipment-usages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            equipmentId: eq.equipmentId,
            schedId: created.schedId,
            notes: eq.notes || null,
          }),
        })
        if (!eqRes.ok) {
          const err = await parseApiError(eqRes)
          equipmentFailures.push(err._general ?? `Equipment #${eq.equipmentId} could not be logged.`)
        }
      }

      notyfSuccess('Schedule added successfully.')
      if (crewFailures.length > 0) {
        crewFailures.forEach(msg => notyfError(msg))
      }
      if (equipmentFailures.length > 0) {
        equipmentFailures.forEach(msg => notyfError(msg))
      }
      navigate('/schedules')
    } catch (err) {
      setFormError({ _general: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Layout activePage="new-schedule">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-semibold">Make New Schedule</h1>
        <p className="text-base-content/60 mt-1">Create a new service schedule for a project.</p>
      </div>

      <div className="flex gap-6 items-start">

        {/* Left: multi-step form */}
        <div className="flex-1 max-w-lg">
        {/* Step progress */}
        <div className="flex items-center gap-x-1 mb-6">
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

        <div className="card bg-base-100 border border-base-300">
          <div className="card-body gap-4">

            {/* Step 1: Project & Purpose */}
            {step === 1 && (
              <div className="flex flex-col gap-4">
                <div>
                  <p className="text-xs font-semibold text-base-content/40 uppercase tracking-wide mb-3">Step 1 — Select Project and Purpose of Scheduling</p>
                </div>

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
                    {formError.purpose
                      ? <span className="helper-text">{formError.purpose}</span>
                      : <span />}
                    <span className="text-xs text-base-content/40">{form.purpose.length}/300</span>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Select Date */}
            {step === 2 && (
              <div className="flex flex-col gap-4">
                <div>
                  <p className="text-xs font-semibold text-base-content/40 uppercase tracking-wide mb-3">Step 2 — Select Date</p>
                  <div className="flex items-center gap-2 text-sm text-base-content/60 bg-base-200 rounded-lg px-3 py-2">
                    <span className="icon-[tabler--folder] size-4 shrink-0"></span>
                    <span className="line-clamp-1">{form.projName}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="label-text font-medium">Date <span className="text-error">*</span></label>
                  <input
                    type="date"
                    className={`input input-bordered w-full${formError.date || projectConflict || noCrewOnDate ? ' is-invalid' : ''}`}
                    required
                    value={form.date}
                    onChange={e => { setForm(f => ({ ...f, date: e.target.value })); setFormError({}) }}
                  />
                  {loadingConflict || loadingCrew ? (
                    <span className="text-xs text-base-content/50 flex items-center gap-1 mt-0.5">
                      <span className="loading loading-spinner loading-xs"></span>
                      Checking availability...
                    </span>
                  ) : noCrewOnDate ? (
                    <span className="helper-text">No crew members are available on this date — all crew are fully assigned.</span>
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
                <div>
                  <p className="text-xs font-semibold text-base-content/40 uppercase tracking-wide mb-3">Step 3 — Select Crew Members</p>
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
                </div>

                <div className="flex flex-col gap-2">
                  <label className="label-text font-medium">Crew Members</label>

                  {crewList.length === 0 ? (
                    <p className="text-sm text-base-content/40">No crew members added yet.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {crewList.map(c => (
                        <div
                          key={c.employeeId}
                          className={`card border ${busyCrewInList.has(c.employeeId) ? 'border-error bg-error/5' : 'bg-base-100 border-base-300'}`}
                        >
                          <div className="card-body py-2 px-3 gap-0.5">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm line-clamp-1">
                                  {c.lastName}, {c.firstName}
                                </p>
                                <p className="text-xs text-base-content/50">
                                  Emp #{c.employeeId} · {c.position ?? '—'}
                                </p>
                                {busyCrewInList.has(c.employeeId) && (
                                  <span className="badge badge-soft badge-error badge-xs mt-0.5">
                                    Already assigned this day
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                className="btn btn-error btn-xs btn-square shrink-0"
                                title="Remove crew member"
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

                  <button
                    type="button"
                    className="btn btn-soft btn-primary btn-sm w-full"
                    onClick={() => setCrewPickerOpen(true)}
                  >
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
                <div>
                  <p className="text-xs font-semibold text-base-content/40 uppercase tracking-wide mb-3">Step 4 — Select Equipment to Bring</p>
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
                                <p className="text-xs text-base-content/50">
                                  #{eq.equipmentId} · {eq.type}{eq.model ? ` · ${eq.model}` : ''}
                                </p>
                                {eq.serialNumber && (
                                  <p className="text-xs text-base-content/40">SN: {eq.serialNumber}</p>
                                )}
                              </div>
                              <button
                                type="button"
                                className="btn btn-error btn-xs btn-square shrink-0"
                                title="Remove equipment"
                                onClick={() => removeEquipment(eq.equipmentId)}
                              >
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

                  {loadingEquipment ? (
                    <span className="text-xs text-base-content/50 flex items-center gap-1">
                      <span className="loading loading-spinner loading-xs"></span>
                      Checking equipment availability...
                    </span>
                  ) : null}

                  <button
                    type="button"
                    className="btn btn-soft btn-primary btn-sm w-full"
                    disabled={loadingEquipment}
                    onClick={() => setEquipmentPickerOpen(true)}
                  >
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

            {/* Navigation buttons */}
            <div className="flex gap-2 justify-between mt-2">
              {step > 1 && (
                <button
                  type="button"
                  className="btn btn-soft btn-secondary"
                  onClick={() => setStep(s => s - 1)}
                >
                  <span className="icon-[tabler--arrow-left] size-4"></span> Back
                </button>
              )}

              {step < 4 ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={step === 2 && (loadingConflict || loadingCrew || noCrewOnDate)}
                  onClick={handleNext}
                >
                  Next <span className="icon-[tabler--arrow-right] size-4"></span>
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={submitting || busyCrewInList.size > 0}
                  onClick={handleSubmit}
                >
                  {submitting
                    ? <span className="loading loading-spinner loading-sm"></span>
                    : <span className="icon-[tabler--plus] size-4"></span>
                  }
                  Add Schedule
                </button>
              )}
            </div>

          </div>
        </div>
        </div>{/* end left column */}

        {/* Right: Calendar */}
        <div className="flex-1">
          <CalendarPanel
            selectedDate={form.date || null}
            onDateSelect={ds => {
              setForm(f => ({ ...f, date: ds }))
              setFormError(e => ({ ...e, date: undefined }))
            }}
            conflict={projectConflict}
            disabledDates={disabledDates}
            onMonthChange={(y, m) => { setCalViewYear(y); setCalViewMonth(m) }}
            renderCellSchedules={(dayScheds) => (
              <div className="flex flex-col gap-0.5">
                {dayScheds.slice(0, 3).map(s => (
                  <div
                    key={s.schedId}
                    className="flex items-center gap-1 px-1 py-0.5 rounded text-xs bg-base-200"
                    title={`Project #${s.projNum} — ${s.purpose}`}
                  >
                    <span className={`size-1.5 rounded-full shrink-0 ${statusDotColor(s.status)}`}></span>
                    <span className="truncate leading-tight">{`Project ${s.projName ?? s.projNum} Schedule`}</span>
                  </div>
                ))}
                {dayScheds.length > 3 && (
                  <p className="text-xs text-base-content/40 px-1">+{dayScheds.length - 3} more</p>
                )}
              </div>
            )}
          />
        </div>{/* end right column */}

      </div>{/* end two-column flex */}

      <CrewPickerModal
        isOpen={crewPickerOpen}
        onClose={() => setCrewPickerOpen(false)}
        onSelect={addCrewFromPicker}
        excludeIds={excludeIdsForPicker}
      />

      <EquipmentPickerModal
        isOpen={equipmentPickerOpen}
        onClose={() => setEquipmentPickerOpen(false)}
        onSelect={addEquipmentFromPicker}
        excludeIds={excludeEquipmentIds}
      />
    </Layout>
  )
}
