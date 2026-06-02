import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './auth'
import Layout from './Layout'
import Modal from './Modal'
import ManageMenu from './ManageMenu'
import AnySchedulePickerModal from './AnySchedulePickerModal'
import { notyfSuccess, notyfError } from './notyf'

async function parseApiError(res) {
  const data = await res.json().catch(() => ({}))
  if (data.errors) return data.errors
  return { _general: data.message ?? data.error ?? `Error ${res.status}` }
}

function formatDate(dt) {
  if (!dt) return '—'
  return String(dt).slice(0, 10)
}

function formatCurrency(value) {
  if (value == null) return '—'
  return Number(value).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })
}

function statusBadge(status) {
  if (status === 'active')            return 'badge-success'
  if (status === 'under_maintenance') return 'badge-warning'
  if (status === 'retired')           return 'badge-neutral'
  if (status === 'depleted')          return 'badge-error'
  return 'badge-neutral'
}

function typeBadge(type) {
  return type === 'durable' ? 'badge-info' : 'badge-warning'
}

const PAGE_SIZE = 10

const EQUIPMENT_MENU_ITEMS = [
  { key: 'update',     label: 'Update Details',  icon: 'icon-[tabler--pencil]', roles: ['ADMIN', 'STAFF'] },
  { key: 'log-deploy', label: 'Log Deployment',  icon: 'icon-[tabler--calendar-plus]', roles: ['ADMIN', 'STAFF'] },
]

const EMPTY_FORM = {
  name: '', type: 'durable', model: '', serialNumber: '', description: '',
  status: 'active', stock: '1', acquisitionCost: '', poNum: '',
}
const EMPTY_DEPLOY_FORM = { schedId: '', notes: '' }

export default function InventoryEquipment() {
  const { apiFetch, hasRole } = useAuth()
  const navigate = useNavigate()
  const canEdit = hasRole('ADMIN', 'STAFF')

  // List
  const [equipment, setEquipment]         = useState([])
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState(null)
  const [inputValue, setInputValue]       = useState('')
  const [search, setSearch]               = useState('')
  const [typeFilter, setTypeFilter]       = useState('')
  const [statusFilter, setStatusFilter]   = useState('')
  const [page, setPage]                   = useState(0)
  const [totalPages, setTotalPages]       = useState(0)
  const [totalElements, setTotalElements] = useState(0)
  const [refreshKey, setRefreshKey]       = useState(0)

  // Manage panel
  const [selectedItem, setSelectedItem]   = useState(null)
  const [deployHistory, setDeployHistory] = useState([])
  const [deployLoading, setDeployLoading] = useState(false)

  // Add modal
  const [addOpen, setAddOpen]             = useState(false)
  const [addForm, setAddForm]             = useState(EMPTY_FORM)
  const [addFormError, setAddFormError]   = useState({})
  const [addSubmitting, setAddSubmitting] = useState(false)

  // Update modal
  const [updateOpen, setUpdateOpen]             = useState(false)
  const [updatingItem, setUpdatingItem]         = useState(null)
  const [updateForm, setUpdateForm]             = useState(EMPTY_FORM)
  const [updateFormError, setUpdateFormError]   = useState({})
  const [updateSubmitting, setUpdateSubmitting] = useState(false)

  // Log Deployment modal
  const [deployOpen, setDeployOpen]             = useState(false)
  const [deployTarget, setDeployTarget]         = useState(null)
  const [deployForm, setDeployForm]             = useState(EMPTY_DEPLOY_FORM)
  const [deployFormError, setDeployFormError]   = useState({})
  const [deploySubmitting, setDeploySubmitting] = useState(false)
  const [deploySchedDisplay, setDeploySchedDisplay]   = useState('')
  const [deploySchedPickerOpen, setDeploySchedPickerOpen] = useState(false)

  // Edit Deployment sub-modal
  const [editDeployOpen, setEditDeployOpen]             = useState(false)
  const [editingDeploy, setEditingDeploy]               = useState(null)
  const [editDeployForm, setEditDeployForm]             = useState({})
  const [editDeployFormError, setEditDeployFormError]   = useState({})
  const [editDeploySubmitting, setEditDeploySubmitting] = useState(false)
  const [editSchedDisplay, setEditSchedDisplay]         = useState('')
  const [editSchedPickerOpen, setEditSchedPickerOpen]   = useState(false)

  /** Fetch paginated equipment list. */
  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ page: String(page), size: String(PAGE_SIZE), sort: 'addedOn,desc' })
    if (search)       params.set('search', search)
    if (typeFilter)   params.set('type', typeFilter)
    if (statusFilter) params.set('status', statusFilter)
    apiFetch(`/api/equipment?${params}`)
      .then(res => { if (!res.ok) throw new Error(`Failed to load equipment (${res.status})`); return res.json() })
      .then(data => {
        if (!active) return
        setEquipment(data.content ?? [])
        setTotalPages(data.totalPages ?? 0)
        setTotalElements(data.totalElements ?? 0)
      })
      .catch(err => { if (active) setError(err.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [apiFetch, page, refreshKey, search, typeFilter, statusFilter])

  /** Fetch deployment history when Manage panel opens. */
  useEffect(() => {
    if (!selectedItem) { setDeployHistory([]); return }
    let active = true
    setDeployLoading(true)
    apiFetch(`/api/equipment-usages?equipmentId=${selectedItem.equipmentId}&size=50&sort=loggedOn,desc`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => { if (active) setDeployHistory(data.content ?? []) })
      .catch(() => { if (active) setDeployHistory([]) })
      .finally(() => { if (active) setDeployLoading(false) })
    return () => { active = false }
  }, [apiFetch, selectedItem])

  function handleMenuSelect(key, item) {
    setSelectedItem(null)
    if (key === 'update')     openUpdate(item)
    if (key === 'log-deploy') openDeploy(item)
  }

  // ── Add ──────────────────────────────────────────────────────────────────
  function openAdd() { setAddForm(EMPTY_FORM); setAddFormError({}); setAddOpen(true) }
  function closeAdd() { setAddOpen(false); setAddForm(EMPTY_FORM); setAddFormError({}) }

  async function handleAddSubmit(e) {
    e.preventDefault()
    setAddFormError({})
    setAddSubmitting(true)
    try {
      const res = await apiFetch('/api/equipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...addForm,
          stock: Number(addForm.stock),
          acquisitionCost: addForm.acquisitionCost ? Number(addForm.acquisitionCost) : null,
          poNum: addForm.poNum || null,
          model: addForm.model || null,
          serialNumber: addForm.serialNumber || null,
          description: addForm.description || null,
        }),
      })
      if (!res.ok) { setAddFormError(await parseApiError(res)); notyfError('Add failed'); return }
      closeAdd()
      notyfSuccess('Equipment added successfully.')
      setRefreshKey(k => k + 1)
    } catch (err) {
      setAddFormError({ _general: err.message })
    } finally {
      setAddSubmitting(false)
    }
  }

  // ── Update ───────────────────────────────────────────────────────────────
  function openUpdate(item) {
    setUpdateForm({
      name: item.name, type: item.type, model: item.model ?? '',
      serialNumber: item.serialNumber ?? '', description: item.description ?? '',
      status: item.status, stock: String(item.stock),
      acquisitionCost: item.acquisitionCost ?? '', poNum: item.poNum ?? '',
    })
    setUpdatingItem(item)
    setUpdateFormError({})
    setUpdateOpen(true)
  }
  function closeUpdate() { setUpdateOpen(false); setUpdatingItem(null); setUpdateForm(EMPTY_FORM); setUpdateFormError({}) }

  async function handleUpdateSubmit(e) {
    e.preventDefault()
    setUpdateFormError({})
    setUpdateSubmitting(true)
    try {
      const res = await apiFetch(`/api/equipment/${updatingItem.equipmentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...updateForm,
          stock: Number(updateForm.stock),
          acquisitionCost: updateForm.acquisitionCost ? Number(updateForm.acquisitionCost) : null,
          poNum: updateForm.poNum || null,
          model: updateForm.model || null,
          serialNumber: updateForm.serialNumber || null,
          description: updateForm.description || null,
        }),
      })
      if (!res.ok) { setUpdateFormError(await parseApiError(res)); notyfError('Update failed'); return }
      closeUpdate()
      notyfSuccess(`Equipment #${updatingItem.equipmentId} updated.`)
      setRefreshKey(k => k + 1)
    } catch (err) {
      setUpdateFormError({ _general: err.message })
    } finally {
      setUpdateSubmitting(false)
    }
  }

  // ── Log Deployment ────────────────────────────────────────────────────────
  function openDeploy(item) {
    setDeployTarget(item)
    setDeployForm(EMPTY_DEPLOY_FORM)
    setDeployFormError({})
    setDeploySchedDisplay('')
    setDeployOpen(true)
  }
  function closeDeploy() {
    setDeployOpen(false); setDeployTarget(null)
    setDeployForm(EMPTY_DEPLOY_FORM); setDeployFormError({})
    setDeploySchedDisplay('')
  }

  async function handleDeploySubmit(e) {
    e.preventDefault()
    setDeployFormError({})
    setDeploySubmitting(true)
    try {
      const res = await apiFetch('/api/equipment-usages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equipmentId: deployTarget.equipmentId,
          schedId: Number(deployForm.schedId),
          notes: deployForm.notes || null,
        }),
      })
      if (!res.ok) { setDeployFormError(await parseApiError(res)); notyfError('Log deployment failed'); return }
      closeDeploy()
      notyfSuccess('Deployment logged.')
      setRefreshKey(k => k + 1)
    } catch (err) {
      setDeployFormError({ _general: err.message })
    } finally {
      setDeploySubmitting(false)
    }
  }

  // ── Edit Deployment ───────────────────────────────────────────────────────
  function openEditDeploy(u) {
    setEditingDeploy(u)
    setEditDeployForm({ schedId: u.schedId, notes: u.notes ?? '' })
    setEditDeployFormError({})
    setEditSchedDisplay(`Sched #${u.schedId} — ${u.schedDate ?? ''}`)
    setEditDeployOpen(true)
  }
  function closeEditDeploy() {
    setEditDeployOpen(false); setEditingDeploy(null)
    setEditDeployForm({}); setEditDeployFormError({})
    setEditSchedDisplay('')
  }

  async function handleEditDeploySubmit(e) {
    e.preventDefault()
    setEditDeployFormError({})
    setEditDeploySubmitting(true)
    try {
      const res = await apiFetch(`/api/equipment-usages/${editingDeploy.usageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schedId: Number(editDeployForm.schedId),
          notes: editDeployForm.notes || null,
        }),
      })
      if (!res.ok) { setEditDeployFormError(await parseApiError(res)); notyfError('Update failed'); return }
      closeEditDeploy()
      notyfSuccess(`Deployment #${editingDeploy.usageId} updated.`)
      // Refresh deployment history
      if (selectedItem) {
        apiFetch(`/api/equipment-usages?equipmentId=${selectedItem.equipmentId}&size=50&sort=loggedOn,desc`)
          .then(r => r.ok ? r.json() : Promise.reject())
          .then(data => setDeployHistory(data.content ?? []))
          .catch(() => {})
      }
    } catch (err) {
      setEditDeployFormError({ _general: err.message })
    } finally {
      setEditDeploySubmitting(false)
    }
  }

  function commitSearch() { setPage(0); setSearch(inputValue) }

  // ── Shared form field handler ─────────────────────────────────────────────
  const fieldChange = setter => e => {
    const { name, value } = e.target
    setter(prev => ({ ...prev, [name]: value }))
  }

  // ── Equipment form fields (reused in Add + Update) ────────────────────────
  function EquipmentFormFields({ form, onChange, errors }) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        <div className="sm:col-span-2 flex flex-col gap-1">
          <label className="label-text font-medium">Name <span className="text-error">*</span></label>
          <input type="text" name="name" maxLength={150} required
            className={`input input-bordered w-full${errors.name ? ' is-invalid' : ''}`}
            placeholder="e.g. Industrial Vacuum Pump"
            value={form.name} onChange={onChange} />
          {errors.name && <span className="helper-text">{errors.name}</span>}
        </div>

        <div className="flex flex-col gap-1">
          <label className="label-text font-medium">Type <span className="text-error">*</span></label>
          <select name="type"
            className={`select select-bordered w-full${errors.type ? ' is-invalid' : ''}`}
            value={form.type} onChange={onChange}>
            <option value="durable">durable</option>
            <option value="consumable">consumable</option>
          </select>
          {errors.type && <span className="helper-text">{errors.type}</span>}
        </div>

        <div className="flex flex-col gap-1">
          <label className="label-text font-medium">Status <span className="text-error">*</span></label>
          <select name="status"
            className={`select select-bordered w-full${errors.status ? ' is-invalid' : ''}`}
            value={form.status} onChange={onChange}>
            <option value="active">active</option>
            <option value="under_maintenance">under_maintenance</option>
            <option value="retired">retired</option>
            <option value="depleted">depleted</option>
          </select>
          {errors.status && <span className="helper-text">{errors.status}</span>}
        </div>

        <div className="flex flex-col gap-1">
          <label className="label-text font-medium">Model</label>
          <input type="text" name="model" maxLength={100}
            className={`input input-bordered w-full${errors.model ? ' is-invalid' : ''}`}
            placeholder="e.g. VP-300X"
            value={form.model} onChange={onChange} />
          {errors.model && <span className="helper-text">{errors.model}</span>}
        </div>

        <div className="flex flex-col gap-1">
          <label className="label-text font-medium">Serial Number</label>
          <input type="text" name="serialNumber" maxLength={100}
            className={`input input-bordered w-full${errors.serialNumber ? ' is-invalid' : ''}`}
            placeholder="e.g. SN-20240501-001"
            value={form.serialNumber} onChange={onChange} />
          {errors.serialNumber && <span className="helper-text">{errors.serialNumber}</span>}
        </div>

        <div className="flex flex-col gap-1">
          <label className="label-text font-medium">Stock <span className="text-error">*</span></label>
          <input type="number" name="stock" min={0} required
            className={`input input-bordered w-full${errors.stock ? ' is-invalid' : ''}`}
            placeholder="1"
            value={form.stock} onChange={onChange} />
          {errors.stock && <span className="helper-text">{errors.stock}</span>}
        </div>

        <div className="flex flex-col gap-1">
          <label className="label-text font-medium">Acquisition Cost</label>
          <input type="number" name="acquisitionCost" min={0} step="0.01"
            className={`input input-bordered w-full${errors.acquisitionCost ? ' is-invalid' : ''}`}
            placeholder="e.g. 12500.00"
            value={form.acquisitionCost} onChange={onChange} />
          {errors.acquisitionCost && <span className="helper-text">{errors.acquisitionCost}</span>}
        </div>

        <div className="sm:col-span-2 flex flex-col gap-1">
          <label className="label-text font-medium">Description</label>
          <textarea name="description" maxLength={500} rows={2}
            className={`textarea textarea-bordered w-full${errors.description ? ' is-invalid' : ''}`}
            placeholder="Brief description of the equipment"
            value={form.description} onChange={onChange} />
          {errors.description && <span className="helper-text">{errors.description}</span>}
        </div>

        <div className="flex flex-col gap-1">
          <label className="label-text font-medium">PO Number <span className="text-base-content/40 font-normal">(optional)</span></label>
          <input type="text" name="poNum" maxLength={30}
            className={`input input-bordered w-full${errors.poNum ? ' is-invalid' : ''}`}
            placeholder="e.g. PO-2024-001"
            value={form.poNum} onChange={onChange} />
          {errors.poNum && <span className="helper-text">{errors.poNum}</span>}
        </div>

        {errors._general && (
          <div className="sm:col-span-2 alert alert-error py-2">
            <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
            <span className="text-sm">{errors._general}</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <Layout activePage="inventory">
      {/* Header */}
      <div className="flex items-stretch justify-between h-16 mb-6">
        <div>
          <h1 className="text-3xl font-semibold">Equipment</h1>
          <p className="text-base-content/60 mt-1">Manage durable and consumable equipment</p>
        </div>
        {canEdit && (
          <button type="button" className="btn btn-primary h-full min-h-0" onClick={() => navigate('/inventory/equipment/new')}>
            <span className="icon-[tabler--plus] size-4"></span>
            Add Equipment
          </button>
        )}
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <div className="relative flex-1 min-w-48">
          <span className="icon-[tabler--search] size-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none"></span>
          <input
            type="text"
            className="input input-bordered w-full pl-9"
            placeholder="Search by name or model..."
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commitSearch() }}
          />
        </div>
        <button type="button" className="btn btn-secondary shrink-0" onClick={commitSearch}>
          <span className="icon-[tabler--search] size-4"></span>
          Search
        </button>

        {/* Type filter */}
        <div className="dropdown relative inline-flex shrink-0">
          <button type="button" className="dropdown-toggle btn btn-secondary" aria-haspopup="menu" aria-expanded="false">
            <span className="icon-[tabler--filter] size-4"></span>
            {typeFilter || 'All Types'}
            <span className="icon-[tabler--chevron-down] dropdown-open:rotate-180 size-4"></span>
          </button>
          <ul className="dropdown-menu dropdown-open:opacity-100 hidden min-w-36" role="menu">
            {['', 'durable', 'consumable'].map(v => (
              <li key={v}><a className={`dropdown-item${typeFilter === v ? ' dropdown-active' : ''}`} href="#" onClick={e => { e.preventDefault(); setPage(0); setTypeFilter(v) }}>{v || 'All Types'}</a></li>
            ))}
          </ul>
        </div>

        {/* Status filter */}
        <div className="dropdown relative inline-flex shrink-0">
          <button type="button" className="dropdown-toggle btn btn-secondary" aria-haspopup="menu" aria-expanded="false">
            <span className="icon-[tabler--filter] size-4"></span>
            {statusFilter || 'All Status'}
            <span className="icon-[tabler--chevron-down] dropdown-open:rotate-180 size-4"></span>
          </button>
          <ul className="dropdown-menu dropdown-open:opacity-100 hidden min-w-44" role="menu">
            {['', 'active', 'under_maintenance', 'retired', 'depleted'].map(v => (
              <li key={v}><a className={`dropdown-item${statusFilter === v ? ' dropdown-active' : ''}`} href="#" onClick={e => { e.preventDefault(); setPage(0); setStatusFilter(v) }}>{v || 'All Status'}</a></li>
            ))}
          </ul>
        </div>
      </div>

      {/* Loading */}
      {loading && <div className="flex justify-center py-20"><span className="loading loading-spinner loading-lg text-primary"></span></div>}

      {/* Error */}
      {error && <div className="alert alert-error"><span className="icon-[tabler--alert-circle] size-5"></span><span>{error}</span></div>}

      {/* Table */}
      {!loading && !error && (
        <>
          <p className="text-sm text-base-content/50 mb-3">
            {totalElements} item{totalElements !== 1 ? 's' : ''} total
            {search && ` · "${search}"`}
            {typeFilter && ` · ${typeFilter}`}
            {statusFilter && ` · ${statusFilter}`}
          </p>

          {equipment.length === 0 ? (
            <div className="text-center py-20 text-base-content/40">
              <span className="icon-[tabler--tool-off] size-12 mx-auto mb-3 block"></span>
              <p>No equipment found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
              <table className="table table-zebra w-full">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Model</th>
                    <th>Stock</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {equipment.map(e => (
                    <tr key={e.equipmentId}>
                      <td className="font-mono font-semibold">{e.equipmentId}</td>
                      <td className="max-w-48">
                        <span className="line-clamp-1 font-medium text-sm" title={e.name}>{e.name}</span>
                        {e.serialNumber && <p className="text-xs text-base-content/50 font-mono">{e.serialNumber}</p>}
                      </td>
                      <td>
                        <span className={`badge badge-soft ${typeBadge(e.type)} text-xs`}>{e.type}</span>
                      </td>
                      <td className="text-sm text-base-content/70">{e.model ?? '—'}</td>
                      <td className="text-sm font-medium">{e.stock}</td>
                      <td>
                        <span className={`badge badge-soft ${statusBadge(e.status)} text-xs`}>{e.status}</span>
                      </td>
                      <td>
                        <button className="btn btn-soft btn-primary btn-sm" onClick={() => setSelectedItem(e)}>
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
                <span className="icon-[tabler--chevron-left] size-4"></span>Prev
              </button>
              <span className="text-sm text-base-content/60">Page {page + 1} of {totalPages}</span>
              <button className="btn btn-sm btn-secondary" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                Next<span className="icon-[tabler--chevron-right] size-4"></span>
              </button>
            </div>
          )}
        </>
      )}

      {/* Manage Panel */}
      <ManageMenu
        isOpen={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        item={selectedItem}
        title={`Equipment #${selectedItem?.equipmentId}`}
        subtitle={selectedItem?.name}
        hasRole={hasRole}
        menuItems={EQUIPMENT_MENU_ITEMS.map(item =>
          item.key === 'log-deploy' && selectedItem?.status !== 'active'
            ? { ...item, disabled: true, disabledTitle: 'Equipment is not active' }
            : item
        )}
        onMenuSelect={handleMenuSelect}
        details={selectedItem ? [
          { label: 'Equipment ID',  value: selectedItem.equipmentId },
          { label: 'Type',          value: <span className={`badge badge-soft ${typeBadge(selectedItem.type)} text-xs`}>{selectedItem.type}</span> },
          { label: 'Status',        value: <span className={`badge badge-soft ${statusBadge(selectedItem.status)} text-xs`}>{selectedItem.status}</span> },
          { label: 'Name',          value: selectedItem.name, fullWidth: true },
          { label: 'Model',         value: selectedItem.model ?? '—' },
          { label: 'Serial Number', value: selectedItem.serialNumber ?? '—' },
          { label: 'Stock',         value: selectedItem.stock },
          { label: 'Acq. Cost',     value: formatCurrency(selectedItem.acquisitionCost) },
          { label: 'PO Number',     value: selectedItem.poNum ?? '—' },
          { label: 'Added On',      value: formatDate(selectedItem.addedOn) },
          selectedItem.description && { label: 'Description', value: selectedItem.description, fullWidth: true },
          {
            fullWidth: true,
            component: (
              <div>
                <p className="text-xs text-base-content/50 uppercase tracking-wide mb-2">Deployment History</p>
                {deployLoading ? (
                  <div className="flex justify-center py-4"><span className="loading loading-spinner loading-sm text-primary"></span></div>
                ) : deployHistory.length === 0 ? (
                  <p className="text-xs text-base-content/40 py-2">No deployments recorded yet.</p>
                ) : (
                  <div className="overflow-x-auto rounded-box border border-base-300">
                    <table className="table table-xs w-full">
                      <thead>
                        <tr>
                          <th>Sched #</th>
                          <th>Date</th>
                          <th>Notes</th>
                          <th>Logged</th>
                          {canEdit && <th>Action</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {deployHistory.map(u => (
                          <tr key={u.usageId}>
                            <td className="font-mono">{u.schedId}</td>
                            <td>{formatDate(u.schedDate)}</td>
                            <td className="max-w-40">
                              <span className="line-clamp-1 text-base-content/70" title={u.notes}>{u.notes || '—'}</span>
                            </td>
                            <td>{formatDate(u.loggedOn)}</td>
                            {canEdit && (
                              <td>
                                <button type="button" className="btn btn-soft btn-secondary btn-xs" onClick={() => openEditDeploy(u)}>
                                  <span className="icon-[tabler--pencil] size-3"></span>Edit
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ),
          },
        ].filter(Boolean) : []}
      />

      {/* Add Equipment Modal */}
      <Modal
        isOpen={addOpen}
        onClose={closeAdd}
        title="Add Equipment"
        footer={
          <>
            <button type="button" className="btn btn-soft btn-secondary" onClick={closeAdd}>Cancel</button>
            <button type="submit" form="equip-add-form" className="btn btn-primary" disabled={addSubmitting}>
              {addSubmitting ? <span className="loading loading-spinner loading-sm"></span> : <span className="icon-[tabler--plus] size-4"></span>}
              Add Equipment
            </button>
          </>
        }
      >
        <form id="equip-add-form" onSubmit={handleAddSubmit}>
          <EquipmentFormFields form={addForm} onChange={fieldChange(setAddForm)} errors={addFormError} />
        </form>
      </Modal>

      {/* Update Equipment Modal */}
      <Modal
        isOpen={updateOpen}
        onClose={closeUpdate}
        title={`Update Equipment #${updatingItem?.equipmentId ?? ''}`}
        footer={
          <>
            <button type="button" className="btn btn-soft btn-secondary" onClick={closeUpdate}>Cancel</button>
            <button type="submit" form="equip-update-form" className="btn btn-primary" disabled={updateSubmitting}>
              {updateSubmitting ? <span className="loading loading-spinner loading-sm"></span> : <span className="icon-[tabler--device-floppy] size-4"></span>}
              Save Changes
            </button>
          </>
        }
      >
        <form id="equip-update-form" onSubmit={handleUpdateSubmit}>
          <EquipmentFormFields form={updateForm} onChange={fieldChange(setUpdateForm)} errors={updateFormError} />
        </form>
      </Modal>

      {/* Log Deployment Modal */}
      <Modal
        isOpen={deployOpen}
        onClose={closeDeploy}
        title={`Log Deployment — ${deployTarget?.name ?? ''}`}
        footer={
          <>
            <button type="button" className="btn btn-soft btn-secondary" onClick={closeDeploy}>Cancel</button>
            <button type="submit" form="equip-deploy-form" className="btn btn-warning" disabled={deploySubmitting}>
              {deploySubmitting ? <span className="loading loading-spinner loading-sm"></span> : <span className="icon-[tabler--calendar-plus] size-4"></span>}
              Log Deployment
            </button>
          </>
        }
      >
        <form id="equip-deploy-form" onSubmit={handleDeploySubmit}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Service Schedule <span className="text-error">*</span></label>
              <div className="flex gap-2">
                <input type="text" readOnly
                  className={`input input-bordered flex-1${deployFormError.schedId ? ' is-invalid' : ''}`}
                  placeholder="No schedule selected"
                  value={deploySchedDisplay} />
                <button type="button" className="btn btn-soft btn-secondary shrink-0" onClick={() => setDeploySchedPickerOpen(true)}>Pick</button>
                {deployForm.schedId && (
                  <button type="button" className="btn btn-soft btn-error shrink-0" onClick={() => { setDeployForm(prev => ({ ...prev, schedId: '' })); setDeploySchedDisplay('') }}>
                    <span className="icon-[tabler--x] size-4"></span>
                  </button>
                )}
              </div>
              {deployFormError.schedId && <span className="helper-text">{deployFormError.schedId}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Notes <span className="text-base-content/40 font-normal">(optional)</span></label>
              <input type="text" name="notes" maxLength={255}
                className={`input input-bordered w-full${deployFormError.notes ? ' is-invalid' : ''}`}
                placeholder="e.g. Brought to site for leak test"
                value={deployForm.notes}
                onChange={e => setDeployForm(prev => ({ ...prev, notes: e.target.value }))} />
              {deployFormError.notes && <span className="helper-text">{deployFormError.notes}</span>}
            </div>

            {deployFormError._general && (
              <div className="alert alert-error py-2">
                <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                <span className="text-sm">{deployFormError._general}</span>
              </div>
            )}
          </div>
        </form>
      </Modal>

      {/* Schedule Picker for Log Deployment */}
      <AnySchedulePickerModal
        isOpen={deploySchedPickerOpen}
        onClose={() => setDeploySchedPickerOpen(false)}
        onSelect={s => {
          setDeployForm(prev => ({ ...prev, schedId: s.schedId }))
          setDeploySchedDisplay(`Sched #${s.schedId} — ${s.date ?? ''} · ${s.purpose ?? ''}`)
          setDeploySchedPickerOpen(false)
        }}
      />

      {/* Edit Deployment Sub-modal */}
      {editDeployOpen && editingDeploy && (
        <>
          <div className="fixed inset-0 bg-base-300/40 z-[55]" onClick={closeEditDeploy} />
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="modal-content w-full max-w-md shadow-xl">
              <div className="modal-header">
                <div>
                  <h3 className="modal-title">Edit Deployment #{editingDeploy.usageId}</h3>
                  <span className="text-sm text-base-content/50">{editingDeploy.equipmentName}</span>
                </div>
                <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={closeEditDeploy}>
                  <span className="icon-[tabler--x] size-4"></span>
                </button>
              </div>
              <div className="modal-body">
                <form id="equip-edit-deploy-form" onSubmit={handleEditDeploySubmit}>
                  <div className="flex flex-col gap-4">

                    <div className="flex flex-col gap-1">
                      <label className="label-text font-medium">Service Schedule <span className="text-error">*</span></label>
                      <div className="flex gap-2">
                        <input type="text" readOnly
                          className={`input input-bordered flex-1${editDeployFormError.schedId ? ' is-invalid' : ''}`}
                          placeholder="No schedule selected"
                          value={editSchedDisplay} />
                        <button type="button" className="btn btn-soft btn-secondary shrink-0" onClick={() => setEditSchedPickerOpen(true)}>Pick</button>
                      </div>
                      {editDeployFormError.schedId && <span className="helper-text">{editDeployFormError.schedId}</span>}
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="label-text font-medium">Notes <span className="text-base-content/40 font-normal">(optional)</span></label>
                      <input type="text" maxLength={255}
                        className={`input input-bordered w-full${editDeployFormError.notes ? ' is-invalid' : ''}`}
                        placeholder="e.g. Brought to site for leak test"
                        value={editDeployForm.notes}
                        onChange={e => setEditDeployForm(prev => ({ ...prev, notes: e.target.value }))} />
                      {editDeployFormError.notes && <span className="helper-text">{editDeployFormError.notes}</span>}
                    </div>

                    {editDeployFormError._general && (
                      <div className="alert alert-error py-2">
                        <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                        <span className="text-sm">{editDeployFormError._general}</span>
                      </div>
                    )}
                  </div>
                </form>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-soft btn-secondary" onClick={closeEditDeploy}>Cancel</button>
                <button type="submit" form="equip-edit-deploy-form" className="btn btn-primary" disabled={editDeploySubmitting}>
                  {editDeploySubmitting ? <span className="loading loading-spinner loading-sm"></span> : <span className="icon-[tabler--device-floppy] size-4"></span>}
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Schedule Picker for Edit Deployment — above sub-modal */}
      <AnySchedulePickerModal
        isOpen={editSchedPickerOpen}
        onClose={() => setEditSchedPickerOpen(false)}
        onSelect={s => {
          setEditDeployForm(prev => ({ ...prev, schedId: s.schedId }))
          setEditSchedDisplay(`Sched #${s.schedId} — ${s.date ?? ''} · ${s.purpose ?? ''}`)
          setEditSchedPickerOpen(false)
        }}
      />
    </Layout>
  )
}
