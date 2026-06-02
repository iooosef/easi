import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from './auth'
import Layout from './Layout'
import Modal from './Modal'
import { notyfSuccess, notyfError } from './notyf'

const EMPTY_GAS_FORM = { invoiceId: '', amount: '' }
const ACCEPTED_EXTENSIONS = '.jpg,.jpeg,.png,.gif,.webp,.pdf'
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']

async function parseApiError(res) {
  const data = await res.json().catch(() => ({}))
  if (data.errors) return data.errors
  return { _general: data.message ?? data.error ?? `Error ${res.status}` }
}

/** Navigation items shown as Link cards on the Home page. */
const HOME_NAV_ITEMS = [
  { page: 'new-schedule',      label: 'Make new Schedule',  icon: 'icon-[tabler--calendar-plus]', path: '/schedules/new',                        roles: ['ADMIN', 'STAFF'] },
  { page: 'new-service-report',label: 'New Service Report', icon: 'icon-[tabler--file-plus]',     path: '/service-report/new',                   roles: ['ADMIN', 'STAFF'] },
  { page: 'new-purchase-order',label: 'New Purchase Order', icon: 'icon-[tabler--file-invoice]',  path: '/inventory/purchase-orders?newPO=1',    roles: ['ADMIN', 'ACCOUNTING', 'STAFF'] },
  { page: 'record-payment',    label: 'Record a Payment',   icon: 'icon-[tabler--cash]',          path: '/billing?status=unpaid,partial',         roles: ['ADMIN', 'ACCOUNTING'] },
  { page: 'add-vehicle-log',   label: 'Add Vehicle Log',    icon: 'icon-[tabler--truck]',         path: '/vehicles?addLog=1',                    roles: ['ADMIN', 'STAFF', 'CREW'] },
]

/** Action items that open an inline modal instead of navigating. */
const HOME_ACTION_ITEMS = [
  { page: 'log-refueling', label: 'Log Refueling', icon: 'icon-[tabler--gas-station]', action: 'refueling', roles: ['ADMIN', 'STAFF', 'CREW'] },
]

export default function Home() {
  const { fullName, hasRole, apiFetch } = useAuth()

  const navCards    = HOME_NAV_ITEMS.filter(({ roles }) => roles === null || hasRole(...roles))
  const actionCards = HOME_ACTION_ITEMS.filter(({ roles }) => roles === null || hasRole(...roles))

  // --- Log Refueling multi-step flow ---
  // refuelStep: null | 'pick-vehicle' | 'pick-log' | 'add-gas-log'
  const [refuelStep, setRefuelStep] = useState(null)

  // Step 1: vehicle list
  const [vehicles, setVehicles]             = useState([])
  const [vehiclesLoading, setVehiclesLoading] = useState(false)
  const [selectedVehicle, setSelectedVehicle] = useState(null)

  // Step 2: vehicle log list
  const [vehicleLogs, setVehicleLogs]       = useState([])
  const [logsLoading, setLogsLoading]       = useState(false)
  const [selectedLog, setSelectedLog]       = useState(null)

  // Step 3: gas log form
  const [gasForm, setGasForm]               = useState(EMPTY_GAS_FORM)
  const [gasFormError, setGasFormError]     = useState({})
  const [gasSubmitting, setGasSubmitting]   = useState(false)
  const [gasFile, setGasFile]               = useState(null)
  const gasFileRef                          = useRef(null)

  const canManageDocs = hasRole('ADMIN', 'STAFF')

  /** Opens the refueling flow at step 1. */
  function openRefueling() {
    setRefuelStep('pick-vehicle')
    setSelectedVehicle(null)
    setSelectedLog(null)
    setGasForm(EMPTY_GAS_FORM)
    setGasFormError({})
    setGasFile(null)
  }

  /** Closes and resets the entire refueling flow. */
  function closeRefueling() {
    setRefuelStep(null)
    setSelectedVehicle(null)
    setSelectedLog(null)
    setGasForm(EMPTY_GAS_FORM)
    setGasFormError({})
    setGasFile(null)
  }

  /** Fetch vehicles when step 1 opens. */
  useEffect(() => {
    if (refuelStep !== 'pick-vehicle') return
    let active = true
    setVehiclesLoading(true)
    apiFetch('/api/vehicles?size=100&sort=vehicleModel,asc')
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => { if (active) setVehicles(data.content ?? []) })
      .catch(() => { if (active) setVehicles([]) })
      .finally(() => { if (active) setVehiclesLoading(false) })
    return () => { active = false }
  }, [apiFetch, refuelStep])

  /** Fetch vehicle logs for the selected vehicle when step 2 opens. */
  useEffect(() => {
    if (refuelStep !== 'pick-log' || !selectedVehicle) return
    let active = true
    setLogsLoading(true)
    const params = new URLSearchParams({
      vehiclesId: String(selectedVehicle.vehiclesId),
      size: '50',
      sort: 'addedOn,desc',
    })
    apiFetch(`/api/vehicle-logs?${params}`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => { if (active) setVehicleLogs(data.content ?? []) })
      .catch(() => { if (active) setVehicleLogs([]) })
      .finally(() => { if (active) setLogsLoading(false) })
    return () => { active = false }
  }, [apiFetch, refuelStep, selectedVehicle])

  /** Advance to step 2 with the chosen vehicle. */
  function handleVehicleSelect(vehicle) {
    setSelectedVehicle(vehicle)
    setVehicleLogs([])
    setRefuelStep('pick-log')
  }

  /** Advance to step 3 with the chosen log. */
  function handleLogSelect(log) {
    setSelectedLog(log)
    setGasForm(EMPTY_GAS_FORM)
    setGasFormError({})
    setGasFile(null)
    setRefuelStep('add-gas-log')
  }

  function handleGasFormChange(e) {
    const { name, value } = e.target
    setGasForm(prev => ({ ...prev, [name]: value }))
  }

  /** Submits the gas log, optionally uploading a document first. */
  async function handleGasSubmit(e) {
    e.preventDefault()
    setGasFormError({})
    setGasSubmitting(true)
    try {
      let docuId = null
      if (gasFile) {
        if (!ACCEPTED_TYPES.includes(gasFile.type)) {
          setGasFormError({ file: 'File must be an image (JPG/PNG/GIF/WebP) or PDF.' })
          notyfError('Invalid file type')
          return
        }
        const fd = new FormData()
        fd.append('file', gasFile)
        const uploadRes = await apiFetch('/api/documents', { method: 'POST', body: fd })
        if (!uploadRes.ok) {
          setGasFormError(await parseApiError(uploadRes))
          notyfError('File upload failed')
          return
        }
        const docData = await uploadRes.json()
        docuId = docData.docuId
      }

      const res = await apiFetch('/api/vehicle-gas-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleLogId: selectedLog.vehicleLogId,
          amount:       Number(gasForm.amount),
          invoiceId:    gasForm.invoiceId,
          docuId,
        }),
      })
      if (!res.ok) {
        setGasFormError(await parseApiError(res))
        notyfError('Add gas log failed')
        return
      }
      closeRefueling()
      setTimeout(() => notyfSuccess('Refueling logged successfully.'), 150)
    } catch (err) {
      setGasFormError({ _general: err.message })
    } finally {
      setGasSubmitting(false)
    }
  }

  return (
    <Layout activePage="home">
      <h1 className="text-3xl font-semibold mb-1">Welcome, {fullName}</h1>
      <p className="text-base-content/60 mb-8">What would you like to do today?</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {navCards.map(({ page, label, icon, path }) => (
          <Link key={page} to={path} className="group">
            <div className="card bg-base-100 border border-base-300 transition-transform duration-300 group-hover:-translate-y-2 h-full">
              <div className="card-body items-center justify-center text-center gap-3 py-8">
                <span className={`${icon} size-10 text-primary`}></span>
                <p className="font-medium text-base-content">{label}</p>
              </div>
            </div>
          </Link>
        ))}
        {actionCards.map(({ page, label, icon, action }) => (
          <button key={page} type="button" className="group text-left" onClick={() => action === 'refueling' && openRefueling()}>
            <div className="card bg-base-100 border border-base-300 transition-transform duration-300 group-hover:-translate-y-2 h-full">
              <div className="card-body items-center justify-center text-center gap-3 py-8">
                <span className={`${icon} size-10 text-primary`}></span>
                <p className="font-medium text-base-content">{label}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Step 1: Pick Vehicle */}
      <Modal
        isOpen={refuelStep === 'pick-vehicle'}
        onClose={closeRefueling}
        title="Log Refueling — Step 1: Select Vehicle"
        size="max-w-2xl"
        footer={
          <button type="button" className="btn btn-soft btn-secondary" onClick={closeRefueling}>
            Cancel
          </button>
        }
      >
        {vehiclesLoading ? (
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

      {/* Step 2: Pick Vehicle Log */}
      <Modal
        isOpen={refuelStep === 'pick-log'}
        onClose={closeRefueling}
        title={`Log Refueling — Step 2: Select Log (${selectedVehicle?.vehicleModel ?? ''})`}
        size="max-w-2xl"
        footer={
          <div className="flex gap-2 w-full">
            <button type="button" className="btn btn-soft btn-secondary" onClick={() => setRefuelStep('pick-vehicle')}>
              <span className="icon-[tabler--arrow-left] size-4"></span>
              Back
            </button>
            <button type="button" className="btn btn-soft btn-secondary ml-auto" onClick={closeRefueling}>
              Cancel
            </button>
          </div>
        }
      >
        {logsLoading ? (
          <div className="flex justify-center py-12">
            <span className="loading loading-spinner loading-md text-primary"></span>
          </div>
        ) : vehicleLogs.length === 0 ? (
          <div className="text-center py-12 text-base-content/40">
            <span className="icon-[tabler--road-off] size-10 mx-auto mb-2 block"></span>
            <p>No vehicle logs found for this vehicle.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-box border border-base-300">
            <table className="table table-zebra table-sm w-full">
              <thead>
                <tr>
                  <th>Log #</th>
                  <th>Purpose</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {vehicleLogs.map(log => (
                  <tr key={log.vehicleLogId}>
                    <td className="font-mono text-xs">{log.vehicleLogId}</td>
                    <td className="text-sm">{log.purpose}</td>
                    <td>
                      <span className={`badge badge-soft text-xs ${log.status === 'completed' ? 'badge-success' : 'badge-info'}`}>
                        {log.status.charAt(0).toUpperCase() + log.status.slice(1)}
                      </span>
                    </td>
                    <td className="text-xs text-base-content/60">
                      {log.addedOn ? new Date(log.addedOn).toISOString().slice(0, 10) : '—'}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-primary btn-xs"
                        onClick={() => handleLogSelect(log)}
                      >
                        Select
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      {/* Step 3: Add Gas Log */}
      <Modal
        isOpen={refuelStep === 'add-gas-log'}
        onClose={closeRefueling}
        title="Log Refueling — Step 3: Add Gas Log"
        size="max-w-lg"
        footer={
          <div className="flex gap-2 w-full">
            <button type="button" className="btn btn-soft btn-secondary" onClick={() => setRefuelStep('pick-log')}>
              <span className="icon-[tabler--arrow-left] size-4"></span>
              Back
            </button>
            <div className="ml-auto flex gap-2">
              <button type="button" className="btn btn-soft btn-secondary" onClick={closeRefueling}>
                Cancel
              </button>
              <button type="submit" form="home-gas-log-form" className="btn btn-primary" disabled={gasSubmitting}>
                {gasSubmitting
                  ? <span className="loading loading-spinner loading-sm"></span>
                  : <span className="icon-[tabler--gas-station] size-4"></span>
                }
                Log Refueling
              </button>
            </div>
          </div>
        }
      >
        <div className="mb-4 p-3 rounded-box bg-base-200 text-sm flex flex-col gap-0.5">
          <span className="text-base-content/50 text-xs uppercase tracking-wide">Vehicle</span>
          <span className="font-medium">
            {selectedVehicle?.vehicleModel}{' '}
            <span className="font-mono text-xs text-base-content/50">· {selectedVehicle?.vehiclePlateNum}</span>
          </span>
          <span className="text-base-content/50 text-xs uppercase tracking-wide mt-1">Log</span>
          <span className="font-medium">Log #{selectedLog?.vehicleLogId} — {selectedLog?.purpose}</span>
        </div>

        <form id="home-gas-log-form" onSubmit={handleGasSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Invoice ID <span className="text-error">*</span></label>
              <input
                type="text"
                name="invoiceId"
                className={`input input-bordered w-full${gasFormError.invoiceId ? ' is-invalid' : ''}`}
                placeholder="e.g. INV-001"
                maxLength={16}
                required
                value={gasForm.invoiceId}
                onChange={handleGasFormChange}
              />
              {gasFormError.invoiceId && <span className="helper-text">{gasFormError.invoiceId}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Amount <span className="text-error">*</span></label>
              <input
                type="number"
                name="amount"
                className={`input input-bordered w-full${gasFormError.amount ? ' is-invalid' : ''}`}
                placeholder="e.g. 500.00"
                min="0"
                step="0.01"
                required
                value={gasForm.amount}
                onChange={handleGasFormChange}
              />
              {gasFormError.amount && <span className="helper-text">{gasFormError.amount}</span>}
            </div>

            {canManageDocs && (
              <div className="sm:col-span-2 flex flex-col gap-1">
                <label className="label-text font-medium">
                  Document <span className="text-base-content/40 font-normal">(optional)</span>
                </label>
                <input
                  ref={gasFileRef}
                  type="file"
                  accept={ACCEPTED_EXTENSIONS}
                  className="hidden"
                  onChange={e => setGasFile(e.target.files?.[0] ?? null)}
                />
                <button
                  type="button"
                  className={`btn btn-outline w-full justify-start font-normal${gasFormError.file ? ' btn-error' : ''}`}
                  onClick={() => gasFileRef.current?.click()}
                >
                  <span className="icon-[tabler--paperclip] size-4"></span>
                  {gasFile ? gasFile.name : 'Choose file…'}
                </button>
                {gasFormError.file && <span className="helper-text">{gasFormError.file}</span>}
              </div>
            )}

            {gasFormError._general && (
              <div className="sm:col-span-2 alert alert-error py-2">
                <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                <span className="text-sm">{gasFormError._general}</span>
              </div>
            )}
          </div>
        </form>
      </Modal>
    </Layout>
  )
}
