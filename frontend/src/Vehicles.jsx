import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './auth'
import Layout from './Layout'
import ManageMenu from './ManageMenu'
import Modal from './Modal'
import { notyfSuccess, notyfError } from './notyf'

const VEHICLE_MENU_ITEMS = [
  { key: 'update',     label: 'Update Vehicle',       icon: 'icon-[tabler--pencil]',      roles: ['ADMIN', 'STAFF'] },
  { key: 'logs',       label: 'Manage Vehicle Logs',  icon: 'icon-[tabler--road]',         roles: null },
  { key: 'gas-logs',   label: 'Manage Gas Logs',      icon: 'icon-[tabler--gas-station]',  roles: null },
]

const EMPTY_FORM = {
  vehicleModel: '',
  vehiclePlateNum: '',
}

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

  const [vehicles, setVehicles]           = useState([])
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState(null)
  const [search, setSearch]               = useState('')
  const [page, setPage]                   = useState(0)
  const [totalPages, setTotalPages]       = useState(0)
  const [totalElements, setTotalElements] = useState(0)

  const [selectedVehicle, setSelectedVehicle] = useState(null)

  // Add modal
  const [modalOpen, setModalOpen]   = useState(false)
  const [form, setForm]             = useState(EMPTY_FORM)
  const [formError, setFormError]   = useState({})
  const [submitting, setSubmitting] = useState(false)

  // Edit modal
  const [editModalOpen, setEditModalOpen]     = useState(false)
  const [editingVehicleId, setEditingVehicleId] = useState(null)

  const canEdit = hasRole('ADMIN', 'STAFF')

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
                      <div className="card-actions mt-2">
                        <button
                          className="btn btn-soft btn-primary btn-sm flex-1"
                          onClick={() => setSelectedVehicle(vehicle)}
                        >
                          <span className="icon-[tabler--settings] size-4"></span>
                          Manage
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
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

      {/* Manage Vehicle Menu */}
      <ManageMenu
        title={selectedVehicle?.vehicleModel}
        subtitle={selectedVehicle?.vehiclePlateNum}
        item={selectedVehicle}
        details={selectedVehicle ? [
          { label: 'Model',        value: selectedVehicle.vehicleModel },
          { label: 'Plate Number', value: selectedVehicle.vehiclePlateNum },
          { label: 'Added On',     value: formatDate(selectedVehicle.addedOn) },
        ] : []}
        isOpen={!!selectedVehicle}
        onClose={() => setSelectedVehicle(null)}
        hasRole={hasRole}
        menuItems={VEHICLE_MENU_ITEMS}
        onMenuSelect={(key, vehicle) => {
          if (key === 'update') {
            setSelectedVehicle(null)
            openEditModal(vehicle)
          } else if (key === 'logs') {
            setSelectedVehicle(null)
            navigate(`/vehicles/${vehicle.vehiclesId}/logs`, { state: { vehicleModel: vehicle.vehicleModel } })
          } else if (key === 'gas-logs') {
            setSelectedVehicle(null)
            navigate(`/vehicles/${vehicle.vehiclesId}/gas-logs`, { state: { vehicleModel: vehicle.vehicleModel } })
          }
        }}
      />

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
    </Layout>
  )
}
