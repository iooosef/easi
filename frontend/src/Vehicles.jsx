import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from './auth'
import { useModal } from './modals/index.js'
import Layout from './Layout'
import { notyfSuccess, notyfError } from './notyf'
import AnySchedulePickerModal from './AnySchedulePickerModal'
import EmployeePickerModal from './EmployeePickerModal'

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

/**
 * Parses a failed API response.
 * Returns { fieldName: message } for validation errors,
 * or { _general: message } for other errors.
 */
async function parseApiError(res) {
  const data = await res.json().catch(() => ({}))
  if (data.errors) return data.errors
  return { _general: data.message ?? data.error ?? `Error ${res.status}` }
}

/** Formats a LocalDateTime string to a readable date */
function formatDate(dt) {
  if (!dt) return '—'
  return new Date(dt).toISOString().slice(0, 10)
}

const PAGE_SIZE = 12

/**
 * Modal for adding a new vehicle.
 * Pushed from the Vehicles page header button.
 */
function NewVehicleModal({ onSuccess }) {
  const { popModal } = useModal()
  const { apiFetch } = useAuth()
  const [form, setForm] = useState({ vehicleModel: '', vehiclePlateNum: '' })
  const [formError, setFormError] = useState({})
  const [submitting, setSubmitting] = useState(false)

  function handleChange(e) {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  }

  /** Submits the new vehicle and closes on success. */
  async function handleSubmit(e) {
    e.preventDefault()
    setFormError({})
    setSubmitting(true)
    try {
      const res = await apiFetch('/api/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        setFormError(await parseApiError(res))
        notyfError('Add failed')
        return
      }
      const data = await res.json().catch(() => ({}))
      popModal()
      setTimeout(() => notyfSuccess(`Vehicle "${data.vehicleModel}" added successfully.`), 150)
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
        <h3 className="modal-title">New Vehicle</h3>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body">
        <form id="new-vehicle-form" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Vehicle Model <span className="text-error">*</span></label>
              <input type="text" name="vehicleModel" maxLength={30} required
                className={`input input-bordered w-full${formError.vehicleModel ? ' is-invalid' : ''}`}
                placeholder="e.g. Toyota HiAce"
                value={form.vehicleModel} onChange={handleChange} />
              {formError.vehicleModel && <span className="helper-text">{formError.vehicleModel}</span>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Plate Number <span className="text-error">*</span></label>
              <input type="text" name="vehiclePlateNum" maxLength={12} required
                className={`input input-bordered w-full${formError.vehiclePlateNum ? ' is-invalid' : ''}`}
                placeholder="e.g. AAA 1234"
                value={form.vehiclePlateNum} onChange={handleChange} />
              {formError.vehiclePlateNum && <span className="helper-text">{formError.vehiclePlateNum}</span>}
            </div>
            {formError._general && (
              <div className="alert alert-error py-2">
                <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                <span className="text-sm">{formError._general}</span>
              </div>
            )}
          </div>
        </form>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-soft btn-secondary" onClick={popModal}>Cancel</button>
        <button type="submit" form="new-vehicle-form" className="btn btn-primary" disabled={submitting}>
          {submitting
            ? <span className="loading loading-spinner loading-sm"></span>
            : <span className="icon-[tabler--plus] size-4"></span>
          }
          Add Vehicle
        </button>
      </div>
    </div>
  )
}

/**
 * Modal for updating an existing vehicle's model and plate number.
 * Pushed from the vehicle card's "Update Vehicle Info" button.
 */
function UpdateVehicleModal({ vehicle, onSuccess }) {
  const { popModal } = useModal()
  const { apiFetch } = useAuth()
  const [form, setForm] = useState({
    vehicleModel:    vehicle.vehicleModel,
    vehiclePlateNum: vehicle.vehiclePlateNum,
  })
  const [formError, setFormError] = useState({})
  const [submitting, setSubmitting] = useState(false)

  function handleChange(e) {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  }

  /** Submits the vehicle update and closes on success. */
  async function handleSubmit(e) {
    e.preventDefault()
    setFormError({})
    setSubmitting(true)
    try {
      const res = await apiFetch(`/api/vehicles/${vehicle.vehiclesId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        setFormError(await parseApiError(res))
        notyfError('Update failed')
        return
      }
      const data = await res.json().catch(() => ({}))
      popModal()
      setTimeout(() => notyfSuccess(`Vehicle "${data.vehicleModel}" updated successfully.`), 150)
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
        <h3 className="modal-title">Update Vehicle</h3>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body">
        <form id="update-vehicle-form" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Vehicle Model <span className="text-error">*</span></label>
              <input type="text" name="vehicleModel" maxLength={30} required
                className={`input input-bordered w-full${formError.vehicleModel ? ' is-invalid' : ''}`}
                placeholder="e.g. Toyota HiAce"
                value={form.vehicleModel} onChange={handleChange} />
              {formError.vehicleModel && <span className="helper-text">{formError.vehicleModel}</span>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Plate Number <span className="text-error">*</span></label>
              <input type="text" name="vehiclePlateNum" maxLength={12} required
                className={`input input-bordered w-full${formError.vehiclePlateNum ? ' is-invalid' : ''}`}
                placeholder="e.g. AAA 1234"
                value={form.vehiclePlateNum} onChange={handleChange} />
              {formError.vehiclePlateNum && <span className="helper-text">{formError.vehiclePlateNum}</span>}
            </div>
            {formError._general && (
              <div className="alert alert-error py-2">
                <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                <span className="text-sm">{formError._general}</span>
              </div>
            )}
          </div>
        </form>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-soft btn-secondary" onClick={popModal}>Cancel</button>
        <button type="submit" form="update-vehicle-form" className="btn btn-primary" disabled={submitting}>
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

/** Layer component that pushes a schedule picker onto the modal stack (L3). */
function SchedulePickerLayer({ onSelect }) {
  const { popModal } = useModal()
  return (
    <AnySchedulePickerModal
      asLayer
      isOpen
      onClose={popModal}
      onSelect={s => { popModal(); onSelect(s) }}
    />
  )
}

/** Layer component that pushes an employee (driver) picker onto the modal stack (L3). */
function DriverPickerLayer({ onSelect }) {
  const { popModal } = useModal()
  return (
    <EmployeePickerModal
      asLayer
      isOpen
      position="Crew"
      onClose={popModal}
      onSelect={e => { popModal(); onSelect(e) }}
    />
  )
}

/**
 * Blocking modal shown when the selected vehicle has an ongoing trip with no end odometer.
 * Pushed from VehiclePickerModal (L2).
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
 * Pushed from VehiclePickerModal (L2).
 * Schedule and driver pickers are pushed as L3 layers.
 * On success: closes itself, then invokes onSuccess which closes VehiclePickerModal.
 */
function AddVehicleLogModal({ vehicle, prefillOdo, onSuccess }) {
  const { pushModal, popModal } = useModal()
  const { apiFetch } = useAuth()
  const odoLocked = prefillOdo !== ''
  const [form, setForm] = useState({ ...EMPTY_LOG_FORM, odometerStart: prefillOdo })
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
                {odoLocked && (
                  <span className="ml-2 text-xs font-normal text-base-content/40">
                    <span className="icon-[tabler--lock] size-3 inline-block align-middle mr-0.5"></span>
                    from previous log
                  </span>
                )}
              </label>
              <input type="number" name="odometerStart" min={0} required
                readOnly={odoLocked}
                className={`input input-bordered w-full${odoLocked ? ' bg-base-200 cursor-not-allowed' : ''}${formError.odometerStart ? ' is-invalid' : ''}`}
                placeholder="e.g. 12500"
                value={form.odometerStart}
                onChange={odoLocked ? undefined : handleChange} />
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
 *   - Incomplete trip → pushes VehicleStillOutModal (L2 blocker)
 *   - Clear → pushes AddVehicleLogModal (L2 form)
 */
function VehiclePickerModal({ onSuccess }) {
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

export default function Vehicles() {
  const { apiFetch, hasRole } = useAuth()
  const { pushModal } = useModal()
  const navigate = useNavigate()
  const location = useLocation()

  const [vehicles, setVehicles]           = useState([])
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState(null)
  const [search, setSearch]               = useState('')
  const [page, setPage]                   = useState(0)
  const [totalPages, setTotalPages]       = useState(0)
  const [totalElements, setTotalElements] = useState(0)


  const canEdit   = hasRole('ADMIN', 'STAFF')
  const canAddLog = hasRole('ADMIN', 'STAFF', 'CREW')

  /** Auto-open Add Vehicle Log flow when navigated from Home with ?addLog=1 */
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('addLog') === '1') {
      pushModal(<VehiclePickerModal onSuccess={fetchVehicles} />)
    }
  }, [])

  async function fetchVehicles() {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        page: String(page),
        size: String(PAGE_SIZE),
        sort: 'addedOn,desc',
      })
      const res = await apiFetch(`/api/vehicles?${params}`)
      if (!res.ok) throw new Error(`Failed to load vehicles (${res.status})`)
      const data = await res.json()
      setVehicles(data.content ?? [])
      setTotalPages(data.totalPages ?? 0)
      setTotalElements(data.totalElements ?? 0)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchVehicles() }, [apiFetch, page])

  const filtered = vehicles.filter(v =>
    search === '' ||
    v.vehicleModel.toLowerCase().includes(search.toLowerCase()) ||
    v.vehiclePlateNum.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Layout activePage="vehicles">
      {/* Header row */}
      <div className="flex items-stretch justify-between h-16 mb-6">
        <div>
          <h1 className="text-3xl font-semibold">Vehicles</h1>
          <p className="text-base-content/60 mt-1">Manage company vehicles and trip records</p>
        </div>
        <div className="flex gap-2 items-center h-full">
          {canAddLog && (
            <button
              type="button"
              className="btn btn-secondary h-full min-h-0"
              onClick={() => pushModal(<VehiclePickerModal onSuccess={fetchVehicles} />)}
            >
              <span className="icon-[tabler--truck] size-4"></span>
              Add Vehicle Log
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              className="btn btn-primary h-full min-h-0"
              onClick={() => pushModal(<NewVehicleModal onSuccess={() => { setPage(0); fetchVehicles() }} />)}
            >
              <span className="icon-[tabler--plus] size-4"></span>
              New Vehicle
            </button>
          )}
        </div>
      </div>

      {/* Search row */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <span className="icon-[tabler--search] size-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none"></span>
          <input
            type="text"
            className="input input-bordered w-full pl-9"
            placeholder="Search by model or plate number..."
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

      {/* Vehicle grid */}
      {!loading && !error && (
        <>
          <p className="text-sm text-base-content/50 mb-3">
            {totalElements} vehicle{totalElements !== 1 ? 's' : ''} total
            {search && ` · ${filtered.length} shown`}
          </p>

          {filtered.length === 0 ? (
            <div className="text-center py-20 text-base-content/40">
              <span className="icon-[tabler--truck-off] size-12 mx-auto mb-3 block"></span>
              <p>No vehicles found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(vehicle => (
                <div key={vehicle.vehiclesId} className="group">
                  <div className="card bg-base-100 border border-base-300 transition-transform duration-300 group-hover:-translate-y-2 h-full">
                    <div className="card-body gap-2">
                      <div className="flex items-start justify-between gap-2">
                        <h2 className="card-title text-base">{vehicle.vehicleModel}</h2>
                        <span className="badge badge-soft badge-neutral shrink-0 text-xs font-mono">
                          {vehicle.vehiclePlateNum}
                        </span>
                      </div>
                      <p className="text-sm text-base-content/50">Added {formatDate(vehicle.addedOn)}</p>
                      <p className="text-sm text-base-content/60">
                        <span className="icon-[tabler--road] size-3.5 inline-block mr-1 align-middle"></span>
                        {vehicle.latestOdometer != null
                          ? <>{vehicle.latestOdometer.toLocaleString()} km</>
                          : <span className="italic text-base-content/40">No odometer recorded</span>
                        }
                      </p>
                      <div className="card-actions mt-2 flex-col gap-2">
                        <button
                          className="btn btn-soft btn-primary btn-sm w-full"
                          onClick={() => navigate(`/vehicles/${vehicle.vehiclesId}/logs`, { state: { vehicleModel: vehicle.vehicleModel } })}
                        >
                          <span className="icon-[tabler--road] size-4"></span>
                          Manage Vehicle Logs
                        </button>
                        {canEdit && (
                          <button
                            className="btn btn-soft btn-secondary btn-sm w-full"
                            onClick={() => pushModal(<UpdateVehicleModal vehicle={vehicle} onSuccess={fetchVehicles} />)}
                          >
                            <span className="icon-[tabler--pencil] size-4"></span>
                            Update Vehicle Info
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
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
