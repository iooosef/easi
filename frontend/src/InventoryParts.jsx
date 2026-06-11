import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from './auth'
import { useModal } from './modals/index.js'
import Layout from './Layout'
import ModalNav from './modals/ModalNav.jsx'
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

const EMPTY_ADD_FORM   = { name: '', quantityOrdered: '', quantityType: '', unitPrice: '', supplierId: '', status: 'ordered' }
const EMPTY_USAGE_FORM = { srNumber: '', qtyUsed: '', notes: '' }

// ---------------------------------------------------------------------------
// Picker layer components — each is its own component so pushModal receives
// a stable component, not an inline closure.
// ---------------------------------------------------------------------------

/** Picker layer: Purchase Order */
function POPickerLayer({ onSelect }) {
  const { popModal } = useModal()
  return (
    <PurchaseOrderPickerModal
      asLayer
      isOpen={true}
      onClose={popModal}
      onSelect={o => { onSelect(o); popModal() }}
    />
  )
}

/** Picker layer: Supplier */
function SupplierPickerLayer({ onSelect }) {
  const { popModal } = useModal()
  return (
    <SupplierPickerModal
      asLayer={true}
      isOpen={true}
      onClose={popModal}
      onSelect={s => { onSelect(s); popModal() }}
    />
  )
}

/** Picker layer: Service Report */
function SRPickerLayer({ onSelect }) {
  const { popModal } = useModal()
  return (
    <ServiceReportPickerModal
      asLayer
      isOpen={true}
      onClose={popModal}
      onSelect={sr => { onSelect(sr); popModal() }}
    />
  )
}

// ---------------------------------------------------------------------------
// Detail grid helper
// ---------------------------------------------------------------------------

/** Single labeled cell in the details grid */
function DetailItem({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-base-content/50 uppercase tracking-wide">{label}</span>
      <span className="text-sm font-medium text-base-content">{value ?? '—'}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Modal components
// ---------------------------------------------------------------------------

/** Layer 3 — edit an existing usage record */
function EditUsageModal({ usage, onSuccess }) {
  const { popModal, pushModal } = useModal()
  const { apiFetch } = useAuth()
  const [form, setForm] = useState({ qtyUsed: usage.qtyUsed, srNumber: usage.srNumber ?? '', notes: usage.notes ?? '' })
  const [formError, setFormError] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [srDisplay, setSrDisplay] = useState('')

  useEffect(() => {
    if (!usage.srNumber) return
    setSrDisplay(`SR #${usage.srNumber}`)
    apiFetch(`/api/service-reports/${usage.srNumber}`)
      .then(res => res.ok ? res.json() : null)
      .then(sr => { if (sr) setSrDisplay(`SR #${sr.srNumber} — ${sr.complaint ?? ''}`) })
      .catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError({})
    setSubmitting(true)
    try {
      const res = await apiFetch(`/api/part-usages/${usage.usageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          srNumber: form.srNumber ? Number(form.srNumber) : null,
          qtyUsed:  Number(form.qtyUsed),
          notes:    form.notes || null,
        }),
      })
      if (!res.ok) {
        setFormError(await parseApiError(res))
        notyfError('Update failed')
        return
      }
      notyfSuccess(`Usage #${usage.usageId} updated.`)
      popModal()
      onSuccess?.()
    } catch (err) {
      setFormError({ _general: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-content w-full max-w-md my-auto">
      <div className="modal-header">
        <div>
          <h3 className="modal-title">Edit Usage #{usage.usageId}</h3>
          <span className="text-sm text-base-content/50">{usage.partName}</span>
        </div>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body">
        <form id="parts-edit-usage-form" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4">

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Quantity Used <span className="text-error">*</span></label>
              <input
                type="number" min={1}
                className={`input input-bordered w-full${formError.qtyUsed ? ' is-invalid' : ''}`}
                value={form.qtyUsed}
                onChange={e => setForm(prev => ({ ...prev, qtyUsed: e.target.value }))}
                required
              />
              {formError.qtyUsed && <span className="helper-text">{formError.qtyUsed}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Service Report <span className="text-base-content/40 font-normal">(optional)</span></label>
              <div className="flex gap-2">
                <input
                  type="text" readOnly
                  className={`input input-bordered flex-1${formError.srNumber ? ' is-invalid' : ''}`}
                  placeholder="None — not linked to an SR"
                  value={srDisplay}
                />
                <button
                  type="button"
                  className="btn btn-soft btn-secondary shrink-0"
                  onClick={() => pushModal(<SRPickerLayer onSelect={sr => {
                    setForm(prev => ({ ...prev, srNumber: sr.srNumber }))
                    setSrDisplay(`SR #${sr.srNumber} — ${sr.complaint ?? sr.projectName ?? ''}`)
                  }} />)}
                >
                  Pick
                </button>
                {form.srNumber && (
                  <button
                    type="button"
                    className="btn btn-soft btn-error shrink-0"
                    title="Clear SR link"
                    onClick={() => { setForm(prev => ({ ...prev, srNumber: '' })); setSrDisplay('') }}
                  >
                    <span className="icon-[tabler--x] size-4"></span>
                  </button>
                )}
              </div>
              {formError.srNumber && <span className="helper-text">{formError.srNumber}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Notes <span className="text-base-content/40 font-normal">(optional)</span></label>
              <input
                type="text" maxLength={255}
                className={`input input-bordered w-full${formError.notes ? ' is-invalid' : ''}`}
                placeholder="e.g. Used during emergency repair"
                value={form.notes}
                onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
              />
              {formError.notes && <span className="helper-text">{formError.notes}</span>}
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
        <button type="submit" form="parts-edit-usage-form" className="btn btn-primary" disabled={submitting}>
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

/** Layer 2 — log a new usage for a part */
function LogUsageModal({ part, onSuccess }) {
  const { popModal, pushModal } = useModal()
  const { apiFetch } = useAuth()
  const [form, setForm] = useState(EMPTY_USAGE_FORM)
  const [formError, setFormError] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [srDisplay, setSrDisplay] = useState('')

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError({})
    setSubmitting(true)
    try {
      const res = await apiFetch('/api/part-usages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partId:   part.partId,
          srNumber: form.srNumber ? Number(form.srNumber) : null,
          qtyUsed:  Number(form.qtyUsed),
          notes:    form.notes || null,
        }),
      })
      if (!res.ok) {
        setFormError(await parseApiError(res))
        notyfError('Log usage failed')
        return
      }
      notyfSuccess('Usage logged successfully.')
      popModal()
      onSuccess?.()
    } catch (err) {
      setFormError({ _general: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-content w-full max-w-lg my-auto">
      <div className="modal-header">
        <h3 className="modal-title">Log Usage — Part #{part.partId}</h3>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body">
        <form id="parts-usage-form" onSubmit={handleSubmit}>
          <p className="text-sm text-base-content/60 mb-4">
            <span className="font-medium">{part.name}</span>
            &nbsp;·&nbsp;Available: <span className="font-medium">{part.availableQty} {part.quantityType}</span>
          </p>
          <div className="flex flex-col gap-4">

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="label-text font-medium">Quantity Used <span className="text-error">*</span></label>
                <button type="button" className="btn btn-xs btn-soft btn-primary"
                  onClick={() => setForm(prev => ({ ...prev, qtyUsed: part.availableQty }))}>
                  Use All
                </button>
              </div>
              <input type="number" name="qtyUsed" min={1} max={part.availableQty}
                className={`input input-bordered w-full${formError.qtyUsed ? ' is-invalid' : ''}`}
                placeholder="e.g. 2" required
                value={form.qtyUsed} onChange={handleChange} />
              {formError.qtyUsed && <span className="helper-text">{formError.qtyUsed}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Service Report <span className="text-base-content/40 font-normal">(optional)</span></label>
              <div className="flex gap-2">
                <input
                  type="text" readOnly
                  className={`input input-bordered flex-1${formError.srNumber ? ' is-invalid' : ''}`}
                  placeholder="None — not linked to an SR"
                  value={srDisplay}
                />
                <button
                  type="button"
                  className="btn btn-soft btn-secondary shrink-0"
                  onClick={() => pushModal(<SRPickerLayer onSelect={sr => {
                    setForm(prev => ({ ...prev, srNumber: sr.srNumber }))
                    setSrDisplay(`SR #${sr.srNumber} — ${sr.complaint ?? sr.projectName ?? ''}`)
                  }} />)}
                >
                  Select Service Report
                </button>
                {form.srNumber && (
                  <button
                    type="button"
                    className="btn btn-soft btn-error shrink-0"
                    title="Clear SR link"
                    onClick={() => { setForm(prev => ({ ...prev, srNumber: '' })); setSrDisplay('') }}
                  >
                    <span className="icon-[tabler--x] size-4"></span>
                  </button>
                )}
              </div>
              {formError.srNumber && <span className="helper-text">{formError.srNumber}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Notes <span className="text-base-content/40 font-normal">(optional)</span></label>
              <input type="text" name="notes" maxLength={255}
                className={`input input-bordered w-full${formError.notes ? ' is-invalid' : ''}`}
                placeholder="e.g. Used during emergency repair"
                value={form.notes} onChange={handleChange} />
              {formError.notes && <span className="helper-text">{formError.notes}</span>}
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
        <button type="submit" form="parts-usage-form" className="btn btn-warning" disabled={submitting}>
          {submitting
            ? <span className="loading loading-spinner loading-sm"></span>
            : <span className="icon-[tabler--tool] size-4"></span>
          }
          Log Usage
        </button>
      </div>
    </div>
  )
}

/** Layer 2 — update part details; sits on top of ManagePartModal */
function UpdatePartModal({ part, onRefresh }) {
  const { popModal, pushModal } = useModal()
  const { apiFetch } = useAuth()
  const [form, setForm] = useState({
    name:            part.name,
    quantityOrdered: part.quantityOrdered,
    quantityType:    part.quantityType,
    unitPrice:       part.unitPrice,
    supplierId:      part.supplierId,
    status:          part.status,
  })
  const [formError, setFormError] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [supplierDisplay, setSupplierDisplay] = useState(`${part.supplierName ?? 'Supplier'} (#${part.supplierId})`)

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError({})
    setSubmitting(true)
    try {
      const res = await apiFetch(`/api/parts/${part.partId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          quantityOrdered: Number(form.quantityOrdered),
          unitPrice:       Number(form.unitPrice),
          supplierId:      Number(form.supplierId),
          poNum:           part.poNum,
          orderDate:       part.orderDate,
        }),
      })
      if (!res.ok) {
        setFormError(await parseApiError(res))
        notyfError('Update failed')
        return
      }
      notyfSuccess(`Part #${part.partId} updated successfully.`)
      popModal()
      onRefresh?.()
    } catch (err) {
      setFormError({ _general: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-content w-full max-w-2xl my-auto">
      <div className="modal-header">
        <h3 className="modal-title">Update Part #{part.partId}</h3>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body">
        <form id="parts-update-form" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="label-text font-medium">Name <span className="text-error">*</span></label>
              <input type="text" name="name"
                className={`input input-bordered w-full${formError.name ? ' is-invalid' : ''}`}
                maxLength={255} required
                value={form.name} onChange={handleChange} />
              {formError.name && <span className="helper-text">{formError.name}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Quantity Ordered <span className="text-error">*</span></label>
              <input type="number" name="quantityOrdered" min={0}
                className={`input input-bordered w-full${formError.quantityOrdered ? ' is-invalid' : ''}`}
                required value={form.quantityOrdered} onChange={handleChange} />
              {formError.quantityOrdered && <span className="helper-text">{formError.quantityOrdered}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Quantity Type <span className="text-error">*</span></label>
              <input type="text" name="quantityType" maxLength={30}
                className={`input input-bordered w-full${formError.quantityType ? ' is-invalid' : ''}`}
                required value={form.quantityType} onChange={handleChange} />
              {formError.quantityType && <span className="helper-text">{formError.quantityType}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Unit Price <span className="text-error">*</span></label>
              <input type="number" name="unitPrice" min={0} step="0.01"
                className={`input input-bordered w-full${formError.unitPrice ? ' is-invalid' : ''}`}
                required value={form.unitPrice} onChange={handleChange} />
              {formError.unitPrice && <span className="helper-text">{formError.unitPrice}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Supplier <span className="text-error">*</span></label>
              <div className="flex gap-2">
                <input type="text" readOnly
                  className={`input input-bordered flex-1${formError.supplierId ? ' is-invalid' : ''}`}
                  placeholder="No supplier selected"
                  value={supplierDisplay} />
                <button type="button" className="btn btn-soft btn-secondary shrink-0"
                  onClick={() => pushModal(<SupplierPickerLayer onSelect={s => {
                    setForm(prev => ({ ...prev, supplierId: s.supplierId }))
                    setSupplierDisplay(`${s.name} (#${s.supplierId})`)
                  }} />)}>
                  Pick
                </button>
              </div>
              {formError.supplierId && <span className="helper-text">{formError.supplierId}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Status</label>
              <select name="status"
                className={`select select-bordered w-full${formError.status ? ' is-invalid' : ''}`}
                value={form.status} onChange={handleChange}>
                <option value="ordered">ordered</option>
                <option value="received">received</option>
                <option value="cancelled">cancelled</option>
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
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-soft btn-secondary" onClick={popModal}>Cancel</button>
        <button type="submit" form="parts-update-form" className="btn btn-primary" disabled={submitting}>
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

/** Layer 1 — manage part: details, usage history, and action menu */
function ManagePartModal({ part, onRefresh }) {
  const { pushModal, popModal } = useModal()
  const { hasRole, apiFetch } = useAuth()
  const canEdit = hasRole('ADMIN', 'ACCOUNTING', 'STAFF')
  const [partData, setPartData] = useState(part)
  const [usageHistory, setUsageHistory] = useState([])
  const [usageLoading, setUsageLoading] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  // Re-fetch both part and usage history when refreshKey changes
  useEffect(() => {
    let active = true
    apiFetch(`/api/parts/${part.partId}`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => { if (active) setPartData(data) })
      .catch(() => {})
    setUsageLoading(true)
    apiFetch(`/api/part-usages?partId=${part.partId}&size=50&sort=usedOn,desc`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => { if (active) setUsageHistory(data.content ?? []) })
      .catch(() => { if (active) setUsageHistory([]) })
      .finally(() => { if (active) setUsageLoading(false) })
    return () => { active = false }
  }, [apiFetch, part.partId, refreshKey])

  function handleRefresh() {
    setRefreshKey(k => k + 1)
    onRefresh?.()
  }

  // Log Usage is only available when there is stock; filter it out when qty is 0.
  const navItems = partData.availableQty === 0
    ? PART_MENU_ITEMS.filter(item => item.key !== 'log-usage')
    : PART_MENU_ITEMS

  function handleAction(key) {
    if (key === 'update') pushModal(<UpdatePartModal part={partData} onRefresh={handleRefresh} />)
    // Log Usage sits on top; closing it reveals this modal with refreshed data.
    if (key === 'log-usage') pushModal(<LogUsageModal part={partData} onSuccess={handleRefresh} />)
  }

  function handleEditUsage(u) {
    pushModal(<EditUsageModal usage={u} onSuccess={handleRefresh} />)
  }

  return (
    <div className="modal-content w-full max-w-2xl my-auto">
      <div className="modal-header">
        <div>
          <h3 className="modal-title">Part #{partData.partId}</h3>
          <span className="text-sm text-base-content/50 line-clamp-1">{partData.name}</span>
        </div>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body flex flex-col gap-5">

        {/* Details grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <DetailItem label="Part ID"     value={partData.partId} />
          <DetailItem label="Status"      value={<span className={`badge badge-soft ${partStatusBadge(partData.status)} text-xs`}>{partData.status}</span>} />
          <DetailItem label="PO Number"   value={partData.poNum} />
          <DetailItem label="Qty Ordered" value={`${partData.quantityOrdered} ${partData.quantityType}`} />
          <DetailItem label="Available"   value={<span className={partData.availableQty === 0 ? 'text-error font-semibold' : ''}>{partData.availableQty} {partData.quantityType}</span>} />
          <DetailItem label="Unit Price"  value={formatCurrency(partData.unitPrice)} />
          <DetailItem label="Subtotal"    value={<span className="text-primary font-semibold">{formatCurrency(Number(partData.quantityOrdered) * Number(partData.unitPrice ?? 0))}</span>} />
          <DetailItem label="Supplier"    value={`(${partData.supplierId}) ${partData.supplierName ?? '—'}`} />
          <DetailItem label="Order Date"  value={formatDate(partData.orderDate)} />
          <DetailItem label="Added On"    value={formatDate(partData.addedOn)} />
          <div className="col-span-2 sm:col-span-3 flex flex-col gap-0.5">
            <span className="text-xs text-base-content/50 uppercase tracking-wide">Name</span>
            <span className="text-sm font-medium">{partData.name}</span>
          </div>
        </div>

        {/* Usage history */}
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
                            onClick={() => handleEditUsage(u)}
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

        {/* Action menu */}
        {partData.availableQty === 0 && canEdit && (
          <p className="text-xs text-warning">Log Usage is unavailable — no stock remaining.</p>
        )}
        <ModalNav items={navItems} hasRole={hasRole} onSelect={handleAction} cols={2} />
      </div>
    </div>
  )
}

/** Layer 1 — add a new part */
function AddPartModal({ onSuccess }) {
  const { popModal, pushModal } = useModal()
  const { apiFetch } = useAuth()
  const [form, setForm] = useState(EMPTY_ADD_FORM)
  const [formError, setFormError] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [poNum, setPoNum] = useState('')
  const [poDisplay, setPoDisplay] = useState('')
  const [supplierDisplay, setSupplierDisplay] = useState('')

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError({})
    setSubmitting(true)
    try {
      const res = await apiFetch('/api/parts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          quantityOrdered: Number(form.quantityOrdered),
          unitPrice:       Number(form.unitPrice),
          supplierId:      Number(form.supplierId),
          poNum,
        }),
      })
      if (!res.ok) {
        setFormError(await parseApiError(res))
        notyfError('Add part failed')
        return
      }
      notyfSuccess('Part added successfully.')
      popModal()
      onSuccess?.()
    } catch (err) {
      setFormError({ _general: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-content w-full max-w-2xl my-auto">
      <div className="modal-header">
        <h3 className="modal-title">Add Part</h3>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body">
        <form id="parts-add-form" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="label-text font-medium">Purchase Order <span className="text-error">*</span></label>
              <div className="flex gap-2">
                <input type="text" readOnly
                  className={`input input-bordered flex-1${formError.poNum ? ' is-invalid' : ''}`}
                  placeholder="No purchase order selected"
                  value={poDisplay} />
                <button type="button" className="btn btn-soft btn-secondary shrink-0"
                  onClick={() => pushModal(<POPickerLayer onSelect={o => {
                    setPoNum(o.poNum)
                    setPoDisplay(`${o.poNum} — ${o.purpose ?? ''}`)
                  }} />)}>
                  Pick Purchase Order
                </button>
              </div>
              {formError.poNum && <span className="helper-text">{formError.poNum}</span>}
            </div>

            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="label-text font-medium">Name <span className="text-error">*</span></label>
              <input type="text" name="name"
                className={`input input-bordered w-full${formError.name ? ' is-invalid' : ''}`}
                placeholder="e.g. Compressor Unit" maxLength={255} required
                value={form.name} onChange={handleChange} />
              {formError.name && <span className="helper-text">{formError.name}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Quantity Ordered <span className="text-error">*</span></label>
              <input type="number" name="quantityOrdered" min={0}
                className={`input input-bordered w-full${formError.quantityOrdered ? ' is-invalid' : ''}`}
                placeholder="e.g. 2" required
                value={form.quantityOrdered} onChange={handleChange} />
              {formError.quantityOrdered && <span className="helper-text">{formError.quantityOrdered}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Quantity Type <span className="text-error">*</span></label>
              <input type="text" name="quantityType" maxLength={30}
                className={`input input-bordered w-full${formError.quantityType ? ' is-invalid' : ''}`}
                placeholder="e.g. pcs" required
                value={form.quantityType} onChange={handleChange} />
              {formError.quantityType && <span className="helper-text">{formError.quantityType}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Unit Price <span className="text-error">*</span></label>
              <input type="number" name="unitPrice" min={0} step="0.01"
                className={`input input-bordered w-full${formError.unitPrice ? ' is-invalid' : ''}`}
                placeholder="e.g. 1500.00" required
                value={form.unitPrice} onChange={handleChange} />
              {formError.unitPrice && <span className="helper-text">{formError.unitPrice}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Supplier <span className="text-error">*</span></label>
              <div className="flex gap-2">
                <input type="text" readOnly
                  className={`input input-bordered flex-1${formError.supplierId ? ' is-invalid' : ''}`}
                  placeholder="No supplier selected"
                  value={supplierDisplay} />
                <button type="button" className="btn btn-soft btn-secondary shrink-0"
                  onClick={() => pushModal(<SupplierPickerLayer onSelect={s => {
                    setForm(prev => ({ ...prev, supplierId: s.supplierId }))
                    setSupplierDisplay(`${s.name} (#${s.supplierId})`)
                  }} />)}>
                  Pick Supplier
                </button>
              </div>
              {formError.supplierId && <span className="helper-text">{formError.supplierId}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Status</label>
              <select name="status"
                className={`select select-bordered w-full${formError.status ? ' is-invalid' : ''}`}
                value={form.status} onChange={handleChange}>
                <option value="ordered">ordered</option>
                <option value="received">received</option>
                <option value="cancelled">cancelled</option>
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
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-soft btn-secondary" onClick={popModal}>Cancel</button>
        <button type="submit" form="parts-add-form" className="btn btn-primary" disabled={submitting}>
          {submitting
            ? <span className="loading loading-spinner loading-sm"></span>
            : <span className="icon-[tabler--plus] size-4"></span>
          }
          Add Part
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function InventoryParts() {
  const { apiFetch, hasRole } = useAuth()
  const { pushModal } = useModal()
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

  // Auto-open Add Part modal when ?addPart=1 is in the URL
  useEffect(() => {
    if (canEdit && searchParams.get('addPart') === '1') {
      pushModal(<AddPartModal onSuccess={() => setRefreshKey(k => k + 1)} />)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function commitSearch() {
    setPage(0)
    setSearch(inputValue)
  }

  function applyStatusFilter(value) {
    setPage(0)
    setStatusFilter(value)
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
            onClick={() => pushModal(<AddPartModal onSuccess={() => setRefreshKey(k => k + 1)} />)}
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
                          onClick={() => pushModal(<ManagePartModal part={p} onRefresh={() => setRefreshKey(k => k + 1)} />)}
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
