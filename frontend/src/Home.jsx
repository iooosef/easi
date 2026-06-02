import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from './auth'
import Layout from './Layout'
import Modal from './Modal'
import { notyfSuccess, notyfError } from './notyf'

const EMPTY_GAS_FORM = { invoiceId: '', amount: '' }
const ACCEPTED_EXTENSIONS = '.jpg,.jpeg,.png,.gif,.webp,.pdf'
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']

const FINDING_TYPE_OPTIONS = ['GOOD', 'DEFECT', 'WORN', 'DIRTY', 'LEAK', 'FAIL']
const EMPTY_FINDING_FORM = { findingType: 'GOOD', partModel: '', acNum: '', remarks: '' }

function findingBadgeClass(type) {
  if (type === 'GOOD') return 'badge-success'
  if (type === 'DEFECT' || type === 'FAIL') return 'badge-error'
  if (type === 'LEAK') return 'badge-warning'
  return 'badge-neutral'
}

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
  { page: 'add-employee',      label: 'Add Employee',       icon: 'icon-[tabler--user-plus]',     path: '/employees?addEmployee=1',              roles: ['HR'] },
  { page: 'add-part',          label: 'Add Part',           icon: 'icon-[tabler--tool]',          path: '/inventory/parts?addPart=1',            roles: ['ACCOUNTING'] },
  { page: 'add-equipment',     label: 'Add Equipment',      icon: 'icon-[tabler--device-desktop]', path: '/inventory/equipment?addEquipment=1',  roles: ['ACCOUNTING'] },
  { page: 'add-supplier',      label: 'Add Supplier',       icon: 'icon-[tabler--building-store]', path: '/inventory/suppliers?addSupplier=1',   roles: ['ACCOUNTING'] },
]

/** Action items that open an inline modal instead of navigating. */
const HOME_ACTION_ITEMS = [
  { page: 'log-refueling', label: 'Log Refueling',  icon: 'icon-[tabler--gas-station]',   action: 'refueling', roles: ['ADMIN', 'STAFF', 'CREW'] },
  { page: 'add-findings',  label: 'Add Findings',   icon: 'icon-[tabler--clipboard-list]', action: 'findings',  roles: ['CREW'] },
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

  // --- Add Findings wizard ---
  const [findingsOpen, setFindingsOpen]             = useState(false)
  const [findingsStep, setFindingsStep]             = useState(1)

  // Step 1: project list + search
  const [fProjects, setFProjects]                   = useState([])
  const [fProjectsLoading, setFProjectsLoading]     = useState(false)
  const [fSelectedProject, setFSelectedProject]     = useState(null)
  const [fProjSearch, setFProjSearch]               = useState('')

  // Step 2: service report list + search
  const [fReports, setFReports]                     = useState([])
  const [fReportsLoading, setFReportsLoading]       = useState(false)
  const [fSelectedReport, setFSelectedReport]       = useState(null)
  const [fSRSearch, setFSRSearch]                   = useState('')

  // Step 3: findings list + AC units
  const [fFindings, setFFindings]                   = useState([])
  const [fFindingsLoading, setFFindingsLoading]     = useState(false)
  const [fAcUnits, setFAcUnits]                     = useState([])
  const [fRefreshKey, setFRefreshKey]               = useState(0)

  // Step 3 — Add Finding sub-modal
  const [fAddOpen, setFAddOpen]                     = useState(false)
  const [fAddForm, setFAddForm]                     = useState(EMPTY_FINDING_FORM)
  const [fAddError, setFAddError]                   = useState({})
  const [fAddSubmitting, setFAddSubmitting]         = useState(false)

  // Step 3 — Edit Finding sub-modal
  const [fEditOpen, setFEditOpen]                   = useState(false)
  const [fEditingFinding, setFEditingFinding]       = useState(null)
  const [fEditForm, setFEditForm]                   = useState(EMPTY_FINDING_FORM)
  const [fEditError, setFEditError]                 = useState({})
  const [fEditSubmitting, setFEditSubmitting]       = useState(false)

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

  /** Opens the findings wizard at step 1. */
  function openFindings() {
    setFindingsOpen(true)
    setFindingsStep(1)
    setFSelectedProject(null)
    setFSelectedReport(null)
    setFProjSearch('')
    setFSRSearch('')
    setFFindings([])
    setFAcUnits([])
    setFRefreshKey(0)
  }

  /** Closes and resets the entire findings wizard including sub-modals. */
  function closeFindingsAll() {
    setFindingsOpen(false)
    setFindingsStep(1)
    setFSelectedProject(null)
    setFSelectedReport(null)
    setFProjSearch('')
    setFSRSearch('')
    setFProjects([])
    setFReports([])
    setFFindings([])
    setFAcUnits([])
    setFAddOpen(false)
    setFAddForm(EMPTY_FINDING_FORM)
    setFAddError({})
    setFEditOpen(false)
    setFEditingFinding(null)
    setFEditForm(EMPTY_FINDING_FORM)
    setFEditError({})
  }

  /** Opens the Add Finding sub-modal for the current service report. */
  function openFAdd() {
    setFAddForm(EMPTY_FINDING_FORM)
    setFAddError({})
    setFAddOpen(true)
  }

  function closeFAdd() {
    setFAddOpen(false)
    setFAddForm(EMPTY_FINDING_FORM)
    setFAddError({})
  }

  /** Opens the Edit Finding sub-modal pre-populated with the given finding. */
  function openFEdit(finding) {
    setFEditForm({
      findingType: finding.findingType ?? 'GOOD',
      partModel:   finding.partModel ?? '',
      acNum:       finding.acNum ?? '',
      remarks:     finding.remarks ?? '',
    })
    setFEditingFinding(finding)
    setFEditError({})
    setFEditOpen(true)
  }

  function closeFEdit() {
    setFEditOpen(false)
    setFEditingFinding(null)
    setFEditForm(EMPTY_FINDING_FORM)
    setFEditError({})
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

  /** Fetch projects when findings wizard step 1 opens. */
  useEffect(() => {
    if (!findingsOpen || findingsStep !== 1) return
    let active = true
    setFProjectsLoading(true)
    apiFetch('/api/projects?size=100&sort=name,asc')
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => { if (active) setFProjects(data.content ?? []) })
      .catch(() => { if (active) setFProjects([]) })
      .finally(() => { if (active) setFProjectsLoading(false) })
    return () => { active = false }
  }, [apiFetch, findingsOpen, findingsStep])

  /** Fetch service reports for the selected project when findings wizard step 2 opens. */
  useEffect(() => {
    if (!findingsOpen || findingsStep !== 2 || !fSelectedProject) return
    let active = true
    setFReportsLoading(true)
    apiFetch(`/api/service-reports?projNum=${fSelectedProject.projNum}&size=100&sort=srNumber,asc`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => { if (active) setFReports(data.content ?? []) })
      .catch(() => { if (active) setFReports([]) })
      .finally(() => { if (active) setFReportsLoading(false) })
    return () => { active = false }
  }, [apiFetch, findingsOpen, findingsStep, fSelectedProject])

  /** Fetch findings for the selected service report when findings wizard step 3 opens or refreshes. */
  useEffect(() => {
    if (!findingsOpen || findingsStep !== 3 || !fSelectedReport) return
    let active = true
    setFFindingsLoading(true)
    apiFetch(`/api/service-report-findings?srNumber=${fSelectedReport.srNumber}&size=100&sort=srFindingsNumber,asc`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => { if (active) setFFindings(data.content ?? []) })
      .catch(() => { if (active) setFFindings([]) })
      .finally(() => { if (active) setFFindingsLoading(false) })
    return () => { active = false }
  }, [apiFetch, findingsOpen, findingsStep, fSelectedReport, fRefreshKey])

  /** Fetch AC units for the selected project when findings wizard step 3 opens. */
  useEffect(() => {
    if (!findingsOpen || findingsStep !== 3 || !fSelectedProject) return
    let active = true
    apiFetch(`/api/ac-units?projNum=${fSelectedProject.projNum}&size=100&sort=acNum,asc`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => { if (active) setFAcUnits(data.content ?? []) })
      .catch(() => { if (active) setFAcUnits([]) })
    return () => { active = false }
  }, [apiFetch, findingsOpen, findingsStep, fSelectedProject])

  /** Submits the new finding form. */
  async function handleFAddSubmit(e) {
    e.preventDefault()
    setFAddError({})
    setFAddSubmitting(true)
    try {
      const res = await apiFetch('/api/service-report-findings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          srNumber:    fSelectedReport.srNumber,
          findingType: fAddForm.findingType || null,
          partModel:   fAddForm.partModel   || null,
          acNum:       fAddForm.acNum       ? Number(fAddForm.acNum) : null,
          remarks:     fAddForm.remarks     || null,
        }),
      })
      if (!res.ok) {
        setFAddError(await parseApiError(res))
        notyfError('Add finding failed')
        return
      }
      const data = await res.json().catch(() => ({}))
      closeFAdd()
      setTimeout(() => notyfSuccess(`Finding #${data.srFindingsNumber} added.`), 150)
      setFRefreshKey(k => k + 1)
    } catch (err) {
      setFAddError({ _general: err.message })
    } finally {
      setFAddSubmitting(false)
    }
  }

  /** Submits the edit finding form. */
  async function handleFEditSubmit(e) {
    e.preventDefault()
    setFEditError({})
    setFEditSubmitting(true)
    try {
      const res = await apiFetch(`/api/service-report-findings/${fEditingFinding.srFindingsNumber}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          srNumber:    fSelectedReport.srNumber,
          findingType: fEditForm.findingType || null,
          partModel:   fEditForm.partModel   || null,
          acNum:       fEditForm.acNum       ? Number(fEditForm.acNum) : null,
          remarks:     fEditForm.remarks     || null,
        }),
      })
      if (!res.ok) {
        setFEditError(await parseApiError(res))
        notyfError('Update finding failed')
        return
      }
      closeFEdit()
      setTimeout(() => notyfSuccess(`Finding #${fEditingFinding.srFindingsNumber} updated.`), 150)
      setFRefreshKey(k => k + 1)
    } catch (err) {
      setFEditError({ _general: err.message })
    } finally {
      setFEditSubmitting(false)
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
          <button key={page} type="button" className="group text-left" onClick={() => {
            if (action === 'refueling') openRefueling()
            else if (action === 'findings') openFindings()
          }}>
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

      {/* ── Add Findings wizard (z-40/z-45) ────────────────────── */}
      {findingsOpen && (
        <>
          <div className="fixed inset-0 bg-base-300/40 z-[40]" onClick={closeFindingsAll} />
          <div className="fixed inset-0 z-[45] flex items-center justify-center p-4 overflow-y-auto">
            <div className="modal-content w-full max-w-2xl my-auto shadow-xl">
              <div className="modal-header">
                <h3 className="modal-title">Add Findings</h3>
                <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={closeFindingsAll}>
                  <span className="icon-[tabler--x] size-4"></span>
                </button>
              </div>

              <div className="modal-body flex flex-col gap-4">
                {/* Progress bar */}
                <div className="flex items-center gap-x-1">
                  {[1,2,3].map(n => (
                    <div key={n}
                      className={`progress-step transition-colors ${findingsStep >= n ? 'bg-primary' : 'bg-primary/10'}`}
                      role="progressbar"
                      aria-valuenow={findingsStep >= n ? 100 : 0}
                      aria-valuemin="0"
                      aria-valuemax="100"
                    />
                  ))}
                  <p className="text-xs text-primary ms-1 font-medium">{findingsStep}/3</p>
                </div>

                <p className="text-xs font-semibold text-base-content/40 uppercase tracking-wide -mb-2">
                  {findingsStep === 1 && 'Step 1 — Select Project'}
                  {findingsStep === 2 && 'Step 2 — Select Service Report'}
                  {findingsStep === 3 && `Step 3 — Findings · SR #${fSelectedReport?.srNumber}`}
                </p>

                {/* ── Step 1: Select Project ── */}
                {findingsStep === 1 && (
                  <div className="flex flex-col gap-3">
                    <div className="relative">
                      <span className="icon-[tabler--search] size-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none"></span>
                      <input type="text" className="input input-bordered w-full pl-9" placeholder="Search projects..."
                        value={fProjSearch} onChange={e => setFProjSearch(e.target.value)} />
                    </div>
                    {fProjectsLoading ? (
                      <div className="flex justify-center py-8"><span className="loading loading-spinner loading-md text-primary"></span></div>
                    ) : (() => {
                      const q = fProjSearch.toLowerCase()
                      const filtered = q
                        ? fProjects.filter(p => p.name.toLowerCase().includes(q) || String(p.projNum).includes(q))
                        : fProjects
                      return filtered.length === 0 ? (
                        <p className="text-center py-8 text-base-content/40 text-sm">
                          {fProjects.length === 0 ? 'No projects available.' : 'No results match your search.'}
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
                          {filtered.map(proj => (
                            <div key={proj.projNum} className="card bg-base-100 border border-base-300">
                              <div className="card-body py-3 px-4">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm line-clamp-1">{proj.name}</p>
                                    <p className="text-xs text-base-content/50">#{proj.projNum} · {proj.type}</p>
                                    <p className="text-xs text-base-content/60 line-clamp-1 mt-0.5">{proj.address}</p>
                                  </div>
                                  <button type="button" className="btn btn-primary btn-sm shrink-0"
                                    onClick={() => { setFSelectedProject(proj); setFReports([]); setFSRSearch(''); setFindingsStep(2) }}>
                                    Select
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    })()}
                  </div>
                )}

                {/* ── Step 2: Select Service Report ── */}
                {findingsStep === 2 && (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-sm text-base-content/60 bg-base-200 rounded-lg px-3 py-2">
                      <span className="icon-[tabler--building] size-4 shrink-0"></span>
                      <span>Project: <span className="font-medium text-base-content">{fSelectedProject?.name}</span></span>
                    </div>
                    <div className="relative">
                      <span className="icon-[tabler--search] size-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none"></span>
                      <input type="text" className="input input-bordered w-full pl-9" placeholder="Search by SR #, date, or complaint..."
                        value={fSRSearch} onChange={e => setFSRSearch(e.target.value)} />
                    </div>
                    {fReportsLoading ? (
                      <div className="flex justify-center py-8"><span className="loading loading-spinner loading-md text-primary"></span></div>
                    ) : (() => {
                      const q = fSRSearch.toLowerCase()
                      const filtered = q
                        ? fReports.filter(sr =>
                            String(sr.srNumber).includes(q) ||
                            (sr.scheduleDate && String(sr.scheduleDate).includes(q)) ||
                            (sr.complaint?.toLowerCase().includes(q))
                          )
                        : fReports
                      return filtered.length === 0 ? (
                        <p className="text-center py-8 text-base-content/40 text-sm">
                          {fReports.length === 0 ? 'No service reports found for this project.' : 'No results match your search.'}
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
                          {filtered.map(sr => (
                            <div key={sr.srNumber} className="card bg-base-100 border border-base-300">
                              <div className="card-body py-3 px-4">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm">SR #{sr.srNumber}</p>
                                    <p className="text-xs text-base-content/50">{sr.scheduleDate ? String(sr.scheduleDate).slice(0, 10) : '—'}</p>
                                    {sr.complaint && (
                                      <p className="text-xs text-base-content/50 mt-0.5 line-clamp-2">{sr.complaint}</p>
                                    )}
                                  </div>
                                  <button type="button" className="btn btn-primary btn-sm shrink-0"
                                    onClick={() => { setFSelectedReport(sr); setFFindings([]); setFAcUnits([]); setFRefreshKey(0); setFindingsStep(3) }}>
                                    Select
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    })()}
                  </div>
                )}

                {/* ── Step 3: Manage Findings ── */}
                {findingsStep === 3 && (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-sm text-base-content/60 bg-base-200 rounded-lg px-3 py-2">
                      <span className="icon-[tabler--building] size-4 shrink-0"></span>
                      <span className="font-medium text-base-content">{fSelectedProject?.name}</span>
                      <span className="text-base-content/30">·</span>
                      <span className="icon-[tabler--file-text] size-4 shrink-0"></span>
                      <span>SR #{fSelectedReport?.srNumber}</span>
                      {fSelectedReport?.complaint && (
                        <span className="text-base-content/40 truncate hidden sm:block">— {fSelectedReport.complaint}</span>
                      )}
                    </div>

                    <div className="flex justify-end">
                      <button type="button" className="btn btn-soft btn-primary btn-sm" onClick={openFAdd}>
                        <span className="icon-[tabler--plus] size-4"></span>
                        New Finding
                      </button>
                    </div>

                    {fFindingsLoading ? (
                      <div className="flex justify-center py-8"><span className="loading loading-spinner loading-md text-primary"></span></div>
                    ) : fFindings.length === 0 ? (
                      <p className="text-center py-8 text-base-content/40 text-sm">
                        No findings recorded yet. Click <strong>New Finding</strong> to add one.
                      </p>
                    ) : (
                      <div className="overflow-x-auto rounded-box border border-base-300">
                        <table className="table table-zebra table-sm w-full">
                          <thead>
                            <tr>
                              <th>Finding #</th><th>AC Unit #</th><th>Type</th><th>Part / Model</th><th>Remarks</th><th></th>
                            </tr>
                          </thead>
                          <tbody>
                            {fFindings.map(f => (
                              <tr key={f.srFindingsNumber}>
                                <td className="font-mono font-semibold">{f.srFindingsNumber}</td>
                                <td className="font-mono">{f.acNum ?? '—'}</td>
                                <td>
                                  <span className={`badge badge-soft text-xs ${findingBadgeClass(f.findingType)}`}>
                                    {f.findingType ?? '—'}
                                  </span>
                                </td>
                                <td className="text-sm max-w-32"><span className="line-clamp-1">{f.partModel ?? '—'}</span></td>
                                <td className="max-w-40"><span className="line-clamp-2 text-sm" title={f.remarks}>{f.remarks ?? '—'}</span></td>
                                <td>
                                  <button type="button" className="btn btn-soft btn-primary btn-xs" onClick={() => openFEdit(f)}>
                                    <span className="icon-[tabler--pencil] size-3"></span>Edit
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="modal-footer">
                {findingsStep > 1 && (
                  <button type="button" className="btn btn-soft btn-secondary me-auto"
                    onClick={() => {
                      if (findingsStep === 2) { setFSelectedProject(null); setFProjSearch(''); setFindingsStep(1) }
                      else setFindingsStep(s => s - 1)
                    }}>
                    <span className="icon-[tabler--arrow-left] size-4"></span>Back
                  </button>
                )}
                <button type="button" className="btn btn-ghost" onClick={closeFindingsAll}>
                  {findingsStep === 3 ? 'Close' : 'Cancel'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Add Finding sub-modal (z-50/z-55) ─────────────────── */}
      {fAddOpen && (
        <>
          <div className="fixed inset-0 bg-base-300/40 z-[50]" onClick={closeFAdd} />
          <div className="fixed inset-0 z-[55] flex items-center justify-center p-4">
            <div className="modal-content w-full max-w-lg shadow-xl">
              <div className="modal-header">
                <h3 className="modal-title">New Finding</h3>
                <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={closeFAdd}>
                  <span className="icon-[tabler--x] size-4"></span>
                </button>
              </div>
              <div className="modal-body">
                <form id="home-new-finding-form" onSubmit={handleFAddSubmit}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="label-text font-medium">AC Unit <span className="text-error">*</span></label>
                      <select required
                        className={`select select-bordered w-full${fAddError.acNum ? ' is-invalid' : ''}`}
                        value={fAddForm.acNum} onChange={e => setFAddForm(p => ({ ...p, acNum: e.target.value }))}>
                        <option value="">Select AC unit...</option>
                        {fAcUnits.map(u => (
                          <option key={u.acNum} value={u.acNum}>#{u.acNum} — {u.brand} {u.model}</option>
                        ))}
                      </select>
                      {fAddError.acNum && <span className="helper-text">{fAddError.acNum}</span>}
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="label-text font-medium">Finding Type</label>
                      <select
                        className={`select select-bordered w-full${fAddError.findingType ? ' is-invalid' : ''}`}
                        value={fAddForm.findingType} onChange={e => setFAddForm(p => ({ ...p, findingType: e.target.value }))}>
                        {FINDING_TYPE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                      {fAddError.findingType && <span className="helper-text">{fAddError.findingType}</span>}
                    </div>
                    <div className="sm:col-span-2 flex flex-col gap-1">
                      <label className="label-text font-medium">Part / Model</label>
                      <input type="text" maxLength={60}
                        className={`input input-bordered w-full${fAddError.partModel ? ' is-invalid' : ''}`}
                        placeholder="e.g. Capacitor 35/5 MFD"
                        value={fAddForm.partModel} onChange={e => setFAddForm(p => ({ ...p, partModel: e.target.value }))} />
                      {fAddError.partModel && <span className="helper-text">{fAddError.partModel}</span>}
                    </div>
                    <div className="sm:col-span-2 flex flex-col gap-1">
                      <label className="label-text font-medium">Remarks</label>
                      <textarea rows={4} maxLength={1200}
                        className={`textarea textarea-bordered w-full${fAddError.remarks ? ' is-invalid' : ''}`}
                        placeholder="Describe the finding in detail..."
                        value={fAddForm.remarks} onChange={e => setFAddForm(p => ({ ...p, remarks: e.target.value }))} />
                      {fAddError.remarks && <span className="helper-text">{fAddError.remarks}</span>}
                    </div>
                    {fAddError._general && (
                      <div className="sm:col-span-2 alert alert-error py-2">
                        <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                        <span className="text-sm">{fAddError._general}</span>
                      </div>
                    )}
                  </div>
                </form>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={closeFAdd}>Cancel</button>
                <button type="submit" form="home-new-finding-form" className="btn btn-primary" disabled={fAddSubmitting}>
                  {fAddSubmitting ? <span className="loading loading-spinner loading-sm"></span> : <span className="icon-[tabler--plus] size-4"></span>}
                  Add Finding
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Edit Finding sub-modal (z-50/z-55) ────────────────── */}
      {fEditOpen && (
        <>
          <div className="fixed inset-0 bg-base-300/40 z-[50]" onClick={closeFEdit} />
          <div className="fixed inset-0 z-[55] flex items-center justify-center p-4">
            <div className="modal-content w-full max-w-lg shadow-xl">
              <div className="modal-header">
                <h3 className="modal-title">Update Finding #{fEditingFinding?.srFindingsNumber}</h3>
                <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={closeFEdit}>
                  <span className="icon-[tabler--x] size-4"></span>
                </button>
              </div>
              <div className="modal-body">
                <form id="home-edit-finding-form" onSubmit={handleFEditSubmit}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="label-text font-medium">AC Unit <span className="text-error">*</span></label>
                      <select required
                        className={`select select-bordered w-full${fEditError.acNum ? ' is-invalid' : ''}`}
                        value={fEditForm.acNum} onChange={e => setFEditForm(p => ({ ...p, acNum: e.target.value }))}>
                        <option value="">Select AC unit...</option>
                        {fAcUnits.map(u => (
                          <option key={u.acNum} value={u.acNum}>#{u.acNum} — {u.brand} {u.model}</option>
                        ))}
                      </select>
                      {fEditError.acNum && <span className="helper-text">{fEditError.acNum}</span>}
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="label-text font-medium">Finding Type</label>
                      <select
                        className={`select select-bordered w-full${fEditError.findingType ? ' is-invalid' : ''}`}
                        value={fEditForm.findingType} onChange={e => setFEditForm(p => ({ ...p, findingType: e.target.value }))}>
                        {FINDING_TYPE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                      {fEditError.findingType && <span className="helper-text">{fEditError.findingType}</span>}
                    </div>
                    <div className="sm:col-span-2 flex flex-col gap-1">
                      <label className="label-text font-medium">Part / Model</label>
                      <input type="text" maxLength={60}
                        className={`input input-bordered w-full${fEditError.partModel ? ' is-invalid' : ''}`}
                        placeholder="e.g. Capacitor 35/5 MFD"
                        value={fEditForm.partModel} onChange={e => setFEditForm(p => ({ ...p, partModel: e.target.value }))} />
                      {fEditError.partModel && <span className="helper-text">{fEditError.partModel}</span>}
                    </div>
                    <div className="sm:col-span-2 flex flex-col gap-1">
                      <label className="label-text font-medium">Remarks</label>
                      <textarea rows={4} maxLength={1200}
                        className={`textarea textarea-bordered w-full${fEditError.remarks ? ' is-invalid' : ''}`}
                        placeholder="Describe the finding in detail..."
                        value={fEditForm.remarks} onChange={e => setFEditForm(p => ({ ...p, remarks: e.target.value }))} />
                      {fEditError.remarks && <span className="helper-text">{fEditError.remarks}</span>}
                    </div>
                    {fEditError._general && (
                      <div className="sm:col-span-2 alert alert-error py-2">
                        <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                        <span className="text-sm">{fEditError._general}</span>
                      </div>
                    )}
                  </div>
                </form>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={closeFEdit}>Cancel</button>
                <button type="submit" form="home-edit-finding-form" className="btn btn-primary" disabled={fEditSubmitting}>
                  {fEditSubmitting ? <span className="loading loading-spinner loading-sm"></span> : <span className="icon-[tabler--device-floppy] size-4"></span>}
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </Layout>
  )
}
