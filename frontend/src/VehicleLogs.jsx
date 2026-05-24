import { useState, useEffect } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { useAuth } from './auth'
import Layout from './Layout'
import Modal from './Modal'
import ManageMenu from './ManageMenu'
import ProjectPickerModal from './ProjectPickerModal'
import EmployeePickerModal from './EmployeePickerModal'
import { notyfSuccess, notyfError } from './notyf'

const STATUS_OPTIONS = ['driving', 'completed']

const LOG_MENU_ITEMS = [
  { key: 'update', label: 'Update Log', icon: 'icon-[tabler--pencil]', roles: ['ADMIN', 'STAFF', 'CREW'] },
]

const EMPTY_FORM = {
  purpose: '',
  projNum: '',
  destination: '',
  driverEmployeeId: '',
  odometerStart: '',
  odometerEnd: '',
  status: 'driving',
}

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

const PAGE_SIZE = 10

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
  const [modalOpen, setModalOpen]   = useState(false)
  const [form, setForm]             = useState(EMPTY_FORM)
  const [formError, setFormError]   = useState({})
  const [submitting, setSubmitting] = useState(false)

  // Manage menu
  const [selectedLog, setSelectedLog] = useState(null)

  // Edit modal
  const [editModalOpen, setEditModalOpen]   = useState(false)
  const [editingLog, setEditingLog]         = useState(null)
  const [editForm, setEditForm]             = useState(EMPTY_FORM)
  const [editFormError, setEditFormError]   = useState({})
  const [editSubmitting, setEditSubmitting] = useState(false)

  // Picker state — shared between add and edit, pickerFor tracks which form is active
  const [pickerFor, setPickerFor]                   = useState(null) // 'add' | 'edit'
  const [projectPickerOpen, setProjectPickerOpen]   = useState(false)
  const [driverPickerOpen, setDriverPickerOpen]     = useState(false)
  const [addProjectLabel, setAddProjectLabel]       = useState('')
  const [addDriverLabel, setAddDriverLabel]         = useState('')
  const [editProjectLabel, setEditProjectLabel]     = useState('')
  const [editDriverLabel, setEditDriverLabel]       = useState('')

  const canEdit = hasRole('ADMIN', 'STAFF', 'CREW')

  function openProjectPicker(forForm) {
    setPickerFor(forForm)
    setProjectPickerOpen(true)
  }

  function openDriverPicker(forForm) {
    setPickerFor(forForm)
    setDriverPickerOpen(true)
  }

  function handleProjectSelect(project) {
    setProjectPickerOpen(false)
    if (pickerFor === 'add') {
      setForm(prev => ({ ...prev, projNum: String(project.projNum) }))
      setAddProjectLabel(project.name)
    } else {
      setEditForm(prev => ({ ...prev, projNum: String(project.projNum) }))
      setEditProjectLabel(project.name)
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

  function openModal() {
    setForm(EMPTY_FORM)
    setFormError({})
    setAddProjectLabel('')
    setAddDriverLabel('')
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setForm(EMPTY_FORM)
    setFormError({})
    setAddProjectLabel('')
    setAddDriverLabel('')
  }

  /** Opens the edit modal pre-populated with the given log's data. */
  function openEditModal(log) {
    setEditForm({
      purpose:          log.purpose,
      projNum:          String(log.projNum),
      destination:      log.destination,
      driverEmployeeId: String(log.driverEmployeeId),
      odometerStart:    String(log.odometerStart),
      odometerEnd:      log.odometerEnd != null ? String(log.odometerEnd) : '',
      status:           log.status,
    })
    setEditProjectLabel(log.projectName)
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
    setEditProjectLabel('')
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
      l.projectName.toLowerCase().includes(q) ||
      l.destination.toLowerCase().includes(q)
    )
  })

  /** Builds the request body from a form state object. */
  function buildBody(f) {
    return {
      vehiclesId:       vehiclesIdInt,
      purpose:          f.purpose,
      projNum:          f.projNum ? Number(f.projNum) : null,
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
            placeholder="Search by log #, purpose, project, or destination..."
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
                    <th>Project</th>
                    <th>Purpose</th>
                    <th>Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(l => (
                    <tr key={l.vehicleLogId}>
                      <td className="font-mono font-semibold">{l.vehicleLogId}</td>
                      <td>
                        <span className="font-medium">{l.vehicleModel}</span>
                        <span className="text-base-content/50"> · </span>
                        <span className="font-mono text-sm">{l.vehiclePlateNum}</span>
                      </td>
                      <td className="max-w-[180px] truncate">{l.projectName}</td>
                      <td>{l.purpose}</td>
                      <td className="text-sm text-base-content/70">{formatDate(l.addedOn)}</td>
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
              <button className="btn btn-sm btn-ghost" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                <span className="icon-[tabler--chevron-left] size-4"></span>
                Prev
              </button>
              <span className="text-sm text-base-content/60">Page {page + 1} of {totalPages}</span>
              <button className="btn btn-sm btn-ghost" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
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
          { label: 'Project',        value: selectedLog.projectName },
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
        }}
      />

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
            projectLabel={addProjectLabel}
            driverLabel={addDriverLabel}
            onOpenProjectPicker={() => openProjectPicker('add')}
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
            projectLabel={editProjectLabel}
            driverLabel={editDriverLabel}
            onOpenProjectPicker={() => openProjectPicker('edit')}
            onOpenDriverPicker={() => openDriverPicker('edit')}
          />
        </form>
      </Modal>

      {/* Project Picker */}
      <ProjectPickerModal
        isOpen={projectPickerOpen}
        onClose={() => setProjectPickerOpen(false)}
        onSelect={handleProjectSelect}
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
function LogFormFields({ form, formError, onChange, projectLabel, driverLabel, onOpenProjectPicker, onOpenDriverPicker }) {
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
        <label className="label-text font-medium">Project <span className="text-error">*</span></label>
        <div className={`input input-bordered w-full flex items-center justify-between gap-2${formError.projNum ? ' is-invalid' : ''}`}>
          <span className={`text-sm truncate ${projectLabel ? '' : 'text-base-content/40'}`}>
            {projectLabel || 'No project selected'}
          </span>
          <button
            type="button"
            className="btn btn-sm btn-ghost shrink-0"
            onClick={onOpenProjectPicker}
          >
            {projectLabel ? 'Change' : 'Select'}
          </button>
        </div>
        {formError.projNum && <span className="helper-text">{formError.projNum}</span>}
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
            className="btn btn-sm btn-ghost shrink-0"
            onClick={onOpenDriverPicker}
          >
            {driverLabel ? 'Change' : 'Select'}
          </button>
        </div>
        {formError.driverEmployeeId && <span className="helper-text">{formError.driverEmployeeId}</span>}
      </div>

      <div className="flex flex-col gap-1">
        <label className="label-text font-medium">Odometer Start (km) <span className="text-error">*</span></label>
        <input
          type="number"
          name="odometerStart"
          min={0}
          required
          className={`input input-bordered w-full${formError.odometerStart ? ' is-invalid' : ''}`}
          placeholder="e.g. 12500"
          value={form.odometerStart}
          onChange={onChange}
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
