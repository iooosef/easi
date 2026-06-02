import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from './auth'
import Layout from './Layout'
import Modal from './Modal'
import { notyfSuccess, notyfError } from './notyf'
import AnySchedulePickerModal from './AnySchedulePickerModal'
import EmployeePickerModal from './EmployeePickerModal'

const EMPTY_FORM = {
  vehicleModel: '',
  vehiclePlateNum: '',
}

const EMPTY_LOG_FORM = {
  purpose: '',
  schedId: '',
  _scheduleDisplay: '',
  destination: '',
  driverEmployeeId: '',
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

export default function Vehicles() {
  const { apiFetch, hasRole } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [vehicles, setVehicles]           = useState([])
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState(null)
  const [search, setSearch]               = useState('')
  const [page, setPage]                   = useState(0)
  const [totalPages, setTotalPages]       = useState(0)
  const [totalElements, setTotalElements] = useState(0)

  // Add vehicle modal
  const [modalOpen, setModalOpen]   = useState(false)
  const [form, setForm]             = useState(EMPTY_FORM)
  const [formError, setFormError]   = useState({})
  const [submitting, setSubmitting] = useState(false)

  // Edit vehicle modal
  const [editModalOpen, setEditModalOpen]         = useState(false)
  const [editingVehicleId, setEditingVehicleId]   = useState(null)

  // Add Vehicle Log multi-step flow
  const [addLogStep, setAddLogStep]                             = useState(null) // null | 'pick' | 'new-log'
  const [addLogVehicle, setAddLogVehicle]                       = useState(null)
  const [addLogCheckingIncomplete, setAddLogCheckingIncomplete] = useState(false)
  const [addLogForm, setAddLogForm]                             = useState(EMPTY_LOG_FORM)
  const [addLogFormError, setAddLogFormError]                   = useState({})
  const [addLogSubmitting, setAddLogSubmitting]                 = useState(false)
  const [addLogDriverLabel, setAddLogDriverLabel]               = useState('')
  const [addLogSchedPickerOpen, setAddLogSchedPickerOpen]       = useState(false)
  const [addLogDriverPickerOpen, setAddLogDriverPickerOpen]     = useState(false)
  const [addLogOdoStartLocked, setAddLogOdoStartLocked]         = useState(false)

  // Blocking modal shown when the selected vehicle has an ongoing (no odometerEnd) log
  const [incompleteLog, setIncompleteLog] = useState(null)

  const canEdit   = hasRole('ADMIN', 'STAFF')
  const canAddLog = hasRole('ADMIN', 'STAFF', 'CREW')

  /** Auto-open Add Vehicle Log flow when navigated from Home with ?addLog=1 */
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('addLog') === '1') {
      openAddVehicleLog()
    }
  }, [])

  function openModal() {
    setForm(EMPTY_FORM)
    setFormError({})
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setForm(EMPTY_FORM)
    setFormError({})
  }

  function openEditModal(vehicle) {
    setForm({
      vehicleModel:    vehicle.vehicleModel,
      vehiclePlateNum: vehicle.vehiclePlateNum,
    })
    setEditingVehicleId(vehicle.vehiclesId)
    setFormError({})
    setEditModalOpen(true)
  }

  function closeEditModal() {
    setEditModalOpen(false)
    setEditingVehicleId(null)
    setForm(EMPTY_FORM)
    setFormError({})
  }

  function handleFormChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  // --- Add Vehicle Log flow ---

  /** Opens the vehicle picker (step 1). */
  function openAddVehicleLog() {
    setAddLogStep('pick')
    setAddLogVehicle(null)
    setAddLogForm(EMPTY_LOG_FORM)
    setAddLogFormError({})
    setAddLogDriverLabel('')
    setIncompleteLog(null)
    setAddLogOdoStartLocked(false)
  }

  /** Closes and resets the entire multi-step flow. */
  function closeAddVehicleLog() {
    setAddLogStep(null)
    setAddLogVehicle(null)
    setAddLogForm(EMPTY_LOG_FORM)
    setAddLogFormError({})
    setAddLogDriverLabel('')
    setIncompleteLog(null)
    setAddLogOdoStartLocked(false)
  }

  /**
   * Called when the user picks a vehicle in step 1.
   * Blocks if the vehicle has an ongoing trip (no odometerEnd).
   * Otherwise pre-fills odometerStart from the last log's odometerEnd and advances.
   */
  async function handleVehicleSelect(vehicle) {
    setAddLogVehicle(vehicle)
    setAddLogCheckingIncomplete(true)
    try {
      const res = await apiFetch(`/api/vehicle-logs/latest-incomplete?vehiclesId=${vehicle.vehiclesId}`)
      if (res.status === 200) {
        // Vehicle still out — block the user
        setIncompleteLog(await res.json())
      } else {
        // No ongoing trip — fetch last log to pre-fill odometerStart
        setIncompleteLog(null)
        let prefillOdo = ''
        const lastRes = await apiFetch(
          `/api/vehicle-logs?vehiclesId=${vehicle.vehiclesId}&sort=addedOn,desc&size=1`
        )
        if (lastRes.ok) {
          const lastData = await lastRes.json()
          const lastLog = lastData.content?.[0]
          if (lastLog?.odometerEnd != null) prefillOdo = String(lastLog.odometerEnd)
        }
        setAddLogOdoStartLocked(prefillOdo !== '')
        setAddLogForm({ ...EMPTY_LOG_FORM, odometerStart: prefillOdo })
        setAddLogFormError({})
        setAddLogDriverLabel('')
        setAddLogStep('new-log')
      }
    } catch {
      setIncompleteLog(null)
      setAddLogForm(EMPTY_LOG_FORM)
      setAddLogFormError({})
      setAddLogDriverLabel('')
      setAddLogStep('new-log')
    } finally {
      setAddLogCheckingIncomplete(false)
    }
  }

  function handleAddLogFormChange(e) {
    const { name, value } = e.target
    setAddLogForm(prev => ({ ...prev, [name]: value }))
  }

  function handleAddLogScheduleSelect(schedule) {
    setAddLogSchedPickerOpen(false)
    const display = `Sched #${schedule.schedId} · Project #${schedule.projNum} · ${schedule.date ?? '—'}`
    setAddLogForm(prev => ({ ...prev, schedId: String(schedule.schedId), _scheduleDisplay: display }))
  }

  function handleAddLogDriverSelect(employee) {
    setAddLogDriverPickerOpen(false)
    setAddLogForm(prev => ({ ...prev, driverEmployeeId: String(employee.employeeId) }))
    setAddLogDriverLabel(`${employee.firstName} ${employee.lastName} — ${employee.position}`)
  }

  /** Submits the new vehicle log for the selected vehicle. */
  async function handleAddLogSubmit(e) {
    e.preventDefault()
    setAddLogFormError({})
    setAddLogSubmitting(true)
    try {
      const res = await apiFetch('/api/vehicle-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehiclesId:       addLogVehicle.vehiclesId,
          purpose:          addLogForm.purpose,
          schedId:          addLogForm.schedId ? Number(addLogForm.schedId) : null,
          destination:      addLogForm.destination,
          driverEmployeeId: addLogForm.driverEmployeeId ? Number(addLogForm.driverEmployeeId) : null,
          odometerStart:    addLogForm.odometerStart !== '' ? Number(addLogForm.odometerStart) : null,
          odometerEnd:      addLogForm.odometerEnd !== '' ? Number(addLogForm.odometerEnd) : null,
          status:           addLogForm.status,
        }),
      })
      if (!res.ok) {
        setAddLogFormError(await parseApiError(res))
        notyfError('Add failed')
        return
      }
      const data = await res.json().catch(() => ({}))
      closeAddVehicleLog()
      setTimeout(() => notyfSuccess(`Log #${data.vehicleLogId} added successfully.`), 150)
    } catch (err) {
      setAddLogFormError({ _general: err.message })
    } finally {
      setAddLogSubmitting(false)
    }
  }

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
      closeModal()
      setTimeout(() => notyfSuccess(`Vehicle "${data.vehicleModel}" added successfully.`), 150)
      setPage(0)
      await fetchVehicles()
    } catch (err) {
      setFormError({ _general: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleUpdate(e) {
    e.preventDefault()
    setFormError({})
    setSubmitting(true)
    try {
      const res = await apiFetch(`/api/vehicles/${editingVehicleId}`, {
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
      closeEditModal()
      setTimeout(() => notyfSuccess(`Vehicle "${data.vehicleModel}" updated successfully.`), 150)
      await fetchVehicles()
    } catch (err) {
      setFormError({ _general: err.message })
    } finally {
      setSubmitting(false)
    }
  }

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
              onClick={openAddVehicleLog}
            >
              <span className="icon-[tabler--truck] size-4"></span>
              Add Vehicle Log
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              className="btn btn-primary h-full min-h-0"
              onClick={openModal}
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
                            onClick={() => openEditModal(vehicle)}
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

      {/* Edit Vehicle Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={closeEditModal}
        title="Update Vehicle"
        footer={
          <>
            <button type="button" className="btn btn-soft btn-secondary" onClick={closeEditModal}>
              Cancel
            </button>
            <button type="submit" form="edit-vehicle-form" className="btn btn-primary" disabled={submitting}>
              {submitting
                ? <span className="loading loading-spinner loading-sm"></span>
                : <span className="icon-[tabler--device-floppy] size-4"></span>
              }
              Save Changes
            </button>
          </>
        }
      >
        <form id="edit-vehicle-form" onSubmit={handleUpdate}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Vehicle Model <span className="text-error">*</span></label>
              <input
                type="text"
                name="vehicleModel"
                className={`input input-bordered w-full${formError.vehicleModel ? ' is-invalid' : ''}`}
                placeholder="e.g. Toyota HiAce"
                maxLength={30}
                required
                value={form.vehicleModel}
                onChange={handleFormChange}
              />
              {formError.vehicleModel && <span className="helper-text">{formError.vehicleModel}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Plate Number <span className="text-error">*</span></label>
              <input
                type="text"
                name="vehiclePlateNum"
                className={`input input-bordered w-full${formError.vehiclePlateNum ? ' is-invalid' : ''}`}
                placeholder="e.g. AAA 1234"
                maxLength={12}
                required
                value={form.vehiclePlateNum}
                onChange={handleFormChange}
              />
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
      </Modal>

      {/* New Vehicle Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title="New Vehicle"
        footer={
          <>
            <button type="button" className="btn btn-soft btn-secondary" onClick={closeModal}>
              Cancel
            </button>
            <button type="submit" form="new-vehicle-form" className="btn btn-primary" disabled={submitting}>
              {submitting
                ? <span className="loading loading-spinner loading-sm"></span>
                : <span className="icon-[tabler--plus] size-4"></span>
              }
              Add Vehicle
            </button>
          </>
        }
      >
        <form id="new-vehicle-form" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Vehicle Model <span className="text-error">*</span></label>
              <input
                type="text"
                name="vehicleModel"
                className={`input input-bordered w-full${formError.vehicleModel ? ' is-invalid' : ''}`}
                placeholder="e.g. Toyota HiAce"
                maxLength={30}
                required
                value={form.vehicleModel}
                onChange={handleFormChange}
              />
              {formError.vehicleModel && <span className="helper-text">{formError.vehicleModel}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Plate Number <span className="text-error">*</span></label>
              <input
                type="text"
                name="vehiclePlateNum"
                className={`input input-bordered w-full${formError.vehiclePlateNum ? ' is-invalid' : ''}`}
                placeholder="e.g. AAA 1234"
                maxLength={12}
                required
                value={form.vehiclePlateNum}
                onChange={handleFormChange}
              />
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
      </Modal>

      {/* Step 1: Pick a vehicle */}
      <Modal
        isOpen={addLogStep === 'pick'}
        onClose={addLogCheckingIncomplete ? undefined : closeAddVehicleLog}
        hideClose={addLogCheckingIncomplete}
        title="Add Vehicle Log — Select a Vehicle"
        size="max-w-2xl"
        footer={
          <button type="button" className="btn btn-soft btn-secondary" onClick={closeAddVehicleLog} disabled={addLogCheckingIncomplete}>
            Cancel
          </button>
        }
      >
        {addLogCheckingIncomplete ? (
          <div className="flex flex-col items-center gap-3 py-10">
            <span className="loading loading-spinner loading-md text-primary"></span>
            <p className="text-sm text-base-content/60">Checking vehicle logs…</p>
          </div>
        ) : loading ? (
          <div className="flex justify-center py-12">
            <span className="loading loading-spinner loading-md text-primary"></span>
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
      </Modal>

      {/* Blocking modal — vehicle is still on a trip with no end odometer */}
      {incompleteLog && (
        <>
          <div className="fixed inset-0 bg-base-300/40 z-[55]" />
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="modal-content w-full max-w-sm shadow-xl">
              <div className="modal-header">
                <div>
                  <h3 className="modal-title">Vehicle Still Out</h3>
                  <span className="text-sm text-base-content/50">{addLogVehicle?.vehicleModel} · {addLogVehicle?.vehiclePlateNum}</span>
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
                <button type="button" className="btn btn-primary" onClick={() => setIncompleteLog(null)}>
                  OK
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Step 2: New vehicle log form */}
      <Modal
        isOpen={addLogStep === 'new-log'}
        onClose={closeAddVehicleLog}
        title={`New Vehicle Log — ${addLogVehicle?.vehicleModel ?? ''}`}
        size="max-w-2xl"
        footer={
          <>
            <button type="button" className="btn btn-soft btn-secondary" onClick={closeAddVehicleLog}>
              Cancel
            </button>
            <button type="submit" form="add-log-form" className="btn btn-primary" disabled={addLogSubmitting}>
              {addLogSubmitting
                ? <span className="loading loading-spinner loading-sm"></span>
                : <span className="icon-[tabler--plus] size-4"></span>
              }
              Add Log
            </button>
          </>
        }
      >
        <form id="add-log-form" onSubmit={handleAddLogSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="label-text font-medium">Purpose <span className="text-error">*</span></label>
              <input
                type="text"
                name="purpose"
                maxLength={30}
                required
                className={`input input-bordered w-full${addLogFormError.purpose ? ' is-invalid' : ''}`}
                placeholder="e.g. Material Delivery"
                value={addLogForm.purpose}
                onChange={handleAddLogFormChange}
              />
              {addLogFormError.purpose && <span className="helper-text">{addLogFormError.purpose}</span>}
            </div>

            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="label-text font-medium">Schedule <span className="text-base-content/40 font-normal">(optional)</span></label>
              <div className={`input input-bordered w-full flex items-center justify-between gap-2${addLogFormError.schedId ? ' is-invalid' : ''}`}>
                <span className={`text-sm truncate ${addLogForm._scheduleDisplay ? '' : 'text-base-content/40'}`}>
                  {addLogForm._scheduleDisplay || 'No schedule linked'}
                </span>
                <div className="flex gap-1 shrink-0">
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() => setAddLogSchedPickerOpen(true)}
                  >
                    {addLogForm._scheduleDisplay ? 'Change' : 'Select'}
                  </button>
                  {addLogForm._scheduleDisplay && (
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      onClick={() => setAddLogForm(prev => ({ ...prev, schedId: '', _scheduleDisplay: '' }))}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
              {addLogFormError.schedId && <span className="helper-text">{addLogFormError.schedId}</span>}
            </div>

            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="label-text font-medium">Destination <span className="text-error">*</span></label>
              <input
                type="text"
                name="destination"
                maxLength={255}
                required
                className={`input input-bordered w-full${addLogFormError.destination ? ' is-invalid' : ''}`}
                placeholder="e.g. 123 Ayala Ave, Makati City"
                value={addLogForm.destination}
                onChange={handleAddLogFormChange}
              />
              {addLogFormError.destination && <span className="helper-text">{addLogFormError.destination}</span>}
            </div>

            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="label-text font-medium">Driver <span className="text-error">*</span></label>
              <div className={`input input-bordered w-full flex items-center justify-between gap-2${addLogFormError.driverEmployeeId ? ' is-invalid' : ''}`}>
                <span className={`text-sm truncate ${addLogDriverLabel ? '' : 'text-base-content/40'}`}>
                  {addLogDriverLabel || 'No driver selected'}
                </span>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary shrink-0"
                  onClick={() => setAddLogDriverPickerOpen(true)}
                >
                  {addLogDriverLabel ? 'Change' : 'Select'}
                </button>
              </div>
              {addLogFormError.driverEmployeeId && <span className="helper-text">{addLogFormError.driverEmployeeId}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">
                Odometer Start (km) <span className="text-error">*</span>
                {addLogOdoStartLocked && (
                  <span className="ml-2 text-xs font-normal text-base-content/40">
                    <span className="icon-[tabler--lock] size-3 inline-block align-middle mr-0.5"></span>
                    from previous log
                  </span>
                )}
              </label>
              <input
                type="number"
                name="odometerStart"
                min={0}
                required
                readOnly={addLogOdoStartLocked}
                className={`input input-bordered w-full${addLogOdoStartLocked ? ' bg-base-200 cursor-not-allowed' : ''}${addLogFormError.odometerStart ? ' is-invalid' : ''}`}
                placeholder="e.g. 12500"
                value={addLogForm.odometerStart}
                onChange={addLogOdoStartLocked ? undefined : handleAddLogFormChange}
              />
              {addLogFormError.odometerStart && <span className="helper-text">{addLogFormError.odometerStart}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Odometer End (km)</label>
              <input
                type="number"
                name="odometerEnd"
                min={0}
                className={`input input-bordered w-full${addLogFormError.odometerEnd ? ' is-invalid' : ''}`}
                placeholder="Leave blank if still driving"
                value={addLogForm.odometerEnd}
                onChange={handleAddLogFormChange}
              />
              {addLogFormError.odometerEnd && <span className="helper-text">{addLogFormError.odometerEnd}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Status</label>
              <select
                name="status"
                className={`select select-bordered w-full${addLogFormError.status ? ' is-invalid' : ''}`}
                value={addLogForm.status}
                onChange={handleAddLogFormChange}
              >
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
              {addLogFormError.status && <span className="helper-text">{addLogFormError.status}</span>}
            </div>

            {addLogFormError._general && (
              <div className="sm:col-span-2 alert alert-error py-2">
                <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                <span className="text-sm">{addLogFormError._general}</span>
              </div>
            )}
          </div>
        </form>
      </Modal>

      {/* Schedule picker for add log form */}
      <AnySchedulePickerModal
        isOpen={addLogSchedPickerOpen}
        onClose={() => setAddLogSchedPickerOpen(false)}
        onSelect={handleAddLogScheduleSelect}
      />

      {/* Driver picker for add log form */}
      <EmployeePickerModal
        isOpen={addLogDriverPickerOpen}
        onClose={() => setAddLogDriverPickerOpen(false)}
        onSelect={handleAddLogDriverSelect}
      />
    </Layout>
  )
}
