import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { useModal } from '../modals/index.js'
import ModalNav from '../modals/ModalNav.jsx'
import Layout from '../components/Layout'
import SupplierPickerModal from '../pickers/SupplierPickerModal'
import { notyfSuccess, notyfError } from '../notyf'

/** Parses a failed API response into a field-level or general error map. */
async function parseApiError(res) {
  const data = await res.json().catch(() => ({}))
  if (data.errors) return data.errors
  return { _general: data.message ?? data.error ?? `Error ${res.status}` }
}

/** Formats an ISO date string to YYYY-MM-DD; returns em dash for empty values. */
function formatDate(dt) {
  if (!dt) return '—'
  return String(dt).slice(0, 10)
}

/** Formats a number as Philippine Peso (PHP) currency. */
function formatCurrency(value) {
  if (value == null) return '—'
  return Number(value).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })
}

/** Returns the FlyonUI badge class for a given part status string. */
function partStatusBadge(status) {
  if (status === 'received')  return 'badge-success'
  if (status === 'cancelled') return 'badge-error'
  if (status === 'used')      return 'badge-warning'
  return 'badge-neutral'
}

const PAGE_SIZE = 12
const PARTS_PAGE_SIZE = 7

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
const ACCEPTED_EXTENSIONS = '.jpg,.jpeg,.png,.gif,.webp,.pdf'
const EMPTY_WIZARD_EQUIP = { name: '', type: 'durable', model: '', serialNumber: '', description: '', stock: '1', acquisitionCost: '' }

/** Builds the manage menu items for a PO modal; shows Parts or Equipment depending on SR linkage. */
function getPoMenuItems(order) {
  const hasSR = !!(order?.srNum)
  return [
    { key: 'update',    label: 'Update Details',    icon: 'icon-[tabler--pencil]',       roles: ['ADMIN', 'ACCOUNTING', 'STAFF'] },
    hasSR
      ? { key: 'parts',     label: 'Manage Parts',     icon: 'icon-[tabler--package]', roles: ['ADMIN', 'ACCOUNTING', 'STAFF'] }
      : { key: 'equipment', label: 'Manage Equipment', icon: 'icon-[tabler--tool]',     roles: ['ADMIN', 'STAFF'] },
    { key: 'contacts',  label: 'Delivery Contacts', icon: 'icon-[tabler--address-book]', roles: ['ADMIN', 'ACCOUNTING', 'STAFF'] },
    { key: 'documents', label: 'Documents',         icon: 'icon-[tabler--files]',        roles: ['ADMIN', 'ACCOUNTING', 'STAFF'] },
  ]
}

const EMPTY_PO_FORM = { purpose: '', terms: '', paymentMethod: '', ewalletType: '', paymentDetails: '', deliveryAddress: '', remarks: '' }

function parsePoPaymentMethod(stored) {
  if (!stored) return { method: '', ewalletType: '' }
  const lower = stored.toLowerCase()
  if (lower === 'cash') return { method: 'cash', ewalletType: '' }
  if (lower === 'check') return { method: 'check', ewalletType: '' }
  if (lower === 'bank' || lower === 'bank transfer') return { method: 'bank', ewalletType: '' }
  if (lower === 'gcash') return { method: 'ewallet', ewalletType: 'GCash' }
  if (lower.startsWith('ewallet:')) return { method: 'ewallet', ewalletType: stored.slice(8) }
  return { method: '', ewalletType: '' }
}
const EMPTY_PART_FORM = { name: '', quantityOrdered: '', quantityType: '', unitPrice: '', supplierId: '', status: 'ordered' }
const EMPTY_CONTACT_FORM = { contactName: '', contactNumber: '' }
const EMPTY_EQUIP_FORM = { name: '', type: 'durable', model: '', serialNumber: '', description: '', stock: '1', acquisitionCost: '', status: 'active' }
const EMPTY_NEW_PO_PART_FORM = { name: '', quantityOrdered: '', quantityType: '', unitPrice: '', supplierId: '', _supplierName: '', orderDate: '' }

/** Stacking Layer Helpers */

/** Modal layer wrapper for the supplier picker; calls onSelect with the chosen supplier then closes. */
function SupplierPickerLayer({ onSelect }) {
  const { popModal } = useModal()
  function handleSelect(s) { onSelect(s); popModal() }
  return <SupplierPickerModal asLayer isOpen={true} onClose={popModal} onSelect={handleSelect} />
}

/** Modal for adding a delivery contact to a new purchase order before it is saved. */
function NewPoAddContactModal({ onAdd }) {
  const { popModal } = useModal()
  const [form, setForm] = useState(EMPTY_CONTACT_FORM)
  const [formError, setFormError] = useState({})

  /** Validates fields and passes the new contact up via onAdd. */
  function handleSubmit(e) {
    e.preventDefault()
    const errors = {}
    if (!form.contactName.trim()) errors.contactName = 'Contact name is required.'
    if (!form.contactNumber.trim()) errors.contactNumber = 'Contact number is required.'
    if (Object.keys(errors).length > 0) { setFormError(errors); return }
    onAdd({ ...form, _tempId: Date.now() })
    popModal()
  }

  return (
    <div className="modal-content w-full max-w-sm my-auto">
      <div className="modal-header">
        <h3 className="modal-title">Add Delivery Contact</h3>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body">
        <form id="inv-new-po-contact-modal-form" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Contact Name <span className="text-error">*</span></label>
              <input type="text" maxLength={120}
                className={`input input-bordered w-full${formError.contactName ? ' is-invalid' : ''}`}
                value={form.contactName}
                onChange={e => setForm(p => ({ ...p, contactName: e.target.value }))} />
              {formError.contactName && <span className="helper-text">{formError.contactName}</span>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Contact Number <span className="text-error">*</span></label>
              <input type="text" maxLength={30}
                className={`input input-bordered w-full${formError.contactNumber ? ' is-invalid' : ''}`}
                value={form.contactNumber}
                onChange={e => setForm(p => ({ ...p, contactNumber: e.target.value }))} />
              {formError.contactNumber && <span className="helper-text">{formError.contactNumber}</span>}
            </div>
          </div>
        </form>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-soft btn-secondary" onClick={popModal}>Cancel</button>
        <button type="submit" form="inv-new-po-contact-modal-form" className="btn btn-primary">
          <span className="icon-[tabler--plus] size-4"></span>Add
        </button>
      </div>
    </div>
  )
}

/** Modal for adding a part (with supplier) to a new purchase order before it is saved. */
function NewPoAddPartModal({ onAdd }) {
  const { popModal, pushModal } = useModal()
  const [form, setForm] = useState(EMPTY_NEW_PO_PART_FORM)
  const [formError, setFormError] = useState({})
  const [supplierDisplay, setSupplierDisplay] = useState('')

  /** Stores the selected supplier id and display name into form state. */
  function handleSupplierSelect(s) {
    setForm(p => ({ ...p, supplierId: s.supplierId, _supplierName: s.name }))
    setSupplierDisplay(`${s.name} (#${s.supplierId})`)
  }

  return (
    <div className="modal-content w-full max-w-lg my-auto">
      <div className="modal-header">
        <h3 className="modal-title">Add Part</h3>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body">
        <form id="inv-new-po-part-modal-form" onSubmit={e => {
          e.preventDefault()
          const errors = {}
          if (!form.name.trim()) errors.name = 'Name is required.'
          if (!form.quantityOrdered || Number(form.quantityOrdered) < 1) errors.quantityOrdered = 'Quantity must be at least 1.'
          if (!form.quantityType.trim()) errors.quantityType = 'Quantity type is required.'
          if (form.unitPrice === '' || Number(form.unitPrice) < 0) errors.unitPrice = 'Unit price must be 0 or greater.'
          if (!form.supplierId) errors.supplierId = 'Please select a supplier.'
          if (Object.keys(errors).length > 0) { setFormError(errors); return }
          onAdd({ ...form, _tempId: Date.now() })
          popModal()
        }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="label-text font-medium">Name <span className="text-error">*</span></label>
              <input type="text" maxLength={120}
                className={`input input-bordered w-full${formError.name ? ' is-invalid' : ''}`}
                value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
              {formError.name && <span className="helper-text">{formError.name}</span>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Quantity <span className="text-error">*</span></label>
              <input type="number" min={1}
                className={`input input-bordered w-full${formError.quantityOrdered ? ' is-invalid' : ''}`}
                value={form.quantityOrdered} onChange={e => setForm(p => ({ ...p, quantityOrdered: e.target.value }))} />
              {formError.quantityOrdered && <span className="helper-text">{formError.quantityOrdered}</span>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Qty Type <span className="text-error">*</span></label>
              <input type="text" maxLength={30} placeholder="e.g. pcs, kg, m"
                className={`input input-bordered w-full${formError.quantityType ? ' is-invalid' : ''}`}
                value={form.quantityType} onChange={e => setForm(p => ({ ...p, quantityType: e.target.value }))} />
              {formError.quantityType && <span className="helper-text">{formError.quantityType}</span>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Unit Price <span className="text-error">*</span></label>
              <input type="number" min={0} step="0.01"
                className={`input input-bordered w-full${formError.unitPrice ? ' is-invalid' : ''}`}
                value={form.unitPrice} onChange={e => setForm(p => ({ ...p, unitPrice: e.target.value }))} />
              {formError.unitPrice && <span className="helper-text">{formError.unitPrice}</span>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Supplier <span className="text-error">*</span></label>
              <div className="flex gap-2">
                <input type="text" readOnly
                  className={`input input-bordered flex-1${formError.supplierId ? ' is-invalid' : ''}`}
                  placeholder="Select supplier…" value={supplierDisplay} />
                <button type="button" className="btn btn-soft btn-secondary shrink-0"
                  onClick={() => pushModal(<SupplierPickerLayer onSelect={handleSupplierSelect} />)}>
                  Pick
                </button>
              </div>
              {formError.supplierId && <span className="helper-text">{formError.supplierId}</span>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Order Date</label>
              <input type="date" className="input input-bordered w-full"
                value={form.orderDate} onChange={e => setForm(p => ({ ...p, orderDate: e.target.value }))} />
            </div>
          </div>
        </form>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-soft btn-secondary" onClick={popModal}>Cancel</button>
        <button type="submit" form="inv-new-po-part-modal-form" className="btn btn-primary">
          <span className="icon-[tabler--plus] size-4"></span>Add Part
        </button>
      </div>
    </div>
  )
}

/** Modal for adding a document record (invoice ID + optional file) to a new purchase order before it is saved. */
function NewPoAddDocModal({ onAdd }) {
  const { popModal } = useModal()
  const [form, setForm] = useState({ invoiceId: '', file: null })
  const [formError, setFormError] = useState({})
  const fileRef = useRef(null)

  function handleSubmit(e) {
    e.preventDefault()
    const errors = {}
    if (!form.invoiceId.trim()) errors.invoiceId = 'Invoice ID is required.'
    if (Object.keys(errors).length > 0) { setFormError(errors); return }
    onAdd({ ...form, _key: Date.now() })
    popModal()
  }

  return (
    <div className="modal-content w-full max-w-sm my-auto">
      <div className="modal-header">
        <h3 className="modal-title">Add Document Record</h3>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body">
        <form id="inv-new-po-doc-modal-form" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Invoice ID <span className="text-error">*</span></label>
              <input type="text" maxLength={16} required
                className={`input input-bordered w-full${formError.invoiceId ? ' is-invalid' : ''}`}
                placeholder="e.g. INV-001"
                value={form.invoiceId}
                onChange={e => setForm(p => ({ ...p, invoiceId: e.target.value }))} />
              {formError.invoiceId && <span className="helper-text">{formError.invoiceId}</span>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">
                File <span className="text-base-content/40 font-normal">(optional — images or PDF)</span>
              </label>
              <input ref={fileRef} type="file" accept={ACCEPTED_EXTENSIONS} className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0] ?? null
                  if (file && !ACCEPTED_TYPES.includes(file.type)) {
                    setFormError(prev => ({ ...prev, file: 'Only images and PDFs are accepted.' }))
                    e.target.value = ''
                    return
                  }
                  setFormError(prev => { const n = { ...prev }; delete n.file; return n })
                  setForm(prev => ({ ...prev, file }))
                }} />
              <button type="button"
                className={`btn btn-outline w-full justify-start font-normal${formError.file ? ' btn-error' : ''}`}
                onClick={() => fileRef.current?.click()}>
                <span className="icon-[tabler--paperclip] size-4"></span>
                {form.file ? form.file.name : 'Choose file…'}
              </button>
              {formError.file && <span className="helper-text">{formError.file}</span>}
              {form.file && <span className="text-xs text-base-content/50">{(form.file.size / 1024).toFixed(1)} KB</span>}
            </div>
          </div>
        </form>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-soft btn-secondary" onClick={popModal}>Cancel</button>
        <button type="submit" form="inv-new-po-doc-modal-form" className="btn btn-primary">
          <span className="icon-[tabler--plus] size-4"></span>Add
        </button>
      </div>
    </div>
  )
}

/** Paginated table of parts with a total cost summary row; clicking Manage opens the part detail modal. */
function PartsTable({ parts, loading, onSelectPart }) {
  const [partsPage, setPartsPage] = useState(0)
  if (loading) return <div className="flex justify-center py-6"><span className="loading loading-spinner loading-sm text-primary"></span></div>
  if (parts.length === 0) return <div className="text-center py-6 text-base-content/40 text-sm">No parts linked to this purchase order.</div>
  const totalPages = Math.ceil(parts.length / PARTS_PAGE_SIZE)
  const pageParts = parts.slice(partsPage * PARTS_PAGE_SIZE, (partsPage + 1) * PARTS_PAGE_SIZE)
  const totalCost = parts.reduce((s, p) => s + Number(p.quantityOrdered) * Number(p.unitPrice ?? 0), 0)
  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-box border border-base-300">
        <table className="table table-zebra table-sm w-full">
          <thead><tr><th>ID</th><th>Name</th><th>Qty</th><th>Unit Price</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {pageParts.map(p => (
              <tr key={p.partId}>
                <td className="font-mono text-xs">{p.partId}</td>
                <td className="text-sm max-w-36"><span className="line-clamp-1" title={p.name}>{p.name}</span></td>
                <td className="text-sm">{p.quantityOrdered} {p.quantityType}</td>
                <td className="text-sm">{formatCurrency(p.unitPrice)}</td>
                <td><span className={`badge badge-soft ${partStatusBadge(p.status)} text-xs`}>{p.status}</span></td>
                <td><button className="btn btn-soft btn-primary btn-xs" onClick={() => onSelectPart(p)}><span className="icon-[tabler--settings] size-3"></span>Manage</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-base-content/50">Page {partsPage + 1}/{totalPages} · {parts.length} parts</span>
          <div className="flex gap-1">
            <button className="btn btn-xs btn-secondary" disabled={partsPage === 0} onClick={() => setPartsPage(p => p - 1)}><span className="icon-[tabler--chevron-left] size-3"></span></button>
            <button className="btn btn-xs btn-secondary" disabled={partsPage >= totalPages - 1} onClick={() => setPartsPage(p => p + 1)}><span className="icon-[tabler--chevron-right] size-3"></span></button>
          </div>
        </div>
      )}
      <div className="flex justify-end">
        <div className="bg-base-200 rounded-box px-4 py-2 text-sm font-semibold">
          Total Cost: <span className="text-primary">{formatCurrency(totalCost)}</span>
        </div>
      </div>
    </div>
  )
}

/** Modular Stack-driven Components */

/** Modal for updating an existing purchase order's details. */
function UpdatePoModal({ order, onRefresh }) {
  const { popModal } = useModal()
  const { apiFetch } = useAuth()
  const [form, setForm] = useState(() => {
    const { method, ewalletType } = parsePoPaymentMethod(order.paymentMethod)
    return { purpose: order.purpose ?? '', terms: order.terms ?? '', paymentMethod: method, ewalletType, paymentDetails: order.paymentDetails ?? '', deliveryAddress: order.deliveryAddress ?? '', remarks: order.remarks ?? '' }
  })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [projectAddress, setProjectAddress] = useState('')

  useEffect(() => {
    if (!order.srNum) return
    apiFetch(`/api/service-reports/${order.srNum}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(sr => apiFetch(`/api/projects/${sr.projNum}`))
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(proj => setProjectAddress(proj.address ?? ''))
      .catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /** Submits the updated PO fields to the API and refreshes the list on success. */
  async function handleUpdatePoSubmit(e) {
    e.preventDefault(); setErrors({}); setSubmitting(true)
    try {
      const res = await apiFetch(`/api/purchase-orders/${order.poNum}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, ewalletType: undefined, paymentMethod: form.paymentMethod === 'ewallet' ? `ewallet:${form.ewalletType}` : form.paymentMethod || null, poNum: order.poNum, srNum: order.srNum }),
      })
      if (!res.ok) { setErrors(await parseApiError(res)); notyfError('Update failed'); return }
      popModal()
      notyfSuccess(`Purchase Order "${order.poNum}" updated.`)
      onRefresh()
    } catch (err) { setErrors({ _general: err.message }) }
    finally { setSubmitting(false) }
  }

  return (
    <div className="modal-content w-full max-w-lg my-auto shadow-xl">
      <div className="modal-header">
        <div><h3 className="modal-title">Update {order.poNum}</h3><span className="text-sm text-base-content/50">{order.purpose}</span></div>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body">
        <form id="inv-po-update-form" onSubmit={handleUpdatePoSubmit}>
          <POFormFields form={form} onChange={e => setForm(p => ({ ...p, [e.target.name]: e.target.value }))} errors={errors} projectAddress={projectAddress} />
        </form>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-soft btn-secondary" onClick={popModal}>Cancel</button>
        <button type="submit" form="inv-po-update-form" className="btn btn-primary" disabled={submitting}>
          {submitting ? <span className="loading loading-spinner loading-sm"></span> : <span className="icon-[tabler--device-floppy] size-4"></span>}
          Save Changes
        </button>
      </div>
    </div>
  )
}

/** Modal for editing an existing part usage record. */
function EditUsageModal({ usage, selectedPart, onRefresh }) {
  const { popModal } = useModal()
  const { apiFetch } = useAuth()
  const [form, setForm] = useState({ srNumber: usage.srNumber ?? '', qtyUsed: usage.qtyUsed, notes: usage.notes ?? '' })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  /** Submits the edited usage record to the API and refreshes part details on success. */
  async function handleEditUsageSubmit(e) {
    e.preventDefault(); setErrors({}); setSubmitting(true)
    try {
      const res = await apiFetch(`/api/part-usages/${usage.usageId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ srNumber: form.srNumber ? Number(form.srNumber) : null, qtyUsed: Number(form.qtyUsed), notes: form.notes || null }),
      })
      if (!res.ok) { setErrors(await parseApiError(res)); notyfError('Update failed'); return }
      popModal()
      notyfSuccess(`Usage #${usage.usageId} updated.`)
      onRefresh()
    } catch (err) { setErrors({ _general: err.message }) }
    finally { setSubmitting(false) }
  }

  return (
    <div className="modal-content w-full max-w-sm shadow-xl">
      <div className="modal-header">
        <h3 className="modal-title">Edit Usage #{usage.usageId}</h3>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body">
        <form id="inv-edit-usage-form" onSubmit={handleEditUsageSubmit}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">SR #</label>
              <input type="number" min={1}
                className={`input input-bordered w-full${errors.srNumber ? ' is-invalid' : ''}`}
                value={form.srNumber} onChange={e => setForm(p => ({ ...p, srNumber: e.target.value }))} />
              {errors.srNumber && <span className="helper-text">{errors.srNumber}</span>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Qty Used <span className="text-error">*</span></label>
              <input type="number" min={1} required
                className={`input input-bordered w-full${errors.qtyUsed ? ' is-invalid' : ''}`}
                value={form.qtyUsed} onChange={e => setForm(p => ({ ...p, qtyUsed: e.target.value }))} />
              {errors.qtyUsed && <span className="helper-text">{errors.qtyUsed}</span>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Notes</label>
              <input type="text" maxLength={255}
                className="input input-bordered w-full"
                value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
            {errors._general && (
              <div className="alert alert-error py-2"><span className="icon-[tabler--alert-circle] size-4 shrink-0"></span><span className="text-sm">{errors._general}</span></div>
            )}
          </div>
        </form>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-soft btn-secondary" onClick={popModal}>Cancel</button>
        <button type="submit" form="inv-edit-usage-form" className="btn btn-primary" disabled={submitting}>
          {submitting ? <span className="loading loading-spinner loading-sm"></span> : <span className="icon-[tabler--device-floppy] size-4"></span>}
          Save
        </button>
      </div>
    </div>
  )
}

/** Modal for logging a new part usage against a specific part; enforces max quantity. */
function LogUsageModal({ selectedPart, srNumber, availableQty, onRefresh }) {
  const { popModal } = useModal()
  const { apiFetch } = useAuth()
  const [form, setForm] = useState({ qtyUsed: '', notes: '' })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [srInfo, setSrInfo] = useState(null)

  useEffect(() => {
    if (!srNumber) return
    apiFetch(`/api/service-reports/${srNumber}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setSrInfo(d))
      .catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /** Posts the new usage entry to the API and triggers a refresh of usage history. */
  async function handleLogUsageSubmit(e) {
    e.preventDefault(); setErrors({}); setSubmitting(true)
    try {
      const res = await apiFetch('/api/part-usages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partId: selectedPart.partId, srNumber: srNumber ?? null, qtyUsed: Number(form.qtyUsed), notes: form.notes || null }),
      })
      if (!res.ok) { setErrors(await parseApiError(res)); notyfError('Log usage failed'); return }
      popModal()
      notyfSuccess('Usage logged.')
      onRefresh()
    } catch (err) { setErrors({ _general: err.message }) }
    finally { setSubmitting(false) }
  }

  return (
    <div className="modal-content w-full max-w-sm shadow-xl">
      <div className="modal-header">
        <div><h3 className="modal-title">Log Usage — Part #{selectedPart.partId}</h3><span className="text-sm text-base-content/50">{selectedPart.name}</span></div>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body">
        <form id="inv-log-usage-form" onSubmit={handleLogUsageSubmit}>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 bg-base-200/60 rounded-box px-4 py-3 text-sm">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-base-content/50 uppercase tracking-wide">Qty Ordered</span>
                <span className="font-medium">{selectedPart.quantityOrdered} {selectedPart.quantityType}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-base-content/50 uppercase tracking-wide">Available</span>
                <span className="font-medium">{availableQty} {selectedPart.quantityType}</span>
              </div>
            </div>
            {srNumber && (
              <div className="bg-base-200/60 rounded-box px-4 py-3 flex flex-col gap-1 text-sm">
                <span className="text-xs text-base-content/50 uppercase tracking-wide">Logging against SR #{srNumber}</span>
                {srInfo ? (
                  <>
                    <span className="font-medium">{srInfo.projectName}</span>
                    {srInfo.complaint && <span className="text-base-content/60 text-xs line-clamp-2">{srInfo.complaint}</span>}
                    {srInfo.scheduleDate && <span className="text-base-content/50 text-xs">{formatDate(srInfo.scheduleDate)}</span>}
                  </>
                ) : (
                  <span className="text-base-content/40 text-xs">Loading SR info…</span>
                )}
              </div>
            )}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="label-text font-medium">Quantity Used <span className="text-error">*</span></label>
                <button type="button" className="btn btn-xs btn-soft btn-primary"
                  onClick={() => setForm(p => ({ ...p, qtyUsed: availableQty }))}>
                  Use All
                </button>
              </div>
              <input type="number" min={1} max={availableQty} required
                className={`input input-bordered w-full${errors.qtyUsed ? ' is-invalid' : ''}`}
                value={form.qtyUsed} onChange={e => setForm(p => ({ ...p, qtyUsed: e.target.value }))} />
              {errors.qtyUsed ? <span className="helper-text">{errors.qtyUsed}</span>
                : <span className="text-xs text-base-content/40">Max: {availableQty} {selectedPart.quantityType}</span>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Notes</label>
              <input type="text" maxLength={255}
                className="input input-bordered w-full"
                value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
            {errors._general && (
              <div className="alert alert-error py-2"><span className="icon-[tabler--alert-circle] size-4 shrink-0"></span><span className="text-sm">{errors._general}</span></div>
            )}
          </div>
        </form>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-soft btn-secondary" onClick={popModal}>Cancel</button>
        <button type="submit" form="inv-log-usage-form" className="btn btn-primary" disabled={submitting}>
          {submitting ? <span className="loading loading-spinner loading-sm"></span> : <span className="icon-[tabler--tool] size-4"></span>}
          Log Usage
        </button>
      </div>
    </div>
  )
}

/** Modal for updating a part's details including status and supplier selection. */
function UpdatePartModal({ part, onRefresh }) {
  const { popModal, pushModal } = useModal()
  const { apiFetch } = useAuth()
  const [form, setForm] = useState({ name: part.name, quantityOrdered: part.quantityOrdered, quantityType: part.quantityType, unitPrice: part.unitPrice, supplierId: part.supplierId, status: part.status })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [supplierDisplay, setSupplierDisplay] = useState(`${part.supplierName ?? 'Supplier'} (#${part.supplierId})`)

  /** Submits updated part data to the API and refreshes the parts table on success. */
  async function handleUpdatePartSubmit(e) {
    e.preventDefault(); setErrors({}); setSubmitting(true)
    try {
      const res = await apiFetch(`/api/parts/${part.partId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, quantityOrdered: Number(form.quantityOrdered), unitPrice: Number(form.unitPrice), supplierId: Number(form.supplierId), poNum: part.poNum, orderDate: part.orderDate }),
      })
      if (!res.ok) { setErrors(await parseApiError(res)); notyfError('Update failed'); return }
      popModal()
      notyfSuccess(`Part #${part.partId} updated.`)
      onRefresh()
    } catch (err) { setErrors({ _general: err.message }) }
    finally { setSubmitting(false) }
  }

  return (
    <div className="modal-content w-full max-w-md my-auto shadow-xl">
      <div className="modal-header">
        <h3 className="modal-title">Update Part #{part.partId}</h3>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body">
        <form id="inv-update-part-form" onSubmit={handleUpdatePartSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="label-text font-medium">Name <span className="text-error">*</span></label>
              <input type="text" maxLength={120} required
                className={`input input-bordered w-full${errors.name ? ' is-invalid' : ''}`}
                value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
              {errors.name && <span className="helper-text">{errors.name}</span>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Qty Ordered <span className="text-error">*</span></label>
              <input type="number" min={1} required
                className={`input input-bordered w-full${errors.quantityOrdered ? ' is-invalid' : ''}`}
                value={form.quantityOrdered} onChange={e => setForm(p => ({ ...p, quantityOrdered: e.target.value }))} />
              {errors.quantityOrdered && <span className="helper-text">{errors.quantityOrdered}</span>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Qty Type <span className="text-error">*</span></label>
              <input type="text" maxLength={30} required
                className={`input input-bordered w-full${errors.quantityType ? ' is-invalid' : ''}`}
                value={form.quantityType} onChange={e => setForm(p => ({ ...p, quantityType: e.target.value }))} />
              {errors.quantityType && <span className="helper-text">{errors.quantityType}</span>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Unit Price <span className="text-error">*</span></label>
              <input type="number" min={0} step="0.01" required
                className={`input input-bordered w-full${errors.unitPrice ? ' is-invalid' : ''}`}
                value={form.unitPrice} onChange={e => setForm(p => ({ ...p, unitPrice: e.target.value }))} />
              {errors.unitPrice && <span className="helper-text">{errors.unitPrice}</span>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Status <span className="text-error">*</span></label>
              <select className="select select-bordered w-full" value={form.status}
                onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                {['ordered','received','cancelled','used'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Supplier <span className="text-error">*</span></label>
              <div className="flex gap-2">
                <input type="text" readOnly className={`input input-bordered flex-1${errors.supplierId ? ' is-invalid' : ''}`}
                  placeholder="Select supplier…" value={supplierDisplay} />
                <button type="button" className="btn btn-soft btn-secondary shrink-0" onClick={() => pushModal(
                  <SupplierPickerLayer onSelect={s => {
                    setForm(p => ({ ...p, supplierId: s.supplierId }))
                    setSupplierDisplay(`${s.name} (#${s.supplierId})`)
                  }} />
                )}>Pick</button>
              </div>
              {errors.supplierId && <span className="helper-text">{errors.supplierId}</span>}
            </div>
            {errors._general && (
              <div className="sm:col-span-2 alert alert-error py-2">
                <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                <span className="text-sm">{errors._general}</span>
              </div>
            )}
          </div>
        </form>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-soft btn-secondary" onClick={popModal}>Cancel</button>
        <button type="submit" form="inv-update-part-form" className="btn btn-primary" disabled={submitting}>
          {submitting ? <span className="loading loading-spinner loading-sm"></span> : <span className="icon-[tabler--device-floppy] size-4"></span>}
          Save Changes
        </button>
      </div>
    </div>
  )
}

/** Modal showing full part details, usage history, and manage actions (update/log usage). */
function PartDetailModal({ part, srNumber, canEdit, onRefreshTable }) {
  const { popModal, pushModal } = useModal()
  const { apiFetch } = useAuth()
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let active = true; setLoading(true)
    apiFetch(`/api/part-usages?partId=${part.partId}&size=100&sort=usedOn,desc`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { if (active) setHistory(d.content ?? []) })
      .catch(() => { if (active) setHistory([]) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [apiFetch, part, refreshKey])

  const availableQty = (part.quantityOrdered ?? 0) - history.reduce((s, u) => s + u.qtyUsed, 0)

  return (
    <div className="modal-content w-full max-w-xl my-auto">
      <div className="modal-header">
        <div><h3 className="modal-title">Part #{part.partId}</h3><span className="text-sm text-base-content/50">{part.name}</span></div>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body flex flex-col gap-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
          <PartDetailField label="Part ID"><span className="font-mono">{part.partId}</span></PartDetailField>
          <PartDetailField label="Status"><span className={`badge badge-soft ${partStatusBadge(part.status)} text-xs`}>{part.status}</span></PartDetailField>
          <PartDetailField label="PO Number"><span className="font-mono">{part.poNum}</span></PartDetailField>
          <div className="col-span-2 sm:col-span-3 flex flex-col gap-0.5">
            <span className="text-xs text-base-content/50 uppercase tracking-wide">Name</span>
            <span className="text-sm font-medium">{part.name}</span>
          </div>
          <PartDetailField label="Ordered">{part.quantityOrdered} {part.quantityType}</PartDetailField>
          <PartDetailField label="Available">
            <span className={availableQty === 0 ? 'text-error font-semibold' : 'text-success font-semibold'}>
              {loading ? '…' : availableQty} {part.quantityType}
            </span>
          </PartDetailField>
          <PartDetailField label="Unit Price">{formatCurrency(part.unitPrice)}</PartDetailField>
          <PartDetailField label="Subtotal">{formatCurrency(Number(part.quantityOrdered) * Number(part.unitPrice ?? 0))}</PartDetailField>
          <PartDetailField label="Supplier">({part.supplierId}) {part.supplierName ?? '—'}</PartDetailField>
          <PartDetailField label="Order Date">{formatDate(part.orderDate)}</PartDetailField>
        </div>
        <div className="divider my-0"></div>
        <div className="flex flex-col gap-2">
          <span className="text-xs text-base-content/50 uppercase tracking-wide">Usage History</span>
          {loading ? (
            <div className="flex justify-center py-4"><span className="loading loading-spinner loading-sm text-primary"></span></div>
          ) : history.length === 0 ? (
            <div className="text-center py-4 text-base-content/40 text-sm">No usage recorded.</div>
          ) : (
            <div className="overflow-x-auto rounded-box border border-base-300">
              <table className="table table-zebra table-sm w-full">
                <thead><tr><th>ID</th><th>SR #</th><th>Qty Used</th><th>Used On</th>{canEdit && <th></th>}</tr></thead>
                <tbody>
                  {history.map(u => (
                    <tr key={u.usageId}>
                      <td className="font-mono text-xs">{u.usageId}</td>
                      <td className="text-sm">{u.srNumber ?? '—'}</td>
                      <td className="text-sm">{u.qtyUsed} {part.quantityType}</td>
                      <td className="text-sm">{formatDate(u.usedOn)}</td>
                      {canEdit && (
                        <td><button className="btn btn-soft btn-secondary btn-xs"
                          onClick={() => pushModal(<EditUsageModal usage={u} selectedPart={part} onRefresh={() => { setRefreshKey(k => k + 1); onRefreshTable() }} />)}>
                          <span className="icon-[tabler--pencil] size-3"></span>Edit
                        </button></td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {canEdit && (
          <>
            <div className="divider my-0"></div>
            <div>
              <p className="text-xs text-base-content/50 uppercase tracking-wide mb-3">Manage</p>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" className="group w-full" onClick={() => pushModal(<UpdatePartModal part={part} onRefresh={onRefreshTable} />)}>
                  <div className="card bg-base-100 border border-base-300 h-full transition-transform duration-300 group-hover:-translate-y-2">
                    <div className="card-body items-center justify-center text-center gap-2 py-5 px-3">
                      <span className="icon-[tabler--pencil] size-8 text-primary"></span>
                      <p className="text-xs font-medium leading-tight">Update Details</p>
                    </div>
                  </div>
                </button>
                <button type="button"
                  className={`group w-full${availableQty === 0 ? ' cursor-not-allowed opacity-40' : ''}`}
                  disabled={availableQty === 0}
                  onClick={() => pushModal(<LogUsageModal selectedPart={part} srNumber={srNumber} availableQty={availableQty} onRefresh={() => { setRefreshKey(k => k + 1); onRefreshTable() }} />)}>
                  <div className={`card bg-base-100 border border-base-300 h-full${availableQty > 0 ? ' transition-transform duration-300 group-hover:-translate-y-2' : ''}`}>
                    <div className="card-body items-center justify-center text-center gap-2 py-5 px-3">
                      <span className="icon-[tabler--tool] size-8 text-primary"></span>
                      <p className="text-xs font-medium leading-tight">Log Usage</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/** Modal panel listing and managing parts linked to a purchase order; supports adding new parts inline. */
function PartsPanelModal({ order, canEdit, onRefreshOrderList }) {
  const { popModal, pushModal } = useModal()
  const { apiFetch } = useAuth()
  const [parts, setParts] = useState([])
  const [loading, setLoading] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [addPartOpen, setAddPartOpen] = useState(false)
  const [partForm, setPartForm] = useState(EMPTY_PART_FORM)
  const [partFormError, setPartFormError] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [supplierDisplay, setSupplierDisplay] = useState('')

  useEffect(() => {
    let active = true; setLoading(true)
    apiFetch(`/api/parts?poNum=${order.poNum}&size=100&sort=partId,asc`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { if (active) setParts(d.content ?? []) })
      .catch(() => { if (active) setParts([]) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [apiFetch, order, refreshKey])

  /** Posts a new part linked to this PO, then resets the inline form and refreshes the parts list. */
  async function handleAddPartSubmit(e) {
    e.preventDefault(); setPartFormError({}); setSubmitting(true)
    try {
      const res = await apiFetch('/api/parts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...partForm, quantityOrdered: Number(partForm.quantityOrdered), unitPrice: Number(partForm.unitPrice), supplierId: Number(partForm.supplierId), poNum: order.poNum }),
      })
      if (!res.ok) { setPartFormError(await parseApiError(res)); notyfError('Add part failed'); return }
      setAddPartOpen(false); setPartForm(EMPTY_PART_FORM); setSupplierDisplay('')
      notyfSuccess('Part added.')
      setRefreshKey(k => k + 1)
      onRefreshOrderList()
    } catch (err) { setPartFormError({ _general: err.message }) }
    finally { setSubmitting(false) }
  }

  return (
    <div className="modal-content w-full max-w-2xl my-auto shadow-xl">
      <div className="modal-header">
        <div><h3 className="modal-title">Parts — {order.poNum}</h3><span className="text-sm text-base-content/50">{order.purpose}</span></div>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body flex flex-col gap-4">
        <PartsTable parts={parts} loading={loading} onSelectPart={p => pushModal(<PartDetailModal part={p} srNumber={order.srNumber} canEdit={canEdit} onRefreshTable={() => setRefreshKey(k => k + 1)} />)} />
        {canEdit && !addPartOpen && (
          <button type="button" className="btn btn-soft btn-primary btn-sm w-full" onClick={() => { setAddPartOpen(true); setPartForm(EMPTY_PART_FORM); setPartFormError({}); setSupplierDisplay('') }}>
            <span className="icon-[tabler--plus] size-4"></span>Add Part
          </button>
        )}
        {addPartOpen && (
          <div className="card border border-base-300 bg-base-200/40">
            <div className="card-body gap-3">
              <p className="text-xs font-semibold text-base-content/50 uppercase tracking-wide">New Part</p>
              <form id="inv-add-part-form" onSubmit={handleAddPartSubmit}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2 flex flex-col gap-1">
                    <label className="label-text font-medium">Name <span className="text-error">*</span></label>
                    <input type="text" name="name" maxLength={120} required className={`input input-bordered w-full${partFormError.name ? ' is-invalid' : ''}`} value={partForm.name} onChange={e => setPartForm(p => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="label-text font-medium">Qty Ordered <span className="text-error">*</span></label>
                    <input type="number" min={1} required className={`input input-bordered w-full${partFormError.quantityOrdered ? ' is-invalid' : ''}`} value={partForm.quantityOrdered} onChange={e => setPartForm(p => ({ ...p, quantityOrdered: e.target.value }))} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="label-text font-medium">Qty Type <span className="text-error">*</span></label>
                    <input type="text" maxLength={30} required className={`input input-bordered w-full${partFormError.quantityType ? ' is-invalid' : ''}`} placeholder="e.g. pcs, kg, m" value={partForm.quantityType} onChange={e => setPartForm(p => ({ ...p, quantityType: e.target.value }))} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="label-text font-medium">Unit Price <span className="text-error">*</span></label>
                    <input type="number" min={0} step="0.01" required className={`input input-bordered w-full${partFormError.unitPrice ? ' is-invalid' : ''}`} value={partForm.unitPrice} onChange={e => setPartForm(p => ({ ...p, unitPrice: e.target.value }))} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="label-text font-medium">Status <span className="text-error">*</span></label>
                    <select className="select select-bordered w-full" value={partForm.status} onChange={e => setPartForm(p => ({ ...p, status: e.target.value }))}>
                      {['ordered','received','cancelled','used'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="label-text font-medium">Supplier <span className="text-error">*</span></label>
                    <div className="flex gap-2">
                      <input type="text" readOnly className={`input input-bordered flex-1${partFormError.supplierId ? ' is-invalid' : ''}`} placeholder="Select supplier…" value={supplierDisplay} />
                      <button type="button" className="btn btn-soft btn-secondary shrink-0" onClick={() => pushModal(<SupplierPickerLayer onSelect={s => { setPartForm(p => ({ ...p, supplierId: s.supplierId })); setSupplierDisplay(`${s.name} (#${s.supplierId})`) }} />)}>Pick</button>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 justify-end mt-3">
                  <button type="button" className="btn btn-soft btn-secondary btn-sm" onClick={() => setAddPartOpen(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>Add Part</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/** Modal for editing an existing equipment item's details. */
function EditEquipModal({ equipment, onRefresh }) {
  const { popModal } = useModal()
  const { apiFetch } = useAuth()
  const [form, setForm] = useState({ name: equipment.name, type: equipment.type, model: equipment.model ?? '', serialNumber: equipment.serialNumber ?? '', description: equipment.description ?? '', stock: String(equipment.stock), acquisitionCost: equipment.acquisitionCost ?? '', status: equipment.status })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  /** Submits updated equipment data to the API and refreshes the equipment list on success. */
  async function handleEditEquipSubmit(e) {
    e.preventDefault(); setErrors({}); setSubmitting(true)
    try {
      const res = await apiFetch(`/api/equipment/${equipment.equipmentId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, stock: Number(form.stock), acquisitionCost: form.acquisitionCost ? Number(form.acquisitionCost) : null, poNum: equipment.poNum }),
      })
      if (!res.ok) { setErrors(await parseApiError(res)); notyfError('Update failed'); return }
      popModal()
      notyfSuccess(`Equipment #${equipment.equipmentId} updated.`)
      onRefresh()
    } catch (err) { setErrors({ _general: err.message }) }
    finally { setSubmitting(false) }
  }

  return (
    <div className="modal-content w-full max-w-lg my-auto shadow-xl">
      <div className="modal-header">
        <div><h3 className="modal-title">Edit Equipment #{equipment.equipmentId}</h3><span className="text-sm text-base-content/50">{equipment.name}</span></div>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body">
        <form id="inv-edit-equip-form" onSubmit={handleEditEquipSubmit}>
          <EquipFormFields form={form} onChange={e => setForm(p => ({ ...p, [e.target.name]: e.target.value }))} errors={errors} showStatus={true} />
        </form>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-soft btn-secondary" onClick={popModal}>Cancel</button>
        <button type="submit" form="inv-edit-equip-form" className="btn btn-primary" disabled={submitting}>
          {submitting ? <span className="loading loading-spinner loading-sm"></span> : <span className="icon-[tabler--device-floppy] size-4"></span>}
          Save Changes
        </button>
      </div>
    </div>
  )
}

/** Modal panel listing and managing equipment linked to a purchase order; supports adding new items inline. */
function EquipmentPanelModal({ order, canEdit }) {
  const { popModal, pushModal } = useModal()
  const { apiFetch } = useAuth()
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_EQUIP_FORM)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let active = true; setLoading(true)
    apiFetch(`/api/equipment?poNum=${encodeURIComponent(order.poNum)}&size=100&sort=equipmentId,asc`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { if (active) setList(d.content ?? []) })
      .catch(() => { if (active) setList([]) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [apiFetch, order, refreshKey])

  /** Posts a new equipment item linked to this PO, then resets the inline form and refreshes the list. */
  async function handleAddEquipSubmit(e) {
    e.preventDefault(); setErrors({}); setSubmitting(true)
    try {
      const res = await apiFetch('/api/equipment', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, stock: Number(form.stock), acquisitionCost: form.acquisitionCost ? Number(form.acquisitionCost) : null, status: 'active', poNum: order.poNum }),
      })
      if (!res.ok) { setErrors(await parseApiError(res)); notyfError('Add equipment failed'); return }
      setAddOpen(false); setForm(EMPTY_EQUIP_FORM)
      notyfSuccess('Equipment added.')
      setRefreshKey(k => k + 1)
    } catch (err) { setErrors({ _general: err.message }) }
    finally { setSubmitting(false) }
  }

  return (
    <div className="modal-content w-full max-w-2xl my-auto shadow-xl">
      <div className="modal-header">
        <div><h3 className="modal-title">Equipment — {order.poNum}</h3><span className="text-sm text-base-content/50">{order.purpose}</span></div>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body flex flex-col gap-4">
        {loading ? (
          <div className="flex justify-center py-10"><span className="loading loading-spinner loading-lg text-primary"></span></div>
        ) : list.length === 0 ? (
          <div className="text-center py-10 text-base-content/40">
            <span className="icon-[tabler--tool-off] size-10 mx-auto mb-2 block"></span>
            <p>No equipment linked to this purchase order.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-box border border-base-300">
            <table className="table table-zebra table-sm w-full">
              <thead><tr><th>ID</th><th>Name</th><th>Type</th><th>Stock</th><th>Status</th>{canEdit && <th></th>}</tr></thead>
              <tbody>
                {list.map(eq => (
                  <tr key={eq.equipmentId}>
                    <td className="font-mono text-xs">{eq.equipmentId}</td>
                    <td className="text-sm font-medium max-w-40"><span className="line-clamp-1" title={eq.name}>{eq.name}</span></td>
                    <td><span className={`badge badge-soft ${eq.type === 'durable' ? 'badge-info' : 'badge-warning'} text-xs`}>{eq.type}</span></td>
                    <td className="text-sm">{eq.stock}</td>
                    <td><span className={`badge badge-soft ${eq.status === 'active' ? 'badge-success' : eq.status === 'under_maintenance' ? 'badge-warning' : eq.status === 'retired' ? 'badge-neutral' : 'badge-error'} text-xs`}>{eq.status}</span></td>
                    {canEdit && (
                      <td>
                        <button className="btn btn-soft btn-secondary btn-xs" onClick={() => pushModal(<EditEquipModal equipment={eq} onRefresh={() => setRefreshKey(k => k + 1)} />)}>
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
        {canEdit && !addOpen && (
          <button type="button" className="btn btn-soft btn-primary btn-sm w-full" onClick={() => { setAddOpen(true); setForm(EMPTY_EQUIP_FORM); setErrors({}) }}>
            <span className="icon-[tabler--plus] size-4"></span>Add Equipment
          </button>
        )}
        {addOpen && (
          <div className="card border border-base-300 bg-base-200/40">
            <div className="card-body gap-3">
              <p className="text-xs font-semibold text-base-content/50 uppercase tracking-wide">New Equipment</p>
              <form id="inv-add-equip-form" onSubmit={handleAddEquipSubmit}>
                <EquipFormFields form={form} onChange={e => setForm(p => ({ ...p, [e.target.name]: e.target.value }))} errors={errors} showStatus={false} />
                <div className="flex gap-2 justify-end mt-3">
                  <button type="button" className="btn btn-soft btn-secondary btn-sm" onClick={() => setAddOpen(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>Add</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/** Modal for editing an existing delivery contact's name and number. */
function EditContactModal({ contact, onRefresh }) {
  const { popModal } = useModal()
  const { apiFetch } = useAuth()
  const [form, setForm] = useState({ contactName: contact.contactName, contactNumber: contact.contactNumber })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  /** Submits updated contact data to the API and refreshes the contacts list on success. */
  async function handleUpdateContactSubmit(e) {
    e.preventDefault(); setErrors({}); setSubmitting(true)
    try {
      const res = await apiFetch(`/api/purchase-order-delivery-contacts/${contact.poContactNum}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, poNum: contact.poNum }),
      })
      if (!res.ok) { setErrors(await parseApiError(res)); notyfError('Update failed'); return }
      popModal()
      notyfSuccess(`Contact #${contact.poContactNum} updated.`)
      onRefresh()
    } catch (err) { setErrors({ _general: err.message }) }
    finally { setSubmitting(false) }
  }

  return (
    <div className="modal-content w-full max-w-sm shadow-xl">
      <div className="modal-header">
        <h3 className="modal-title">Edit Contact #{contact.poContactNum}</h3>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body">
        <form id="inv-update-contact-form" onSubmit={handleUpdateContactSubmit}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Name <span className="text-error">*</span></label>
              <input type="text" maxLength={120} required className={`input input-bordered w-full${errors.contactName ? ' is-invalid' : ''}`} value={form.contactName} onChange={e => setForm(p => ({ ...p, contactName: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Number <span className="text-error">*</span></label>
              <input type="text" maxLength={30} required className={`input input-bordered w-full${errors.contactNumber ? ' is-invalid' : ''}`} value={form.contactNumber} onChange={e => setForm(p => ({ ...p, contactNumber: e.target.value }))} />
            </div>
          </div>
        </form>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-soft btn-secondary" onClick={popModal}>Cancel</button>
        <button type="submit" form="inv-update-contact-form" className="btn btn-primary" disabled={submitting}>Save</button>
      </div>
    </div>
  )
}

/** Modal panel for listing, adding, editing, and deleting delivery contacts on a purchase order. */
function ContactsPanelModal({ order, canEdit }) {
  const { popModal, pushModal } = useModal()
  const { apiFetch } = useAuth()
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_CONTACT_FORM)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => {
    let active = true; setLoading(true)
    apiFetch(`/api/purchase-order-delivery-contacts?poNum=${order.poNum}&size=100&sort=poContactNum,asc`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { if (active) setContacts(d.content ?? []) })
      .catch(() => { if (active) setContacts([]) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [apiFetch, order, refreshKey])

  /** Posts a new delivery contact linked to this PO, then resets the inline form and refreshes. */
  async function handleAddContactSubmit(e) {
    e.preventDefault(); setErrors({}); setSubmitting(true)
    try {
      const res = await apiFetch('/api/purchase-order-delivery-contacts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, poNum: order.poNum }),
      })
      if (!res.ok) { setErrors(await parseApiError(res)); notyfError('Add contact failed'); return }
      setAddOpen(false); setForm(EMPTY_CONTACT_FORM)
      notyfSuccess('Contact added.')
      setRefreshKey(k => k + 1)
    } catch (err) { setErrors({ _general: err.message }) }
    finally { setSubmitting(false) }
  }

  return (
    <div className="modal-content w-full max-w-lg my-auto shadow-xl">
      <div className="modal-header">
        <div><h3 className="modal-title">Delivery Contacts — {order.poNum}</h3><span className="text-sm text-base-content/50">{order.purpose}</span></div>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body flex flex-col gap-4">
        {loading ? (
          <div className="flex justify-center py-6"><span className="loading loading-spinner loading-sm text-primary"></span></div>
        ) : contacts.length === 0 ? (
          <div className="text-center py-6 text-base-content/40 text-sm">No delivery contacts yet.</div>
        ) : (
          <div className="overflow-x-auto rounded-box border border-base-300">
            <table className="table table-zebra table-sm w-full">
              <thead><tr><th>ID</th><th>Name</th><th>Number</th>{canEdit && <th></th>}</tr></thead>
              <tbody>
                {contacts.map(c => (
                  <tr key={c.poContactNum}>
                    <td className="font-mono text-xs">{c.poContactNum}</td>
                    <td className="text-sm">{c.contactName}</td>
                    <td className="text-sm">{c.contactNumber}</td>
                    {canEdit && (
                      <td>
                        <div className="flex gap-1">
                          <button className="btn btn-soft btn-secondary btn-xs" onClick={() => pushModal(<EditContactModal contact={c} onRefresh={() => setRefreshKey(k => k + 1)} />)}>Edit</button>
                          <button className="btn btn-soft btn-error btn-xs" disabled={deletingId === c.poContactNum} onClick={async () => {
                            setDeletingId(c.poContactNum)
                            try {
                              const res = await apiFetch(`/api/purchase-order-delivery-contacts/${c.poContactNum}`, { method: 'DELETE' })
                              if (!res.ok) return
                              notyfSuccess('Contact deleted.')
                              setRefreshKey(k => k + 1)
                            } finally { setDeletingId(null) }
                          }}>Delete</button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {canEdit && !addOpen && (
          <button type="button" className="btn btn-soft btn-primary btn-sm w-full" onClick={() => { setAddOpen(true); setForm(EMPTY_CONTACT_FORM); setErrors({}) }}>Add Contact</button>
        )}
        {addOpen && (
          <form onSubmit={handleAddContactSubmit} className="grid grid-cols-2 gap-2 border p-3 rounded-box bg-base-200/40">
            <input type="text" placeholder="Name" required className="input input-sm input-bordered" value={form.contactName} onChange={e => setForm(p => ({ ...p, contactName: e.target.value }))} />
            <input type="text" placeholder="Number" required className="input input-sm input-bordered" value={form.contactNumber} onChange={e => setForm(p => ({ ...p, contactNumber: e.target.value }))} />
            <div className="col-span-2 flex justify-end gap-1"><button type="button" className="btn btn-xs" onClick={() => setAddOpen(false)}>Cancel</button><button type="submit" className="btn btn-xs btn-primary" disabled={submitting}>Save</button></div>
          </form>
        )}
      </div>
    </div>
  )
}

/** Modal listing all ordered parts for a PO so the user can mark them received one by one. */
function ReceivePartsModal({ order, onRefreshList }) {
  const { popModal } = useModal()
  const { apiFetch } = useAuth()
  const [parts, setParts] = useState([])
  const [loading, setLoading] = useState(true)
  const [receivingId, setReceivingId] = useState(null)

  /** Fetches parts for this PO and filters to only those still ordered. */
  function fetchParts() {
    setLoading(true)
    apiFetch(`/api/parts?poNum=${order.poNum}&size=100&sort=partId,asc`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setParts((d.content ?? []).filter(p => p.status === 'ordered')))
      .catch(() => setParts([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchParts() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /** Marks a single part as received via PUT, then removes it from the visible list. */
  async function handleReceive(part) {
    setReceivingId(part.partId)
    try {
      const res = await apiFetch(`/api/parts/${part.partId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: part.name,
          quantityOrdered: part.quantityOrdered,
          quantityType: part.quantityType,
          unitPrice: part.unitPrice,
          supplierId: part.supplierId,
          poNum: part.poNum,
          orderDate: part.orderDate,
          status: 'received',
        }),
      })
      if (!res.ok) { notyfError('Failed to receive part'); return }
      setParts(prev => prev.filter(p => p.partId !== part.partId))
      notyfSuccess(`Part #${part.partId} — ${part.name} marked as received.`)
      onRefreshList()
    } catch {
      notyfError('Failed to receive part')
    } finally {
      setReceivingId(null)
    }
  }

  return (
    <div className="modal-content w-full max-w-2xl my-auto shadow-xl">
      <div className="modal-header">
        <div>
          <h3 className="modal-title">Receive Ordered Parts</h3>
          <span className="text-sm text-base-content/50">PO {order.poNum} · {order.purpose}</span>
        </div>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body">
        {loading ? (
          <div className="flex justify-center py-12">
            <span className="loading loading-spinner loading-md text-primary"></span>
          </div>
        ) : parts.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-base-content/40">
            <span className="icon-[tabler--circle-check] size-12 text-success"></span>
            <p className="text-sm font-medium">All parts have been received.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-box border border-base-300">
            <table className="table table-zebra table-sm w-full">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Qty</th>
                  <th>Unit Price</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {parts.map(p => (
                  <tr key={p.partId}>
                    <td className="font-mono font-semibold">{p.partId}</td>
                    <td className="font-medium max-w-40"><span className="line-clamp-1" title={p.name}>{p.name}</span></td>
                    <td className="text-sm">{p.quantityOrdered} {p.quantityType}</td>
                    <td className="text-sm">{formatCurrency(p.unitPrice)}</td>
                    <td><span className="badge badge-soft badge-neutral text-xs">ordered</span></td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-success btn-sm"
                        disabled={receivingId === p.partId}
                        onClick={() => handleReceive(p)}
                      >
                        {receivingId === p.partId
                          ? <span className="loading loading-spinner loading-xs"></span>
                          : <span className="icon-[tabler--check] size-4"></span>
                        }
                        Receive
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-ghost" onClick={popModal}>Close</button>
      </div>
    </div>
  )
}

/** Modal for logging usage of a received part and marking it as used in one step. */
function UsePartModal({ part, srNumber, onSuccess }) {
  const { popModal } = useModal()
  const { apiFetch } = useAuth()
  const [usageHistory, setUsageHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [srInfo, setSrInfo] = useState(null)
  const [form, setForm] = useState({ qtyUsed: '', notes: '' })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    apiFetch(`/api/part-usages?partId=${part.partId}&size=100&sort=usedOn,desc`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setUsageHistory(d.content ?? []))
      .catch(() => setUsageHistory([]))
      .finally(() => setHistoryLoading(false))
    if (srNumber) {
      apiFetch(`/api/service-reports/${srNumber}`)
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(d => setSrInfo(d))
        .catch(() => {})
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const availableQty = (part.quantityOrdered ?? 0) - usageHistory.reduce((s, u) => s + u.qtyUsed, 0)

  /** Posts the usage entry then marks the part as used; closes and notifies the parent list on success. */
  async function handleSubmit(e) {
    e.preventDefault(); setErrors({}); setSubmitting(true)
    try {
      const usageRes = await apiFetch('/api/part-usages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partId: part.partId, srNumber: srNumber ?? null, qtyUsed: Number(form.qtyUsed), notes: form.notes || null }),
      })
      if (!usageRes.ok) { setErrors(await parseApiError(usageRes)); notyfError('Log usage failed'); return }

      await apiFetch(`/api/parts/${part.partId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: part.name, quantityOrdered: part.quantityOrdered, quantityType: part.quantityType,
          unitPrice: part.unitPrice, supplierId: part.supplierId, poNum: part.poNum,
          orderDate: part.orderDate, status: 'used',
        }),
      })

      popModal()
      notyfSuccess(`Part #${part.partId} — ${part.name} usage logged and marked as used.`)
      onSuccess(part.partId)
    } catch (err) { setErrors({ _general: err.message }) }
    finally { setSubmitting(false) }
  }

  return (
    <div className="modal-content w-full max-w-sm shadow-xl">
      <div className="modal-header">
        <div>
          <h3 className="modal-title">Log Use — Part #{part.partId}</h3>
          <span className="text-sm text-base-content/50">{part.name}</span>
        </div>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body">
        <form id="inv-use-part-form" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 bg-base-200/60 rounded-box px-4 py-3 text-sm">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-base-content/50 uppercase tracking-wide">Qty Ordered</span>
                <span className="font-medium">{part.quantityOrdered} {part.quantityType}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-base-content/50 uppercase tracking-wide">Available</span>
                <span className="font-medium">
                  {historyLoading ? '…' : availableQty} {part.quantityType}
                </span>
              </div>
            </div>
            {srNumber && (
              <div className="bg-base-200/60 rounded-box px-4 py-3 flex flex-col gap-1 text-sm">
                <span className="text-xs text-base-content/50 uppercase tracking-wide">Logging against SR #{srNumber}</span>
                {srInfo ? (
                  <>
                    <span className="font-medium">{srInfo.projectName}</span>
                    {srInfo.complaint && <span className="text-base-content/60 text-xs line-clamp-2">{srInfo.complaint}</span>}
                    {srInfo.scheduleDate && <span className="text-base-content/50 text-xs">{formatDate(srInfo.scheduleDate)}</span>}
                  </>
                ) : (
                  <span className="text-base-content/40 text-xs">Loading SR info…</span>
                )}
              </div>
            )}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="label-text font-medium">Quantity Used <span className="text-error">*</span></label>
                <button type="button" className="btn btn-xs btn-soft btn-primary"
                  disabled={historyLoading}
                  onClick={() => setForm(p => ({ ...p, qtyUsed: availableQty }))}>
                  Use All
                </button>
              </div>
              <input type="number" min={1} max={historyLoading ? undefined : availableQty} required
                className={`input input-bordered w-full${errors.qtyUsed ? ' is-invalid' : ''}`}
                value={form.qtyUsed} onChange={e => setForm(p => ({ ...p, qtyUsed: e.target.value }))} />
              {errors.qtyUsed
                ? <span className="helper-text">{errors.qtyUsed}</span>
                : <span className="text-xs text-base-content/40">
                    {historyLoading ? 'Loading available qty…' : `Max: ${availableQty} ${part.quantityType}`}
                  </span>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Notes</label>
              <input type="text" maxLength={255}
                className="input input-bordered w-full"
                value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
            {errors._general && (
              <div className="alert alert-error py-2">
                <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                <span className="text-sm">{errors._general}</span>
              </div>
            )}
          </div>
        </form>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-soft btn-secondary" onClick={popModal}>Cancel</button>
        <button type="submit" form="inv-use-part-form" className="btn btn-primary" disabled={submitting || historyLoading}>
          {submitting ? <span className="loading loading-spinner loading-sm"></span> : <span className="icon-[tabler--tool] size-4"></span>}
          Log &amp; Mark Used
        </button>
      </div>
    </div>
  )
}

/** Modal listing all received parts for a PO so the user can log usage and mark them used one by one. */
function UsePartsListModal({ order, onRefreshList }) {
  const { popModal, pushModal } = useModal()
  const { apiFetch } = useAuth()
  const [parts, setParts] = useState([])
  const [loading, setLoading] = useState(true)

  function fetchParts() {
    setLoading(true)
    apiFetch(`/api/parts?poNum=${order.poNum}&size=100&sort=partId,asc`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setParts((d.content ?? []).filter(p => p.status === 'received')))
      .catch(() => setParts([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchParts() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /** Removes the part from the visible list after it has been used; also notifies the PO list. */
  function handlePartUsed(partId) {
    setParts(prev => prev.filter(p => p.partId !== partId))
    onRefreshList()
  }

  return (
    <div className="modal-content w-full max-w-2xl my-auto shadow-xl">
      <div className="modal-header">
        <div>
          <h3 className="modal-title">Log Use of Parts</h3>
          <span className="text-sm text-base-content/50">PO {order.poNum} · {order.purpose}</span>
        </div>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body">
        {loading ? (
          <div className="flex justify-center py-12">
            <span className="loading loading-spinner loading-md text-primary"></span>
          </div>
        ) : parts.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-base-content/40">
            <span className="icon-[tabler--package-off] size-12"></span>
            <p className="text-sm font-medium">No received parts available to log usage for.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-box border border-base-300">
            <table className="table table-zebra table-sm w-full">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Qty</th>
                  <th>Unit Price</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {parts.map(p => (
                  <tr key={p.partId}>
                    <td className="font-mono font-semibold">{p.partId}</td>
                    <td className="font-medium max-w-40"><span className="line-clamp-1" title={p.name}>{p.name}</span></td>
                    <td className="text-sm">{p.quantityOrdered} {p.quantityType}</td>
                    <td className="text-sm">{formatCurrency(p.unitPrice)}</td>
                    <td><span className="badge badge-soft badge-success text-xs">received</span></td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => pushModal(<UsePartModal part={p} srNumber={order.srNum} onSuccess={handlePartUsed} />)}
                      >
                        <span className="icon-[tabler--tool] size-4"></span>
                        Use
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-ghost" onClick={popModal}>Close</button>
      </div>
    </div>
  )
}

/** Layer 1 manage panel for a purchase order; shows metadata summary and pushes sub-modals for each action. */
function ManagePurchaseOrderModal({ order, hasRole, onRefreshList }) {
  const { popModal, pushModal } = useModal()
  const { apiFetch } = useAuth()
  const navigate = useNavigate()
  const canEdit = hasRole('ADMIN', 'ACCOUNTING', 'STAFF')
  const [hasOrderedParts, setHasOrderedParts] = useState(false)
  const [hasReceivedParts, setHasReceivedParts] = useState(false)
  const [partsRefreshKey, setPartsRefreshKey] = useState(0)

  /** Re-fetches parts status whenever partsRefreshKey changes (e.g. after add/receive/use). */
  useEffect(() => {
    if (!order.srNum) return
    apiFetch(`/api/parts?poNum=${order.poNum}&size=100&sort=partId,asc`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => {
        const parts = d.content ?? []
        setHasOrderedParts(parts.some(p => p.status === 'ordered'))
        setHasReceivedParts(parts.some(p => p.status === 'received'))
      })
      .catch(() => {})
  }, [partsRefreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  /** Refreshes both the PO list and the parts status indicators. */
  function refreshAll() { onRefreshList(); setPartsRefreshKey(k => k + 1) }

  /** Dispatches the selected action key to push the appropriate sub-modal or navigate away. */
  function handleMenuSelect(key) {
    if (key === 'update') {
      pushModal(<UpdatePoModal order={order} onRefresh={onRefreshList} />)
    } else if (key === 'documents') {
      popModal() // Close current workflow session before external routing updates
      const url = order.srNum
        ? `/service-report/${order.srNum}/purchase-orders/${order.poNum}/documents`
        : `/inventory/purchase-orders/${order.poNum}/documents`
      navigate(url)
    } else if (key === 'parts') {
      pushModal(<PartsPanelModal order={order} canEdit={canEdit} onRefreshOrderList={refreshAll} />)
    } else if (key === 'receive') {
      pushModal(<ReceivePartsModal order={order} onRefreshList={refreshAll} />)
    } else if (key === 'use-parts') {
      pushModal(<UsePartsListModal order={order} onRefreshList={refreshAll} />)
    } else if (key === 'equipment') {
      pushModal(<EquipmentPanelModal order={order} canEdit={canEdit} />)
    } else if (key === 'contacts') {
      pushModal(<ContactsPanelModal order={order} canEdit={canEdit} />)
    }
  }

  const detailedMetadata = [
    { label: 'PO Number',       value: order.poNum },
    { label: 'Terms',           value: order.terms },
    { label: 'Payment Method',  value: order.paymentMethod ?? '—' },
    { label: 'Payment Details', value: order.paymentDetails ?? '—' },
    { label: 'Total Cost',      value: formatCurrency(order.totalCost) },
    { label: 'SR #',            value: order.srNum ?? '—' },
    { label: 'Added On',        value: formatDate(order.addedOn) },
    { label: 'Delivery Address', value: order.deliveryAddress ?? '—', fullWidth: true },
    { label: 'Remarks',          value: order.remarks ?? '—', fullWidth: true },
  ]

  return (
    <div className="modal-content w-full max-w-2xl my-auto shadow-xl">
      <div className="modal-header border-b border-base-200 pb-3">
        <div>
          <h3 className="modal-title text-xl font-bold">PO {order.poNum}</h3>
          <span className="text-sm text-base-content/60">{order.purpose}</span>
        </div>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>

      <div className="modal-body py-4 flex flex-col gap-6">
        {/* Core Profile Context Info metadata display */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 bg-base-200/50 rounded-box p-4 text-xs">
          {detailedMetadata.map((f, idx) => (
            <div key={idx} className={f.fullWidth ? "col-span-2 sm:col-span-3 flex flex-col gap-0.5" : "flex flex-col gap-0.5"}>
              <span className="text-base-content/40 font-semibold uppercase tracking-wider">{f.label}</span>
              <span className="text-sm font-medium text-base-content break-words">{f.value}</span>
            </div>
          ))}
        </div>

        {/* ModalNav Grid Section */}
        <div className="border-t border-base-200 pt-4">
          <ModalNav
            title="Available Operations"
            items={[
              ...getPoMenuItems(order),
              ...(hasOrderedParts ? [{ key: 'receive', label: 'Receive Ordered Parts', icon: 'icon-[tabler--package-import]', roles: ['ADMIN', 'ACCOUNTING', 'STAFF'] }] : []),
              ...(hasReceivedParts ? [{ key: 'use-parts', label: 'Log Use of Parts', icon: 'icon-[tabler--tool]', roles: ['ADMIN', 'ACCOUNTING', 'STAFF'] }] : []),
            ]}
            hasRole={hasRole}
            onSelect={handleMenuSelect}
          />
        </div>
      </div>
    </div>
  )
}

/** Modal for creating a new purchase order linked to a specific service report (SR context). */
function NewPoContextModal({ srNum, onRefresh }) {
  const { popModal, pushModal } = useModal()
  const { apiFetch } = useAuth()
  const [form, setForm] = useState(EMPTY_PO_FORM)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [contacts, setContacts] = useState([])
  const [parts, setParts] = useState([])
  const [projectAddress, setProjectAddress] = useState('')

  useEffect(() => {
    apiFetch(`/api/service-reports/${srNum}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(sr => apiFetch(`/api/projects/${sr.projNum}`))
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(proj => setProjectAddress(proj.address ?? ''))
      .catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /** Creates the PO then sequentially posts any staged contacts and parts; closes modal on success. */
  async function handleNewPoSubmit(e) {
    e.preventDefault()
    const validationErrors = {}
    if (!form.purpose.trim()) validationErrors.purpose = 'Purpose is required.'
    if (!form.terms.trim()) validationErrors.terms = 'Terms are required.'
    if (Object.keys(validationErrors).length > 0) { setErrors(validationErrors); return }
    setSubmitting(true)
    try {
      const res = await apiFetch('/api/purchase-orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, ewalletType: undefined, paymentMethod: form.paymentMethod === 'ewallet' ? `ewallet:${form.ewalletType}` : form.paymentMethod || null, srNum }),
      })
      if (!res.ok) { setErrors(await parseApiError(res)); notyfError('Failed to create purchase order'); return }
      const createdPo = await res.json()
      for (const c of contacts) {
        await apiFetch('/api/purchase-order-delivery-contacts', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ poNum: createdPo.poNum, contactName: c.contactName, contactNumber: c.contactNumber }),
        })
      }
      for (const p of parts) {
        await apiFetch('/api/parts', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ poNum: createdPo.poNum, name: p.name, quantityOrdered: Number(p.quantityOrdered), quantityType: p.quantityType, unitPrice: Number(p.unitPrice), supplierId: Number(p.supplierId), orderDate: p.orderDate || null, status: 'ordered' }),
        })
      }
      popModal()
      notyfSuccess(`Purchase Order ${createdPo.poNum} created.`)
      onRefresh()
    } catch (err) { setErrors({ _general: err.message }) }
    finally { setSubmitting(false) }
  }

  return (
    <div className="modal-content w-full max-w-2xl my-auto shadow-xl">
      <div className="modal-header">
        <div><h3 className="modal-title">New Purchase Order</h3><span className="text-sm text-base-content/50">Linked to SR #{srNum}</span></div>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}><span className="icon-[tabler--x] size-4"></span></button>
      </div>
      <div className="modal-body flex flex-col gap-5">
        <form id="inv-new-po-form" onSubmit={handleNewPoSubmit}>
          <POFormFields form={form} onChange={e => setForm(p => ({ ...p, [e.target.name]: e.target.value }))} errors={errors} projectAddress={projectAddress} />
        </form>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Delivery Contacts</span>
            <button type="button" className="btn btn-soft btn-accent btn-sm" onClick={() => pushModal(<NewPoAddContactModal onAdd={c => setContacts(l => [...l, c])} />)}><span className="icon-[tabler--address-book] size-4"></span>Add Contact</button>
          </div>
          {contacts.length === 0 ? <p className="text-sm text-base-content/40">No delivery contacts added yet.</p> : (
            <div className="overflow-x-auto rounded-box border border-base-300">
              <table className="table table-sm">
                <tbody>{contacts.map((c, i) => <tr key={c._tempId}><td>{i+1}</td><td>{c.contactName}</td><td>{c.contactNumber}</td><td><button type="button" className="btn btn-error btn-xs" onClick={() => setContacts(l => l.filter(x => x._tempId !== c._tempId))}>Remove</button></td></tr>)}</tbody>
              </table>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Parts</span>
            <button type="button" className="btn btn-soft btn-accent btn-sm" onClick={() => pushModal(<NewPoAddPartModal onAdd={p => setParts(l => [...l, p])} />)}><span className="icon-[tabler--package] size-4"></span>Add Part</button>
          </div>
          {parts.length === 0 ? <p className="text-sm text-base-content/40">No parts added yet.</p> : (
            <div className="overflow-x-auto rounded-box border border-base-300">
              <table className="table table-sm">
                <tbody>{parts.map((p, i) => <tr key={p._tempId}><td>{i+1}</td><td>{p.name}</td><td>{p.quantityOrdered}</td><td>{p._supplierName}</td><td><button type="button" className="btn btn-error btn-xs" onClick={() => setParts(l => l.filter(x => x._tempId !== p._tempId))}>Remove</button></td></tr>)}</tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-soft btn-secondary" onClick={popModal}>Cancel</button>
        <button type="submit" form="inv-new-po-form" className="btn btn-primary" disabled={submitting}>Create Purchase Order</button>
      </div>
    </div>
  )
}

/** Multi-step wizard for creating a new PO; step flow differs for SR-linked vs standalone equipment types. */
function NewPoWizardModal({ onRefresh }) {
  const { popModal, pushModal } = useModal()
  const { apiFetch } = useAuth()
  const [step, setStep] = useState(1)
  const [type, setType] = useState(null)
  const [project, setProject] = useState(null)
  const [sr, setSr] = useState(null)

  const [projects, setProjects] = useState([])
  const [projLoading, setProjLoading] = useState(false)
  const [projPage, setProjPage] = useState(0)
  const [projTotal, setProjTotal] = useState(0)
  const [projSearch, setProjSearch] = useState('')
  const [projInput, setProjInput] = useState('')

  const [srs, setSrs] = useState([])
  const [srLoading, setSrLoading] = useState(false)
  const [srPage, setSrPage] = useState(0)
  const [srTotal, setSrTotal] = useState(0)
  const [srInput, setSrInput] = useState('')
  const [srSearch, setSrSearch] = useState('')

  const [equipPoForm, setEquipPoForm] = useState(EMPTY_PO_FORM)
  const [equipPoError, setEquipPoError] = useState({})
  const [equipList, setEquipList] = useState([])
  const [equipForm, setEquipForm] = useState(EMPTY_WIZARD_EQUIP)
  const [equipFormError, setEquipFormError] = useState({})
  const [addingEquip, setAddingEquip] = useState(false)

  const [docList, setDocList] = useState([])
  const [docForm, setDocForm] = useState({ invoiceId: '', file: null })
  const [docFormError, setDocFormError] = useState({})
  const [addingDoc, setAddingDoc] = useState(false)
  const [submitError, setSubmitError] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const docFileRef = useRef(null)

  const [srPoForm, setSrPoForm] = useState(EMPTY_PO_FORM)
  const [srPoError, setSrPoError] = useState({})
  const [srContacts, setSrContacts] = useState([])
  const [srParts, setSrParts] = useState([])
  const [srDocs, setSrDocs] = useState([])
  const [srDocForm, setSrDocForm] = useState({ invoiceId: '', file: null })
  const [srDocFormError, setSrDocFormError] = useState({})
  const [addingSrDoc, setAddingSrDoc] = useState(false)
  const srDocFileRef = useRef(null)

  useEffect(() => {
    if (step !== 2 || type === 'equipment') return
    let active = true; setProjLoading(true)
    const params = new URLSearchParams({ page: String(projPage), size: '8', sort: 'name,asc' })
    if (projSearch) params.set('search', projSearch)
    apiFetch(`/api/projects?${params}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { if (active) { setProjects(d.content ?? []); setProjTotal(d.totalPages ?? 0) } })
      .catch(() => { if (active) setProjects([]) })
      .finally(() => { if (active) setProjLoading(false) })
    return () => { active = false }
  }, [apiFetch, step, type, projPage, projSearch])

  useEffect(() => {
    if (step !== 3 || type === 'equipment' || !project) return
    let active = true; setSrLoading(true)
    apiFetch(`/api/service-reports?projNum=${project.projNum}&page=${srPage}&size=50&sort=srNumber,desc`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { if (active) { setSrs(d.content ?? []); setSrTotal(d.totalPages ?? 0) } })
      .catch(() => { if (active) setSrs([]) })
      .finally(() => { if (active) setSrLoading(false) })
    return () => { active = false }
  }, [apiFetch, step, type, project, srPage])

  /** Creates the equipment PO then posts each staged equipment item and document; closes wizard on success. */
  async function handleWizardEquipSubmit() {
    setSubmitError({})
    const poErrors = {}
    if (!equipPoForm.purpose.trim()) poErrors.purpose = 'Purpose is required.'
    if (!equipPoForm.terms.trim()) poErrors.terms = 'Terms are required.'
    if (Object.keys(poErrors).length > 0) { setEquipPoError(poErrors); return }
    if (equipList.length === 0) { setEquipFormError({ _general: 'Add at least one equipment item before saving.' }); return }
    setSubmitting(true)
    try {
      const poRes = await apiFetch('/api/purchase-orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...equipPoForm, ewalletType: undefined, paymentMethod: equipPoForm.paymentMethod === 'ewallet' ? `ewallet:${equipPoForm.ewalletType}` : equipPoForm.paymentMethod || null, srNum: null }),
      })
      if (!poRes.ok) { setSubmitError(await parseApiError(poRes)); return }
      const createdPo = await poRes.json()
      for (const item of equipList) {
        await apiFetch('/api/equipment', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...item, stock: Number(item.stock), acquisitionCost: item.acquisitionCost ? Number(item.acquisitionCost) : null, status: 'active', poNum: createdPo.poNum }),
        })
      }
      for (const doc of docList) {
        let docuId = null
        if (doc.file) {
          const fd = new FormData(); fd.append('file', doc.file)
          const up = await apiFetch('/api/documents', { method: 'POST', body: fd })
          if (up.ok) { const u = await up.json(); docuId = u.docuId }
        }
        await apiFetch('/api/purchase-order-documents', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ poNum: createdPo.poNum, invoiceId: doc.invoiceId, docuId }),
        })
      }
      popModal()
      notyfSuccess(`Purchase Order ${createdPo.poNum} created.`)
      onRefresh()
    } catch (err) { setSubmitError({ _general: err.message }) }
    finally { setSubmitting(false) }
  }

  /** Creates the SR-linked PO then posts staged contacts and parts; closes wizard on success. */
  async function handleWizardSrSubmit(e) {
    e.preventDefault()
    const valErrors = {}
    if (!srPoForm.purpose.trim()) valErrors.purpose = 'Purpose is required.'
    if (!srPoForm.terms.trim()) valErrors.terms = 'Terms are required.'
    if (Object.keys(valErrors).length > 0) { setSrPoError(valErrors); return }
    setSubmitting(true)
    try {
      const res = await apiFetch('/api/purchase-orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...srPoForm, ewalletType: undefined, paymentMethod: srPoForm.paymentMethod === 'ewallet' ? `ewallet:${srPoForm.ewalletType}` : srPoForm.paymentMethod || null, srNum: sr.srNumber }),
      })
      if (!res.ok) { setSrPoError(await parseApiError(res)); return }
      const createdPo = await res.json()
      for (const c of srContacts) {
        await apiFetch('/api/purchase-order-delivery-contacts', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ poNum: createdPo.poNum, contactName: c.contactName, contactNumber: c.contactNumber }),
        })
      }
      for (const p of srParts) {
        await apiFetch('/api/parts', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ poNum: createdPo.poNum, name: p.name, quantityOrdered: Number(p.quantityOrdered), quantityType: p.quantityType, unitPrice: Number(p.unitPrice), supplierId: Number(p.supplierId), orderDate: p.orderDate || null, status: 'ordered' }),
        })
      }
      for (const doc of srDocs) {
        let docuId = null
        if (doc.file) {
          const fd = new FormData(); fd.append('file', doc.file)
          const up = await apiFetch('/api/documents', { method: 'POST', body: fd })
          if (up.ok) { const u = await up.json(); docuId = u.docuId }
        }
        await apiFetch('/api/purchase-order-documents', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ poNum: createdPo.poNum, invoiceId: doc.invoiceId, docuId }),
        })
      }
      popModal()
      notyfSuccess(`Purchase Order ${createdPo.poNum} created.`)
      onRefresh()
    } catch (err) { setSrPoError({ _general: err.message }) }
    finally { setSubmitting(false) }
  }

  /** Handles file selection for a document record; rejects non-image/PDF files. */
  function handleDocFileChange(e) {
    const file = e.target.files?.[0] ?? null
    if (file && !ACCEPTED_TYPES.includes(file.type)) {
      setDocFormError(prev => ({ ...prev, file: 'Only images and PDFs are accepted.' }))
      e.target.value = ''
      return
    }
    setDocFormError(prev => { const n = { ...prev }; delete n.file; return n })
    setDocForm(prev => ({ ...prev, file }))
  }

  /** Validates the doc form and stages the record to docList. */
  function handleAddDocToList(e) {
    e.preventDefault()
    const errors = {}
    if (!docForm.invoiceId.trim()) errors.invoiceId = 'Invoice ID is required.'
    if (Object.keys(errors).length > 0) { setDocFormError(errors); return }
    setDocFormError({})
    setDocList(prev => [...prev, { ...docForm, _key: Date.now() }])
    setDocForm({ invoiceId: '', file: null })
    if (docFileRef.current) docFileRef.current.value = ''
    setAddingDoc(false)
  }

  return (
    <div className="modal-content w-full max-w-2xl my-auto shadow-xl">
      <div className="modal-header">
        <h3 className="modal-title">New Purchase Order</h3>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}><span className="icon-[tabler--x] size-4"></span></button>
      </div>
      <div className="modal-body flex flex-col gap-4">
        <div className="flex items-center gap-x-1">
          {(type === 'equipment' ? [1,2] : [1,2,3,4]).map(n => <div key={n} className={`progress-step transition-colors ${step >= n ? 'bg-primary' : 'bg-primary/10'}`} />)}
          <p className="text-xs text-primary ms-1 font-medium">{step}/{type === 'equipment' ? 2 : 4}</p>
        </div>

        {step === 1 && (
          <div className="grid grid-cols-2 gap-4">
            <button type="button" onClick={() => { setType('sr'); setStep(2) }}>
              <div className="card bg-base-100 border-2 border-base-300 hover:border-primary h-full py-6 items-center"><span className="icon-[tabler--report] size-12 text-primary"></span><p className="font-semibold mt-2">For Service Report</p></div>
            </button>
            <button type="button" onClick={() => { setType('equipment'); setStep(2) }}>
              <div className="card bg-base-100 border-2 border-base-300 hover:border-primary h-full py-6 items-center"><span className="icon-[tabler--tool] size-12 text-primary"></span><p className="font-semibold mt-2">For Equipment</p></div>
            </button>
          </div>
        )}

        {step === 2 && type === 'sr' && (
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <input type="text" className="input input-bordered flex-1" placeholder="Search projects..." value={projInput} onChange={e => setProjInput(e.target.value)} />
              <button type="button" className="btn btn-secondary" onClick={() => { setProjPage(0); setProjSearch(projInput) }}>Search</button>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
              {projects.map(p => <div key={p.projNum} className="border p-2 rounded flex justify-between items-center"><span className="text-sm font-medium">{p.name}</span><button type="button" className="btn btn-xs btn-primary" onClick={() => { setProject(p); setStep(3) }}>Select</button></div>)}
            </div>
          </div>
        )}

        {step === 3 && type === 'sr' && (
          <div className="flex flex-col gap-3">
            <div className="text-sm bg-base-200 p-2 rounded">Project: <strong>{project?.name}</strong></div>
            <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto">
              {srs.map(s => <div key={s.srNumber} className="border p-2 rounded flex justify-between items-center"><div><p className="text-sm font-semibold">SR #{s.srNumber}</p><p className="text-xs text-base-content/50">{s.complaint}</p></div><button type="button" className="btn btn-xs btn-primary" onClick={() => { setSr(s); setStep(4) }}>Select</button></div>)}
            </div>
          </div>
        )}

        {step === 4 && type === 'sr' && (
          <div className="flex flex-col gap-5">
            <form id="inv-wizard-po-form" onSubmit={handleWizardSrSubmit}>
              <POFormFields form={srPoForm} onChange={e => setSrPoForm(p => ({ ...p, [e.target.name]: e.target.value }))} errors={srPoError} projectAddress={project?.address ?? ''} />
            </form>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Delivery Contacts</span>
                <button type="button" className="btn btn-soft btn-accent btn-sm"
                  onClick={() => pushModal(<NewPoAddContactModal onAdd={c => setSrContacts(l => [...l, c])} />)}>
                  <span className="icon-[tabler--address-book] size-4"></span>Add Contact
                </button>
              </div>
              {srContacts.length === 0 ? (
                <p className="text-sm text-base-content/40">No delivery contacts added yet.</p>
              ) : (
                <div className="overflow-x-auto rounded-box border border-base-300">
                  <table className="table table-sm">
                    <tbody>
                      {srContacts.map((c, i) => (
                        <tr key={c._tempId}>
                          <td>{i + 1}</td>
                          <td>{c.contactName}</td>
                          <td>{c.contactNumber}</td>
                          <td>
                            <button type="button" className="btn btn-error btn-xs"
                              onClick={() => setSrContacts(l => l.filter(x => x._tempId !== c._tempId))}>Remove</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Parts</span>
                <button type="button" className="btn btn-soft btn-accent btn-sm"
                  onClick={() => pushModal(<NewPoAddPartModal onAdd={p => setSrParts(l => [...l, p])} />)}>
                  <span className="icon-[tabler--package] size-4"></span>Add Part
                </button>
              </div>
              {srParts.length === 0 ? (
                <p className="text-sm text-base-content/40">No parts added yet.</p>
              ) : (
                <div className="overflow-x-auto rounded-box border border-base-300">
                  <table className="table table-sm">
                    <tbody>
                      {srParts.map((p, i) => (
                        <tr key={p._tempId}>
                          <td>{i + 1}</td>
                          <td>{p.name}</td>
                          <td>{p.quantityOrdered}</td>
                          <td>{p._supplierName}</td>
                          <td>
                            <button type="button" className="btn btn-error btn-xs"
                              onClick={() => setSrParts(l => l.filter(x => x._tempId !== p._tempId))}>Remove</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Documents <span className="text-base-content/40 font-normal text-xs">(optional)</span></span>
                <button type="button" className="btn btn-soft btn-accent btn-sm"
                  onClick={() => pushModal(<NewPoAddDocModal onAdd={d => setSrDocs(l => [...l, d])} />)}>
                  <span className="icon-[tabler--files] size-4"></span>Add Document Record
                </button>
              </div>
              {srDocs.length === 0 ? (
                <p className="text-sm text-base-content/40">No documents added yet.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {srDocs.map((doc, idx) => (
                    <div key={doc._key} className="card border border-base-300 bg-base-100">
                      <div className="card-body py-2 px-3 gap-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm font-mono">{doc.invoiceId}</p>
                            <p className="text-xs text-base-content/50">
                              {doc.file
                                ? <><span className="icon-[tabler--paperclip] size-3 inline-block mr-0.5"></span>{doc.file.name}</>
                                : 'No file attached'
                              }
                            </p>
                          </div>
                          <button type="button" className="btn btn-error btn-xs btn-square shrink-0"
                            title={`Remove document ${idx + 1}`}
                            onClick={() => setSrDocs(prev => prev.filter(d => d._key !== doc._key))}>
                            <span className="icon-[tabler--x] size-3.5"></span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {step === 2 && type === 'equipment' && (
          <div className="flex flex-col gap-5">
            <form id="inv-wizard-equip-po-form" onSubmit={e => e.preventDefault()}>
              <POFormFields form={equipPoForm} onChange={e => setEquipPoForm(p => ({ ...p, [e.target.name]: e.target.value }))} errors={equipPoError} />
            </form>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Equipment Items</span>
                <button type="button" className="btn btn-soft btn-accent btn-sm"
                  onClick={() => pushModal(<NewPoAddEquipModal onAdd={item => setEquipList(l => [...l, item])} />)}>
                  <span className="icon-[tabler--tool] size-4"></span>Add Equipment Item
                </button>
              </div>
              {equipList.length === 0 ? (
                <p className="text-sm text-base-content/40">No equipment added yet.</p>
              ) : (
                equipList.map(item => (
                  <div key={item._key} className="flex items-center justify-between bg-base-100 border border-base-300 rounded p-2 gap-2">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-sm font-medium truncate">{item.name}</span>
                      <span className="text-xs text-base-content/50">{item.type} · Stock: {item.stock}{item.model ? ` · ${item.model}` : ''}</span>
                    </div>
                    <button type="button" className="btn btn-xs btn-soft btn-error shrink-0" onClick={() => setEquipList(l => l.filter(x => x._key !== item._key))}>Remove</button>
                  </div>
                ))
              )}
              {equipFormError._general && (
                <div className="alert alert-error py-2">
                  <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                  <span className="text-sm">{equipFormError._general}</span>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Documents <span className="text-base-content/40 font-normal text-xs">(optional)</span></span>
                <button type="button" className="btn btn-soft btn-accent btn-sm"
                  onClick={() => pushModal(<NewPoAddDocModal onAdd={d => setDocList(l => [...l, d])} />)}>
                  <span className="icon-[tabler--files] size-4"></span>Add Document Record
                </button>
              </div>
              {docList.length === 0 ? (
                <p className="text-sm text-base-content/40">No documents added yet.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {docList.map((doc, idx) => (
                    <div key={doc._key} className="card border border-base-300 bg-base-100">
                      <div className="card-body py-2 px-3 gap-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm font-mono">{doc.invoiceId}</p>
                            <p className="text-xs text-base-content/50">
                              {doc.file
                                ? <><span className="icon-[tabler--paperclip] size-3 inline-block mr-0.5"></span>{doc.file.name}</>
                                : 'No file attached'
                              }
                            </p>
                          </div>
                          <button type="button" className="btn btn-error btn-xs btn-square shrink-0"
                            title={`Remove document ${idx + 1}`}
                            onClick={() => setDocList(prev => prev.filter(d => d._key !== doc._key))}>
                            <span className="icon-[tabler--x] size-3.5"></span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {submitError._general && (
              <div className="alert alert-error py-2">
                <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                <span className="text-sm">{submitError._general}</span>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="modal-footer">
        {step > 1 && <button type="button" className="btn btn-soft btn-secondary me-auto" onClick={() => { setStep(s => s - 1) }}>Back</button>}
        <button type="button" className="btn btn-ghost" onClick={popModal}>Cancel</button>
        {step === 2 && type === 'equipment' && <button type="button" className="btn btn-primary" disabled={submitting} onClick={handleWizardEquipSubmit}>Finish &amp; Save</button>}
        {step === 4 && type === 'sr' && <button type="submit" form="inv-wizard-po-form" className="btn btn-primary" disabled={submitting}>Create Purchase Order</button>}
      </div>
    </div>
  )
}

/** Main page component for viewing, searching, filtering, and managing all purchase orders. */
export default function InventoryPurchaseOrders() {
  const { apiFetch, hasRole } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const srNumFilter = searchParams.get('srNum') ? Number(searchParams.get('srNum')) : null
  const canEdit = hasRole('ADMIN', 'ACCOUNTING', 'STAFF')
  const { pushModal } = useModal()

  const [orders, setOrders]               = useState([])
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState(null)
  const [inputValue, setInputValue]       = useState('')
  const [search, setSearch]               = useState('')
  const [filterBy, setFilterBy]           = useState('')
  const [page, setPage]                   = useState(0)
  const [totalPages, setTotalPages]       = useState(0)
  const [totalElements, setTotalElements] = useState(0)
  const [refreshKey, setRefreshKey]       = useState(0)

  useEffect(() => {
    let active = true; setLoading(true); setError(null)
    const params = new URLSearchParams({ page: String(page), size: String(PAGE_SIZE), sort: 'addedOn,desc' })
    if (srNumFilter) params.set('srNum', String(srNumFilter))
    if (search)      params.set('search', search)
    if (filterBy)    params.set('filterBy', filterBy)
    apiFetch(`/api/purchase-orders?${params}`)
      .then(r => { if (!r.ok) throw new Error(`Failed to load (${r.status})`); return r.json() })
      .then(d => { if (!active) return; setOrders(d.content ?? []); setTotalPages(d.totalPages ?? 0); setTotalElements(d.totalElements ?? 0) })
      .catch(e => { if (active) setError(e.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [apiFetch, page, search, filterBy, srNumFilter, refreshKey])

  useEffect(() => {
    if (canEdit && searchParams.get('newPO') === '1') {
      navigate({ search: '' }, { replace: true })
      pushModal(<NewPoWizardModal onRefresh={() => setRefreshKey(k => k + 1)} />)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const filterLabel = filterBy === 'parts' ? 'Parts' : filterBy === 'equipment' ? 'Equipment' : 'All'

  return (
    <Layout activePage="inventory">
      {/* Header */}
      <div className="flex items-stretch justify-between h-16 mb-6">
        <div>
          {srNumFilter ? (
            <>
              <div className="flex items-center gap-2">
                <button type="button" className="btn btn-ghost btn-xs px-1" onClick={() => navigate(-1)}>
                  <span className="icon-[tabler--arrow-left] size-4"></span>
                </button>
                <h1 className="text-3xl font-semibold">Purchase Orders — SR #{srNumFilter}</h1>
              </div>
              <p className="text-base-content/60 mt-1">Showing purchase orders linked to this service report</p>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-semibold">Purchase Orders</h1>
              <p className="text-base-content/60 mt-1">View and manage all purchase orders</p>
            </>
          )}
        </div>
        {canEdit && (
          <div className="flex gap-2 items-center h-full">
            <button type="button" className="btn btn-primary h-full min-h-0"
              onClick={srNumFilter 
                ? () => pushModal(<NewPoContextModal srNum={srNumFilter} onRefresh={() => setRefreshKey(k => k + 1)} />) 
                : () => pushModal(<NewPoWizardModal onRefresh={() => setRefreshKey(k => k + 1)} />)
              }>
              <span className="icon-[tabler--plus] size-4"></span>
              New Purchase Order
            </button>
          </div>
        )}
      </div>

      {/* Search + Filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        <div className="relative flex-1 min-w-48">
          <span className="icon-[tabler--search] size-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none"></span>
          <input type="text" className="input input-bordered w-full pl-9" placeholder="Search by PO number or purpose..."
            value={inputValue} onChange={e => setInputValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { setPage(0); setSearch(inputValue) } }} />
        </div>
        <button type="button" className="btn btn-secondary shrink-0" onClick={() => { setPage(0); setSearch(inputValue) }}>
          <span className="icon-[tabler--search] size-4"></span>Search
        </button>
        {!srNumFilter && (
          <div className="dropdown relative inline-flex shrink-0">
            <button type="button" className="dropdown-toggle btn btn-secondary" aria-haspopup="menu" aria-expanded="false">
              <span className="icon-[tabler--filter] size-4"></span>{filterLabel}
              <span className="icon-[tabler--chevron-down] dropdown-open:rotate-180 size-4"></span>
            </button>
            <ul className="dropdown-menu dropdown-open:opacity-100 hidden min-w-40" role="menu">
              {[{ value: '', label: 'All' }, { value: 'parts', label: 'Parts' }, { value: 'equipment', label: 'Equipment' }].map(opt => (
                <li key={opt.value}>
                  <a className={`dropdown-item${filterBy === opt.value ? ' dropdown-active' : ''}`} href="#"
                    onClick={e => { e.preventDefault(); setPage(0); setFilterBy(opt.value) }}>{opt.label}</a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {loading && <div className="flex justify-center py-20"><span className="loading loading-spinner loading-lg text-primary"></span></div>}
      {error && <div className="alert alert-error"><span className="icon-[tabler--alert-circle] size-5"></span><span>{error}</span></div>}

      {!loading && !error && (
        <>
          <p className="text-sm text-base-content/50 mb-3">
            {totalElements} purchase order{totalElements !== 1 ? 's' : ''} total
            {search && ` · "${search}"`}{filterBy && ` · ${filterLabel}`}
          </p>

          {orders.length === 0 ? (
            <div className="text-center py-20 text-base-content/40">
              <span className="icon-[tabler--file-invoice-off] size-12 mx-auto mb-3 block"></span>
              <p>No purchase orders found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
              <table className="table table-zebra w-full">
                <thead>
                  <tr>
                    <th>PO Number</th><th>Purpose</th><th>Type</th><th>Total Cost</th><th>SR #</th><th>Added On</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(o => (
                    <tr key={o.poNum}>
                      <td className="font-mono font-semibold text-sm">{o.poNum}</td>
                      <td className="max-w-48"><span className="line-clamp-1 text-sm font-medium" title={o.purpose}>{o.purpose}</span></td>
                      <td><span className={`badge badge-soft text-xs ${o.srNum ? 'badge-primary' : 'badge-accent'}`}>{o.srNum ? 'Parts' : 'Equipment'}</span></td>
                      <td className="text-sm font-medium">{formatCurrency(o.totalCost)}</td>
                      <td className="text-sm">
                        {o.srNum ? <span className="badge badge-soft badge-neutral text-xs">SR #{o.srNum}</span> : <span className="text-base-content/40">—</span>}
                      </td>
                      <td className="text-sm">{formatDate(o.addedOn)}</td>
                      <td>
                        <button className="btn btn-soft btn-primary btn-sm" onClick={() => pushModal(<ManagePurchaseOrderModal order={o} hasRole={hasRole} onRefreshList={() => setRefreshKey(k => k + 1)} />)}>
                          <span className="icon-[tabler--settings] size-4"></span>Manage
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
    </Layout>
  )
}

/** Reusable labeled display field used inside the part detail modal. */
function PartDetailField({ label, children }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-base-content/50 uppercase tracking-wide">{label}</span>
      <span className="text-sm font-medium text-base-content">{children}</span>
    </div>
  )
}

/** Reusable form field group for equipment create/edit; conditionally renders the Status field. */
function EquipFormFields({ form, onChange, errors, showStatus }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="sm:col-span-2 flex flex-col gap-1">
        <label className="label-text font-medium">Name <span className="text-error">*</span></label>
        <input type="text" name="name" maxLength={150} required placeholder="e.g. Industrial Air Compressor" className={`input input-bordered w-full${errors.name ? ' is-invalid' : ''}`} value={form.name} onChange={onChange} />
        {errors.name && <span className="helper-text">{errors.name}</span>}
      </div>
      <div className="flex flex-col gap-1">
        <label className="label-text font-medium">Type <span className="text-error">*</span></label>
        <select name="type" className="select select-bordered w-full" value={form.type} onChange={onChange}>
          <option value="durable">Durable</option>
          <option value="consumable">Consumable</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="label-text font-medium">Stock <span className="text-error">*</span></label>
        <input type="number" name="stock" min={0} required placeholder="e.g. 2" className={`input input-bordered w-full${errors.stock ? ' is-invalid' : ''}`} value={form.stock} onChange={onChange} />
        {errors.stock && <span className="helper-text">{errors.stock}</span>}
      </div>
      <div className="flex flex-col gap-1">
        <label className="label-text font-medium">Model</label>
        <input type="text" name="model" maxLength={100} placeholder="e.g. XR-2000" className={`input input-bordered w-full${errors.model ? ' is-invalid' : ''}`} value={form.model} onChange={onChange} />
      </div>
      <div className="flex flex-col gap-1">
        <label className="label-text font-medium">Serial Number</label>
        <input type="text" name="serialNumber" maxLength={100} placeholder="e.g. SN-ABC-123456" className={`input input-bordered w-full${errors.serialNumber ? ' is-invalid' : ''}`} value={form.serialNumber} onChange={onChange} />
      </div>
      <div className="flex flex-col gap-1">
        <label className="label-text font-medium">Acquisition Cost</label>
        <input type="number" name="acquisitionCost" min={0} step="0.01" placeholder="e.g. 15000.00" className={`input input-bordered w-full${errors.acquisitionCost ? ' is-invalid' : ''}`} value={form.acquisitionCost} onChange={onChange} />
      </div>
      {showStatus && (
        <div className="flex flex-col gap-1">
          <label className="label-text font-medium">Status <span className="text-error">*</span></label>
          <select name="status" className="select select-bordered w-full" value={form.status} onChange={onChange}>
            {['active', 'under_maintenance', 'retired', 'depleted'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      )}
      <div className={`flex flex-col gap-1${showStatus ? '' : ' sm:col-span-2'}`}>
        <label className="label-text font-medium">Description</label>
        <textarea name="description" maxLength={500} rows={2} placeholder="e.g. Used for pneumatic operations on-site" className={`textarea textarea-bordered w-full${errors.description ? ' is-invalid' : ''}`} value={form.description} onChange={onChange} />
      </div>
    </div>
  )
}

/** Modal for adding a single equipment item to a new equipment PO before it is saved. */
function NewPoAddEquipModal({ onAdd }) {
  const { popModal } = useModal()
  const [form, setForm] = useState(EMPTY_WIZARD_EQUIP)
  const [formError, setFormError] = useState({})

  return (
    <div className="modal-content w-full max-w-lg my-auto">
      <div className="modal-header">
        <h3 className="modal-title">Add Equipment Item</h3>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body">
        <form id="inv-new-po-equip-modal-form" onSubmit={e => {
          e.preventDefault()
          onAdd({ ...form, _key: Date.now() })
          popModal()
        }}>
          <EquipFormFields form={form} onChange={e => setForm(p => ({ ...p, [e.target.name]: e.target.value }))} errors={formError} showStatus={false} />
        </form>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-soft btn-secondary" onClick={popModal}>Cancel</button>
        <button type="submit" form="inv-new-po-equip-modal-form" className="btn btn-primary">
          <span className="icon-[tabler--plus] size-4"></span>Add
        </button>
      </div>
    </div>
  )
}

/** Reusable form field group for purchase order create/edit; includes purpose, terms, payment, and address fields. */
function POFormFields({ form, onChange, errors, projectAddress }) {
  const { officeAddress } = useAuth()
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="flex flex-col gap-1">
        <label className="label-text font-medium">Purpose <span className="text-error">*</span></label>
        <input type="text" name="purpose" maxLength={30} required className={`input input-bordered w-full${errors.purpose ? ' is-invalid' : ''}`} placeholder="e.g. Equipment procurement" value={form.purpose} onChange={onChange} />
        {errors.purpose ? <span className="helper-text">{errors.purpose}</span> : <span className="text-xs text-base-content/40">{form.purpose.length}/30</span>}
      </div>
      <div className="flex flex-col gap-1">
        <label className="label-text font-medium">Terms <span className="text-error">*</span></label>
        <input type="text" name="terms" maxLength={16} required className={`input input-bordered w-full${errors.terms ? ' is-invalid' : ''}`} placeholder="e.g. Net 30" value={form.terms} onChange={onChange} />
        {errors.terms ? <span className="helper-text">{errors.terms}</span> : <span className="text-xs text-base-content/40">{form.terms.length}/16</span>}
      </div>
      <div className={`flex flex-col gap-1${form.paymentMethod === 'ewallet' ? ' sm:col-span-2' : ''}`}>
        <label className="label-text font-medium">Payment Method</label>
        <div className="flex gap-2">
          <select name="paymentMethod"
            className={`select select-bordered${form.paymentMethod === 'ewallet' ? '' : ' w-full'}${errors?.paymentMethod ? ' is-invalid' : ''}`}
            value={form.paymentMethod} onChange={onChange}>
            <option value="">— None —</option>
            <option value="cash">Cash</option>
            <option value="check">Check</option>
            <option value="ewallet">E-Wallet</option>
            <option value="bank">Bank Transfer</option>
          </select>
          {form.paymentMethod === 'ewallet' && (
            <select name="ewalletType" required
              className={`select select-bordered flex-1${errors?.ewalletType ? ' is-invalid' : ''}`}
              value={form.ewalletType} onChange={onChange}>
              <option value="">— Select —</option>
              <option value="GCash">GCash</option>
              <option value="Maya">Maya</option>
              <option value="ShopeePay">ShopeePay</option>
              <option value="GrabPay">GrabPay</option>
            </select>
          )}
        </div>
        {errors?.paymentMethod && <span className="helper-text">{errors.paymentMethod}</span>}
        {form.paymentMethod === 'ewallet' && errors?.ewalletType && <span className="helper-text">{errors.ewalletType}</span>}
      </div>
      <div className="flex flex-col gap-1">
        <label className="label-text font-medium">Payment Details</label>
        <input type="text" name="paymentDetails" maxLength={60} className="input input-bordered w-full" placeholder="e.g. Account #1234-5678" value={form.paymentDetails} onChange={onChange} />
      </div>
      <div className="sm:col-span-2 flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <label className="label-text font-medium">Delivery Address</label>
          <div className="flex gap-1.5">
            {projectAddress && (
              <button type="button" className="btn btn-xs btn-soft btn-secondary"
                onClick={() => onChange({ target: { name: 'deliveryAddress', value: projectAddress } })}>
                <span className="icon-[tabler--building] size-3"></span>Same as project
              </button>
            )}
            {officeAddress && (
              <button type="button" className="btn btn-xs btn-soft btn-secondary"
                onClick={() => onChange({ target: { name: 'deliveryAddress', value: officeAddress } })}>
                <span className="icon-[tabler--building-factory-2] size-3"></span>Office address
              </button>
            )}
          </div>
        </div>
        <textarea name="deliveryAddress" maxLength={600} rows={2} className="textarea textarea-bordered w-full" placeholder="Full delivery address" value={form.deliveryAddress} onChange={onChange} />
      </div>
      <div className="sm:col-span-2 flex flex-col gap-1">
        <label className="label-text font-medium">Remarks</label>
        <textarea name="remarks" maxLength={255} rows={2} className="textarea textarea-bordered w-full" placeholder="Additional notes or instructions" value={form.remarks} onChange={onChange} />
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