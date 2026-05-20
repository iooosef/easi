import { useState, useEffect } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { useAuth } from './auth'
import Layout from './Layout'
import Modal from './Modal'
import ManageMenu from './ManageMenu'
import { notyfSuccess, notyfError } from './notyf'

const STATUS_OPTIONS = ['active', 'inactive', 'maintenance']

const AC_MENU_ITEMS = [
  { key: 'update', label: 'Update Details', icon: 'icon-[tabler--pencil]', roles: ['ADMIN', 'STAFF'] },
]

const EMPTY_FORM = {
  brand: '',
  model: '',
  serialNum: '',
  status: 'active',
}

/**
 * Parses a failed API response into field-level or general error object.
 */
async function parseApiError(res) {
  const data = await res.json().catch(() => ({}))
  if (data.errors) return data.errors
  return { _general: data.message ?? data.error ?? `Error ${res.status}` }
}

/** Returns badge class for AC unit status */
function statusBadgeClass(status) {
  if (status === 'active') return 'badge-success'
  if (status === 'maintenance') return 'badge-warning'
  return 'badge-neutral'
}

/** Capitalizes and formats status string for display */
function formatStatus(status) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

const PAGE_SIZE = 10

export default function AirConditioningUnits() {
  const { apiFetch, hasRole } = useAuth()
  const { projNum } = useParams()
  const location = useLocation()
  const projNumInt = Number(projNum)
  const projectName = location.state?.projectName ?? '...'

  const [units, setUnits]               = useState([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState(null)
  const [search, setSearch]             = useState('')
  const [page, setPage]                 = useState(0)
  const [totalPages, setTotalPages]     = useState(0)
  const [totalElements, setTotalElements] = useState(0)
  const [refreshKey, setRefreshKey]     = useState(0)

  const [modalOpen, setModalOpen]   = useState(false)
  const [form, setForm]             = useState(EMPTY_FORM)
  const [formError, setFormError]   = useState({})
  const [submitting, setSubmitting] = useState(false)

  const [selectedUnit, setSelectedUnit] = useState(null)

  const [editModalOpen, setEditModalOpen]     = useState(false)
  const [editingUnit, setEditingUnit]         = useState(null)
  const [editForm, setEditForm]               = useState(EMPTY_FORM)
  const [editFormError, setEditFormError]     = useState({})
  const [editSubmitting, setEditSubmitting]   = useState(false)

  const canEdit = hasRole('ADMIN', 'STAFF')

  function openModal() { setModalOpen(true) }

  function closeModal() {
    setModalOpen(false)
    setForm(EMPTY_FORM)
    setFormError({})
  }

  /** Opens the edit modal pre-populated with the given unit's data. */
  function openEditModal(unit) {
    setEditForm({ brand: unit.brand, model: unit.model, serialNum: unit.serialNum, status: unit.status })
    setEditingUnit(unit)
    setEditFormError({})
    setEditModalOpen(true)
  }

  function closeEditModal() {
    setEditModalOpen(false)
    setEditingUnit(null)
    setEditForm(EMPTY_FORM)
    setEditFormError({})
  }

  function handleFormChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  function handleEditFormChange(e) {
    const { name, value } = e.target
    setEditForm(prev => ({ ...prev, [name]: value }))
  }

  /** Fetches AC units for the current project. */
  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({
      page: String(page),
      size: String(PAGE_SIZE),
      sort: 'acNum,asc',
      projNum: String(projNumInt),
    })
    apiFetch(`/api/ac-units?${params}`)
      .then(res => {
        if (!res.ok) throw new Error(`Failed to load AC units (${res.status})`)
        return res.json()
      })
      .then(data => {
        if (!active) return
        setUnits(data.content ?? [])
        setTotalPages(data.totalPages ?? 0)
        setTotalElements(data.totalElements ?? 0)
      })
      .catch(err => { if (active) setError(err.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [apiFetch, page, projNumInt, refreshKey])

  const filtered = units.filter(u => {
    if (search === '') return true
    const q = search.toLowerCase()
    return (
      String(u.acNum).includes(q) ||
      u.brand.toLowerCase().includes(q) ||
      u.model.toLowerCase().includes(q) ||
      u.serialNum.toLowerCase().includes(q)
    )
  })

  /** Submits the new AC unit form. */
  async function handleSubmit(e) {
    e.preventDefault()
    setFormError({})
    setSubmitting(true)
    try {
      const res = await apiFetch('/api/ac-units', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, projNum: projNumInt }),
      })
      if (!res.ok) {
        setFormError(await parseApiError(res))
        notyfError('Add failed')
        return
      }
      const data = await res.json().catch(() => ({}))
      closeModal()
      setTimeout(() => notyfSuccess(`AC Unit #${data.acNum} added successfully.`), 150)
      setPage(0)
      setRefreshKey(k => k + 1)
    } catch (err) {
      setFormError({ _general: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  /** Submits the update AC unit form. */
  async function handleUpdate(e) {
    e.preventDefault()
    setEditFormError({})
    setEditSubmitting(true)
    try {
      const res = await apiFetch(`/api/ac-units/${editingUnit.acNum}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editForm, projNum: projNumInt }),
      })
      if (!res.ok) {
        setEditFormError(await parseApiError(res))
        notyfError('Update failed')
        return
      }
      closeEditModal()
      setTimeout(() => notyfSuccess(`AC Unit #${editingUnit.acNum} updated successfully.`), 150)
      setRefreshKey(k => k + 1)
    } catch (err) {
      setEditFormError({ _general: err.message })
    } finally {
      setEditSubmitting(false)
    }
  }

  return (
    <Layout activePage="projects">
      {/* Header row */}
      <div className="flex items-stretch justify-between h-16 mb-6">
        <div>
          <h1 className="text-3xl font-semibold">
            Air Conditioning Units of {projectName}
          </h1>
          <p className="text-base-content/60 mt-1">View and manage AC units for this project</p>
        </div>

        <div className="flex gap-2 items-center h-full">
          {canEdit && (
            <button
              type="button"
              className="btn btn-primary h-full min-h-0"
              onClick={openModal}
            >
              <span className="icon-[tabler--plus] size-4"></span>
              New AC Unit
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
            placeholder="Search by AC #, brand, model, or serial no..."
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
            {totalElements} unit{totalElements !== 1 ? 's' : ''} total
            {search && ` · ${filtered.length} shown`}
          </p>

          {filtered.length === 0 ? (
            <div className="text-center py-20 text-base-content/40">
              <span className="icon-[tabler--snowflake-off] size-12 mx-auto mb-3 block"></span>
              <p>No AC units found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
              <table className="table table-zebra w-full">
                <thead>
                  <tr>
                    <th>AC #</th>
                    <th>Brand</th>
                    <th>Model</th>
                    <th>Serial No.</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(u => (
                    <tr key={u.acNum}>
                      <td className="font-mono font-semibold">{u.acNum}</td>
                      <td>{u.brand}</td>
                      <td>{u.model}</td>
                      <td className="font-mono text-sm">{u.serialNum}</td>
                      <td>
                        <span className={`badge badge-soft ${statusBadgeClass(u.status)} text-xs`}>
                          {formatStatus(u.status)}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn-soft btn-primary btn-sm"
                          onClick={() => setSelectedUnit(u)}
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

      {/* New AC Unit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title="New AC Unit"
        footer={
          <>
            <button type="button" className="btn btn-soft btn-secondary" onClick={closeModal}>
              Cancel
            </button>
            <button type="submit" form="new-ac-form" className="btn btn-primary" disabled={submitting}>
              {submitting
                ? <span className="loading loading-spinner loading-sm"></span>
                : <span className="icon-[tabler--plus] size-4"></span>
              }
              Add Unit
            </button>
          </>
        }
      >
        <form id="new-ac-form" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Brand <span className="text-error">*</span></label>
              <input type="text" name="brand" maxLength={30} required
                className={`input input-bordered w-full${formError.brand ? ' is-invalid' : ''}`}
                placeholder="e.g. Daikin"
                value={form.brand} onChange={handleFormChange} />
              {formError.brand && <span className="helper-text">{formError.brand}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Model <span className="text-error">*</span></label>
              <input type="text" name="model" maxLength={30} required
                className={`input input-bordered w-full${formError.model ? ' is-invalid' : ''}`}
                placeholder="e.g. FTKF25TV"
                value={form.model} onChange={handleFormChange} />
              {formError.model && <span className="helper-text">{formError.model}</span>}
            </div>

            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="label-text font-medium">Serial Number <span className="text-error">*</span></label>
              <input type="text" name="serialNum" maxLength={60} required
                className={`input input-bordered w-full${formError.serialNum ? ' is-invalid' : ''}`}
                placeholder="e.g. SN-1234567890"
                value={form.serialNum} onChange={handleFormChange} />
              {formError.serialNum && <span className="helper-text">{formError.serialNum}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Status</label>
              <select name="status"
                className={`select select-bordered w-full${formError.status ? ' is-invalid' : ''}`}
                value={form.status} onChange={handleFormChange}>
                {STATUS_OPTIONS.map(o => (
                  <option key={o} value={o}>{formatStatus(o)}</option>
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
      </Modal>

      {/* Edit AC Unit Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={closeEditModal}
        title={`Update AC Unit #${editingUnit?.acNum}`}
        footer={
          <>
            <button type="button" className="btn btn-soft btn-secondary" onClick={closeEditModal}>
              Cancel
            </button>
            <button type="submit" form="edit-ac-form" className="btn btn-primary" disabled={editSubmitting}>
              {editSubmitting
                ? <span className="loading loading-spinner loading-sm"></span>
                : <span className="icon-[tabler--device-floppy] size-4"></span>
              }
              Save Changes
            </button>
          </>
        }
      >
        <form id="edit-ac-form" onSubmit={handleUpdate}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Brand <span className="text-error">*</span></label>
              <input type="text" name="brand" maxLength={30} required
                className={`input input-bordered w-full${editFormError.brand ? ' is-invalid' : ''}`}
                placeholder="e.g. Daikin"
                value={editForm.brand} onChange={handleEditFormChange} />
              {editFormError.brand && <span className="helper-text">{editFormError.brand}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Model <span className="text-error">*</span></label>
              <input type="text" name="model" maxLength={30} required
                className={`input input-bordered w-full${editFormError.model ? ' is-invalid' : ''}`}
                placeholder="e.g. FTKF25TV"
                value={editForm.model} onChange={handleEditFormChange} />
              {editFormError.model && <span className="helper-text">{editFormError.model}</span>}
            </div>

            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="label-text font-medium">Serial Number <span className="text-error">*</span></label>
              <input type="text" name="serialNum" maxLength={60} required
                className={`input input-bordered w-full${editFormError.serialNum ? ' is-invalid' : ''}`}
                placeholder="e.g. SN-1234567890"
                value={editForm.serialNum} onChange={handleEditFormChange} />
              {editFormError.serialNum && <span className="helper-text">{editFormError.serialNum}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Status</label>
              <select name="status"
                className={`select select-bordered w-full${editFormError.status ? ' is-invalid' : ''}`}
                value={editForm.status} onChange={handleEditFormChange}>
                {STATUS_OPTIONS.map(o => (
                  <option key={o} value={o}>{formatStatus(o)}</option>
                ))}
              </select>
              {editFormError.status && <span className="helper-text">{editFormError.status}</span>}
            </div>

            {editFormError._general && (
              <div className="sm:col-span-2 alert alert-error py-2">
                <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                <span className="text-sm">{editFormError._general}</span>
              </div>
            )}
          </div>
        </form>
      </Modal>

      {/* AC Unit Manage Modal */}
      <ManageMenu
        title={selectedUnit ? `AC Unit #${selectedUnit.acNum}` : ''}
        subtitle={selectedUnit ? `${selectedUnit.brand} ${selectedUnit.model}` : ''}
        item={selectedUnit}
        details={selectedUnit ? [
          { label: 'Brand',         value: selectedUnit.brand },
          { label: 'Model',         value: selectedUnit.model },
          { label: 'Serial Number', value: selectedUnit.serialNum, fullWidth: true },
          { label: 'Status',        value: formatStatus(selectedUnit.status) },
        ] : []}
        isOpen={!!selectedUnit}
        onClose={() => setSelectedUnit(null)}
        hasRole={hasRole}
        menuItems={AC_MENU_ITEMS}
        onMenuSelect={(key, unit) => {
          setSelectedUnit(null)
          if (key === 'update') openEditModal(unit)
        }}
      />
    </Layout>
  )
}
