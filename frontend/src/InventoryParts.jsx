import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from './auth'
import Layout from './Layout'
import Modal from './Modal'
import ManageMenu from './ManageMenu'
import SupplierPickerModal from './SupplierPickerModal'
import PurchaseOrderPickerModal from './PurchaseOrderPickerModal'
import ServiceReportPickerModal from './ServiceReportPickerModal'
import { notyfSuccess, notyfError } from './notyf'

/** Parses a failed API response into field-level or general errors. */
async function parseApiError(res) {
  const data = await res.json().catch(() => ({}))
  if (data.errors) return data.errors
  return { _general: data.message ?? data.error ?? `Error ${res.status}` }
}

/** Returns badge class for part status */
function partStatusBadge(status) {
  if (status === 'received')  return 'badge-success'
  if (status === 'cancelled') return 'badge-error'
  return 'badge-neutral'
}

/** Formats a datetime string to YYYY-MM-DD */
function formatDate(dt) {
  if (!dt) return '—'
  return String(dt).slice(0, 10)
}

/** Formats a number as currency (PHP) */
function formatCurrency(value) {
  if (value == null) return '—'
  return Number(value).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })
}

const PAGE_SIZE = 10

const PART_MENU_ITEMS = [
  { key: 'update',    label: 'Update Details', icon: 'icon-[tabler--pencil]', roles: ['ADMIN', 'ACCOUNTING', 'STAFF'] },
  { key: 'log-usage', label: 'Log Usage',       icon: 'icon-[tabler--tool]',   roles: ['ADMIN', 'ACCOUNTING', 'STAFF'] },
]

const EMPTY_ADD_FORM    = { name: '', quantityOrdered: '', quantityType: '', unitPrice: '', supplierId: '', status: 'ordered' }
const EMPTY_UPDATE_FORM = { name: '', quantityOrdered: '', quantityType: '', unitPrice: '', supplierId: '', status: 'ordered' }
const EMPTY_USAGE_FORM  = { srNumber: '', qtyUsed: '', notes: '' }

export default function InventoryParts() {
  const { apiFetch, hasRole } = useAuth()
  const canEdit = hasRole('ADMIN', 'ACCOUNTING', 'STAFF')
  const [searchParams] = useSearchParams()

  const [parts, setParts]               = useState([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState(null)
  const [inputValue, setInputValue]     = useState('')
  const [search, setSearch]             = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage]                 = useState(0)
  const [totalPages, setTotalPages]     = useState(0)
  const [totalElements, setTotalElements] = useState(0)
  const [refreshKey, setRefreshKey]     = useState(0)

  // Add Part modal
  const [addOpen, setAddOpen]                   = useState(false)
  const [addForm, setAddForm]                   = useState(EMPTY_ADD_FORM)
  const [addFormError, setAddFormError]         = useState({})
  const [addSubmitting, setAddSubmitting]       = useState(false)
  const [addPoNum, setAddPoNum]                 = useState('')
  const [addPoDisplay, setAddPoDisplay]         = useState('')
  const [poPickerOpen, setPoPickerOpen]         = useState(false)
  const [addSupplierDisplay, setAddSupplierDisplay]       = useState('')
  const [addSupplierPickerOpen, setAddSupplierPickerOpen] = useState(false)

  // Details modal
  const [selectedPart, setSelectedPart] = useState(null)
  const [usageHistory, setUsageHistory] = useState([])
  const [usageLoading, setUsageLoading] = useState(false)

  // Log Usage modal
  const [usageOpen, setUsageOpen]             = useState(false)
  const [usagePart, setUsagePart]             = useState(null)
  const [usageForm, setUsageForm]             = useState(EMPTY_USAGE_FORM)
  const [usageFormError, setUsageFormError]   = useState({})
  const [usageSubmitting, setUsageSubmitting] = useState(false)

  // Edit Usage sub-modal
  const [editUsageOpen, setEditUsageOpen]           = useState(false)
  const [editingUsage, setEditingUsage]             = useState(null)
  const [editUsageForm, setEditUsageForm]           = useState({})
  const [editUsageFormError, setEditUsageFormError] = useState({})
  const [editUsageSubmitting, setEditUsageSubmitting] = useState(false)
  const [editSrDisplay, setEditSrDisplay]           = useState('')
  const [srPickerOpen, setSrPickerOpen]             = useState(false)

  // Update modal
  const [updateOpen, setUpdateOpen]           = useState(false)
  const [updatingPart, setUpdatingPart]       = useState(null)
  const [updateForm, setUpdateForm]           = useState(EMPTY_UPDATE_FORM)
  const [updateFormError, setUpdateFormError] = useState({})
  const [updateSubmitting, setUpdateSubmitting] = useState(false)
  const [supplierDisplay, setSupplierDisplay] = useState('')
  const [supplierPickerOpen, setSupplierPickerOpen] = useState(false)

  /** Fetches all parts sorted by most recently added. */
  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({
      page: String(page),
      size: String(PAGE_SIZE),
      sort: 'addedOn,desc',
    })
    if (search) params.set('search', search)
    if (statusFilter) params.set('status', statusFilter)
    apiFetch(`/api/parts?${params}`)
      .then(res => {
        if (!res.ok) throw new Error(`Failed to load parts (${res.status})`)
        return res.json()
      })
      .then(data => {
        if (!active) return
        setParts(data.content ?? [])
        setTotalPages(data.totalPages ?? 0)
        setTotalElements(data.totalElements ?? 0)
      })
      .catch(err => { if (active) setError(err.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [apiFetch, page, refreshKey, search, statusFilter])

  /** Fetches usage history when the Details modal opens for a part. */
  useEffect(() => {
    if (!selectedPart) { setUsageHistory([]); return }
    let active = true
    setUsageLoading(true)
    apiFetch(`/api/part-usages?partId=${selectedPart.partId}&size=50&sort=usedOn,desc`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => { if (active) setUsageHistory(data.content ?? []) })
      .catch(() => { if (active) setUsageHistory([]) })
      .finally(() => { if (active) setUsageLoading(false) })
    return () => { active = false }
  }, [apiFetch, selectedPart])

  function handleMenuSelect(key, item) {
    setSelectedPart(null)
    if (key === 'update') openUpdate(item)
    if (key === 'log-usage') openUsage(item)
  }

  function openEditUsage(u) {
    setEditingUsage(u)
    setEditUsageForm({ srNumber: u.srNumber ?? '', qtyUsed: u.qtyUsed, notes: u.notes ?? '' })
    setEditUsageFormError({})
    setEditUsageOpen(true)
    if (u.srNumber) {
      setEditSrDisplay(`SR #${u.srNumber}`)
      apiFetch(`/api/service-reports/${u.srNumber}`)
        .then(res => res.ok ? res.json() : null)
        .then(sr => { if (sr) setEditSrDisplay(`SR #${sr.srNumber} — ${sr.complaint ?? ''}`) })
        .catch(() => {})
    } else {
      setEditSrDisplay('')
    }
  }

  function closeEditUsage() {
    setEditUsageOpen(false)
    setEditingUsage(null)
    setEditUsageForm({})
    setEditUsageFormError({})
    setEditSrDisplay('')
  }

  async function handleEditUsageSubmit(e) {
    e.preventDefault()
    setEditUsageFormError({})
    setEditUsageSubmitting(true)
    try {
      const res = await apiFetch(`/api/part-usages/${editingUsage.usageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          srNumber: editUsageForm.srNumber ? Number(editUsageForm.srNumber) : null,
          qtyUsed:  Number(editUsageForm.qtyUsed),
          notes:    editUsageForm.notes || null,
        }),
      })
      if (!res.ok) {
        setEditUsageFormError(await parseApiError(res))
        notyfError('Update failed')
        return
      }
      closeEditUsage()
      notyfSuccess(`Usage #${editingUsage.usageId} updated.`)
      if (selectedPart) {
        apiFetch(`/api/part-usages?partId=${selectedPart.partId}&size=50&sort=usedOn,desc`)
          .then(r => r.ok ? r.json() : Promise.reject())
          .then(data => setUsageHistory(data.content ?? []))
          .catch(() => {})
        setRefreshKey(k => k + 1)
      }
    } catch (err) {
      setEditUsageFormError({ _general: err.message })
    } finally {
      setEditUsageSubmitting(false)
    }
  }

  function openUsage(p) {
    setUsagePart(p)
    setUsageForm(EMPTY_USAGE_FORM)
    setUsageFormError({})
    setUsageOpen(true)
  }

  function closeUsage() {
    setUsageOpen(false)
    setUsagePart(null)
    setUsageForm(EMPTY_USAGE_FORM)
    setUsageFormError({})
  }

  function handleUsageFormChange(e) {
    const { name, value } = e.target
    setUsageForm(prev => ({ ...prev, [name]: value }))
  }

  async function handleUsageSubmit(e) {
    e.preventDefault()
    setUsageFormError({})
    setUsageSubmitting(true)
    try {
      const body = {
        partId: usagePart.partId,
        srNumber: usageForm.srNumber ? Number(usageForm.srNumber) : null,
        qtyUsed: Number(usageForm.qtyUsed),
        notes: usageForm.notes || null,
      }
      const res = await apiFetch('/api/part-usages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        setUsageFormError(await parseApiError(res))
        notyfError('Log usage failed')
        return
      }
      closeUsage()
      notyfSuccess('Usage logged successfully.')
      setRefreshKey(k => k + 1)
    } catch (err) {
      setUsageFormError({ _general: err.message })
    } finally {
      setUsageSubmitting(false)
    }
  }

  function openAdd() {
    setAddForm(EMPTY_ADD_FORM)
    setAddFormError({})
    setAddPoNum('')
    setAddPoDisplay('')
    setAddSupplierDisplay('')
    setAddOpen(true)
  }

  function closeAdd() {
    setAddOpen(false)
    setAddForm(EMPTY_ADD_FORM)
    setAddFormError({})
    setAddPoNum('')
    setAddPoDisplay('')
    setAddSupplierDisplay('')
  }

  // Auto-open Add Part modal when ?addPart=1 is in the URL
  useEffect(() => {
    if (canEdit && searchParams.get('addPart') === '1') openAdd()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleAddFormChange(e) {
    const { name, value } = e.target
    setAddForm(prev => ({ ...prev, [name]: value }))
  }

  async function handleAddSubmit(e) {
    e.preventDefault()
    setAddFormError({})
    setAddSubmitting(true)
    try {
      const res = await apiFetch('/api/parts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...addForm,
          quantityOrdered: Number(addForm.quantityOrdered),
          unitPrice:       Number(addForm.unitPrice),
          supplierId:      Number(addForm.supplierId),
          poNum:           addPoNum,
        }),
      })
      if (!res.ok) {
        setAddFormError(await parseApiError(res))
        notyfError('Add part failed')
        return
      }
      closeAdd()
      notyfSuccess('Part added successfully.')
      setRefreshKey(k => k + 1)
    } catch (err) {
      setAddFormError({ _general: err.message })
    } finally {
      setAddSubmitting(false)
    }
  }

  function commitSearch() {
    setPage(0)
    setSearch(inputValue)
  }

  function applyStatusFilter(value) {
    setPage(0)
    setStatusFilter(value)
  }

  function openUpdate(p) {
    setUpdateForm({
      name:            p.name,
      quantityOrdered: p.quantityOrdered,
      quantityType:    p.quantityType,
      unitPrice:       p.unitPrice,
      supplierId:      p.supplierId,
      status:          p.status,
    })
    setSupplierDisplay(`${p.supplierName ?? 'Supplier'} (#${p.supplierId})`)
    setUpdatingPart(p)
    setUpdateFormError({})
    setUpdateOpen(true)
  }

  function closeUpdate() {
    setUpdateOpen(false)
    setUpdatingPart(null)
    setUpdateForm(EMPTY_UPDATE_FORM)
    setUpdateFormError({})
    setSupplierDisplay('')
  }

  function handleUpdateFormChange(e) {
    const { name, value } = e.target
    setUpdateForm(prev => ({ ...prev, [name]: value }))
  }

  async function handleUpdateSubmit(e) {
    e.preventDefault()
    setUpdateFormError({})
    setUpdateSubmitting(true)
    try {
      const res = await apiFetch(`/api/parts/${updatingPart.partId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...updateForm,
          quantityOrdered: Number(updateForm.quantityOrdered),
          unitPrice:       Number(updateForm.unitPrice),
          supplierId:      Number(updateForm.supplierId),
          poNum:           updatingPart.poNum,
          orderDate:       updatingPart.orderDate,
        }),
      })
      if (!res.ok) {
        setUpdateFormError(await parseApiError(res))
        notyfError('Update failed')
        return
      }
      closeUpdate()
      notyfSuccess(`Part #${updatingPart.partId} updated successfully.`)
      setRefreshKey(k => k + 1)
    } catch (err) {
      setUpdateFormError({ _general: err.message })
    } finally {
      setUpdateSubmitting(false)
    }
  }

  return (
    <Layout activePage="inventory">
      {/* Header */}
      <div className="flex items-stretch justify-between h-16 mb-6">
        <div>
          <h1 className="text-3xl font-semibold">Parts</h1>
          <p className="text-base-content/60 mt-1">All parts across purchase orders, sorted by most recently added</p>
        </div>
        {canEdit && (
          <button
            type="button"
            className="btn btn-primary h-full min-h-0"
            onClick={openAdd}
          >
            <span className="icon-[tabler--plus] size-4"></span>
            Add Part
          </button>
        )}
      </div>

      {/* Search + Filter */}
      <div className="flex gap-2 mb-6">
        <div className="relative flex-1">
          <span className="icon-[tabler--search] size-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none"></span>
          <input
            type="text"
            className="input input-bordered w-full pl-9"
            placeholder="Search by name or PO number..."
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commitSearch() }}
          />
        </div>
        <button type="button" className="btn btn-secondary shrink-0" onClick={commitSearch}>
          <span className="icon-[tabler--search] size-4"></span>
          Search
        </button>
        <div className="dropdown relative inline-flex shrink-0">
          <button id="status-filter-dropdown" type="button" className="dropdown-toggle btn btn-secondary" aria-haspopup="menu" aria-expanded="false" aria-label="Filter by status">
            <span className="icon-[tabler--filter] size-4"></span>
            {statusFilter || 'All Status'}
            <span className="icon-[tabler--chevron-down] dropdown-open:rotate-180 size-4"></span>
          </button>
          <ul className="dropdown-menu dropdown-open:opacity-100 hidden min-w-40" role="menu" aria-orientation="vertical" aria-labelledby="status-filter-dropdown">
            <li><a className={`dropdown-item${statusFilter === '' ? ' dropdown-active' : ''}`} href="#" onClick={e => { e.preventDefault(); applyStatusFilter('') }}>All Status</a></li>
            <li><a className={`dropdown-item${statusFilter === 'ordered' ? ' dropdown-active' : ''}`} href="#" onClick={e => { e.preventDefault(); applyStatusFilter('ordered') }}>ordered</a></li>
            <li><a className={`dropdown-item${statusFilter === 'received' ? ' dropdown-active' : ''}`} href="#" onClick={e => { e.preventDefault(); applyStatusFilter('received') }}>received</a></li>
            <li><a className={`dropdown-item${statusFilter === 'cancelled' ? ' dropdown-active' : ''}`} href="#" onClick={e => { e.preventDefault(); applyStatusFilter('cancelled') }}>cancelled</a></li>
          </ul>
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
            {totalElements} part{totalElements !== 1 ? 's' : ''} total
            {search && ` · "${search}"`}
            {statusFilter && ` · ${statusFilter}`}
          </p>

          {parts.length === 0 ? (
            <div className="text-center py-20 text-base-content/40">
              <span className="icon-[tabler--package-off] size-12 mx-auto mb-3 block"></span>
              <p>No parts found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
              <table className="table table-zebra w-full">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>PO Number</th>
                    <th>Name</th>
                    <th>QTY</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {parts.map(p => (
                    <tr key={p.partId}>
                      <td className="font-mono font-semibold">{p.partId}</td>
                      <td className="font-mono text-sm">{p.poNum}</td>
                      <td className="max-w-56">
                        <span className="line-clamp-1 text-sm" title={p.name}>{p.name}</span>
                      </td>
                      <td className="text-sm">
                        <span className={p.availableQty === 0 ? 'text-error font-semibold' : ''}>
                          {p.availableQty} {p.quantityType}
                        </span>
                      </td>
                      <td>
                        <span className={`badge badge-soft ${partStatusBadge(p.status)} text-xs`}>
                          {p.status}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn-soft btn-primary btn-sm"
                          onClick={() => setSelectedPart(p)}
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

      {/* Manage Part */}
      <ManageMenu
        isOpen={!!selectedPart}
        onClose={() => setSelectedPart(null)}
        item={selectedPart}
        title={`Part #${selectedPart?.partId}`}
        subtitle={selectedPart?.name}
        hasRole={hasRole}
        menuItems={PART_MENU_ITEMS.map(item =>
          item.key === 'log-usage' && selectedPart?.availableQty === 0
            ? { ...item, disabled: true, disabledTitle: 'No stock available' }
            : item
        )}
        onMenuSelect={handleMenuSelect}
        details={selectedPart ? [
          { label: 'Part ID',     value: selectedPart.partId },
          { label: 'Status',      value: <span className={`badge badge-soft ${partStatusBadge(selectedPart.status)} text-xs`}>{selectedPart.status}</span> },
          { label: 'Name',        value: selectedPart.name, fullWidth: true },
          { label: 'Qty Ordered', value: `${selectedPart.quantityOrdered} ${selectedPart.quantityType}` },
          { label: 'Available',   value: <span className={selectedPart.availableQty === 0 ? 'text-error font-semibold' : ''}>{selectedPart.availableQty} {selectedPart.quantityType}</span> },
          { label: 'Unit Price',  value: formatCurrency(selectedPart.unitPrice) },
          { label: 'Subtotal',    value: <span className="text-primary font-semibold">{formatCurrency(Number(selectedPart.quantityOrdered) * Number(selectedPart.unitPrice ?? 0))}</span> },
          { label: 'Supplier',    value: `(${selectedPart.supplierId}) ${selectedPart.supplierName ?? '—'}` },
          { label: 'Order Date',  value: formatDate(selectedPart.orderDate) },
          { label: 'PO Number',   value: selectedPart.poNum },
          { label: 'Added On',    value: formatDate(selectedPart.addedOn) },
          {
            fullWidth: true,
            component: (
              <div>
                <p className="text-xs text-base-content/50 uppercase tracking-wide mb-2">Usage History</p>
                {usageLoading ? (
                  <div className="flex justify-center py-4">
                    <span className="loading loading-spinner loading-sm text-primary"></span>
                  </div>
                ) : usageHistory.length === 0 ? (
                  <p className="text-xs text-base-content/40 py-2">No usage recorded yet.</p>
                ) : (
                  <div className="overflow-x-auto rounded-box border border-base-300">
                    <table className="table table-xs w-full">
                      <thead>
                        <tr>
                          <th>SR #</th>
                          <th>Qty Used</th>
                          <th>Notes</th>
                          <th>Date</th>
                          {canEdit && <th>Action</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {usageHistory.map(u => (
                          <tr key={u.usageId}>
                            <td className="font-mono">{u.srNumber ?? '—'}</td>
                            <td>{u.qtyUsed}</td>
                            <td className="max-w-40">
                              <span className="line-clamp-1 text-base-content/70" title={u.notes}>{u.notes || '—'}</span>
                            </td>
                            <td>{formatDate(u.usedOn)}</td>
                            {canEdit && (
                              <td>
                                <button
                                  type="button"
                                  className="btn btn-soft btn-secondary btn-xs"
                                  onClick={() => openEditUsage(u)}
                                >
                                  <span className="icon-[tabler--pencil] size-3"></span>
                                  Edit
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
        ] : []}
      />

      {/* Update Part Modal */}
      <Modal
        isOpen={updateOpen}
        onClose={closeUpdate}
        title={`Update Part #${updatingPart?.partId ?? ''}`}
        footer={
          <>
            <button type="button" className="btn btn-soft btn-secondary" onClick={closeUpdate}>
              Cancel
            </button>
            <button type="submit" form="parts-update-form" className="btn btn-primary" disabled={updateSubmitting}>
              {updateSubmitting
                ? <span className="loading loading-spinner loading-sm"></span>
                : <span className="icon-[tabler--device-floppy] size-4"></span>
              }
              Save Changes
            </button>
          </>
        }
      >
        <form id="parts-update-form" onSubmit={handleUpdateSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="label-text font-medium">Name <span className="text-error">*</span></label>
              <input type="text" name="name"
                className={`input input-bordered w-full${updateFormError.name ? ' is-invalid' : ''}`}
                maxLength={255} required
                value={updateForm.name} onChange={handleUpdateFormChange} />
              {updateFormError.name && <span className="helper-text">{updateFormError.name}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Quantity Ordered <span className="text-error">*</span></label>
              <input type="number" name="quantityOrdered" min={0}
                className={`input input-bordered w-full${updateFormError.quantityOrdered ? ' is-invalid' : ''}`}
                required value={updateForm.quantityOrdered} onChange={handleUpdateFormChange} />
              {updateFormError.quantityOrdered && <span className="helper-text">{updateFormError.quantityOrdered}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Quantity Type <span className="text-error">*</span></label>
              <input type="text" name="quantityType" maxLength={30}
                className={`input input-bordered w-full${updateFormError.quantityType ? ' is-invalid' : ''}`}
                required value={updateForm.quantityType} onChange={handleUpdateFormChange} />
              {updateFormError.quantityType && <span className="helper-text">{updateFormError.quantityType}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Unit Price <span className="text-error">*</span></label>
              <input type="number" name="unitPrice" min={0} step="0.01"
                className={`input input-bordered w-full${updateFormError.unitPrice ? ' is-invalid' : ''}`}
                required value={updateForm.unitPrice} onChange={handleUpdateFormChange} />
              {updateFormError.unitPrice && <span className="helper-text">{updateFormError.unitPrice}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Supplier <span className="text-error">*</span></label>
              <div className="flex gap-2">
                <input type="text" readOnly
                  className={`input input-bordered flex-1${updateFormError.supplierId ? ' is-invalid' : ''}`}
                  placeholder="No supplier selected"
                  value={supplierDisplay} />
                <button type="button" className="btn btn-soft btn-secondary shrink-0"
                  onClick={() => setSupplierPickerOpen(true)}>
                  Pick
                </button>
              </div>
              {updateFormError.supplierId && <span className="helper-text">{updateFormError.supplierId}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Status</label>
              <select name="status"
                className={`select select-bordered w-full${updateFormError.status ? ' is-invalid' : ''}`}
                value={updateForm.status} onChange={handleUpdateFormChange}>
                <option value="ordered">ordered</option>
                <option value="received">received</option>
                <option value="cancelled">cancelled</option>
              </select>
              {updateFormError.status && <span className="helper-text">{updateFormError.status}</span>}
            </div>

            {updateFormError._general && (
              <div className="sm:col-span-2 alert alert-error py-2">
                <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                <span className="text-sm">{updateFormError._general}</span>
              </div>
            )}
          </div>
        </form>
      </Modal>

      {/* Log Usage Modal */}
      <Modal
        isOpen={usageOpen}
        onClose={closeUsage}
        title={`Log Usage — Part #${usagePart?.partId ?? ''}`}
        footer={
          <>
            <button type="button" className="btn btn-soft btn-secondary" onClick={closeUsage}>
              Cancel
            </button>
            <button type="submit" form="parts-usage-form" className="btn btn-warning" disabled={usageSubmitting}>
              {usageSubmitting
                ? <span className="loading loading-spinner loading-sm"></span>
                : <span className="icon-[tabler--tool] size-4"></span>
              }
              Log Usage
            </button>
          </>
        }
      >
        <form id="parts-usage-form" onSubmit={handleUsageSubmit}>
          {usagePart && (
            <p className="text-sm text-base-content/60 mb-4">
              <span className="font-medium">{usagePart.name}</span>
              &nbsp;·&nbsp;Available: <span className="font-medium">{usagePart.availableQty} {usagePart.quantityType}</span>
            </p>
          )}
          <div className="flex flex-col gap-4">

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Quantity Used <span className="text-error">*</span></label>
              <input type="number" name="qtyUsed" min={1} max={usagePart?.availableQty ?? undefined}
                className={`input input-bordered w-full${usageFormError.qtyUsed ? ' is-invalid' : ''}`}
                placeholder="e.g. 2" required
                value={usageForm.qtyUsed} onChange={handleUsageFormChange} />
              {usageFormError.qtyUsed && <span className="helper-text">{usageFormError.qtyUsed}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">SR Number <span className="text-base-content/40 font-normal">(optional)</span></label>
              <input type="number" name="srNumber" min={1}
                className={`input input-bordered w-full${usageFormError.srNumber ? ' is-invalid' : ''}`}
                placeholder="e.g. 5 — leave blank if not from an SR"
                value={usageForm.srNumber} onChange={handleUsageFormChange} />
              {usageFormError.srNumber && <span className="helper-text">{usageFormError.srNumber}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Notes <span className="text-base-content/40 font-normal">(optional)</span></label>
              <input type="text" name="notes" maxLength={255}
                className={`input input-bordered w-full${usageFormError.notes ? ' is-invalid' : ''}`}
                placeholder="e.g. Used during emergency repair"
                value={usageForm.notes} onChange={handleUsageFormChange} />
              {usageFormError.notes && <span className="helper-text">{usageFormError.notes}</span>}
            </div>

            {usageFormError._general && (
              <div className="alert alert-error py-2">
                <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                <span className="text-sm">{usageFormError._general}</span>
              </div>
            )}
          </div>
        </form>
      </Modal>

      {/* Supplier Picker — for Update form */}
      <SupplierPickerModal
        isOpen={supplierPickerOpen}
        onClose={() => setSupplierPickerOpen(false)}
        onSelect={s => {
          setUpdateForm(prev => ({ ...prev, supplierId: s.supplierId }))
          setSupplierDisplay(`${s.name} (#${s.supplierId})`)
          setSupplierPickerOpen(false)
        }}
      />

      {/* Add Part Modal */}
      <Modal
        isOpen={addOpen}
        onClose={closeAdd}
        title="Add Part"
        footer={
          <>
            <button type="button" className="btn btn-soft btn-secondary" onClick={closeAdd}>
              Cancel
            </button>
            <button type="submit" form="parts-add-form" className="btn btn-primary" disabled={addSubmitting}>
              {addSubmitting
                ? <span className="loading loading-spinner loading-sm"></span>
                : <span className="icon-[tabler--plus] size-4"></span>
              }
              Add Part
            </button>
          </>
        }
      >
        <form id="parts-add-form" onSubmit={handleAddSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="label-text font-medium">Purchase Order <span className="text-error">*</span></label>
              <div className="flex gap-2">
                <input type="text" readOnly
                  className={`input input-bordered flex-1${addFormError.poNum ? ' is-invalid' : ''}`}
                  placeholder="No purchase order selected"
                  value={addPoDisplay} />
                <button type="button" className="btn btn-soft btn-secondary shrink-0"
                  onClick={() => setPoPickerOpen(true)}>
                  Pick
                </button>
              </div>
              {addFormError.poNum && <span className="helper-text">{addFormError.poNum}</span>}
            </div>

            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="label-text font-medium">Name <span className="text-error">*</span></label>
              <input type="text" name="name"
                className={`input input-bordered w-full${addFormError.name ? ' is-invalid' : ''}`}
                placeholder="e.g. Compressor Unit" maxLength={255} required
                value={addForm.name} onChange={handleAddFormChange} />
              {addFormError.name && <span className="helper-text">{addFormError.name}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Quantity Ordered <span className="text-error">*</span></label>
              <input type="number" name="quantityOrdered" min={0}
                className={`input input-bordered w-full${addFormError.quantityOrdered ? ' is-invalid' : ''}`}
                placeholder="e.g. 2" required
                value={addForm.quantityOrdered} onChange={handleAddFormChange} />
              {addFormError.quantityOrdered && <span className="helper-text">{addFormError.quantityOrdered}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Quantity Type <span className="text-error">*</span></label>
              <input type="text" name="quantityType" maxLength={30}
                className={`input input-bordered w-full${addFormError.quantityType ? ' is-invalid' : ''}`}
                placeholder="e.g. pcs" required
                value={addForm.quantityType} onChange={handleAddFormChange} />
              {addFormError.quantityType && <span className="helper-text">{addFormError.quantityType}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Unit Price <span className="text-error">*</span></label>
              <input type="number" name="unitPrice" min={0} step="0.01"
                className={`input input-bordered w-full${addFormError.unitPrice ? ' is-invalid' : ''}`}
                placeholder="e.g. 1500.00" required
                value={addForm.unitPrice} onChange={handleAddFormChange} />
              {addFormError.unitPrice && <span className="helper-text">{addFormError.unitPrice}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Supplier <span className="text-error">*</span></label>
              <div className="flex gap-2">
                <input type="text" readOnly
                  className={`input input-bordered flex-1${addFormError.supplierId ? ' is-invalid' : ''}`}
                  placeholder="No supplier selected"
                  value={addSupplierDisplay} />
                <button type="button" className="btn btn-soft btn-secondary shrink-0"
                  onClick={() => setAddSupplierPickerOpen(true)}>
                  Pick
                </button>
              </div>
              {addFormError.supplierId && <span className="helper-text">{addFormError.supplierId}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Status</label>
              <select name="status"
                className={`select select-bordered w-full${addFormError.status ? ' is-invalid' : ''}`}
                value={addForm.status} onChange={handleAddFormChange}>
                <option value="ordered">ordered</option>
                <option value="received">received</option>
                <option value="cancelled">cancelled</option>
              </select>
              {addFormError.status && <span className="helper-text">{addFormError.status}</span>}
            </div>

            {addFormError._general && (
              <div className="sm:col-span-2 alert alert-error py-2">
                <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                <span className="text-sm">{addFormError._general}</span>
              </div>
            )}
          </div>
        </form>
      </Modal>

      {/* Purchase Order Picker — for Add Part form */}
      <PurchaseOrderPickerModal
        isOpen={poPickerOpen}
        onClose={() => setPoPickerOpen(false)}
        onSelect={o => {
          setAddPoNum(o.poNum)
          setAddPoDisplay(`${o.poNum} — ${o.purpose ?? ''}`)
          setPoPickerOpen(false)
        }}
      />

      {/* Supplier Picker — for Add Part form */}
      <SupplierPickerModal
        isOpen={addSupplierPickerOpen}
        onClose={() => setAddSupplierPickerOpen(false)}
        onSelect={s => {
          setAddForm(prev => ({ ...prev, supplierId: s.supplierId }))
          setAddSupplierDisplay(`${s.name} (#${s.supplierId})`)
          setAddSupplierPickerOpen(false)
        }}
      />

      {/* Edit Usage Sub-modal */}
      {editUsageOpen && editingUsage && (
        <>
          <div className="fixed inset-0 bg-base-300/40 z-[55]" onClick={closeEditUsage} />
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="modal-content w-full max-w-md shadow-xl">
              <div className="modal-header">
                <div>
                  <h3 className="modal-title">Edit Usage #{editingUsage.usageId}</h3>
                  <span className="text-sm text-base-content/50">{editingUsage.partName}</span>
                </div>
                <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={closeEditUsage}>
                  <span className="icon-[tabler--x] size-4"></span>
                </button>
              </div>
              <div className="modal-body">
                <form id="parts-edit-usage-form" onSubmit={handleEditUsageSubmit}>
                  <div className="flex flex-col gap-4">

                    <div className="flex flex-col gap-1">
                      <label className="label-text font-medium">Quantity Used <span className="text-error">*</span></label>
                      <input
                        type="number" min={1}
                        className={`input input-bordered w-full${editUsageFormError.qtyUsed ? ' is-invalid' : ''}`}
                        value={editUsageForm.qtyUsed}
                        onChange={e => setEditUsageForm(prev => ({ ...prev, qtyUsed: e.target.value }))}
                        required
                      />
                      {editUsageFormError.qtyUsed && <span className="helper-text">{editUsageFormError.qtyUsed}</span>}
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="label-text font-medium">Service Report <span className="text-base-content/40 font-normal">(optional)</span></label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          readOnly
                          className={`input input-bordered flex-1${editUsageFormError.srNumber ? ' is-invalid' : ''}`}
                          placeholder="None — not linked to an SR"
                          value={editSrDisplay}
                        />
                        <button
                          type="button"
                          className="btn btn-soft btn-secondary shrink-0"
                          onClick={() => setSrPickerOpen(true)}
                        >
                          Pick
                        </button>
                        {editUsageForm.srNumber && (
                          <button
                            type="button"
                            className="btn btn-soft btn-error shrink-0"
                            title="Clear SR link"
                            onClick={() => {
                              setEditUsageForm(prev => ({ ...prev, srNumber: '' }))
                              setEditSrDisplay('')
                            }}
                          >
                            <span className="icon-[tabler--x] size-4"></span>
                          </button>
                        )}
                      </div>
                      {editUsageFormError.srNumber && <span className="helper-text">{editUsageFormError.srNumber}</span>}
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="label-text font-medium">Notes <span className="text-base-content/40 font-normal">(optional)</span></label>
                      <input
                        type="text" maxLength={255}
                        className={`input input-bordered w-full${editUsageFormError.notes ? ' is-invalid' : ''}`}
                        placeholder="e.g. Used during emergency repair"
                        value={editUsageForm.notes}
                        onChange={e => setEditUsageForm(prev => ({ ...prev, notes: e.target.value }))}
                      />
                      {editUsageFormError.notes && <span className="helper-text">{editUsageFormError.notes}</span>}
                    </div>

                    {editUsageFormError._general && (
                      <div className="alert alert-error py-2">
                        <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                        <span className="text-sm">{editUsageFormError._general}</span>
                      </div>
                    )}
                  </div>
                </form>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-soft btn-secondary" onClick={closeEditUsage}>
                  Cancel
                </button>
                <button type="submit" form="parts-edit-usage-form" className="btn btn-primary" disabled={editUsageSubmitting}>
                  {editUsageSubmitting
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

      {/* SR Picker — sits above Edit Usage sub-modal */}
      <ServiceReportPickerModal
        isOpen={srPickerOpen}
        onClose={() => setSrPickerOpen(false)}
        onSelect={sr => {
          setEditUsageForm(prev => ({ ...prev, srNumber: sr.srNumber }))
          setEditSrDisplay(`SR #${sr.srNumber} — ${sr.complaint ?? sr.projectName ?? ''}`)
          setSrPickerOpen(false)
        }}
      />
    </Layout>
  )
}
