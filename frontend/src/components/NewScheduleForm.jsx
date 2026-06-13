import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../auth'
import CalendarPanel, { statusDotColor } from './CalendarPanel'
import PickerInput from './PickerInput'
import ProjectPickerModal from '../pickers/ProjectPickerModal'
import CrewPickerModal from '../pickers/CrewPickerModal'
import EquipmentPickerModal from '../pickers/EquipmentPickerModal'
import { notyfSuccess, notyfError } from '../notyf'

const EMPTY_FORM = { projNum: '', projName: '', purpose: '', date: '' }

const QUICK_PURPOSES = ['Check Up', 'General Cleaning']

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

/**
 * Multi-step schedule creation form shared between the full page and the modal.
 * showCalendar=true renders a two-column layout with CalendarPanel (page mode).
 * showCalendar=false renders modal-body + modal-footer fragments (modal mode).
 * onDone() is called after successful submission.
 */
export default function NewScheduleForm({ onDone, showCalendar = false }) {
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

  // Informational only — shows a badge on crew cards, does not block selection or submission
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

  /** Fetches employee IDs already assigned on the selected date — used for informational badge only */
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

  /** Toggles a quick-purpose preset on/off in the purpose textarea */
  function togglePreset(preset) {
    setForm(f => {
      const parts = f.purpose.split(',').map(s => s.trim()).filter(Boolean)
      const idx = parts.indexOf(preset)
      if (idx >= 0) parts.splice(idx, 1)
      else parts.unshift(preset)
      return { ...f, purpose: parts.join(', ') }
    })
    setFormError(e => ({ ...e, purpose: undefined }))
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

  /** Creates the schedule, service report, crew assignments, and equipment usages */
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
        body: JSON.stringify({ projNum: Number(form.projNum), complaint: form.purpose, workDone: null, location: 'same as project location', schedId: created.schedId }),
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
      onDone?.()
    } catch (err) {
      setFormError({ _general: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  const stepProgress = (
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
  )

  const stepContent = (
    <>
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
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-base-content/40">Quick fill:</span>
              {QUICK_PURPOSES.map(p => {
                const active = form.purpose.split(',').map(s => s.trim()).includes(p)
                return (
                  <button
                    key={p}
                    type="button"
                    className={`btn btn-xs ${active ? 'btn-primary' : 'btn-soft btn-secondary'}`}
                    onClick={() => togglePreset(p)}
                  >
                    {active && <span className="icon-[tabler--check] size-3"></span>}
                    {p}
                  </button>
                )
              })}
            </div>
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
    </>
  )

  const navButtons = (
    <>
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
    </>
  )

  const pickers = (
    <>
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
    </>
  )

  if (showCalendar) {
    return (
      <>
        <div className="flex gap-6 items-start">
          <div className="flex-1 max-w-lg">
            <div className="card bg-base-100 border border-base-300">
              <div className="card-body gap-4">
                {stepProgress}
                {stepContent}
                <div className="flex gap-2 justify-between mt-2">{navButtons}</div>
              </div>
            </div>
          </div>
          <div className="flex-1">
            <CalendarPanel
              selectedDate={form.date || null}
              onDateSelect={ds => { setForm(f => ({ ...f, date: ds })); setFormError(e => ({ ...e, date: undefined })) }}
              conflict={projectConflict}
              renderCellSchedules={dayScheds => (
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
          </div>
        </div>
        {pickers}
      </>
    )
  }

  // Modal mode: renders modal-body + modal-footer as siblings inside the caller's modal-content
  return (
    <>
      <div className="modal-body flex flex-col gap-4">
        {stepProgress}
        {stepContent}
      </div>
      <div className="modal-footer justify-between">
        {navButtons}
      </div>
      {pickers}
    </>
  )
}
