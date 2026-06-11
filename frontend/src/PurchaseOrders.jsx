import { useState, useEffect } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from './auth'
import { useModal } from './modals/index.js'
import Layout from './Layout'
import ModalNav from './modals/ModalNav.jsx'
import { notyfSuccess, notyfError } from './notyf'
import SupplierPickerModal from './SupplierPickerModal'
import ServiceReportPickerModal from './ServiceReportPickerModal'

/** Parses a stored PO paymentMethod into { method, ewalletType } for form state */
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
  if (status === 'used')      return 'badge-warning'
  return 'badge-neutral'
}

/** Formats a datetime string to YYYY-MM-DD */
function formatDate(dt) {
  if (!dt) return '—'
  return String(dt).slice(0, 10)
}

const PAGE_SIZE = 12
const PARTS_PAGE_SIZE = 7


/** Formats a number as currency (PHP) */
function formatCurrency(value) {
  if (value == null) return '—'
  return Number(value).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })
}

/** Parts table with optional per-row action button */
function PartsTable({ parts, loading, onSelectPart }) {
  const [partsPage, setPartsPage] = useState(0)

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <span className="loading loading-spinner loading-sm text-primary"></span>
      </div>
    )
  }
  if (parts.length === 0) {
    return (
      <div className="text-center py-6 text-base-content/40 text-sm">
        No parts linked to this purchase order.
      </div>
    )
  }

  const totalPages = Math.ceil(parts.length / PARTS_PAGE_SIZE)
  const pageParts = parts.slice(partsPage * PARTS_PAGE_SIZE, (partsPage + 1) * PARTS_PAGE_SIZE)
  const totalCost = parts.reduce((sum, p) => sum + (Number(p.quantityOrdered) * Number(p.unitPrice ?? 0)), 0)

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-box border border-base-300">
        <table className="table table-zebra table-sm w-full">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Quantity</th>
              <th>Unit Price</th>
              <th>Status</th>
              {onSelectPart && <th>Action</th>}
            </tr>
          </thead>
          <tbody>
            {pageParts.map(p => (
              <tr key={p.partId}>
                <td className="font-mono text-xs">{p.partId}</td>
                <td className="text-sm max-w-40">
                  <span className="line-clamp-1" title={p.name}>{p.name}</span>
                </td>
                <td className="text-sm">{p.quantityOrdered} {p.quantityType}</td>
                <td className="text-sm">{formatCurrency(p.unitPrice)}</td>
                <td>
                  <span className={`badge badge-soft ${partStatusBadge(p.status)} text-xs`}>
                    {p.status}
                  </span>
                </td>
                {onSelectPart && (
                  <td>
                    <button className="btn btn-soft btn-primary btn-xs" onClick={() => onSelectPart(p)}>
                      <span className="icon-[tabler--settings] size-3"></span>
                      Manage
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-base-content/50">
            Page {partsPage + 1} of {totalPages} · {parts.length} part{parts.length !== 1 ? 's' : ''}
          </span>
          <div className="flex gap-1">
            <button className="btn btn-xs btn-secondary" disabled={partsPage === 0} onClick={() => setPartsPage(p => p - 1)}>
              <span className="icon-[tabler--chevron-left] size-3"></span>
            </button>
            <button className="btn btn-xs btn-secondary" disabled={partsPage >= totalPages - 1} onClick={() => setPartsPage(p => p + 1)}>
              <span className="icon-[tabler--chevron-right] size-3"></span>
            </button>
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

/** Delivery contacts table with optional per-row action button */
function DeliveryContactsTable({ contacts, loading, onSelectContact }) {
  const [contactsPage, setContactsPage] = useState(0)

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <span className="loading loading-spinner loading-sm text-primary"></span>
      </div>
    )
  }
  if (contacts.length === 0) {
    return (
      <div className="text-center py-6 text-base-content/40 text-sm">
        No delivery contacts linked to this purchase order.
      </div>
    )
  }

  const totalPages = Math.ceil(contacts.length / PARTS_PAGE_SIZE)
  const pageContacts = contacts.slice(contactsPage * PARTS_PAGE_SIZE, (contactsPage + 1) * PARTS_PAGE_SIZE)

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-box border border-base-300">
        <table className="table table-zebra table-sm w-full">
          <thead>
            <tr>
              <th>ID</th>
              <th>Contact Name</th>
              <th>Contact Number</th>
              {onSelectContact && <th>Action</th>}
            </tr>
          </thead>
          <tbody>
            {pageContacts.map(c => (
              <tr key={c.poContactNum}>
                <td className="font-mono text-xs">{c.poContactNum}</td>
                <td className="text-sm">{c.contactName}</td>
                <td className="text-sm">{c.contactNumber}</td>
                {onSelectContact && (
                  <td>
                    <button className="btn btn-soft btn-primary btn-xs" onClick={() => onSelectContact(c)}>
                      <span className="icon-[tabler--info-circle] size-3"></span>
                      Details
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-base-content/50">
            Page {contactsPage + 1} of {totalPages} · {contacts.length} contact{contacts.length !== 1 ? 's' : ''}
          </span>
          <div className="flex gap-1">
            <button className="btn btn-xs btn-secondary" disabled={contactsPage === 0} onClick={() => setContactsPage(p => p - 1)}>
              <span className="icon-[tabler--chevron-left] size-3"></span>
            </button>
            <button className="btn btn-xs btn-secondary" disabled={contactsPage >= totalPages - 1} onClick={() => setContactsPage(p => p + 1)}>
              <span className="icon-[tabler--chevron-right] size-3"></span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Modal showing all details of a single delivery contact */
function ContactDetailsModal({ contact }) {
  const { popModal } = useModal()
  return (
    <div className="modal-content w-full max-w-sm my-auto">
      <div className="modal-header">
        <div>
          <h3 className="modal-title">Contact #{contact.poContactNum}</h3>
          <span className="text-sm text-base-content/50">{contact.contactName}</span>
        </div>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" aria-label="Close" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-base-content/50 uppercase tracking-wide">Contact ID</span>
            <span className="text-sm font-medium font-mono">{contact.poContactNum}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-base-content/50 uppercase tracking-wide">PO Number</span>
            <span className="text-sm font-medium font-mono">{contact.poNum}</span>
          </div>
          <div className="col-span-2 flex flex-col gap-0.5">
            <span className="text-xs text-base-content/50 uppercase tracking-wide">Contact Name</span>
            <span className="text-sm font-medium">{contact.contactName}</span>
          </div>
          <div className="col-span-2 flex flex-col gap-0.5">
            <span className="text-xs text-base-content/50 uppercase tracking-wide">Contact Number</span>
            <span className="text-sm font-medium">{contact.contactNumber}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Detail field helper for part detail displays */
function PartDetailField({ label, children }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-base-content/50 uppercase tracking-wide">{label}</span>
      <span className="text-sm font-medium text-base-content">{children}</span>
    </div>
  )
}

/** Level 2 modal — form for adding a delivery contact to the local list (New PO wizard) */
function AddContactModal({ onAdd }) {
  const { popModal } = useModal()
  const [form, setForm] = useState({ contactName: '', contactNumber: '' })
  const [formError, setFormError] = useState({})

  function handleSubmit(e) {
    e.preventDefault()
    const errors = {}
    if (!form.contactName.trim()) errors.contactName = 'Contact name is required.'
    if (!form.contactNumber.trim()) errors.contactNumber = 'Contact number is required.'
    if (Object.keys(errors).length > 0) { setFormError(errors); return }
    onAdd({ ...form })
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
        <form id="new-po-add-contact-form" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Contact Name <span className="text-error">*</span></label>
              <input type="text" maxLength={300} required
                className={`input input-bordered w-full${formError.contactName ? ' is-invalid' : ''}`}
                placeholder="e.g. Juan Dela Cruz"
                value={form.contactName}
                onChange={e => setForm(p => ({ ...p, contactName: e.target.value }))} />
              {formError.contactName && <span className="helper-text">{formError.contactName}</span>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Contact Number <span className="text-error">*</span></label>
              <input type="text" maxLength={16} required
                className={`input input-bordered w-full${formError.contactNumber ? ' is-invalid' : ''}`}
                placeholder="e.g. 09171234567"
                value={form.contactNumber}
                onChange={e => setForm(p => ({ ...p, contactNumber: e.target.value }))} />
              {formError.contactNumber && <span className="helper-text">{formError.contactNumber}</span>}
            </div>
          </div>
        </form>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-soft btn-secondary" onClick={popModal}>Cancel</button>
        <button type="submit" form="new-po-add-contact-form" className="btn btn-primary">
          <span className="icon-[tabler--plus] size-4"></span>
          Add Contact
        </button>
      </div>
    </div>
  )
}

/** Supplier picker pushed as a modal layer */
function SupplierPickerLayer({ onSelect }) {
  const { popModal } = useModal()

  function handleSelect(s) {
    onSelect(s)
    popModal()
  }

  return (
    <SupplierPickerModal
      asLayer
      isOpen={true}
      onClose={popModal}
      onSelect={handleSelect}
    />
  )
}

/** Level 2 modal — form for adding a part to the local list (New PO wizard) */
function AddPartModal({ onAdd }) {
  const { popModal, pushModal } = useModal()
  const [form, setForm] = useState({
    name: '', quantityOrdered: '', quantityType: '', unitPrice: '', supplierId: '', status: 'ordered',
  })
  const [formError, setFormError] = useState({})
  const [supplierDisplay, setSupplierDisplay] = useState('')

  function handleSupplierSelect(s) {
    setForm(p => ({ ...p, supplierId: s.supplierId }))
    setSupplierDisplay(`${s.name} (#${s.supplierId})`)
  }

  function handleSubmit(e) {
    e.preventDefault()
    const errors = {}
    if (!form.name.trim()) errors.name = 'Name is required.'
    if (!form.quantityOrdered || Number(form.quantityOrdered) < 0) errors.quantityOrdered = 'Quantity is required.'
    if (!form.quantityType.trim()) errors.quantityType = 'Quantity type is required.'
    if (!form.unitPrice || Number(form.unitPrice) < 0) errors.unitPrice = 'Unit price is required.'
    if (!form.supplierId) errors.supplierId = 'Supplier is required.'
    if (Object.keys(errors).length > 0) { setFormError(errors); return }
    onAdd({
      ...form,
      quantityOrdered: Number(form.quantityOrdered),
      unitPrice: Number(form.unitPrice),
      supplierId: Number(form.supplierId),
      supplierDisplay,
    })
    popModal()
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
        <form id="new-po-add-part-form" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="label-text font-medium">Name <span className="text-error">*</span></label>
              <input type="text" maxLength={255} required
                className={`input input-bordered w-full${formError.name ? ' is-invalid' : ''}`}
                placeholder="e.g. Compressor Unit"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
              {formError.name && <span className="helper-text">{formError.name}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Quantity <span className="text-error">*</span></label>
              <input type="number" min={0} required
                className={`input input-bordered w-full${formError.quantityOrdered ? ' is-invalid' : ''}`}
                placeholder="e.g. 2"
                value={form.quantityOrdered}
                onChange={e => setForm(p => ({ ...p, quantityOrdered: e.target.value }))} />
              {formError.quantityOrdered && <span className="helper-text">{formError.quantityOrdered}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Quantity Type <span className="text-error">*</span></label>
              <input type="text" maxLength={30} required
                className={`input input-bordered w-full${formError.quantityType ? ' is-invalid' : ''}`}
                placeholder="e.g. pcs"
                value={form.quantityType}
                onChange={e => setForm(p => ({ ...p, quantityType: e.target.value }))} />
              {formError.quantityType && <span className="helper-text">{formError.quantityType}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Unit Price <span className="text-error">*</span></label>
              <input type="number" min={0} step="0.01" required
                className={`input input-bordered w-full${formError.unitPrice ? ' is-invalid' : ''}`}
                placeholder="e.g. 1500.00"
                value={form.unitPrice}
                onChange={e => setForm(p => ({ ...p, unitPrice: e.target.value }))} />
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
                  onClick={() => pushModal(<SupplierPickerLayer onSelect={handleSupplierSelect} />)}>
                  Pick
                </button>
              </div>
              {formError.supplierId && <span className="helper-text">{formError.supplierId}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Status</label>
              <select className="select select-bordered w-full"
                value={form.status}
                onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                <option value="ordered">ordered</option>
                <option value="received">received</option>
                <option value="cancelled">cancelled</option>
              </select>
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
        <button type="submit" form="new-po-add-part-form" className="btn btn-primary">
          <span className="icon-[tabler--plus] size-4"></span>
          Add Part
        </button>
      </div>
    </div>
  )
}

const NEW_PO_STEPS = [
  { number: 1, label: 'PO Info' },
  { number: 2, label: 'Payment' },
  { number: 3, label: 'Delivery' },
  { number: 4, label: 'Parts & Contacts' },
]

/** Level 1 modal — 4-step wizard for creating a new Purchase Order with parts and delivery contacts */
function NewPOModal({ srNum, onSuccess }) {
  const { popModal, pushModal } = useModal()
  const { apiFetch, officeAddress } = useAuth()
  const [step, setStep] = useState(1)
  const [projectAddress, setProjectAddress] = useState('')

  useEffect(() => {
    apiFetch(`/api/service-reports/${srNum}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(sr => apiFetch(`/api/projects/${sr.projNum}`))
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(proj => setProjectAddress(proj.address ?? ''))
      .catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState({})

  const [poInfo, setPoInfo] = useState({ purpose: '', terms: '' })
  const [poInfoError, setPoInfoError] = useState({})
  const [payment, setPayment] = useState({ paymentMethod: '', ewalletType: '', paymentDetails: '' })
  const [delivery, setDelivery] = useState({ deliveryAddress: '', remarks: '' })
  const [partsList, setPartsList] = useState([])
  const [contactsList, setContactsList] = useState([])

  function handleNext1() {
    const errors = {}
    if (!poInfo.purpose.trim()) errors.purpose = 'Purpose is required.'
    if (!poInfo.terms.trim()) errors.terms = 'Terms is required.'
    if (Object.keys(errors).length > 0) { setPoInfoError(errors); return }
    setPoInfoError({})
    setStep(2)
  }

  function handleAddPart(partData) {
    setPartsList(prev => [...prev, { ...partData, _key: Date.now() }])
  }

  function handleAddContact(contactData) {
    setContactsList(prev => [...prev, { ...contactData, _key: Date.now() }])
  }

  async function handleSubmit() {
    setSubmitError({})
    setSubmitting(true)
    try {
      const poRes = await apiFetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purpose: poInfo.purpose,
          terms: poInfo.terms,
          paymentMethod: payment.paymentMethod === 'ewallet' ? `ewallet:${payment.ewalletType}` : payment.paymentMethod || null,
          paymentDetails: payment.paymentDetails || null,
          deliveryAddress: delivery.deliveryAddress || null,
          remarks: delivery.remarks || null,
          srNum,
        }),
      })
      if (!poRes.ok) {
        setSubmitError(await parseApiError(poRes))
        notyfError('Failed to create purchase order.')
        return
      }
      const createdPo = await poRes.json()
      const poNum = createdPo.poNum

      const partFailures = []
      for (const part of partsList) {
        const { _key, supplierDisplay, ...partPayload } = part
        const res = await apiFetch('/api/parts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...partPayload, poNum }),
        })
        if (!res.ok) {
          const err = await parseApiError(res)
          partFailures.push(`"${part.name}": ${err._general ?? JSON.stringify(err)}`)
        }
      }

      const contactFailures = []
      for (const contact of contactsList) {
        const { _key, ...contactPayload } = contact
        const res = await apiFetch('/api/purchase-order-delivery-contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...contactPayload, poNum }),
        })
        if (!res.ok) {
          const err = await parseApiError(res)
          contactFailures.push(`"${contact.contactName}": ${err._general ?? JSON.stringify(err)}`)
        }
      }

      notyfSuccess(`Purchase Order ${poNum} created.`)
      partFailures.forEach(msg => notyfError(msg))
      contactFailures.forEach(msg => notyfError(msg))
      onSuccess?.()
      popModal()
    } catch (err) {
      setSubmitError({ _general: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-content w-full max-w-2xl my-auto">
      <div className="modal-header">
        <h3 className="modal-title">New Purchase Order</h3>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body flex flex-col gap-4">

        {/* Step progress */}
        <div className="flex items-center gap-x-1">
          {NEW_PO_STEPS.map(s => (
            <div
              key={s.number}
              className={`progress-step transition-colors ${step >= s.number ? 'bg-primary' : 'bg-primary/10'}`}
              role="progressbar"
              aria-label={s.label}
              aria-valuenow={step >= s.number ? 100 : 0}
              aria-valuemin="0"
              aria-valuemax="100"
            />
          ))}
          <p className="text-xs text-primary ms-1 font-medium">{step}/{NEW_PO_STEPS.length}</p>
        </div>

        {/* Step 1 — PO Info */}
        {step === 1 && (
          <div className="flex flex-col gap-4">
            <p className="text-xs font-semibold text-base-content/40 uppercase tracking-wide">Step 1 — PO Information</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="label-text font-medium">Purpose <span className="text-error">*</span></label>
                <input type="text" maxLength={30} required
                  className={`input input-bordered w-full${poInfoError.purpose ? ' is-invalid' : ''}`}
                  placeholder="e.g. Repair Parts"
                  value={poInfo.purpose}
                  onChange={e => setPoInfo(p => ({ ...p, purpose: e.target.value }))} />
                {poInfoError.purpose
                  ? <span className="helper-text">{poInfoError.purpose}</span>
                  : <span className="text-xs text-base-content/40">{poInfo.purpose.length}/30</span>}
              </div>
              <div className="flex flex-col gap-1">
                <label className="label-text font-medium">Terms <span className="text-error">*</span></label>
                <input type="text" maxLength={16} required
                  className={`input input-bordered w-full${poInfoError.terms ? ' is-invalid' : ''}`}
                  placeholder="e.g. Net 30"
                  value={poInfo.terms}
                  onChange={e => setPoInfo(p => ({ ...p, terms: e.target.value }))} />
                {poInfoError.terms
                  ? <span className="helper-text">{poInfoError.terms}</span>
                  : <span className="text-xs text-base-content/40">{poInfo.terms.length}/16</span>}
              </div>
            </div>
          </div>
        )}

        {/* Step 2 — Payment */}
        {step === 2 && (
          <div className="flex flex-col gap-4">
            <p className="text-xs font-semibold text-base-content/40 uppercase tracking-wide">Step 2 — Payment</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className={`flex flex-col gap-1${payment.paymentMethod === 'ewallet' ? ' sm:col-span-2' : ''}`}>
                <label className="label-text font-medium">Payment Method</label>
                <div className="flex gap-2">
                  <select
                    className={`select select-bordered${payment.paymentMethod === 'ewallet' ? '' : ' w-full'}`}
                    value={payment.paymentMethod}
                    onChange={e => setPayment(p => ({ ...p, paymentMethod: e.target.value }))}>
                    <option value="">— None —</option>
                    <option value="cash">Cash</option>
                    <option value="check">Check</option>
                    <option value="ewallet">E-Wallet</option>
                    <option value="bank">Bank Transfer</option>
                  </select>
                  {payment.paymentMethod === 'ewallet' && (
                    <select name="ewalletType" required
                      className="select select-bordered flex-1"
                      value={payment.ewalletType}
                      onChange={e => setPayment(p => ({ ...p, ewalletType: e.target.value }))}>
                      <option value="">— Select —</option>
                      <option value="GCash">GCash</option>
                      <option value="Maya">Maya</option>
                      <option value="ShopeePay">ShopeePay</option>
                      <option value="GrabPay">GrabPay</option>
                    </select>
                  )}
                </div>
              </div>
              <div className="sm:col-span-2 flex flex-col gap-1">
                <label className="label-text font-medium">Payment Details</label>
                <input type="text" maxLength={60}
                  className="input input-bordered w-full"
                  placeholder="e.g. BDO #1234-5678"
                  value={payment.paymentDetails}
                  onChange={e => setPayment(p => ({ ...p, paymentDetails: e.target.value }))} />
              </div>
            </div>
          </div>
        )}

        {/* Step 3 — Delivery & Remarks */}
        {step === 3 && (
          <div className="flex flex-col gap-4">
            <p className="text-xs font-semibold text-base-content/40 uppercase tracking-wide">Step 3 — Delivery &amp; Remarks</p>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <label className="label-text font-medium">Delivery Address</label>
                  <div className="flex gap-1.5">
                    {projectAddress && (
                      <button type="button" className="btn btn-xs btn-soft btn-secondary"
                        onClick={() => setDelivery(p => ({ ...p, deliveryAddress: projectAddress }))}>
                        <span className="icon-[tabler--building] size-3"></span>Same as project
                      </button>
                    )}
                    {officeAddress && (
                      <button type="button" className="btn btn-xs btn-soft btn-secondary"
                        onClick={() => setDelivery(p => ({ ...p, deliveryAddress: officeAddress }))}>
                        <span className="icon-[tabler--building-factory-2] size-3"></span>Office address
                      </button>
                    )}
                  </div>
                </div>
                <textarea maxLength={600} rows={3}
                  className="textarea textarea-bordered w-full"
                  placeholder="Full delivery address"
                  value={delivery.deliveryAddress}
                  onChange={e => setDelivery(p => ({ ...p, deliveryAddress: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="label-text font-medium">Remarks</label>
                <textarea maxLength={255} rows={2}
                  className="textarea textarea-bordered w-full"
                  placeholder="Optional notes or instructions"
                  value={delivery.remarks}
                  onChange={e => setDelivery(p => ({ ...p, remarks: e.target.value }))} />
              </div>
            </div>
          </div>
        )}

        {/* Step 4 — Parts & Delivery Contacts */}
        {step === 4 && (
          <div className="flex flex-col gap-6">
            <p className="text-xs font-semibold text-base-content/40 uppercase tracking-wide">
              Step 4 — Parts &amp; Delivery Contacts <span className="text-base-content/30 font-normal normal-case">(optional)</span>
            </p>

            {/* Parts */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  Parts
                  <span className="badge badge-soft badge-neutral text-xs ms-1">{partsList.length}</span>
                </span>
                <button type="button" className="btn btn-primary btn-sm"
                  onClick={() => pushModal(<AddPartModal onAdd={handleAddPart} />)}>
                  <span className="icon-[tabler--plus] size-4"></span>
                  Add Part
                </button>
              </div>
              {partsList.length === 0 ? (
                <p className="text-sm text-base-content/40">No parts added yet.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {partsList.map(part => (
                    <div key={part._key} className="card border border-base-300 bg-base-100">
                      <div className="card-body py-2 px-3 gap-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{part.name}</p>
                            <p className="text-xs text-base-content/50">
                              {part.quantityOrdered} {part.quantityType} · {formatCurrency(part.unitPrice)} · {part.supplierDisplay}
                            </p>
                          </div>
                          <button type="button" className="btn btn-error btn-xs btn-square shrink-0"
                            onClick={() => setPartsList(prev => prev.filter(p => p._key !== part._key))}>
                            <span className="icon-[tabler--x] size-3.5"></span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Delivery Contacts */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  Delivery Contacts
                  <span className="badge badge-soft badge-neutral text-xs ms-1">{contactsList.length}</span>
                </span>
                <button type="button" className="btn btn-primary btn-sm"
                  onClick={() => pushModal(<AddContactModal onAdd={handleAddContact} />)}>
                  <span className="icon-[tabler--plus] size-4"></span>
                  Add Contact
                </button>
              </div>
              {contactsList.length === 0 ? (
                <p className="text-sm text-base-content/40">No contacts added yet.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {contactsList.map(contact => (
                    <div key={contact._key} className="card border border-base-300 bg-base-100">
                      <div className="card-body py-2 px-3 gap-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-sm">{contact.contactName}</p>
                            <p className="text-xs text-base-content/50">{contact.contactNumber}</p>
                          </div>
                          <button type="button" className="btn btn-error btn-xs btn-square shrink-0"
                            onClick={() => setContactsList(prev => prev.filter(c => c._key !== contact._key))}>
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

      <div className="modal-footer flex justify-between">
        {step > 1 ? (
          <button type="button" className="btn btn-soft btn-secondary" onClick={() => setStep(s => s - 1)}>
            <span className="icon-[tabler--arrow-left] size-4"></span> Back
          </button>
        ) : (
          <button type="button" className="btn btn-soft btn-secondary" onClick={popModal}>Cancel</button>
        )}
        {step < 4 && (
          <button type="button" className="btn btn-primary"
            onClick={step === 1 ? handleNext1 : () => setStep(s => s + 1)}>
            Next <span className="icon-[tabler--arrow-right] size-4"></span>
          </button>
        )}
        {step === 4 && (
          <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting
              ? <span className="loading loading-spinner loading-sm"></span>
              : <span className="icon-[tabler--plus] size-4"></span>
            }
            Create Purchase Order
          </button>
        )}
      </div>
    </div>
  )
}

/** Modal — form for updating an existing purchase order */
function UpdatePOModal({ po, onSuccess }) {
  const { popModal } = useModal()
  const { apiFetch, officeAddress } = useAuth()
  const [projectAddress, setProjectAddress] = useState('')

  useEffect(() => {
    if (!po.srNum) return
    apiFetch(`/api/service-reports/${po.srNum}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(sr => apiFetch(`/api/projects/${sr.projNum}`))
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(proj => setProjectAddress(proj.address ?? ''))
      .catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [form, setForm] = useState(() => {
    const { method, ewalletType } = parsePoPaymentMethod(po.paymentMethod)
    return {
      purpose:         po.purpose ?? '',
      terms:           po.terms ?? '',
      paymentMethod:   method,
      ewalletType,
      paymentDetails:  po.paymentDetails ?? '',
      deliveryAddress: po.deliveryAddress ?? '',
      remarks:         po.remarks ?? '',
    }
  })
  const [formError, setFormError] = useState({})
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError({})
    setSubmitting(true)
    try {
      const res = await apiFetch(`/api/purchase-orders/${po.poNum}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, ewalletType: undefined, paymentMethod: form.paymentMethod === 'ewallet' ? `ewallet:${form.ewalletType}` : form.paymentMethod || null, poNum: po.poNum, srNum: po.srNum }),
      })
      if (!res.ok) {
        setFormError(await parseApiError(res))
        notyfError('Update failed')
        return
      }
      notyfSuccess(`Purchase Order "${po.poNum}" updated successfully.`)
      popModal()
      onSuccess?.()
    } catch (err) {
      setFormError({ _general: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  return (
    <div className="modal-content w-full max-w-2xl my-auto">
      <div className="modal-header">
        <h3 className="modal-title">Update {po.poNum}</h3>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body">
        <form id="update-po-form" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Purpose <span className="text-error">*</span></label>
              <input type="text" name="purpose" maxLength={30} required
                className={`input input-bordered w-full${formError.purpose ? ' is-invalid' : ''}`}
                placeholder="e.g. Repair Parts"
                value={form.purpose} onChange={handleChange} />
              {formError.purpose && <span className="helper-text">{formError.purpose}</span>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Terms <span className="text-error">*</span></label>
              <input type="text" name="terms" maxLength={16} required
                className={`input input-bordered w-full${formError.terms ? ' is-invalid' : ''}`}
                placeholder="e.g. net30"
                value={form.terms} onChange={handleChange} />
              {formError.terms && <span className="helper-text">{formError.terms}</span>}
            </div>
            <div className={`flex flex-col gap-1${form.paymentMethod === 'ewallet' ? ' sm:col-span-2' : ''}`}>
              <label className="label-text font-medium">Payment Method</label>
              <div className="flex gap-2">
                <select name="paymentMethod"
                  className={`select select-bordered${form.paymentMethod === 'ewallet' ? '' : ' w-full'}${formError.paymentMethod ? ' is-invalid' : ''}`}
                  value={form.paymentMethod} onChange={handleChange}>
                  <option value="">— None —</option>
                  <option value="cash">Cash</option>
                  <option value="check">Check</option>
                  <option value="ewallet">E-Wallet</option>
                  <option value="bank">Bank Transfer</option>
                </select>
                {form.paymentMethod === 'ewallet' && (
                  <select name="ewalletType" required
                    className={`select select-bordered flex-1${formError.ewalletType ? ' is-invalid' : ''}`}
                    value={form.ewalletType} onChange={handleChange}>
                    <option value="">— Select —</option>
                    <option value="GCash">GCash</option>
                    <option value="Maya">Maya</option>
                    <option value="ShopeePay">ShopeePay</option>
                    <option value="GrabPay">GrabPay</option>
                  </select>
                )}
              </div>
              {formError.paymentMethod && <span className="helper-text">{formError.paymentMethod}</span>}
              {form.paymentMethod === 'ewallet' && formError.ewalletType && <span className="helper-text">{formError.ewalletType}</span>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Payment Details</label>
              <input type="text" name="paymentDetails" maxLength={60}
                className={`input input-bordered w-full${formError.paymentDetails ? ' is-invalid' : ''}`}
                placeholder="e.g. BDO #1234567890"
                value={form.paymentDetails} onChange={handleChange} />
              {formError.paymentDetails && <span className="helper-text">{formError.paymentDetails}</span>}
            </div>
            <div className="sm:col-span-2 flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <label className="label-text font-medium">Delivery Address</label>
                <div className="flex gap-1.5">
                  {projectAddress && (
                    <button type="button" className="btn btn-xs btn-soft btn-secondary"
                      onClick={() => setForm(p => ({ ...p, deliveryAddress: projectAddress }))}>
                      <span className="icon-[tabler--building] size-3"></span>Same as project
                    </button>
                  )}
                  {officeAddress && (
                    <button type="button" className="btn btn-xs btn-soft btn-secondary"
                      onClick={() => setForm(p => ({ ...p, deliveryAddress: officeAddress }))}>
                      <span className="icon-[tabler--building-factory-2] size-3"></span>Office address
                    </button>
                  )}
                </div>
              </div>
              <textarea name="deliveryAddress" maxLength={600} rows={2}
                className={`textarea textarea-bordered w-full${formError.deliveryAddress ? ' is-invalid' : ''}`}
                placeholder="Full delivery address"
                value={form.deliveryAddress} onChange={handleChange} />
              {formError.deliveryAddress && <span className="helper-text">{formError.deliveryAddress}</span>}
            </div>
            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="label-text font-medium">Remarks</label>
              <textarea name="remarks" maxLength={255} rows={2}
                className={`textarea textarea-bordered w-full${formError.remarks ? ' is-invalid' : ''}`}
                placeholder="Optional notes"
                value={form.remarks} onChange={handleChange} />
              {formError.remarks && <span className="helper-text">{formError.remarks}</span>}
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
        <button type="submit" form="update-po-form" className="btn btn-primary" disabled={submitting}>
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

/** Modal — form for adding a part to an existing purchase order */
function AddPartToExistingPOModal({ poNum, onSuccess }) {
  const { popModal, pushModal } = useModal()
  const { apiFetch } = useAuth()
  const [form, setForm] = useState({
    name: '', quantityOrdered: '', quantityType: '', unitPrice: '', supplierId: '', status: 'ordered',
  })
  const [formError, setFormError] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [supplierDisplay, setSupplierDisplay] = useState('')

  function handleSupplierSelect(s) {
    setForm(p => ({ ...p, supplierId: s.supplierId }))
    setSupplierDisplay(`${s.name} (#${s.supplierId})`)
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
          unitPrice: Number(form.unitPrice),
          supplierId: Number(form.supplierId),
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

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  return (
    <div className="modal-content w-full max-w-lg my-auto">
      <div className="modal-header">
        <h3 className="modal-title">Add Part to {poNum}</h3>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body">
        <form id="add-part-existing-form" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="label-text font-medium">Name <span className="text-error">*</span></label>
              <input type="text" name="name" maxLength={255} required
                className={`input input-bordered w-full${formError.name ? ' is-invalid' : ''}`}
                placeholder="e.g. Compressor Unit"
                value={form.name} onChange={handleChange} />
              {formError.name && <span className="helper-text">{formError.name}</span>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Quantity <span className="text-error">*</span></label>
              <input type="number" name="quantityOrdered" min={0} required
                className={`input input-bordered w-full${formError.quantityOrdered ? ' is-invalid' : ''}`}
                placeholder="e.g. 2"
                value={form.quantityOrdered} onChange={handleChange} />
              {formError.quantityOrdered && <span className="helper-text">{formError.quantityOrdered}</span>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Quantity Type <span className="text-error">*</span></label>
              <input type="text" name="quantityType" maxLength={30} required
                className={`input input-bordered w-full${formError.quantityType ? ' is-invalid' : ''}`}
                placeholder="e.g. pcs"
                value={form.quantityType} onChange={handleChange} />
              {formError.quantityType && <span className="helper-text">{formError.quantityType}</span>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Unit Price <span className="text-error">*</span></label>
              <input type="number" name="unitPrice" min={0} step="0.01" required
                className={`input input-bordered w-full${formError.unitPrice ? ' is-invalid' : ''}`}
                placeholder="e.g. 1500.00"
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
                  onClick={() => pushModal(<SupplierPickerLayer onSelect={handleSupplierSelect} />)}>
                  Pick
                </button>
              </div>
              {formError.supplierId && <span className="helper-text">{formError.supplierId}</span>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Status</label>
              <select name="status" className="select select-bordered w-full"
                value={form.status} onChange={handleChange}>
                <option value="ordered">ordered</option>
                <option value="received">received</option>
                <option value="cancelled">cancelled</option>
              </select>
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
        <button type="submit" form="add-part-existing-form" className="btn btn-primary" disabled={submitting}>
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

/** Modal — form for updating an existing part */
function UpdatePartModal({ part, onSuccess }) {
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

  function handleSupplierSelect(s) {
    setForm(p => ({ ...p, supplierId: s.supplierId }))
    setSupplierDisplay(`${s.name} (#${s.supplierId})`)
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
      onSuccess?.()
    } catch (err) {
      setFormError({ _general: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  return (
    <div className="modal-content w-full max-w-lg my-auto">
      <div className="modal-header">
        <div>
          <h3 className="modal-title">Update Part #{part.partId}</h3>
          <span className="text-sm text-base-content/50">{part.name}</span>
        </div>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body">
        <form id="update-part-form" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="label-text font-medium">Name <span className="text-error">*</span></label>
              <input type="text" name="name" maxLength={255} required
                className={`input input-bordered w-full${formError.name ? ' is-invalid' : ''}`}
                value={form.name} onChange={handleChange} />
              {formError.name && <span className="helper-text">{formError.name}</span>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Quantity <span className="text-error">*</span></label>
              <input type="number" name="quantityOrdered" min={0} required
                className={`input input-bordered w-full${formError.quantityOrdered ? ' is-invalid' : ''}`}
                value={form.quantityOrdered} onChange={handleChange} />
              {formError.quantityOrdered && <span className="helper-text">{formError.quantityOrdered}</span>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Quantity Type <span className="text-error">*</span></label>
              <input type="text" name="quantityType" maxLength={30} required
                className={`input input-bordered w-full${formError.quantityType ? ' is-invalid' : ''}`}
                value={form.quantityType} onChange={handleChange} />
              {formError.quantityType && <span className="helper-text">{formError.quantityType}</span>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Unit Price <span className="text-error">*</span></label>
              <input type="number" name="unitPrice" min={0} step="0.01" required
                className={`input input-bordered w-full${formError.unitPrice ? ' is-invalid' : ''}`}
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
                  onClick={() => pushModal(<SupplierPickerLayer onSelect={handleSupplierSelect} />)}>
                  Pick
                </button>
              </div>
              {formError.supplierId && <span className="helper-text">{formError.supplierId}</span>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Status</label>
              <select name="status" className="select select-bordered w-full"
                value={form.status} onChange={handleChange}>
                <option value="ordered">ordered</option>
                <option value="received">received</option>
                <option value="cancelled">cancelled</option>
              </select>
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
        <button type="submit" form="update-part-form" className="btn btn-primary" disabled={submitting}>
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

/** Modal — form for logging a new usage record for a part */
function LogUsageModal({ part, srNumber, availableQty, onSuccess }) {
  const { popModal } = useModal()
  const { apiFetch } = useAuth()
  const [form, setForm] = useState({ qtyUsed: '', notes: '' })
  const [formError, setFormError] = useState({})
  const [submitting, setSubmitting] = useState(false)

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
          srNumber: srNumber ?? null,
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
    <div className="modal-content w-full max-w-sm my-auto">
      <div className="modal-header">
        <div>
          <h3 className="modal-title">Log Usage — Part #{part.partId}</h3>
          <span className="text-sm text-base-content/50">{part.name}</span>
        </div>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body">
        <form id="log-usage-form" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4">
            {srNumber && (
              <p className="text-sm text-base-content/60">
                Usage will be logged against <span className="font-medium">SR #{srNumber}</span>.
              </p>
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
                className={`input input-bordered w-full${formError.qtyUsed ? ' is-invalid' : ''}`}
                placeholder={`Max: ${availableQty}`}
                value={form.qtyUsed}
                onChange={e => setForm(p => ({ ...p, qtyUsed: e.target.value }))} />
              {formError.qtyUsed && <span className="helper-text">{formError.qtyUsed}</span>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Notes</label>
              <textarea maxLength={255} rows={2}
                className={`textarea textarea-bordered w-full${formError.notes ? ' is-invalid' : ''}`}
                placeholder="Optional notes"
                value={form.notes}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
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
        <button type="submit" form="log-usage-form" className="btn btn-primary" disabled={submitting}>
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

/** Modal — form for editing an existing usage record. Uses state-driven SR picker to avoid z-index conflicts. */
function EditUsageModal({ usage, part, onSuccess }) {
  const { popModal } = useModal()
  const { apiFetch } = useAuth()
  const [form, setForm] = useState({
    srNumber: usage.srNumber ?? '',
    qtyUsed:  usage.qtyUsed,
    notes:    usage.notes ?? '',
  })
  const [formError, setFormError] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [srDisplay, setSrDisplay] = useState(usage.srNumber ? `SR #${usage.srNumber}` : '')
  const [srPickerOpen, setSrPickerOpen] = useState(false)

  useEffect(() => {
    if (!usage.srNumber) return
    apiFetch(`/api/service-reports/${usage.srNumber}`)
      .then(res => res.ok ? res.json() : null)
      .then(sr => { if (sr) setSrDisplay(`SR #${sr.srNumber} — ${sr.complaint ?? ''}`) })
      .catch(() => {})
  }, [])

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
    <>
      <div className="modal-content w-full max-w-sm my-auto">
        <div className="modal-header">
          <div>
            <h3 className="modal-title">Edit Usage #{usage.usageId}</h3>
            <span className="text-sm text-base-content/50">{part?.name}</span>
          </div>
          <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
            <span className="icon-[tabler--x] size-4"></span>
          </button>
        </div>
        <div className="modal-body">
          <form id="edit-usage-form" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="label-text font-medium">Service Report <span className="text-base-content/50 font-normal">(optional)</span></label>
                <div className="flex gap-2">
                  <input type="text" readOnly
                    className={`input input-bordered flex-1${formError.srNumber ? ' is-invalid' : ''}`}
                    placeholder="None — not linked to an SR"
                    value={srDisplay} />
                  <button type="button" className="btn btn-soft btn-secondary shrink-0"
                    onClick={() => setSrPickerOpen(true)}>
                    Pick
                  </button>
                  {form.srNumber && (
                    <button type="button" className="btn btn-soft btn-error shrink-0" title="Clear SR link"
                      onClick={() => { setForm(p => ({ ...p, srNumber: '' })); setSrDisplay('') }}>
                      <span className="icon-[tabler--x] size-4"></span>
                    </button>
                  )}
                </div>
                {formError.srNumber && <span className="helper-text">{formError.srNumber}</span>}
              </div>
              <div className="flex flex-col gap-1">
                <label className="label-text font-medium">Qty Used <span className="text-error">*</span></label>
                <input type="number" min={1} required
                  className={`input input-bordered w-full${formError.qtyUsed ? ' is-invalid' : ''}`}
                  value={form.qtyUsed}
                  onChange={e => setForm(p => ({ ...p, qtyUsed: e.target.value }))} />
                {formError.qtyUsed && <span className="helper-text">{formError.qtyUsed}</span>}
              </div>
              <div className="flex flex-col gap-1">
                <label className="label-text font-medium">Notes</label>
                <textarea maxLength={255} rows={2}
                  className={`textarea textarea-bordered w-full${formError.notes ? ' is-invalid' : ''}`}
                  placeholder="Optional notes"
                  value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
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
          <button type="submit" form="edit-usage-form" className="btn btn-primary" disabled={submitting}>
            {submitting
              ? <span className="loading loading-spinner loading-sm"></span>
              : <span className="icon-[tabler--device-floppy] size-4"></span>
            }
            Save Changes
          </button>
        </div>
      </div>
      <ServiceReportPickerModal
        isOpen={srPickerOpen}
        onClose={() => setSrPickerOpen(false)}
        backdropZ="z-[300]"
        modalZ="z-[310]"
        onSelect={sr => {
          setForm(p => ({ ...p, srNumber: sr.srNumber }))
          setSrDisplay(`SR #${sr.srNumber} — ${sr.complaint ?? sr.projectName ?? ''}`)
          setSrPickerOpen(false)
        }}
      />
    </>
  )
}

/** Modal — shows part details, usage history, and manage actions (Update / Log Usage) */
function ManagePartModal({ part: initialPart, srNumber, onRefreshList }) {
  const { popModal, pushModal } = useModal()
  const { apiFetch, hasRole } = useAuth()
  const canEdit = hasRole('ADMIN', 'ACCOUNTING', 'STAFF')

  const [part, setPart] = useState(initialPart)
  const [partRefreshKey, setPartRefreshKey] = useState(0)
  const [usageHistory, setUsageHistory] = useState([])
  const [usageLoading, setUsageLoading] = useState(false)
  const [usageRefreshKey, setUsageRefreshKey] = useState(0)

  const PART_MENU_ITEMS = [
    { key: 'update', label: 'Update Details', icon: 'icon-[tabler--pencil]', roles: ['ADMIN', 'ACCOUNTING', 'STAFF'] },
    { key: 'log', label: 'Log Usage', icon: 'icon-[tabler--tool]', roles: ['ADMIN', 'ACCOUNTING', 'STAFF'] },
  ]

  /** Computed qty available based on usage history */
  const availableQty = (part.quantityOrdered ?? 0) - usageHistory.reduce((s, u) => s + u.qtyUsed, 0)

  useEffect(() => {
    if (partRefreshKey === 0) return
    apiFetch(`/api/parts/${initialPart.partId}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setPart(data) })
      .catch(() => {})
  }, [partRefreshKey])

  useEffect(() => {
    let active = true
    setUsageLoading(true)
    const params = new URLSearchParams({ partId: part.partId, size: '100', sort: 'usedOn,desc' })
    apiFetch(`/api/part-usages?${params}`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => { if (active) setUsageHistory(data.content ?? []) })
      .catch(() => { if (active) setUsageHistory([]) })
      .finally(() => { if (active) setUsageLoading(false) })
    return () => { active = false }
  }, [part.partId, apiFetch, usageRefreshKey])

  function handleAction(key) {
    if (key === 'update') {
      pushModal(<UpdatePartModal part={part} onSuccess={() => {
        setPartRefreshKey(k => k + 1)
        onRefreshList?.()
      }} />)
    }
    if (key === 'log') {
      if (availableQty <= 0) { notyfError('No stock available to log.'); return }
      pushModal(<LogUsageModal part={part} srNumber={srNumber} availableQty={availableQty} onSuccess={() => {
        setUsageRefreshKey(k => k + 1)
        onRefreshList?.()
      }} />)
    }
  }

  function handleEditUsage(u) {
    pushModal(<EditUsageModal usage={u} part={part} onSuccess={() => {
      setUsageRefreshKey(k => k + 1)
      onRefreshList?.()
    }} />)
  }

  return (
    <div className="modal-content w-full max-w-xl my-auto">
      <div className="modal-header">
        <div>
          <h3 className="modal-title">Part #{part.partId}</h3>
          <span className="text-sm text-base-content/50">{part.name}</span>
        </div>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body flex flex-col gap-5">

        {/* Part details */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
          <PartDetailField label="Part ID"><span className="font-mono">{part.partId}</span></PartDetailField>
          <PartDetailField label="Status">
            <span className={`badge badge-soft ${partStatusBadge(part.status)} text-xs`}>{part.status}</span>
          </PartDetailField>
          <PartDetailField label="PO Number"><span className="font-mono">{part.poNum}</span></PartDetailField>
          <div className="col-span-2 sm:col-span-3 flex flex-col gap-0.5">
            <span className="text-xs text-base-content/50 uppercase tracking-wide">Name</span>
            <span className="text-sm font-medium">{part.name}</span>
          </div>
          <PartDetailField label="Ordered">{part.quantityOrdered} {part.quantityType}</PartDetailField>
          <PartDetailField label="Available">
            <span className={availableQty === 0 ? 'text-error font-semibold' : 'text-success font-semibold'}>
              {usageLoading ? '…' : availableQty} {part.quantityType}
            </span>
          </PartDetailField>
          <PartDetailField label="Unit Price">{formatCurrency(part.unitPrice)}</PartDetailField>
          <PartDetailField label="Subtotal">{formatCurrency(Number(part.quantityOrdered) * Number(part.unitPrice ?? 0))}</PartDetailField>
          <PartDetailField label="Supplier">({part.supplierId}) {part.supplierName ?? '—'}</PartDetailField>
          <PartDetailField label="Order Date">{formatDate(part.orderDate)}</PartDetailField>
        </div>

        <div className="divider my-0"></div>

        {/* Usage history */}
        <div className="flex flex-col gap-2">
          <span className="text-xs text-base-content/50 uppercase tracking-wide">Usage History</span>
          {usageLoading ? (
            <div className="flex justify-center py-4">
              <span className="loading loading-spinner loading-sm text-primary"></span>
            </div>
          ) : usageHistory.length === 0 ? (
            <div className="text-center py-4 text-base-content/40 text-sm">No usage recorded.</div>
          ) : (
            <div className="overflow-x-auto rounded-box border border-base-300">
              <table className="table table-zebra table-sm w-full">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>SR #</th>
                    <th>Qty Used</th>
                    <th>Used On</th>
                    {canEdit && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {usageHistory.map(u => (
                    <tr key={u.usageId}>
                      <td className="font-mono text-xs">{u.usageId}</td>
                      <td className="text-sm">{u.srNumber ?? '—'}</td>
                      <td className="text-sm">{u.qtyUsed} {part.quantityType}</td>
                      <td className="text-sm">{formatDate(u.usedOn)}</td>
                      {canEdit && (
                        <td>
                          <button className="btn btn-soft btn-secondary btn-xs" onClick={() => handleEditUsage(u)}>
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

        <div className="divider my-0"></div>

        <ModalNav title="Manage" items={PART_MENU_ITEMS} hasRole={hasRole} onSelect={handleAction} cols={3} />
      </div>
    </div>
  )
}

/** Modal — lists all parts for a PO with add/manage/delete actions */
function ManagePartsModal({ po, onRefresh }) {
  const { popModal, pushModal } = useModal()
  const { apiFetch } = useAuth()
  const [parts, setParts] = useState([])
  const [loading, setLoading] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [deletingPartId, setDeletingPartId] = useState(null)

  function refresh() {
    setRefreshKey(k => k + 1)
    onRefresh?.()
  }

  useEffect(() => {
    let active = true
    setLoading(true)
    const params = new URLSearchParams({ poNum: po.poNum, size: '100', sort: 'partId,asc' })
    apiFetch(`/api/parts?${params}`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => { if (active) setParts(data.content ?? []) })
      .catch(() => { if (active) setParts([]) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [po.poNum, apiFetch, refreshKey])

  function handleAddPart() {
    pushModal(<AddPartToExistingPOModal poNum={po.poNum} onSuccess={refresh} />)
  }

  function handleManagePart(p) {
    pushModal(<ManagePartModal part={p} srNumber={po.srNumber} onRefreshList={refresh} />)
  }

  async function handleDeletePart(partId) {
    setDeletingPartId(partId)
    try {
      const res = await apiFetch(`/api/parts/${partId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        notyfError(data.error ?? data.message ?? 'Delete failed')
        return
      }
      notyfSuccess(`Part #${partId} deleted.`)
      refresh()
    } catch {
      notyfError('Delete failed — server error')
    } finally {
      setDeletingPartId(null)
    }
  }

  return (
    <div className="modal-content w-full max-w-5xl my-auto">
      <div className="modal-header">
        <h3 className="modal-title">Parts — {po.poNum}</h3>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body flex flex-col gap-4">
        <div className="flex justify-end">
          <button type="button" className="btn btn-primary btn-sm" onClick={handleAddPart}>
            <span className="icon-[tabler--plus] size-4"></span>
            Add Part
          </button>
        </div>
        {loading ? (
          <div className="flex justify-center py-6">
            <span className="loading loading-spinner loading-sm text-primary"></span>
          </div>
        ) : parts.length === 0 ? (
          <div className="text-center py-6 text-base-content/40 text-sm">
            No parts linked to this purchase order.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-box border border-base-300">
            <table className="table table-zebra table-sm w-full">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>QTY Ordered</th>
                  <th>Remaining</th>
                  <th>Unit Price</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {parts.map(p => (
                  <tr key={p.partId}>
                    <td className="font-mono text-xs">{p.partId}</td>
                    <td className="text-sm max-w-40">
                      <span className="line-clamp-1" title={p.name}>{p.name}</span>
                    </td>
                    <td className="text-sm">{p.quantityOrdered} {p.quantityType}</td>
                    <td className="text-sm">
                      <span className={p.availableQty === 0 ? 'text-error font-semibold' : 'text-success font-semibold'}>
                        {p.availableQty} {p.quantityType}
                      </span>
                    </td>
                    <td className="text-sm">{formatCurrency(p.unitPrice)}</td>
                    <td>
                      <span className={`badge badge-soft ${partStatusBadge(p.status)} text-xs`}>{p.status}</span>
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <button className="btn btn-soft btn-primary btn-xs" onClick={() => handleManagePart(p)}>
                          <span className="icon-[tabler--settings] size-3"></span>
                          Manage
                        </button>
                        <button className="btn btn-soft btn-error btn-xs"
                          disabled={deletingPartId === p.partId}
                          onClick={() => handleDeletePart(p.partId)}>
                          {deletingPartId === p.partId
                            ? <span className="loading loading-spinner loading-xs"></span>
                            : <span className="icon-[tabler--x] size-3"></span>
                          }
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-soft btn-secondary" onClick={popModal}>Close</button>
      </div>
    </div>
  )
}

/** Modal — form for adding a delivery contact to an existing PO */
function AddContactToExistingPOModal({ poNum, onSuccess }) {
  const { popModal } = useModal()
  const { apiFetch } = useAuth()
  const [form, setForm] = useState({ contactName: '', contactNumber: '' })
  const [formError, setFormError] = useState({})
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError({})
    setSubmitting(true)
    try {
      const res = await apiFetch('/api/purchase-order-delivery-contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, poNum }),
      })
      if (!res.ok) {
        setFormError(await parseApiError(res))
        notyfError('Add contact failed')
        return
      }
      notyfSuccess('Delivery contact added successfully.')
      popModal()
      onSuccess?.()
    } catch (err) {
      setFormError({ _general: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
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
        <form id="add-contact-existing-form" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Contact Name <span className="text-error">*</span></label>
              <input type="text" name="contactName" maxLength={300} required
                className={`input input-bordered w-full${formError.contactName ? ' is-invalid' : ''}`}
                placeholder="e.g. Juan Dela Cruz"
                value={form.contactName} onChange={handleChange} />
              {formError.contactName && <span className="helper-text">{formError.contactName}</span>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Contact Number <span className="text-error">*</span></label>
              <input type="text" name="contactNumber" maxLength={16} required
                className={`input input-bordered w-full${formError.contactNumber ? ' is-invalid' : ''}`}
                placeholder="e.g. 09171234567"
                value={form.contactNumber} onChange={handleChange} />
              {formError.contactNumber && <span className="helper-text">{formError.contactNumber}</span>}
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
        <button type="submit" form="add-contact-existing-form" className="btn btn-primary" disabled={submitting}>
          {submitting
            ? <span className="loading loading-spinner loading-sm"></span>
            : <span className="icon-[tabler--plus] size-4"></span>
          }
          Add Contact
        </button>
      </div>
    </div>
  )
}

/** Modal — form for updating an existing delivery contact */
function UpdateContactModal({ contact, onSuccess }) {
  const { popModal } = useModal()
  const { apiFetch } = useAuth()
  const [form, setForm] = useState({ contactName: contact.contactName, contactNumber: contact.contactNumber })
  const [formError, setFormError] = useState({})
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError({})
    setSubmitting(true)
    try {
      const res = await apiFetch(`/api/purchase-order-delivery-contacts/${contact.poContactNum}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, poNum: contact.poNum }),
      })
      if (!res.ok) {
        setFormError(await parseApiError(res))
        notyfError('Update failed')
        return
      }
      notyfSuccess(`Contact #${contact.poContactNum} updated successfully.`)
      popModal()
      onSuccess?.()
    } catch (err) {
      setFormError({ _general: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  return (
    <div className="modal-content w-full max-w-sm my-auto">
      <div className="modal-header">
        <div>
          <h3 className="modal-title">Update Contact #{contact.poContactNum}</h3>
          <span className="text-sm text-base-content/50">{contact.contactName}</span>
        </div>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body">
        <form id="update-contact-form" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Contact Name <span className="text-error">*</span></label>
              <input type="text" name="contactName" maxLength={300} required
                className={`input input-bordered w-full${formError.contactName ? ' is-invalid' : ''}`}
                value={form.contactName} onChange={handleChange} />
              {formError.contactName && <span className="helper-text">{formError.contactName}</span>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Contact Number <span className="text-error">*</span></label>
              <input type="text" name="contactNumber" maxLength={16} required
                className={`input input-bordered w-full${formError.contactNumber ? ' is-invalid' : ''}`}
                value={form.contactNumber} onChange={handleChange} />
              {formError.contactNumber && <span className="helper-text">{formError.contactNumber}</span>}
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
        <button type="submit" form="update-contact-form" className="btn btn-primary" disabled={submitting}>
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

/** Modal — lists all delivery contacts for a PO with add/details/update/delete actions */
function ManageDeliveryContactsModal({ po, onRefresh }) {
  const { popModal, pushModal } = useModal()
  const { apiFetch } = useAuth()
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [deletingId, setDeletingId] = useState(null)

  function refresh() {
    setRefreshKey(k => k + 1)
    onRefresh?.()
  }

  useEffect(() => {
    let active = true
    setLoading(true)
    const params = new URLSearchParams({ poNum: po.poNum, size: '100', sort: 'poContactNum,asc' })
    apiFetch(`/api/purchase-order-delivery-contacts?${params}`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => { if (active) setContacts(data.content ?? []) })
      .catch(() => { if (active) setContacts([]) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [po.poNum, apiFetch, refreshKey])

  function handleAddContact() {
    pushModal(<AddContactToExistingPOModal poNum={po.poNum} onSuccess={refresh} />)
  }

  function handleViewDetails(c) {
    pushModal(<ContactDetailsModal contact={c} />)
  }

  function handleUpdateContact(c) {
    pushModal(<UpdateContactModal contact={c} onSuccess={refresh} />)
  }

  async function handleDeleteContact(poContactNum) {
    setDeletingId(poContactNum)
    try {
      const res = await apiFetch(`/api/purchase-order-delivery-contacts/${poContactNum}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        notyfError(data.error ?? data.message ?? 'Delete failed')
        return
      }
      notyfSuccess(`Contact #${poContactNum} deleted.`)
      refresh()
    } catch {
      notyfError('Delete failed — server error')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="modal-content w-full max-w-2xl my-auto">
      <div className="modal-header">
        <h3 className="modal-title">Delivery Contacts — {po.poNum}</h3>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body flex flex-col gap-4">
        <div className="flex justify-end">
          <button type="button" className="btn btn-primary btn-sm" onClick={handleAddContact}>
            <span className="icon-[tabler--plus] size-4"></span>
            Add Contact
          </button>
        </div>
        {loading ? (
          <div className="flex justify-center py-6">
            <span className="loading loading-spinner loading-sm text-primary"></span>
          </div>
        ) : contacts.length === 0 ? (
          <div className="text-center py-6 text-base-content/40 text-sm">
            No delivery contacts linked to this purchase order.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-box border border-base-300">
            <table className="table table-zebra table-sm w-full">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Contact Name</th>
                  <th>Contact Number</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map(c => (
                  <tr key={c.poContactNum}>
                    <td className="font-mono text-xs">{c.poContactNum}</td>
                    <td className="text-sm">{c.contactName}</td>
                    <td className="text-sm">{c.contactNumber}</td>
                    <td>
                      <div className="flex gap-1">
                        <button className="btn btn-soft btn-primary btn-xs" onClick={() => handleViewDetails(c)}>
                          <span className="icon-[tabler--info-circle] size-3"></span>
                          Details
                        </button>
                        <button className="btn btn-soft btn-secondary btn-xs" onClick={() => handleUpdateContact(c)}>
                          <span className="icon-[tabler--pencil] size-3"></span>
                          Update
                        </button>
                        <button className="btn btn-soft btn-error btn-xs"
                          disabled={deletingId === c.poContactNum}
                          onClick={() => handleDeleteContact(c.poContactNum)}>
                          {deletingId === c.poContactNum
                            ? <span className="loading loading-spinner loading-xs"></span>
                            : <span className="icon-[tabler--x] size-3"></span>
                          }
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-soft btn-secondary" onClick={popModal}>Close</button>
      </div>
    </div>
  )
}

const PO_MANAGE_MENU_ITEMS = [
  { key: 'update',    label: 'Update Details',      icon: 'icon-[tabler--pencil]',       roles: ['ADMIN', 'ACCOUNTING', 'STAFF'] },
  { key: 'parts',     label: 'Manage Parts',         icon: 'icon-[tabler--package]',      roles: ['ADMIN', 'ACCOUNTING', 'STAFF'] },
  { key: 'contacts',  label: 'Delivery Contacts',    icon: 'icon-[tabler--address-book]', roles: ['ADMIN', 'ACCOUNTING', 'STAFF'] },
  { key: 'documents', label: 'Manage Documents',     icon: 'icon-[tabler--files]',        roles: null },
]

/** Level 1 modal — PO details panel with ModalNav for manage actions */
function POManageModal({ po: initialPo, onRefresh }) {
  const { popModal, pushModal } = useModal()
  const { apiFetch, hasRole } = useAuth()
  const navigate = useNavigate()

  const [po, setPo] = useState(initialPo)
  const [parts, setParts] = useState([])
  const [partsLoading, setPartsLoading] = useState(false)
  const [partsRefreshKey, setPartsRefreshKey] = useState(0)
  const [contacts, setContacts] = useState([])
  const [contactsLoading, setContactsLoading] = useState(false)
  const [contactsRefreshKey, setContactsRefreshKey] = useState(0)

  useEffect(() => {
    let active = true
    setPartsLoading(true)
    const params = new URLSearchParams({ poNum: po.poNum, size: '100', sort: 'partId,asc' })
    apiFetch(`/api/parts?${params}`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => { if (active) setParts(data.content ?? []) })
      .catch(() => { if (active) setParts([]) })
      .finally(() => { if (active) setPartsLoading(false) })
    return () => { active = false }
  }, [po.poNum, apiFetch, partsRefreshKey])

  useEffect(() => {
    let active = true
    setContactsLoading(true)
    const params = new URLSearchParams({ poNum: po.poNum, size: '100', sort: 'poContactNum,asc' })
    apiFetch(`/api/purchase-order-delivery-contacts?${params}`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => { if (active) setContacts(data.content ?? []) })
      .catch(() => { if (active) setContacts([]) })
      .finally(() => { if (active) setContactsLoading(false) })
    return () => { active = false }
  }, [po.poNum, apiFetch, contactsRefreshKey])

  function refreshPo() {
    apiFetch(`/api/purchase-orders/${po.poNum}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setPo(data) })
      .catch(() => {})
    onRefresh?.()
  }

  function refreshParts() { setPartsRefreshKey(k => k + 1) }
  function refreshContacts() { setContactsRefreshKey(k => k + 1) }

  function handleAction(key) {
    if (key === 'update') pushModal(<UpdatePOModal po={po} onSuccess={refreshPo} />)
    if (key === 'parts') pushModal(<ManagePartsModal po={po} onRefresh={refreshParts} />)
    if (key === 'contacts') pushModal(<ManageDeliveryContactsModal po={po} onRefresh={refreshContacts} />)
    if (key === 'documents') {
      popModal()
      navigate(`/service-report/${po.srNum}/purchase-orders/${po.poNum}/documents`, {
        state: { poNum: po.poNum, srNumber: po.srNum },
      })
    }
  }

  return (
    <div className="modal-content w-full max-w-2xl my-auto">
      <div className="modal-header">
        <div>
          <h3 className="modal-title">{po.poNum}</h3>
          <span className="text-sm text-base-content/50">SR #{po.srNum} · {po.purpose}</span>
        </div>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body flex flex-col gap-5">

        {/* PO details */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-base-content/50 uppercase tracking-wide">PO Number</span>
            <span className="text-sm font-medium font-mono">{po.poNum}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-base-content/50 uppercase tracking-wide">SR #</span>
            <span className="text-sm font-medium">{po.srNum ?? '—'}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-base-content/50 uppercase tracking-wide">Terms</span>
            <span className="text-sm font-medium">{po.terms}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-base-content/50 uppercase tracking-wide">Payment Method</span>
            <span className="text-sm font-medium">{po.paymentMethod ?? '—'}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-base-content/50 uppercase tracking-wide">Payment Details</span>
            <span className="text-sm font-medium">{po.paymentDetails ?? '—'}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-base-content/50 uppercase tracking-wide">Added On</span>
            <span className="text-sm font-medium">{formatDate(po.addedOn)}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-base-content/50 uppercase tracking-wide">Total Cost</span>
            <span className="text-sm font-medium text-primary">
              {po.totalCost != null ? Number(po.totalCost).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' }) : '₱0.00'}
            </span>
          </div>
          <div className="col-span-2 sm:col-span-3 flex flex-col gap-0.5">
            <span className="text-xs text-base-content/50 uppercase tracking-wide">Delivery Address</span>
            <span className="text-sm font-medium">{po.deliveryAddress ?? '—'}</span>
          </div>
          <div className="col-span-2 sm:col-span-3 flex flex-col gap-0.5">
            <span className="text-xs text-base-content/50 uppercase tracking-wide">Remarks</span>
            <span className="text-sm font-medium">{po.remarks ?? '—'}</span>
          </div>
        </div>

        <div className="divider my-0"></div>

        {/* Ordered parts summary */}
        <div className="flex flex-col gap-3">
          <span className="text-xs text-base-content/50 uppercase tracking-wide">Ordered Parts</span>
          <PartsTable parts={parts} loading={partsLoading} />
        </div>

        <div className="divider my-0"></div>

        {/* Delivery contacts summary */}
        <div className="flex flex-col gap-3">
          <span className="text-xs text-base-content/50 uppercase tracking-wide">Delivery Contacts</span>
          <DeliveryContactsTable contacts={contacts} loading={contactsLoading} />
        </div>

        <div className="divider my-0"></div>

        <ModalNav title="Manage" items={PO_MANAGE_MENU_ITEMS} hasRole={hasRole} onSelect={handleAction} cols={4} />
      </div>
    </div>
  )
}

export default function PurchaseOrders() {
  const { apiFetch, hasRole } = useAuth()
  const { pushModal } = useModal()
  const { srNumber } = useParams()
  const location = useLocation()
  const srNumberInt = Number(srNumber)
  const projectName = location.state?.projectName ?? '...'

  const canEdit = hasRole('ADMIN', 'ACCOUNTING', 'STAFF')

  const [orders, setOrders]               = useState([])
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState(null)
  const [search, setSearch]               = useState('')
  const [page, setPage]                   = useState(0)
  const [totalPages, setTotalPages]       = useState(0)
  const [totalElements, setTotalElements] = useState(0)
  const [refreshKey, setRefreshKey]       = useState(0)

  /** Fetches purchase orders for the current service report. */
  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({
      page: String(page),
      size: String(PAGE_SIZE),
      sort: 'poNum,asc',
      srNum: String(srNumberInt),
    })
    apiFetch(`/api/purchase-orders?${params}`)
      .then(res => {
        if (!res.ok) throw new Error(`Failed to load purchase orders (${res.status})`)
        return res.json()
      })
      .then(data => {
        if (!active) return
        setOrders(data.content ?? [])
        setTotalPages(data.totalPages ?? 0)
        setTotalElements(data.totalElements ?? 0)
      })
      .catch(err => { if (active) setError(err.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [apiFetch, page, srNumberInt, refreshKey])

  const filtered = orders.filter(o => {
    if (search === '') return true
    const q = search.toLowerCase()
    return (
      (o.poNum ?? '').toLowerCase().includes(q) ||
      (o.purpose ?? '').toLowerCase().includes(q) ||
      (o.terms ?? '').toLowerCase().includes(q)
    )
  })

  function openManage(o) {
    pushModal(<POManageModal po={o} onRefresh={() => { setPage(0); setRefreshKey(k => k + 1) }} />)
  }

  return (
    <Layout activePage="service-report">
      {/* Header row */}
      <div className="flex items-stretch justify-between h-16 mb-6">
        <div>
          <h1 className="text-3xl font-semibold">
            Purchase Orders of SR #{srNumberInt}
          </h1>
          <p className="text-base-content/60 mt-1">
            {projectName} — View and manage purchase orders for this service report
          </p>
        </div>
        <div className="flex gap-2 items-center h-full">
          {canEdit && (
            <button
              type="button"
              className="btn btn-primary h-full min-h-0"
              onClick={() => pushModal(<NewPOModal srNum={srNumberInt} onSuccess={() => { setPage(0); setRefreshKey(k => k + 1) }} />)}
            >
              <span className="icon-[tabler--plus] size-4"></span>
              New Purchase Order
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
            placeholder="Search by PO number or purpose..."
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

      {/* Cards */}
      {!loading && !error && (
        <>
          <p className="text-sm text-base-content/50 mb-3">
            {totalElements} purchase order{totalElements !== 1 ? 's' : ''} total
            {search && ` · ${filtered.length} shown`}
          </p>

          {filtered.length === 0 ? (
            <div className="text-center py-20 text-base-content/40">
              <span className="icon-[tabler--file-invoice-off] size-12 mx-auto mb-3 block"></span>
              <p>No purchase orders found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(o => (
                <div key={o.poNum} className="group">
                  <div className="card bg-base-100 border border-base-300 transition-transform duration-300 group-hover:-translate-y-2 h-full">
                    <div className="card-body gap-2">
                      <div className="flex items-start justify-between gap-2">
                        <h2 className="card-title text-base font-mono">{o.poNum}</h2>
                        <span className="badge badge-soft badge-primary shrink-0 text-xs">
                          SR #{o.srNum ?? '—'}
                        </span>
                      </div>
                      <p className="text-sm text-primary line-clamp-2">{o.purpose}</p>
                      <div className="text-sm text-base-content/70 space-y-0.5">
                        <p>Terms: {o.terms}</p>
                        <p>Payment: {o.paymentMethod}</p>
                        <p>Added: {formatDate(o.addedOn)}</p>
                      </div>
                      <div className="card-actions mt-2">
                        <button
                          className="btn btn-soft btn-primary btn-sm w-full"
                          onClick={() => openManage(o)}
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
