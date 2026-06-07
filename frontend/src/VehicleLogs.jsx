import { useState, useEffect, useRef } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { useAuth } from './auth'
import { useModal } from './modals/index.js'
import Layout from './Layout'
import ModalNav from './modals/ModalNav.jsx'
import AnySchedulePickerModal from './AnySchedulePickerModal'
import EmployeePickerModal from './EmployeePickerModal'
import { notyfSuccess, notyfError } from './notyf'

const STATUS_OPTIONS = ['driving', 'completed']

const LOG_MENU_ITEMS = [
  { key: 'update', label: 'Update Log', icon: 'icon-[tabler--pencil]', roles: ['ADMIN', 'STAFF', 'CREW'] },
  { key: 'manage-gas-logs', label: 'Manage Gas Logs', icon: 'icon-[tabler--gas-station]', roles: ['ADMIN', 'STAFF', 'CREW'] },
]

const EMPTY_FORM = {
  purpose: '',
  schedId: '',
  _scheduleDisplay: '',
  destination: '',
  driverEmployeeId: '',
  odometerStart: '',
  odometerEnd: '',
  status: 'driving',
}

const EMPTY_GAS_FORM = { invoiceId: '', amount: '' }

const ACCEPTED_EXTENSIONS = '.jpg,.jpeg,.png,.gif,.webp,.pdf'
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']

/**
 * Parses a failed API response into field-level or general error object.
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

/** Returns badge class for log status */
function statusBadgeClass(status) {
  if (status === 'completed') return 'badge-success'
  if (status === 'driving')   return 'badge-info'
  return 'badge-neutral'
}

/** Formats a number as PHP currency */
function formatCurrency(value) {
  if (value == null) return '—'
  return Number(value).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })
}

const PAGE_SIZE = 10

/** Schedule picker pushed as a modal stack layer. */
function SchedulePickerLayer({ onSelect }) {
  const { popModal } = useModal()
  return (
    <AnySchedulePickerModal
      isOpen={true}
      onClose={popModal}
      onSelect={s => { popModal(); onSelect(s) }}
      asLayer={true}
    />
  )
}

/** Driver picker (Crew only) pushed as a modal stack layer. */
function DriverPickerLayer({ onSelect }) {
  const { popModal } = useModal()
  return (
    <EmployeePickerModal
      isOpen={true}
      onClose={popModal}
      onSelect={e => { popModal(); onSelect(e) }}
      position="Crew"
      asLayer={true}
    />
  )
}

/** Modal for adding a new vehicle log, including incomplete trip check on mount. */
function NewVehicleLogModal({ vehiclesId, vehicleLabel, onSuccess }) {
  const { popModal, pushModal } = useModal()
  const { apiFetch } = useAuth()
  const [checking, setChecking] = useState(true)
  const [incompleteLog, setIncompleteLog] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [driverLabel, setDriverLabel] = useState('')
  const [odoStartLocked, setOdoStartLocked] = useState(false)

  /** Check for ongoing trip and prefill odometer on mount. */
  useEffect(() => {
    let active = true
    async function check() {
      try {
        const res = await apiFetch(`/api/vehicle-logs/latest-incomplete?vehiclesId=${vehiclesId}`)
        if (!active) return
        if (res.status === 200) {
          setIncompleteLog(await res.json())
          return
        }
        let prefillOdo = ''
        const lastRes = await apiFetch(
          `/api/vehicle-logs?vehiclesId=${vehiclesId}&sort=addedOn,desc&size=1`
        )
        if (lastRes.ok) {
          const lastData = await lastRes.json()
          const lastLog = lastData.content?.[0]
          if (lastLog?.odometerEnd != null) prefillOdo = String(lastLog.odometerEnd)
        }
        if (!active) return
        setOdoStartLocked(prefillOdo !== '')
        setForm(prev => ({ ...prev, odometerStart: prefillOdo }))
      } finally {
        if (active) setChecking(false)
      }
    }
    check()
    return () => { active = false }
  }, [apiFetch, vehiclesId])

  function handleFormChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  /** Builds the POST request body from form state. */
  function buildBody(f) {
    return {
      vehiclesId,
      purpose:          f.purpose,
      schedId:          f.schedId ? Number(f.schedId) : null,
      destination:      f.destination,
      driverEmployeeId: f.driverEmployeeId ? Number(f.driverEmployeeId) : null,
      odometerStart:    f.odometerStart !== '' ? Number(f.odometerStart) : null,
      odometerEnd:      f.odometerEnd !== '' ? Number(f.odometerEnd) : null,
      status:           f.status,
    }
  }

  /** Submits the new vehicle log form. */
  async function handleSubmit(e) {
    e.preventDefault()
    setFormError({})
    setSubmitting(true)
    try {
      const res = await apiFetch('/api/vehicle-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildBody(form)),
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

  if (checking) {
    return (
      <div className="modal-content w-full max-w-lg my-auto">
        <div className="modal-body flex justify-center py-12">
          <span className="loading loading-spinner loading-md text-primary"></span>
        </div>
      </div>
    )
  }

  if (incompleteLog) {
    return (
      <div className="modal-content w-full max-w-sm my-auto">
        <div className="modal-header">
          <div>
            <h3 className="modal-title">Vehicle Still Out</h3>
            <span className="text-sm text-base-content/50">{vehicleLabel}</span>
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

  return (
    <div className="modal-content w-full max-w-lg my-auto">
      <div className="modal-header">
        <h3 className="modal-title">New Vehicle Log</h3>
        <button
          type="button"
          className="btn btn-text btn-circle btn-sm absolute end-3 top-3"
          onClick={popModal}
        >
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body">
        <form id="new-log-form" onSubmit={handleSubmit}>
          <LogFormFields
            form={form}
            formError={formError}
            onChange={handleFormChange}
            onSetForm={setForm}
            driverLabel={driverLabel}
            odoStartLocked={odoStartLocked}
            onOpenSchedulePicker={() => pushModal(
              <SchedulePickerLayer onSelect={s => {
                const display = `Sched #${s.schedId} · Project #${s.projNum} · ${s.date ?? '—'}`
                setForm(prev => ({ ...prev, schedId: String(s.schedId), _scheduleDisplay: display }))
              }} />
            )}
            onOpenDriverPicker={() => pushModal(
              <DriverPickerLayer onSelect={e => {
                setForm(prev => ({ ...prev, driverEmployeeId: String(e.employeeId) }))
                setDriverLabel(`${e.firstName} ${e.lastName} — ${e.position}`)
              }} />
            )}
          />
        </form>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-soft btn-secondary" onClick={popModal}>Cancel</button>
        <button type="submit" form="new-log-form" className="btn btn-primary" disabled={submitting}>
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

/** L1 manage panel for a vehicle log — shows details and action menu. */
function ManageLogModal({ log, onRefresh }) {
  const { pushModal, popModal } = useModal()
  const { hasRole } = useAuth()

  function handleAction(key) {
    if (key === 'update') pushModal(<UpdateLogModal log={log} onRefresh={onRefresh} />)
    if (key === 'manage-gas-logs') pushModal(<ManageGasLogsModal log={log} />)
  }

  return (
    <div className="modal-content w-full max-w-lg my-auto">
      <div className="modal-header">
        <div>
          <h3 className="modal-title">Log #{log.vehicleLogId}</h3>
          <span className="text-sm text-base-content/50">{log.vehicleModel} · {log.vehiclePlateNum}</span>
        </div>
        <button
          type="button"
          className="btn btn-text btn-circle btn-sm absolute end-3 top-3"
          onClick={popModal}
        >
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-base-content/50 uppercase tracking-wide">Vehicle</span>
            <span className="font-medium">{log.vehicleModel} ({log.vehiclePlateNum})</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-base-content/50 uppercase tracking-wide">Schedule</span>
            <span className="font-medium">{log.schedId != null ? `Sched #${log.schedId}` : '—'}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-base-content/50 uppercase tracking-wide">Purpose</span>
            <span className="font-medium">{log.purpose}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-base-content/50 uppercase tracking-wide">Driver</span>
            <span className="font-medium">{log.driverName}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-base-content/50 uppercase tracking-wide">Status</span>
            <span className={`badge badge-soft ${statusBadgeClass(log.status)} text-xs`}>
              {log.status.charAt(0).toUpperCase() + log.status.slice(1)}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-base-content/50 uppercase tracking-wide">Date</span>
            <span className="font-medium">{formatDate(log.addedOn)}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-base-content/50 uppercase tracking-wide">Odometer Start</span>
            <span className="font-medium">{log.odometerStart?.toLocaleString()} km</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-base-content/50 uppercase tracking-wide">Odometer End</span>
            <span className="font-medium">{log.odometerEnd != null ? `${log.odometerEnd?.toLocaleString()} km` : '—'}</span>
          </div>
          <div className="col-span-2 flex flex-col gap-0.5">
            <span className="text-xs text-base-content/50 uppercase tracking-wide">Destination</span>
            <span className="font-medium">{log.destination}</span>
          </div>
        </div>
        <ModalNav items={LOG_MENU_ITEMS} hasRole={hasRole} onSelect={handleAction} cols={4} />
      </div>
    </div>
  )
}

/** L2 modal for updating a vehicle log's details. */
function UpdateLogModal({ log, onRefresh }) {
  const { popModal, pushModal } = useModal()
  const { apiFetch } = useAuth()
  const [form, setForm] = useState({
    purpose:          log.purpose,
    schedId:          log.schedId != null ? String(log.schedId) : '',
    _scheduleDisplay: log.schedId ? `Sched #${log.schedId}` : '',
    destination:      log.destination,
    driverEmployeeId: String(log.driverEmployeeId),
    odometerStart:    String(log.odometerStart),
    odometerEnd:      log.odometerEnd != null ? String(log.odometerEnd) : '',
    status:           log.status,
  })
  const [formError, setFormError] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [driverLabel, setDriverLabel] = useState(log.driverName)

  function handleFormChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  /** Builds the PUT request body from form state. */
  function buildBody(f) {
    return {
      vehiclesId:       log.vehiclesId,
      purpose:          f.purpose,
      schedId:          f.schedId ? Number(f.schedId) : null,
      destination:      f.destination,
      driverEmployeeId: f.driverEmployeeId ? Number(f.driverEmployeeId) : null,
      odometerStart:    f.odometerStart !== '' ? Number(f.odometerStart) : null,
      odometerEnd:      f.odometerEnd !== '' ? Number(f.odometerEnd) : null,
      status:           f.status,
    }
  }

  /** Submits the update log form. */
  async function handleSubmit(e) {
    e.preventDefault()
    setFormError({})
    setSubmitting(true)
    try {
      const res = await apiFetch(`/api/vehicle-logs/${log.vehicleLogId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildBody(form)),
      })
      if (!res.ok) {
        setFormError(await parseApiError(res))
        notyfError('Update failed')
        return
      }
      popModal()
      setTimeout(() => notyfSuccess(`Log #${log.vehicleLogId} updated successfully.`), 150)
      onRefresh?.()
    } catch (err) {
      setFormError({ _general: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-content w-full max-w-lg my-auto">
      <div className="modal-header">
        <h3 className="modal-title">Update Log #{log.vehicleLogId}</h3>
        <button
          type="button"
          className="btn btn-text btn-circle btn-sm absolute end-3 top-3"
          onClick={popModal}
        >
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body">
        <form id="update-log-form" onSubmit={handleSubmit}>
          <LogFormFields
            form={form}
            formError={formError}
            onChange={handleFormChange}
            onSetForm={setForm}
            driverLabel={driverLabel}
            onOpenSchedulePicker={() => pushModal(
              <SchedulePickerLayer onSelect={s => {
                const display = `Sched #${s.schedId} · Project #${s.projNum} · ${s.date ?? '—'}`
                setForm(prev => ({ ...prev, schedId: String(s.schedId), _scheduleDisplay: display }))
              }} />
            )}
            onOpenDriverPicker={() => pushModal(
              <DriverPickerLayer onSelect={e => {
                setForm(prev => ({ ...prev, driverEmployeeId: String(e.employeeId) }))
                setDriverLabel(`${e.firstName} ${e.lastName} — ${e.position}`)
              }} />
            )}
          />
        </form>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-soft btn-secondary" onClick={popModal}>Cancel</button>
        <button type="submit" form="update-log-form" className="btn btn-primary" disabled={submitting}>
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

/** L2 modal — manage gas logs for a vehicle log. */
function ManageGasLogsModal({ log }) {
  const { pushModal, popModal } = useModal()
  const { apiFetch, hasRole } = useAuth()
  const [gasLogs, setGasLogs] = useState([])
  const [gasLoading, setGasLoading] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const canManageDocs = hasRole('ADMIN', 'STAFF')

  /** Fetches gas logs for this vehicle log. */
  useEffect(() => {
    let active = true
    setGasLoading(true)
    const params = new URLSearchParams({
      vehicleLogId: String(log.vehicleLogId),
      size: '100',
      sort: 'gasLogId,asc',
    })
    apiFetch(`/api/vehicle-gas-logs?${params}`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => { if (active) setGasLogs(data.content ?? []) })
      .catch(() => { if (active) setGasLogs([]) })
      .finally(() => { if (active) setGasLoading(false) })
    return () => { active = false }
  }, [apiFetch, log.vehicleLogId, refreshKey])

  function refresh() { setRefreshKey(k => k + 1) }

  return (
    <div className="modal-content w-full max-w-2xl my-auto">
      <div className="modal-header">
        <h3 className="modal-title">Gas Logs — Log #{log.vehicleLogId}</h3>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body flex flex-col gap-4">
        <div className="flex justify-end">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => pushModal(<AddGasLogModal vehicleLogId={log.vehicleLogId} onRefresh={refresh} />)}
          >
            <span className="icon-[tabler--plus] size-4"></span>
            Add Gas Log
          </button>
        </div>

        {gasLoading ? (
          <div className="flex justify-center py-6">
            <span className="loading loading-spinner loading-sm text-primary"></span>
          </div>
        ) : gasLogs.length === 0 ? (
          <div className="text-center py-6 text-base-content/40 text-sm">
            No gas logs linked to this vehicle log.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-box border border-base-300">
            <table className="table table-zebra table-sm w-full">
              <thead>
                <tr>
                  <th>Gas Log #</th>
                  <th>Invoice ID</th>
                  <th>Amount</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {gasLogs.map(g => (
                  <tr key={g.gasLogId}>
                    <td className="font-mono text-xs">{g.gasLogId}</td>
                    <td className="text-sm">{g.invoiceId}</td>
                    <td className="text-sm">{formatCurrency(g.amount)}</td>
                    <td>
                      <div className="flex gap-1 flex-wrap">
                        <button
                          className="btn btn-soft btn-primary btn-xs"
                          onClick={() => pushModal(<GasLogDetailsModal gasLog={g} />)}
                        >
                          <span className="icon-[tabler--info-circle] size-3"></span>
                          View
                        </button>
                        <button
                          className="btn btn-soft btn-secondary btn-xs"
                          onClick={() => pushModal(<UpdateGasLogModal gasLog={g} onRefresh={refresh} />)}
                        >
                          <span className="icon-[tabler--pencil] size-3"></span>
                          Update
                        </button>
                        {canManageDocs && (
                          g.docuId != null ? (
                            <button
                              className="btn btn-soft btn-warning btn-xs"
                              onClick={() => pushModal(<ReplaceGasFileModal gasLog={g} onRefresh={refresh} />)}
                            >
                              <span className="icon-[tabler--file-upload] size-3"></span>
                              Replace File
                            </button>
                          ) : (
                            <button
                              className="btn btn-soft btn-accent btn-xs"
                              onClick={() => pushModal(<ReplaceGasFileModal gasLog={g} onRefresh={refresh} />)}
                            >
                              <span className="icon-[tabler--paperclip] size-3"></span>
                              Attach File
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

/** L3 modal — view a single gas log's details with document preview. */
function GasLogDetailsModal({ gasLog }) {
  const { popModal } = useModal()
  const { apiFetch } = useAuth()
  const [docBlobUrl, setDocBlobUrl] = useState(null)
  const [docIsImage, setDocIsImage] = useState(false)
  const [docLoading, setDocLoading] = useState(false)
  const [docError, setDocError] = useState(null)

  useEffect(() => {
    if (!gasLog?.docuId) { setDocBlobUrl(null); setDocIsImage(false); return }
    let active = true
    let blobUrl = null
    setDocLoading(true)
    setDocError(null)
    apiFetch(`/api/documents/${gasLog.docuId}/file`)
      .then(async res => {
        if (!res.ok) throw new Error('Failed to load document')
        const contentType = res.headers.get('Content-Type') ?? ''
        const blob = await res.blob()
        if (!active) return
        blobUrl = URL.createObjectURL(blob)
        setDocBlobUrl(blobUrl)
        setDocIsImage(contentType.startsWith('image/'))
      })
      .catch(() => { if (active) setDocError('Could not load document.') })
      .finally(() => { if (active) setDocLoading(false) })
    return () => {
      active = false
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    }
  }, [gasLog?.docuId, apiFetch])

  return (
    <div className="modal-content w-full max-w-2xl my-auto">
      <div className="modal-header">
        <div>
          <h3 className="modal-title">Gas Log #{gasLog.gasLogId}</h3>
          <span className="text-sm text-base-content/50">Invoice: {gasLog.invoiceId}</span>
        </div>
        <button
          type="button"
          className="btn btn-text btn-circle btn-sm absolute end-3 top-3"
          aria-label="Close"
          onClick={popModal}
        >
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-base-content/50 uppercase tracking-wide">Gas Log ID</span>
            <span className="text-sm font-medium font-mono">{gasLog.gasLogId}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-base-content/50 uppercase tracking-wide">Vehicle Log ID</span>
            <span className="text-sm font-medium font-mono">{gasLog.vehicleLogId}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-base-content/50 uppercase tracking-wide">Invoice ID</span>
            <span className="text-sm font-medium">{gasLog.invoiceId}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-base-content/50 uppercase tracking-wide">Amount</span>
            <span className="text-sm font-medium text-primary">{formatCurrency(gasLog.amount)}</span>
          </div>
        </div>
        {gasLog.docuId != null ? (
          <div className="flex flex-col gap-2">
            <span className="text-xs text-base-content/50 uppercase tracking-wide">Document</span>
            {docLoading && (
              <div className="flex justify-center py-8">
                <span className="loading loading-spinner loading-sm text-primary"></span>
              </div>
            )}
            {docError && (
              <div className="alert alert-error py-2 text-sm">{docError}</div>
            )}
            {docBlobUrl && !docLoading && (
              docIsImage ? (
                <img
                  src={docBlobUrl}
                  alt="Document"
                  className="w-full rounded-box object-contain max-h-80 border border-base-300 bg-base-200"
                />
              ) : (
                <iframe
                  src={docBlobUrl}
                  title="Document preview"
                  className="w-full h-80 rounded-box border border-base-300"
                />
              )
            )}
          </div>
        ) : (
          <p className="text-sm text-base-content/40 italic">No document attached.</p>
        )}
      </div>
    </div>
  )
}

/** L3 modal — add a new gas log to a vehicle log. */
function AddGasLogModal({ vehicleLogId, onRefresh }) {
  const { popModal } = useModal()
  const { apiFetch, hasRole } = useAuth()
  const [form, setForm] = useState(EMPTY_GAS_FORM)
  const [formError, setFormError] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [file, setFile] = useState(null)
  const fileRef = useRef(null)
  const canManageDocs = hasRole('ADMIN', 'STAFF')

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  /** Submits the add gas log form, optionally uploading a document first. */
  async function handleSubmit(e) {
    e.preventDefault()
    setFormError({})
    setSubmitting(true)
    try {
      let docuId = null
      if (file) {
        const fd = new FormData()
        fd.append('file', file)
        const uploadRes = await apiFetch('/api/documents', { method: 'POST', body: fd })
        if (!uploadRes.ok) {
          setFormError(await parseApiError(uploadRes))
          notyfError('File upload failed')
          return
        }
        const docData = await uploadRes.json()
        docuId = docData.docuId
      }
      const res = await apiFetch('/api/vehicle-gas-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicleLogId, amount: Number(form.amount), invoiceId: form.invoiceId, docuId }),
      })
      if (!res.ok) {
        setFormError(await parseApiError(res))
        notyfError('Add gas log failed')
        return
      }
      notyfSuccess('Gas log added successfully.')
      popModal()
      onRefresh?.()
    } catch (err) {
      setFormError({ _general: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-content w-full max-w-sm my-auto">
      <div className="modal-header">
        <h3 className="modal-title">Add Gas Log</h3>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body">
        <form id="add-gas-log-form" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Invoice ID <span className="text-error">*</span></label>
              <input
                type="text"
                name="invoiceId"
                className={`input input-bordered w-full${formError.invoiceId ? ' is-invalid' : ''}`}
                placeholder="e.g. INV-001"
                maxLength={16}
                required
                value={form.invoiceId}
                onChange={handleChange}
              />
              {formError.invoiceId && <span className="helper-text">{formError.invoiceId}</span>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Amount <span className="text-error">*</span></label>
              <input
                type="number"
                name="amount"
                className={`input input-bordered w-full${formError.amount ? ' is-invalid' : ''}`}
                placeholder="e.g. 500.00"
                min="0"
                step="0.01"
                required
                value={form.amount}
                onChange={handleChange}
              />
              {formError.amount && <span className="helper-text">{formError.amount}</span>}
            </div>
            {canManageDocs && (
              <div className="flex flex-col gap-1">
                <label className="label-text font-medium">Document <span className="text-base-content/40 font-normal">(optional)</span></label>
                <input
                  ref={fileRef}
                  type="file"
                  accept={ACCEPTED_EXTENSIONS}
                  className="hidden"
                  onChange={e => setFile(e.target.files?.[0] ?? null)}
                />
                <button
                  type="button"
                  className={`btn btn-outline w-full justify-start font-normal${formError.file ? ' btn-error' : ''}`}
                  onClick={() => fileRef.current?.click()}
                >
                  <span className="icon-[tabler--paperclip] size-4"></span>
                  {file ? file.name : 'Choose file…'}
                </button>
                {formError.file && <span className="helper-text">{formError.file}</span>}
              </div>
            )}
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
        <button type="submit" form="add-gas-log-form" className="btn btn-primary" disabled={submitting}>
          {submitting
            ? <span className="loading loading-spinner loading-xs"></span>
            : <span className="icon-[tabler--plus] size-4"></span>
          }
          Add Gas Log
        </button>
      </div>
    </div>
  )
}

/** L3 modal — update an existing gas log. */
function UpdateGasLogModal({ gasLog, onRefresh }) {
  const { popModal } = useModal()
  const { apiFetch } = useAuth()
  const [form, setForm] = useState({ invoiceId: gasLog.invoiceId, amount: String(gasLog.amount) })
  const [formError, setFormError] = useState({})
  const [submitting, setSubmitting] = useState(false)

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  /** Submits the update gas log form. */
  async function handleSubmit(e) {
    e.preventDefault()
    setFormError({})
    setSubmitting(true)
    try {
      const res = await apiFetch(`/api/vehicle-gas-logs/${gasLog.gasLogId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleLogId: gasLog.vehicleLogId,
          amount:       Number(form.amount),
          invoiceId:    form.invoiceId,
          docuId:       gasLog.docuId ?? null,
        }),
      })
      if (!res.ok) {
        setFormError(await parseApiError(res))
        notyfError('Update failed')
        return
      }
      notyfSuccess(`Gas log #${gasLog.gasLogId} updated successfully.`)
      popModal()
      onRefresh?.()
    } catch (err) {
      setFormError({ _general: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-content w-full max-w-sm my-auto">
      <div className="modal-header">
        <div>
          <h3 className="modal-title">Update Gas Log #{gasLog.gasLogId}</h3>
          <span className="text-sm text-base-content/50">Invoice: {gasLog.invoiceId}</span>
        </div>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body">
        <form id="update-gas-log-form" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Invoice ID <span className="text-error">*</span></label>
              <input
                type="text"
                name="invoiceId"
                className={`input input-bordered w-full${formError.invoiceId ? ' is-invalid' : ''}`}
                maxLength={16}
                required
                value={form.invoiceId}
                onChange={handleChange}
              />
              {formError.invoiceId && <span className="helper-text">{formError.invoiceId}</span>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Amount <span className="text-error">*</span></label>
              <input
                type="number"
                name="amount"
                className={`input input-bordered w-full${formError.amount ? ' is-invalid' : ''}`}
                min="0"
                step="0.01"
                required
                value={form.amount}
                onChange={handleChange}
              />
              {formError.amount && <span className="helper-text">{formError.amount}</span>}
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
        <button type="submit" form="update-gas-log-form" className="btn btn-primary" disabled={submitting}>
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

/** L3 modal — replace or attach a document file to a gas log. */
function ReplaceGasFileModal({ gasLog, onRefresh }) {
  const { popModal } = useModal()
  const { apiFetch } = useAuth()
  const [file, setFile] = useState(null)
  const [formError, setFormError] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const fileRef = useRef(null)

  /** Uploads a new document then links it to the gas log. */
  async function handleSubmit(e) {
    e.preventDefault()
    if (!file) { setFormError({ file: 'Please select a file.' }); return }
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setFormError({ file: 'File must be an image (JPG/PNG/GIF/WebP) or PDF.' })
      return
    }
    setFormError({})
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const uploadRes = await apiFetch('/api/documents', { method: 'POST', body: fd })
      if (!uploadRes.ok) {
        setFormError(await parseApiError(uploadRes))
        notyfError('File upload failed')
        return
      }
      const docData = await uploadRes.json()
      const updateRes = await apiFetch(`/api/vehicle-gas-logs/${gasLog.gasLogId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleLogId: gasLog.vehicleLogId,
          amount:       gasLog.amount,
          invoiceId:    gasLog.invoiceId,
          docuId:       docData.docuId,
        }),
      })
      if (!updateRes.ok) {
        setFormError(await parseApiError(updateRes))
        notyfError('Link document failed')
        return
      }
      notyfSuccess(`Gas log #${gasLog.gasLogId} document replaced successfully.`)
      popModal()
      onRefresh?.()
    } catch (err) {
      setFormError({ _general: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-content w-full max-w-sm my-auto">
      <div className="modal-header">
        <div>
          <h3 className="modal-title">
            {gasLog.docuId != null ? 'Replace File' : 'Attach File'} — Gas Log #{gasLog.gasLogId}
          </h3>
          <span className="text-sm text-base-content/50">Invoice: {gasLog.invoiceId}</span>
        </div>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body">
        <form id="replace-gas-file-form" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">File <span className="text-error">*</span></label>
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPTED_EXTENSIONS}
                className="hidden"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                className={`btn btn-outline w-full justify-start font-normal${formError.file ? ' btn-error' : ''}`}
                onClick={() => fileRef.current?.click()}
              >
                <span className="icon-[tabler--paperclip] size-4"></span>
                {file ? file.name : 'Choose file…'}
              </button>
              {formError.file && <span className="helper-text">{formError.file}</span>}
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
        <button type="submit" form="replace-gas-file-form" className="btn btn-primary" disabled={submitting}>
          {submitting
            ? <span className="loading loading-spinner loading-sm"></span>
            : <span className="icon-[tabler--upload] size-4"></span>
          }
          Upload
        </button>
      </div>
    </div>
  )
}

export default function VehicleLogs() {
  const { apiFetch, hasRole } = useAuth()
  const { pushModal } = useModal()
  const { vehiclesId } = useParams()
  const location = useLocation()
  const vehiclesIdInt = Number(vehiclesId)
  const vehicleLabel = location.state?.vehicleModel ?? 'Vehicle'

  const [logs, setLogs]                   = useState([])
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState(null)
  const [search, setSearch]               = useState('')
  const [page, setPage]                   = useState(0)
  const [totalPages, setTotalPages]       = useState(0)
  const [totalElements, setTotalElements] = useState(0)
  const [refreshKey, setRefreshKey]       = useState(0)

  const canEdit = hasRole('ADMIN', 'STAFF', 'CREW')

  /** Fetches vehicle logs filtered by vehicle ID. */
  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({
      vehiclesId: String(vehiclesIdInt),
      page: String(page),
      size: String(PAGE_SIZE),
      sort: 'addedOn,desc',
    })
    apiFetch(`/api/vehicle-logs?${params}`)
      .then(res => {
        if (!res.ok) throw new Error(`Failed to load vehicle logs (${res.status})`)
        return res.json()
      })
      .then(data => {
        if (!active) return
        setLogs(data.content ?? [])
        setTotalPages(data.totalPages ?? 0)
        setTotalElements(data.totalElements ?? 0)
      })
      .catch(err => { if (active) setError(err.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [apiFetch, page, vehiclesIdInt, refreshKey])

  const filtered = logs.filter(l => {
    if (search === '') return true
    const q = search.toLowerCase()
    return (
      String(l.vehicleLogId).includes(q) ||
      l.purpose.toLowerCase().includes(q) ||
      (l.schedId != null && String(l.schedId).includes(q)) ||
      l.destination.toLowerCase().includes(q)
    )
  })

  return (
    <Layout activePage="vehicles">
      {/* Header row */}
      <div className="flex items-stretch justify-between h-16 mb-6">
        <div>
          <h1 className="text-3xl font-semibold">Vehicle Logs — {vehicleLabel}</h1>
          <p className="text-base-content/60 mt-1">Trip records for this vehicle</p>
        </div>
        <div className="flex gap-2 items-center h-full">
          {canEdit && (
            <button
              type="button"
              className="btn btn-primary h-full min-h-0"
              onClick={() => pushModal(<NewVehicleLogModal vehiclesId={vehiclesIdInt} vehicleLabel={vehicleLabel} onSuccess={() => { setPage(0); setRefreshKey(k => k + 1) }} />)}
            >
              <span className="icon-[tabler--plus] size-4"></span>
              New Log
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
            placeholder="Search by log #, purpose, schedule #, or destination..."
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
            {totalElements} log{totalElements !== 1 ? 's' : ''} total
            {search && ` · ${filtered.length} shown`}
          </p>

          {filtered.length === 0 ? (
            <div className="text-center py-20 text-base-content/40">
              <span className="icon-[tabler--road-off] size-12 mx-auto mb-3 block"></span>
              <p>No vehicle logs found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
              <table className="table table-zebra w-full">
                <thead>
                  <tr>
                    <th>Log #</th>
                    <th>Vehicle</th>
                    <th>Purpose</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(l => (
                    <tr key={l.vehicleLogId}>
                      <td className="font-mono font-semibold">{l.vehicleLogId}</td>
                      <td className="max-w-[160px]">
                        <p className="line-clamp-2 text-sm leading-snug">
                          <span className="font-medium">{l.vehicleModel}</span>
                          <span className="text-base-content/50"> · </span>
                          <span className="font-mono">{l.vehiclePlateNum}</span>
                        </p>
                      </td>
                      <td>{l.purpose}</td>
                      <td className="text-sm text-base-content/70">{formatDate(l.addedOn)}</td>
                      <td>
                        <span className={`badge badge-soft ${statusBadgeClass(l.status)} text-xs`}>
                          {l.status.charAt(0).toUpperCase() + l.status.slice(1)}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn-soft btn-primary btn-sm"
                          onClick={() => pushModal(<ManageLogModal log={l} onRefresh={() => setRefreshKey(k => k + 1)} />)}
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
    </Layout>
  )
}

/** Shared form fields used by both add and edit log modals. */
function LogFormFields({ form, formError, onChange, onSetForm, driverLabel, odoStartLocked, onOpenSchedulePicker, onOpenDriverPicker }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

      <div className="sm:col-span-2 flex flex-col gap-1">
        <label className="label-text font-medium">Purpose <span className="text-error">*</span></label>
        <input
          type="text"
          name="purpose"
          maxLength={30}
          required
          className={`input input-bordered w-full${formError.purpose ? ' is-invalid' : ''}`}
          placeholder="e.g. Material Delivery"
          value={form.purpose}
          onChange={onChange}
        />
        {formError.purpose && <span className="helper-text">{formError.purpose}</span>}
      </div>

      <div className="sm:col-span-2 flex flex-col gap-1">
        <label className="label-text font-medium">Schedule <span className="text-base-content/40 font-normal">(optional)</span></label>
        <div className={`input input-bordered w-full flex items-center justify-between gap-2${formError.schedId ? ' is-invalid' : ''}`}>
          <span className={`text-sm truncate ${form._scheduleDisplay ? '' : 'text-base-content/40'}`}>
            {form._scheduleDisplay || 'No schedule linked'}
          </span>
          <div className="flex gap-1 shrink-0">
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={onOpenSchedulePicker}
            >
              {form._scheduleDisplay ? 'Change' : 'Select'}
            </button>
            {form._scheduleDisplay && (
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={() => onSetForm(prev => ({ ...prev, schedId: '', _scheduleDisplay: '' }))}
              >
                Clear
              </button>
            )}
          </div>
        </div>
        {formError.schedId && <span className="helper-text">{formError.schedId}</span>}
      </div>

      <div className="sm:col-span-2 flex flex-col gap-1">
        <label className="label-text font-medium">Destination <span className="text-error">*</span></label>
        <input
          type="text"
          name="destination"
          maxLength={255}
          required
          className={`input input-bordered w-full${formError.destination ? ' is-invalid' : ''}`}
          placeholder="e.g. 123 Ayala Ave, Makati City"
          value={form.destination}
          onChange={onChange}
        />
        {formError.destination && <span className="helper-text">{formError.destination}</span>}
      </div>

      <div className="sm:col-span-2 flex flex-col gap-1">
        <label className="label-text font-medium">Driver <span className="text-error">*</span></label>
        <div className={`input input-bordered w-full flex items-center justify-between gap-2${formError.driverEmployeeId ? ' is-invalid' : ''}`}>
          <span className={`text-sm truncate ${driverLabel ? '' : 'text-base-content/40'}`}>
            {driverLabel || 'No driver selected'}
          </span>
          <button
            type="button"
            className="btn btn-sm btn-secondary shrink-0"
            onClick={onOpenDriverPicker}
          >
            {driverLabel ? 'Change' : 'Select'}
          </button>
        </div>
        {formError.driverEmployeeId && <span className="helper-text">{formError.driverEmployeeId}</span>}
      </div>

      <div className="flex flex-col gap-1">
        <label className="label-text font-medium">
          Odometer Start (km) <span className="text-error">*</span>
          {odoStartLocked && (
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
          readOnly={odoStartLocked}
          className={`input input-bordered w-full${odoStartLocked ? ' bg-base-200 cursor-not-allowed' : ''}${formError.odometerStart ? ' is-invalid' : ''}`}
          placeholder="e.g. 12500"
          value={form.odometerStart}
          onChange={odoStartLocked ? undefined : onChange}
        />
        {formError.odometerStart && <span className="helper-text">{formError.odometerStart}</span>}
      </div>

      <div className="flex flex-col gap-1">
        <label className="label-text font-medium">Odometer End (km)</label>
        <input
          type="number"
          name="odometerEnd"
          min={0}
          className={`input input-bordered w-full${formError.odometerEnd ? ' is-invalid' : ''}`}
          placeholder="Leave blank if still driving"
          value={form.odometerEnd}
          onChange={onChange}
        />
        {formError.odometerEnd && <span className="helper-text">{formError.odometerEnd}</span>}
      </div>

      <div className="flex flex-col gap-1">
        <label className="label-text font-medium">Status</label>
        <select
          name="status"
          className={`select select-bordered w-full${formError.status ? ' is-invalid' : ''}`}
          value={form.status}
          onChange={onChange}
        >
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
  )
}
