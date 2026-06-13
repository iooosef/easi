import { useState, useEffect } from 'react'
import { useAuth } from '../../auth'
import { useModal } from '../../modals/index.js'
import { notyfSuccess, notyfError } from '../../notyf'
import { SchedulePickerLayer, DriverPickerLayer } from '../../pickers/PickerLayers'

const EMPTY_LOG_FORM = {
  purpose: '',
  schedId: '',
  _scheduleDisplay: '',
  destination: '',
  driverEmployeeId: '',
  _driverDisplay: '',
  odometerStart: '',
  odometerEnd: '',
  status: 'driving',
}

const STATUS_OPTIONS = ['driving', 'completed']

async function parseApiError(res) {
  const data = await res.json().catch(() => ({}))
  if (data.errors) return data.errors
  return { _general: data.message ?? data.error ?? `Error ${res.status}` }
}

/**
 * Blocking modal shown when the selected vehicle has an ongoing trip with no end odometer.
 * Pushed from VehiclePickerModal.
 */
function VehicleStillOutModal({ vehicle, incompleteLog }) {
  const { popModal } = useModal()
  return (
    <div className="modal-content w-full max-w-sm my-auto">
      <div className="modal-header">
        <div>
          <h3 className="modal-title">Vehicle Still Out</h3>
          <span className="text-sm text-base-content/50">{vehicle.vehicleModel} · {vehicle.vehiclePlateNum}</span>
        </div>
      </div>
      <div className="modal-body flex flex-col gap-4">
        <div className="alert alert-error py-3">
          <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
          <span className="text-sm">
            This vehicle has an ongoing trip with no end odometer recorded. Return the vehicle and log the end odometer before adding a new trip.
          </span>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <span className="text-xs text-base-content/50 block">Log #</span>
            <span className="font-medium font-mono">{incompleteLog.vehicleLogId}</span>
          </div>
          <div>
            <span className="text-xs text-base-content/50 block">Driver</span>
            <span className="font-medium">{incompleteLog.driverName}</span>
          </div>
          <div>
            <span className="text-xs text-base-content/50 block">Purpose</span>
            <span className="font-medium">{incompleteLog.purpose}</span>
          </div>
          <div>
            <span className="text-xs text-base-content/50 block">Odometer Start</span>
            <span className="font-medium">{incompleteLog.odometerStart?.toLocaleString()} km</span>
          </div>
        </div>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-primary" onClick={popModal}>OK</button>
      </div>
    </div>
  )
}

/**
 * Form modal for logging a new vehicle trip.
 * Pushed from VehiclePickerModal.
 * Schedule and driver pickers are pushed as additional layers.
 * On success: closes itself, then invokes onSuccess which closes VehiclePickerModal.
 */
function AddVehicleLogModal({ vehicle, prefillOdo, onSuccess }) {
  const { pushModal, popModal } = useModal()
  const { apiFetch } = useAuth()
  const odoMin = prefillOdo !== '' ? Number(prefillOdo) : 0
  const [form, setForm] = useState({ ...EMPTY_LOG_FORM, odometerStart: prefillOdo, date: new Date().toISOString().slice(0, 10) })
  const [formError, setFormError] = useState({})
  const [submitting, setSubmitting] = useState(false)

  function handleChange(e) {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  }

  /** Updates form with the selected schedule. */
  function handleScheduleSelect(sched) {
    setForm(f => ({
      ...f,
      schedId: String(sched.schedId),
      _scheduleDisplay: `Sched #${sched.schedId} · Project #${sched.projNum} · ${sched.date ?? '—'}`,
    }))
  }

  /** Updates form with the selected driver. */
  function handleDriverSelect(emp) {
    setForm(f => ({
      ...f,
      driverEmployeeId: String(emp.employeeId),
      _driverDisplay: `${emp.firstName} ${emp.lastName} — ${emp.position}`,
    }))
  }

  /** Submits the new vehicle log. On success closes this layer and invokes onSuccess. */
  async function handleSubmit(e) {
    e.preventDefault()
    setFormError({})
    setSubmitting(true)
    try {
      const res = await apiFetch('/api/vehicle-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehiclesId:       vehicle.vehiclesId,
          purpose:          form.purpose,
          schedId:          form.schedId ? Number(form.schedId) : null,
          destination:      form.destination,
          driverEmployeeId: form.driverEmployeeId ? Number(form.driverEmployeeId) : null,
          odometerStart:    form.odometerStart !== '' ? Number(form.odometerStart) : null,
          odometerEnd:      form.odometerEnd !== '' ? Number(form.odometerEnd) : null,
          status:           form.status,
          date:             form.date || null,
        }),
      })
      if (!res.ok) {
        setFormError(await parseApiError(res))
        notyfError('Add failed')
        return
      }
      const data = await res.json().catch(() => ({}))
      popModal()
      setTimeout(() => notyfSuccess(`Log #${data.vehicleLogId} added successfully.`), 150)
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
        <h3 className="modal-title">New Vehicle Log — {vehicle.vehicleModel}</h3>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body">
        <form id="add-vehicle-log-form" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Date <span className="text-error">*</span></label>
              <input type="date" name="date" required
                className={`input input-bordered w-full${formError.date ? ' is-invalid' : ''}`}
                value={form.date} onChange={handleChange} />
              {formError.date && <span className="helper-text">{formError.date}</span>}
            </div>

            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="label-text font-medium">Purpose <span className="text-error">*</span></label>
              <input type="text" name="purpose" maxLength={30} required
                className={`input input-bordered w-full${formError.purpose ? ' is-invalid' : ''}`}
                placeholder="e.g. Material Delivery"
                value={form.purpose} onChange={handleChange} />
              {formError.purpose && <span className="helper-text">{formError.purpose}</span>}
            </div>

            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="label-text font-medium">Schedule <span className="text-base-content/40 font-normal">(optional)</span></label>
              <div className={`input input-bordered w-full flex items-center justify-between gap-2${formError.schedId ? ' is-invalid' : ''}`}>
                <span className={`text-sm truncate ${form._scheduleDisplay ? '' : 'text-base-content/40'}`}>
                  {form._scheduleDisplay || 'No schedule linked'}
                </span>
                <div className="flex gap-1 shrink-0">
                  <button type="button" className="btn btn-sm btn-secondary"
                    onClick={() => pushModal(<SchedulePickerLayer onSelect={handleScheduleSelect} />)}>
                    {form._scheduleDisplay ? 'Change' : 'Select'}
                  </button>
                  {form._scheduleDisplay && (
                    <button type="button" className="btn btn-sm btn-ghost"
                      onClick={() => setForm(f => ({ ...f, schedId: '', _scheduleDisplay: '' }))}>
                      Clear
                    </button>
                  )}
                </div>
              </div>
              {formError.schedId && <span className="helper-text">{formError.schedId}</span>}
            </div>

            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="label-text font-medium">Destination <span className="text-error">*</span></label>
              <input type="text" name="destination" maxLength={255} required
                className={`input input-bordered w-full${formError.destination ? ' is-invalid' : ''}`}
                placeholder="e.g. 123 Ayala Ave, Makati City"
                value={form.destination} onChange={handleChange} />
              {formError.destination && <span className="helper-text">{formError.destination}</span>}
            </div>

            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="label-text font-medium">Driver <span className="text-error">*</span></label>
              <div className={`input input-bordered w-full flex items-center justify-between gap-2${formError.driverEmployeeId ? ' is-invalid' : ''}`}>
                <span className={`text-sm truncate ${form._driverDisplay ? '' : 'text-base-content/40'}`}>
                  {form._driverDisplay || 'No driver selected'}
                </span>
                <button type="button" className="btn btn-sm btn-secondary shrink-0"
                  onClick={() => pushModal(<DriverPickerLayer onSelect={handleDriverSelect} />)}>
                  {form._driverDisplay ? 'Change' : 'Select'}
                </button>
              </div>
              {formError.driverEmployeeId && <span className="helper-text">{formError.driverEmployeeId}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">
                Odometer Start (km) <span className="text-error">*</span>
                {odoMin > 0 && (
                  <span className="ml-2 text-xs font-normal text-base-content/40">
                    min {odoMin.toLocaleString()} km
                  </span>
                )}
              </label>
              <input type="number" name="odometerStart" min={odoMin} required
                className={`input input-bordered w-full${formError.odometerStart ? ' is-invalid' : ''}`}
                placeholder="e.g. 12500"
                value={form.odometerStart}
                onChange={handleChange} />
              {formError.odometerStart && <span className="helper-text">{formError.odometerStart}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Odometer End (km)</label>
              <input type="number" name="odometerEnd" min={0}
                className={`input input-bordered w-full${formError.odometerEnd ? ' is-invalid' : ''}`}
                placeholder="Leave blank if still driving"
                value={form.odometerEnd} onChange={handleChange} />
              {formError.odometerEnd && <span className="helper-text">{formError.odometerEnd}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Status</label>
              <select name="status"
                className={`select select-bordered w-full${formError.status ? ' is-invalid' : ''}`}
                value={form.status} onChange={handleChange}>
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
              {formError.status && <span className="helper-text">{formError.status}</span>}
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
        <button type="submit" form="add-vehicle-log-form" className="btn btn-primary" disabled={submitting}>
          {submitting
            ? <span className="loading loading-spinner loading-sm"></span>
            : <span className="icon-[tabler--plus] size-4"></span>
          }
          Add Log
        </button>
      </div>
    </div>
  )
}

/**
 * L1 modal for selecting a vehicle to add a log for.
 * Fetches vehicles itself so it is fully self-contained.
 * On vehicle selection, checks for incomplete trips:
 *   - Incomplete trip → pushes VehicleStillOutModal (blocker)
 *   - Clear → pushes AddVehicleLogModal (form)
 */
export function VehiclePickerModal({ onSuccess }) {
  const { pushModal, popModal } = useModal()
  const { apiFetch } = useAuth()
  const [vehicles, setVehicles] = useState([])
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)

  /** Fetches all vehicles for the picker list. */
  useEffect(() => {
    let active = true
    apiFetch('/api/vehicles?size=100&sort=addedOn,desc')
      .then(r => r.json())
      .then(data => { if (active) { setVehicles(data.content ?? []); setLoading(false) } })
      .catch(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [apiFetch])

  /** Checks for incomplete trips then advances to the log form. */
  async function handleVehicleSelect(vehicle) {
    setChecking(true)
    try {
      const res = await apiFetch(`/api/vehicle-logs/latest-incomplete?vehiclesId=${vehicle.vehiclesId}`)
      if (res.status === 200) {
        const incomplete = await res.json()
        pushModal(<VehicleStillOutModal vehicle={vehicle} incompleteLog={incomplete} />)
      } else {
        let prefillOdo = ''
        const lastRes = await apiFetch(`/api/vehicle-logs?vehiclesId=${vehicle.vehiclesId}&sort=addedOn,desc&size=1`)
        if (lastRes.ok) {
          const lastData = await lastRes.json()
          const lastLog = lastData.content?.[0]
          if (lastLog?.odometerEnd != null) prefillOdo = String(lastLog.odometerEnd)
        }
        pushModal(
          <AddVehicleLogModal
            vehicle={vehicle}
            prefillOdo={prefillOdo}
            onSuccess={() => { popModal(); onSuccess?.() }}
          />
        )
      }
    } catch {
      pushModal(
        <AddVehicleLogModal
          vehicle={vehicle}
          prefillOdo=""
          onSuccess={() => { popModal(); onSuccess?.() }}
        />
      )
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="modal-content w-full max-w-2xl my-auto">
      <div className="modal-header">
        <h3 className="modal-title">Add Vehicle Log — Select a Vehicle</h3>
        {!checking && (
          <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
            <span className="icon-[tabler--x] size-4"></span>
          </button>
        )}
      </div>
      <div className="modal-body">
        {loading || checking ? (
          <div className="flex flex-col items-center gap-3 py-10">
            <span className="loading loading-spinner loading-md text-primary"></span>
            {checking && <p className="text-sm text-base-content/60">Checking vehicle logs…</p>}
          </div>
        ) : vehicles.length === 0 ? (
          <div className="text-center py-12 text-base-content/40">
            <span className="icon-[tabler--truck-off] size-10 mx-auto mb-2 block"></span>
            <p>No vehicles available.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {vehicles.map(vehicle => (
              <button
                key={vehicle.vehiclesId}
                type="button"
                disabled={checking}
                className="card bg-base-100 border border-base-300 hover:border-primary hover:bg-primary/5 transition-colors text-left w-full"
                onClick={() => handleVehicleSelect(vehicle)}
              >
                <div className="card-body py-4 px-5 gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm">{vehicle.vehicleModel}</span>
                    <span className="badge badge-soft badge-neutral text-xs font-mono shrink-0">{vehicle.vehiclePlateNum}</span>
                  </div>
                  <span className="text-xs text-base-content/50">
                    {vehicle.latestOdometer != null
                      ? `${vehicle.latestOdometer.toLocaleString()} km`
                      : 'No odometer recorded'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-soft btn-secondary" onClick={popModal} disabled={checking}>Cancel</button>
      </div>
    </div>
  )
}
