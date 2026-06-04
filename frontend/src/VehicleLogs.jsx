import { useState, useEffect, useRef } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { useAuth } from './auth'
import Layout from './Layout'
import Modal from './Modal'
import ManageMenu from './ManageMenu'
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

/** Modal for viewing gas log details with inline document preview. */
function GasLogDetailsModal({ gasLog, onClose, apiFetch }) {
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

  if (!gasLog) return null
  return (
    <>
      <div className="fixed inset-0 bg-base-300/40 z-[55]" onClick={onClose} />
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div className="modal-content w-full max-w-2xl shadow-xl">
          <div className="modal-header">
            <div>
              <h3 className="modal-title">Gas Log #{gasLog.gasLogId}</h3>
              <span className="text-sm text-base-content/50">Invoice: {gasLog.invoiceId}</span>
            </div>
            <button
              type="button"
              className="btn btn-text btn-circle btn-sm absolute end-3 top-3"
              aria-label="Close"
              onClick={onClose}
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
      </div>
    </>
  )
}

export default function VehicleLogs() {
  const { apiFetch, hasRole } = useAuth()
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

  // Add modal
  const [modalOpen, setModalOpen]         = useState(false)
  const [form, setForm]                   = useState(EMPTY_FORM)
  const [formError, setFormError]         = useState({})
  const [submitting, setSubmitting]       = useState(false)
  const [checkingIncomplete, setCheckingIncomplete] = useState(false)
  const [incompleteLog, setIncompleteLog] = useState(null)
  const [odoStartLocked, setOdoStartLocked] = useState(false)

  // Manage menu
  const [selectedLog, setSelectedLog] = useState(null)

  // Edit modal
  const [editModalOpen, setEditModalOpen]   = useState(false)
  const [editingLog, setEditingLog]         = useState(null)
  const [editForm, setEditForm]             = useState(EMPTY_FORM)
  const [editFormError, setEditFormError]   = useState({})
  const [editSubmitting, setEditSubmitting] = useState(false)

  // Picker state — shared between add and edit, pickerFor tracks which form is active
  const [pickerFor, setPickerFor]               = useState(null) // 'add' | 'edit'
  const [schedulePickerOpen, setSchedulePickerOpen] = useState(false)
  const [driverPickerOpen, setDriverPickerOpen] = useState(false)
  const [addDriverLabel, setAddDriverLabel]     = useState('')
  const [editDriverLabel, setEditDriverLabel]   = useState('')

  // Manage Gas Logs modal
  const [manageGasLogsOpen, setManageGasLogsOpen]       = useState(false)
  const [manageGasLogsLog, setManageGasLogsLog]         = useState(null)
  const [gasLogs, setGasLogs]                           = useState([])
  const [gasLogsLoading, setGasLogsLoading]             = useState(false)
  const [gasLogsRefresh, setGasLogsRefresh]             = useState(0)
  const [addGasLogOpen, setAddGasLogOpen]               = useState(false)
  const [gasLogForm, setGasLogForm]                     = useState(EMPTY_GAS_FORM)
  const [gasLogFormError, setGasLogFormError]           = useState({})
  const [gasLogFormSubmitting, setGasLogFormSubmitting] = useState(false)

  // Update gas log sub-modal
  const [updateGasLogOpen, setUpdateGasLogOpen]             = useState(false)
  const [updatingGasLog, setUpdatingGasLog]                 = useState(null)
  const [updateGasLogForm, setUpdateGasLogForm]             = useState(EMPTY_GAS_FORM)
  const [updateGasLogFormError, setUpdateGasLogFormError]   = useState({})
  const [updateGasLogSubmitting, setUpdateGasLogSubmitting] = useState(false)

  // View gas log details sub-modal
  const [viewGasLog, setViewGasLog] = useState(null)

  // Replace gas log file sub-modal
  const [replaceGasFileOpen, setReplaceGasFileOpen]         = useState(false)
  const [replaceGasTarget, setReplaceGasTarget]             = useState(null)
  const [replaceGasFile, setReplaceGasFile]                 = useState(null)
  const [replaceGasFileError, setReplaceGasFileError]       = useState({})
  const [replaceGasFileSubmitting, setReplaceGasFileSubmitting] = useState(false)
  const replaceGasFileRef = useRef(null)

  // Add gas log file (optional)
  const addGasFileRef = useRef(null)
  const [addGasFile, setAddGasFile] = useState(null)

  const canEdit     = hasRole('ADMIN', 'STAFF', 'CREW')
  const canManageDocs = hasRole('ADMIN', 'STAFF')

  function openSchedulePicker(forForm) {
    setPickerFor(forForm)
    setSchedulePickerOpen(true)
  }

  function openDriverPicker(forForm) {
    setPickerFor(forForm)
    setDriverPickerOpen(true)
  }

  function handleScheduleSelect(schedule) {
    setSchedulePickerOpen(false)
    const display = `Sched #${schedule.schedId} · Project #${schedule.projNum} · ${schedule.date ?? '—'}`
    if (pickerFor === 'add') {
      setForm(prev => ({ ...prev, schedId: String(schedule.schedId), _scheduleDisplay: display }))
    } else {
      setEditForm(prev => ({ ...prev, schedId: String(schedule.schedId), _scheduleDisplay: display }))
    }
  }

  function handleDriverSelect(employee) {
    setDriverPickerOpen(false)
    const label = `${employee.firstName} ${employee.lastName} — ${employee.position}`
    if (pickerFor === 'add') {
      setForm(prev => ({ ...prev, driverEmployeeId: String(employee.employeeId) }))
      setAddDriverLabel(label)
    } else {
      setEditForm(prev => ({ ...prev, driverEmployeeId: String(employee.employeeId) }))
      setEditDriverLabel(label)
    }
  }

  /** Checks for an ongoing trip before opening the new log form. */
  async function openModal() {
    setCheckingIncomplete(true)
    try {
      const res = await apiFetch(`/api/vehicle-logs/latest-incomplete?vehiclesId=${vehiclesIdInt}`)
      if (res.status === 200) {
        setIncompleteLog(await res.json())
        return
      }
      // No incomplete log — prefill odometerStart from last completed log
      let prefillOdo = ''
      const lastRes = await apiFetch(
        `/api/vehicle-logs?vehiclesId=${vehiclesIdInt}&sort=addedOn,desc&size=1`
      )
      if (lastRes.ok) {
        const lastData = await lastRes.json()
        const lastLog = lastData.content?.[0]
        if (lastLog?.odometerEnd != null) prefillOdo = String(lastLog.odometerEnd)
      }
      setOdoStartLocked(prefillOdo !== '')
      setForm({ ...EMPTY_FORM, odometerStart: prefillOdo })
      setFormError({})
      setAddDriverLabel('')
      setModalOpen(true)
    } finally {
      setCheckingIncomplete(false)
    }
  }

  function closeModal() {
    setModalOpen(false)
    setForm(EMPTY_FORM)
    setFormError({})
    setAddDriverLabel('')
    setOdoStartLocked(false)
  }

  /** Opens the edit modal pre-populated with the given log's data. */
  function openEditModal(log) {
    const schedDisplay = log.schedId
      ? `Sched #${log.schedId}`
      : ''
    setEditForm({
      purpose:          log.purpose,
      schedId:          log.schedId != null ? String(log.schedId) : '',
      _scheduleDisplay: schedDisplay,
      destination:      log.destination,
      driverEmployeeId: String(log.driverEmployeeId),
      odometerStart:    String(log.odometerStart),
      odometerEnd:      log.odometerEnd != null ? String(log.odometerEnd) : '',
      status:           log.status,
    })
    setEditDriverLabel(log.driverName)
    setEditingLog(log)
    setEditFormError({})
    setEditModalOpen(true)
  }

  function closeEditModal() {
    setEditModalOpen(false)
    setEditingLog(null)
    setEditForm(EMPTY_FORM)
    setEditFormError({})
    setEditDriverLabel('')
  }

  function handleFormChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  function handleEditFormChange(e) {
    const { name, value } = e.target
    setEditForm(prev => ({ ...prev, [name]: value }))
  }

  // — Manage Gas Logs —

  function openManageGasLogs(log) {
    setManageGasLogsLog(log)
    setGasLogsRefresh(0)
    setAddGasLogOpen(false)
    setGasLogForm(EMPTY_GAS_FORM)
    setGasLogFormError({})
    setAddGasFile(null)
    setManageGasLogsOpen(true)
  }

  function closeManageGasLogs() {
    setManageGasLogsOpen(false)
    setManageGasLogsLog(null)
    setGasLogs([])
    setAddGasLogOpen(false)
    setGasLogForm(EMPTY_GAS_FORM)
    setGasLogFormError({})
    setAddGasFile(null)
  }

  function handleGasLogFormChange(e) {
    const { name, value } = e.target
    setGasLogForm(prev => ({ ...prev, [name]: value }))
  }

  function openUpdateGasLog(g) {
    setUpdateGasLogForm({ invoiceId: g.invoiceId, amount: String(g.amount) })
    setUpdatingGasLog(g)
    setUpdateGasLogFormError({})
    setUpdateGasLogOpen(true)
  }

  function closeUpdateGasLog() {
    setUpdateGasLogOpen(false)
    setUpdatingGasLog(null)
    setUpdateGasLogForm(EMPTY_GAS_FORM)
    setUpdateGasLogFormError({})
  }

  function handleUpdateGasLogFormChange(e) {
    const { name, value } = e.target
    setUpdateGasLogForm(prev => ({ ...prev, [name]: value }))
  }

  function openReplaceGasFile(g) {
    setReplaceGasTarget(g)
    setReplaceGasFile(null)
    setReplaceGasFileError({})
    setReplaceGasFileOpen(true)
  }

  function closeReplaceGasFile() {
    setReplaceGasFileOpen(false)
    setReplaceGasTarget(null)
    setReplaceGasFile(null)
    setReplaceGasFileError({})
  }

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

  /** Fetches gas logs for the selected vehicle log. */
  useEffect(() => {
    if (!manageGasLogsOpen || !manageGasLogsLog) { setGasLogs([]); return }
    let active = true
    setGasLogsLoading(true)
    const params = new URLSearchParams({
      vehicleLogId: String(manageGasLogsLog.vehicleLogId),
      size: '100',
      sort: 'gasLogId,asc',
    })
    apiFetch(`/api/vehicle-gas-logs?${params}`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => { if (active) setGasLogs(data.content ?? []) })
      .catch(() => { if (active) setGasLogs([]) })
      .finally(() => { if (active) setGasLogsLoading(false) })
    return () => { active = false }
  }, [apiFetch, manageGasLogsOpen, manageGasLogsLog, gasLogsRefresh])

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

  /** Builds the request body from a form state object. */
  function buildBody(f) {
    return {
      vehiclesId:       vehiclesIdInt,
      purpose:          f.purpose,
      schedId:          f.schedId ? Number(f.schedId) : null,
      destination:      f.destination,
      driverEmployeeId: f.driverEmployeeId ? Number(f.driverEmployeeId) : null,
      odometerStart:    f.odometerStart !== '' ? Number(f.odometerStart) : null,
      odometerEnd:      f.odometerEnd !== '' ? Number(f.odometerEnd) : null,
      status:           f.status,
    }
  }

  /** Submits the new log form. */
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
      closeModal()
      setTimeout(() => notyfSuccess(`Log #${data.vehicleLogId} added successfully.`), 150)
      setPage(0)
      setRefreshKey(k => k + 1)
    } catch (err) {
      setFormError({ _general: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  /** Submits the update log form. */
  async function handleUpdate(e) {
    e.preventDefault()
    setEditFormError({})
    setEditSubmitting(true)
    try {
      const res = await apiFetch(`/api/vehicle-logs/${editingLog.vehicleLogId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildBody(editForm)),
      })
      if (!res.ok) {
        setEditFormError(await parseApiError(res))
        notyfError('Update failed')
        return
      }
      closeEditModal()
      setTimeout(() => notyfSuccess(`Log #${editingLog.vehicleLogId} updated successfully.`), 150)
      setRefreshKey(k => k + 1)
    } catch (err) {
      setEditFormError({ _general: err.message })
    } finally {
      setEditSubmitting(false)
    }
  }

  /** Submits the add gas log form, optionally uploading a document first. */
  async function handleAddGasLogSubmit(e) {
    e.preventDefault()
    setGasLogFormError({})
    setGasLogFormSubmitting(true)
    try {
      let docuId = null
      if (addGasFile) {
        const fd = new FormData()
        fd.append('file', addGasFile)
        const uploadRes = await apiFetch('/api/documents', { method: 'POST', body: fd })
        if (!uploadRes.ok) {
          setGasLogFormError(await parseApiError(uploadRes))
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
          vehicleLogId: manageGasLogsLog.vehicleLogId,
          amount:       Number(gasLogForm.amount),
          invoiceId:    gasLogForm.invoiceId,
          docuId,
        }),
      })
      if (!res.ok) {
        setGasLogFormError(await parseApiError(res))
        notyfError('Add gas log failed')
        return
      }
      setAddGasLogOpen(false)
      setGasLogForm(EMPTY_GAS_FORM)
      setGasLogFormError({})
      setAddGasFile(null)
      notyfSuccess('Gas log added successfully.')
      setGasLogsRefresh(k => k + 1)
    } catch (err) {
      setGasLogFormError({ _general: err.message })
    } finally {
      setGasLogFormSubmitting(false)
    }
  }

  /** Submits the update gas log form. */
  async function handleUpdateGasLogSubmit(e) {
    e.preventDefault()
    setUpdateGasLogFormError({})
    setUpdateGasLogSubmitting(true)
    try {
      const res = await apiFetch(`/api/vehicle-gas-logs/${updatingGasLog.gasLogId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleLogId: updatingGasLog.vehicleLogId,
          amount:       Number(updateGasLogForm.amount),
          invoiceId:    updateGasLogForm.invoiceId,
          docuId:       updatingGasLog.docuId ?? null,
        }),
      })
      if (!res.ok) {
        setUpdateGasLogFormError(await parseApiError(res))
        notyfError('Update failed')
        return
      }
      closeUpdateGasLog()
      notyfSuccess(`Gas log #${updatingGasLog.gasLogId} updated successfully.`)
      setGasLogsRefresh(k => k + 1)
    } catch (err) {
      setUpdateGasLogFormError({ _general: err.message })
    } finally {
      setUpdateGasLogSubmitting(false)
    }
  }

  /** Uploads a new document file then links it to the gas log. */
  async function handleReplaceGasFileSubmit(e) {
    e.preventDefault()
    if (!replaceGasFile) {
      setReplaceGasFileError({ file: 'Please select a file.' })
      return
    }
    if (!ACCEPTED_TYPES.includes(replaceGasFile.type)) {
      setReplaceGasFileError({ file: 'File must be an image (JPG/PNG/GIF/WebP) or PDF.' })
      return
    }
    setReplaceGasFileError({})
    setReplaceGasFileSubmitting(true)
    try {
      // Step 1: upload new document
      const fd = new FormData()
      fd.append('file', replaceGasFile)
      const uploadRes = await apiFetch('/api/documents', { method: 'POST', body: fd })
      if (!uploadRes.ok) {
        setReplaceGasFileError(await parseApiError(uploadRes))
        notyfError('File upload failed')
        return
      }
      const docData = await uploadRes.json()
      const newDocuId = docData.docuId

      // Step 2: update gas log with new docuId
      const updateRes = await apiFetch(`/api/vehicle-gas-logs/${replaceGasTarget.gasLogId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleLogId: replaceGasTarget.vehicleLogId,
          amount:       replaceGasTarget.amount,
          invoiceId:    replaceGasTarget.invoiceId,
          docuId:       newDocuId,
        }),
      })
      if (!updateRes.ok) {
        setReplaceGasFileError(await parseApiError(updateRes))
        notyfError('Link document failed')
        return
      }
      closeReplaceGasFile()
      notyfSuccess(`Gas log #${replaceGasTarget.gasLogId} document replaced successfully.`)
      setGasLogsRefresh(k => k + 1)
    } catch (err) {
      setReplaceGasFileError({ _general: err.message })
    } finally {
      setReplaceGasFileSubmitting(false)
    }
  }

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
              onClick={openModal}
              disabled={checkingIncomplete}
            >
              {checkingIncomplete
                ? <span className="loading loading-spinner loading-sm"></span>
                : <span className="icon-[tabler--plus] size-4"></span>
              }
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
                          onClick={() => setSelectedLog(l)}
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

      {/* Log Manage Menu */}
      <ManageMenu
        title={selectedLog ? `Log #${selectedLog.vehicleLogId}` : ''}
        subtitle={selectedLog ? `${selectedLog.vehicleModel} · ${selectedLog.vehiclePlateNum}` : ''}
        item={selectedLog}
        details={selectedLog ? [
          { label: 'Vehicle',        value: `${selectedLog.vehicleModel} (${selectedLog.vehiclePlateNum})` },
          { label: 'Schedule',       value: selectedLog.schedId != null ? `Sched #${selectedLog.schedId}` : '—' },
          { label: 'Purpose',        value: selectedLog.purpose },
          { label: 'Driver',         value: selectedLog.driverName },
          { label: 'Status',         value: selectedLog.status.charAt(0).toUpperCase() + selectedLog.status.slice(1) },
          { label: 'Date',           value: formatDate(selectedLog.addedOn) },
          { label: 'Odometer Start', value: `${selectedLog.odometerStart?.toLocaleString()} km` },
          { label: 'Odometer End',   value: selectedLog.odometerEnd != null ? `${selectedLog.odometerEnd?.toLocaleString()} km` : '—' },
          { label: 'Destination',    value: selectedLog.destination, fullWidth: true },
        ] : []}
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        hasRole={hasRole}
        menuItems={LOG_MENU_ITEMS}
        onMenuSelect={(key, log) => {
          setSelectedLog(null)
          if (key === 'update') openEditModal(log)
          if (key === 'manage-gas-logs') openManageGasLogs(log)
        }}
      />

      {/* Manage Gas Logs Modal */}
      <Modal
        isOpen={manageGasLogsOpen}
        onClose={addGasLogOpen ? undefined : closeManageGasLogs}
        hideClose={addGasLogOpen}
        title={`Gas Logs — Log #${manageGasLogsLog?.vehicleLogId ?? ''}`}
        size="max-w-2xl"
        footer={!addGasLogOpen && (
          <button type="button" className="btn btn-soft btn-secondary" onClick={closeManageGasLogs}>
            Close
          </button>
        )}
      >
        {addGasLogOpen ? (
          <form onSubmit={handleAddGasLogSubmit}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">

              <div className="flex flex-col gap-1">
                <label className="label-text font-medium">Invoice ID <span className="text-error">*</span></label>
                <input
                  type="text"
                  name="invoiceId"
                  className={`input input-bordered w-full${gasLogFormError.invoiceId ? ' is-invalid' : ''}`}
                  placeholder="e.g. INV-001"
                  maxLength={16}
                  required
                  value={gasLogForm.invoiceId}
                  onChange={handleGasLogFormChange}
                />
                {gasLogFormError.invoiceId && <span className="helper-text">{gasLogFormError.invoiceId}</span>}
              </div>

              <div className="flex flex-col gap-1">
                <label className="label-text font-medium">Amount <span className="text-error">*</span></label>
                <input
                  type="number"
                  name="amount"
                  className={`input input-bordered w-full${gasLogFormError.amount ? ' is-invalid' : ''}`}
                  placeholder="e.g. 500.00"
                  min="0"
                  step="0.01"
                  required
                  value={gasLogForm.amount}
                  onChange={handleGasLogFormChange}
                />
                {gasLogFormError.amount && <span className="helper-text">{gasLogFormError.amount}</span>}
              </div>

              {canManageDocs && (
                <div className="sm:col-span-2 flex flex-col gap-1">
                  <label className="label-text font-medium">Document <span className="text-base-content/40 font-normal">(optional)</span></label>
                  <input
                    ref={addGasFileRef}
                    type="file"
                    accept={ACCEPTED_EXTENSIONS}
                    className="hidden"
                    onChange={e => setAddGasFile(e.target.files?.[0] ?? null)}
                  />
                  <button
                    type="button"
                    className={`btn btn-outline w-full justify-start font-normal${gasLogFormError.file ? ' btn-error' : ''}`}
                    onClick={() => addGasFileRef.current?.click()}
                  >
                    <span className="icon-[tabler--paperclip] size-4"></span>
                    {addGasFile ? addGasFile.name : 'Choose file…'}
                  </button>
                  {gasLogFormError.file && <span className="helper-text">{gasLogFormError.file}</span>}
                </div>
              )}

              {gasLogFormError._general && (
                <div className="sm:col-span-2 alert alert-error py-2">
                  <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                  <span className="text-sm">{gasLogFormError._general}</span>
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                className="btn btn-soft btn-secondary btn-sm"
                onClick={() => { setAddGasLogOpen(false); setGasLogForm(EMPTY_GAS_FORM); setGasLogFormError({}); setAddGasFile(null) }}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={gasLogFormSubmitting}>
                {gasLogFormSubmitting
                  ? <span className="loading loading-spinner loading-xs"></span>
                  : <span className="icon-[tabler--plus] size-4"></span>
                }
                Add Gas Log
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="flex justify-end mb-3">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => { setGasLogForm(EMPTY_GAS_FORM); setGasLogFormError({}); setAddGasFile(null); setAddGasLogOpen(true) }}
              >
                <span className="icon-[tabler--plus] size-4"></span>
                Add Gas Log
              </button>
            </div>

            {gasLogsLoading ? (
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
                              onClick={() => setViewGasLog(g)}
                            >
                              <span className="icon-[tabler--info-circle] size-3"></span>
                              View
                            </button>
                            <button
                              className="btn btn-soft btn-secondary btn-xs"
                              onClick={() => openUpdateGasLog(g)}
                            >
                              <span className="icon-[tabler--pencil] size-3"></span>
                              Update
                            </button>
                            {canManageDocs && (
                              g.docuId != null ? (
                                <button
                                  className="btn btn-soft btn-warning btn-xs"
                                  onClick={() => openReplaceGasFile(g)}
                                >
                                  <span className="icon-[tabler--file-upload] size-3"></span>
                                  Replace File
                                </button>
                              ) : (
                                <button
                                  className="btn btn-soft btn-accent btn-xs"
                                  onClick={() => openReplaceGasFile(g)}
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
          </>
        )}
      </Modal>

      {/* View Gas Log Details Sub-modal */}
      <GasLogDetailsModal
        gasLog={viewGasLog}
        onClose={() => setViewGasLog(null)}
        apiFetch={apiFetch}
      />

      {/* Update Gas Log Sub-modal */}
      {updateGasLogOpen && (
        <>
          <div className="fixed inset-0 bg-base-300/40 z-[55]" onClick={closeUpdateGasLog} />
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="modal-content w-full max-w-sm shadow-xl">
              <div className="modal-header">
                <div>
                  <h3 className="modal-title">Update Gas Log #{updatingGasLog?.gasLogId}</h3>
                  <span className="text-sm text-base-content/50">Invoice: {updatingGasLog?.invoiceId}</span>
                </div>
                <button
                  type="button"
                  className="btn btn-text btn-circle btn-sm absolute end-3 top-3"
                  onClick={closeUpdateGasLog}
                >
                  <span className="icon-[tabler--x] size-4"></span>
                </button>
              </div>
              <div className="modal-body">
                <form id="update-gas-log-form" onSubmit={handleUpdateGasLogSubmit}>
                  <div className="flex flex-col gap-4">

                    <div className="flex flex-col gap-1">
                      <label className="label-text font-medium">Invoice ID <span className="text-error">*</span></label>
                      <input
                        type="text"
                        name="invoiceId"
                        className={`input input-bordered w-full${updateGasLogFormError.invoiceId ? ' is-invalid' : ''}`}
                        maxLength={16}
                        required
                        value={updateGasLogForm.invoiceId}
                        onChange={handleUpdateGasLogFormChange}
                      />
                      {updateGasLogFormError.invoiceId && <span className="helper-text">{updateGasLogFormError.invoiceId}</span>}
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="label-text font-medium">Amount <span className="text-error">*</span></label>
                      <input
                        type="number"
                        name="amount"
                        className={`input input-bordered w-full${updateGasLogFormError.amount ? ' is-invalid' : ''}`}
                        min="0"
                        step="0.01"
                        required
                        value={updateGasLogForm.amount}
                        onChange={handleUpdateGasLogFormChange}
                      />
                      {updateGasLogFormError.amount && <span className="helper-text">{updateGasLogFormError.amount}</span>}
                    </div>

                    {updateGasLogFormError._general && (
                      <div className="alert alert-error py-2">
                        <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                        <span className="text-sm">{updateGasLogFormError._general}</span>
                      </div>
                    )}
                  </div>
                </form>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-soft btn-secondary" onClick={closeUpdateGasLog}>
                  Cancel
                </button>
                <button type="submit" form="update-gas-log-form" className="btn btn-primary" disabled={updateGasLogSubmitting}>
                  {updateGasLogSubmitting
                    ? <span className="loading loading-spinner loading-sm"></span>
                    : <span className="icon-[tabler--device-floppy] size-4"></span>
                  }
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Replace Gas Log File Sub-modal */}
      {replaceGasFileOpen && (
        <>
          <div className="fixed inset-0 bg-base-300/40 z-[55]" onClick={closeReplaceGasFile} />
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="modal-content w-full max-w-sm shadow-xl">
              <div className="modal-header">
                <div>
                  <h3 className="modal-title">
                    {replaceGasTarget?.docuId != null ? 'Replace File' : 'Attach File'} — Gas Log #{replaceGasTarget?.gasLogId}
                  </h3>
                  <span className="text-sm text-base-content/50">Invoice: {replaceGasTarget?.invoiceId}</span>
                </div>
                <button
                  type="button"
                  className="btn btn-text btn-circle btn-sm absolute end-3 top-3"
                  onClick={closeReplaceGasFile}
                >
                  <span className="icon-[tabler--x] size-4"></span>
                </button>
              </div>
              <div className="modal-body">
                <form id="replace-gas-file-form" onSubmit={handleReplaceGasFileSubmit}>
                  <div className="flex flex-col gap-4">

                    <div className="flex flex-col gap-1">
                      <label className="label-text font-medium">File <span className="text-error">*</span></label>
                      <input
                        ref={replaceGasFileRef}
                        type="file"
                        accept={ACCEPTED_EXTENSIONS}
                        className="hidden"
                        onChange={e => setReplaceGasFile(e.target.files?.[0] ?? null)}
                      />
                      <button
                        type="button"
                        className={`btn btn-outline w-full justify-start font-normal${replaceGasFileError.file ? ' btn-error' : ''}`}
                        onClick={() => replaceGasFileRef.current?.click()}
                      >
                        <span className="icon-[tabler--paperclip] size-4"></span>
                        {replaceGasFile ? replaceGasFile.name : 'Choose file…'}
                      </button>
                      {replaceGasFileError.file && <span className="helper-text">{replaceGasFileError.file}</span>}
                    </div>

                    {replaceGasFileError._general && (
                      <div className="alert alert-error py-2">
                        <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                        <span className="text-sm">{replaceGasFileError._general}</span>
                      </div>
                    )}
                  </div>
                </form>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-soft btn-secondary" onClick={closeReplaceGasFile}>
                  Cancel
                </button>
                <button type="submit" form="replace-gas-file-form" className="btn btn-primary" disabled={replaceGasFileSubmitting}>
                  {replaceGasFileSubmitting
                    ? <span className="loading loading-spinner loading-sm"></span>
                    : <span className="icon-[tabler--upload] size-4"></span>
                  }
                  Upload
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Blocking modal — vehicle is still on a trip with no end odometer */}
      {incompleteLog && (
        <>
          <div className="fixed inset-0 bg-base-300/40 z-[55]" />
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="modal-content w-full max-w-sm shadow-xl">
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
                <button type="button" className="btn btn-primary" onClick={() => setIncompleteLog(null)}>
                  OK
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* New Log Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title="New Vehicle Log"
        footer={
          <>
            <button type="button" className="btn btn-soft btn-secondary" onClick={closeModal}>
              Cancel
            </button>
            <button type="submit" form="new-log-form" className="btn btn-primary" disabled={submitting}>
              {submitting
                ? <span className="loading loading-spinner loading-sm"></span>
                : <span className="icon-[tabler--plus] size-4"></span>
              }
              Add Log
            </button>
          </>
        }
      >
        <form id="new-log-form" onSubmit={handleSubmit}>
          <LogFormFields
            form={form}
            formError={formError}
            onChange={handleFormChange}
            onSetForm={setForm}
            driverLabel={addDriverLabel}
            odoStartLocked={odoStartLocked}
            onOpenSchedulePicker={() => openSchedulePicker('add')}
            onOpenDriverPicker={() => openDriverPicker('add')}
          />
        </form>
      </Modal>

      {/* Edit Log Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={closeEditModal}
        title={`Update Log #${editingLog?.vehicleLogId}`}
        footer={
          <>
            <button type="button" className="btn btn-soft btn-secondary" onClick={closeEditModal}>
              Cancel
            </button>
            <button type="submit" form="edit-log-form" className="btn btn-primary" disabled={editSubmitting}>
              {editSubmitting
                ? <span className="loading loading-spinner loading-sm"></span>
                : <span className="icon-[tabler--device-floppy] size-4"></span>
              }
              Save Changes
            </button>
          </>
        }
      >
        <form id="edit-log-form" onSubmit={handleUpdate}>
          <LogFormFields
            form={editForm}
            formError={editFormError}
            onChange={handleEditFormChange}
            onSetForm={setEditForm}
            driverLabel={editDriverLabel}
            onOpenSchedulePicker={() => openSchedulePicker('edit')}
            onOpenDriverPicker={() => openDriverPicker('edit')}
          />
        </form>
      </Modal>

      {/* Schedule Picker */}
      <AnySchedulePickerModal
        isOpen={schedulePickerOpen}
        onClose={() => setSchedulePickerOpen(false)}
        onSelect={handleScheduleSelect}
      />

      {/* Driver Picker */}
      <EmployeePickerModal
        isOpen={driverPickerOpen}
        onClose={() => setDriverPickerOpen(false)}
        onSelect={handleDriverSelect}
      />
    </Layout>
  )
}

/** Shared form fields used by both the add and edit modals. */
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
