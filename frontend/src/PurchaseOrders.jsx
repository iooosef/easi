import { useState, useEffect } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from './auth'
import Layout from './Layout'
import ManageMenu from './ManageMenu'
import Modal from './Modal'
import { notyfSuccess, notyfError } from './notyf'
import SupplierPickerModal from './SupplierPickerModal'

/** Parses a failed API response into field-level or general errors. */
async function parseApiError(res) {
  const data = await res.json().catch(() => ({}))
  if (data.errors) return data.errors
  return { _general: data.message ?? data.error ?? `Error ${res.status}` }
}
const PO_MENU_ITEMS = []

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

/** Parts table rendered inside the ManageMenu details component */
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
  const totalCost = parts.reduce((sum, p) => sum + (Number(p.quantity) * Number(p.unitPrice ?? 0)), 0)

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
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {pageParts.map(p => (
              <tr key={p.partId}>
                <td className="font-mono text-xs">{p.partId}</td>
                <td className="text-sm max-w-40">
                  <span className="line-clamp-1" title={p.name}>{p.name}</span>
                </td>
                <td className="text-sm">{p.quantity} {p.quantityType}</td>
                <td className="text-sm">{formatCurrency(p.unitPrice)}</td>
                <td>
                  <span className={`badge badge-soft ${partStatusBadge(p.status)} text-xs`}>
                    {p.status}
                  </span>
                </td>
                <td>
                  <button
                    className="btn btn-soft btn-primary btn-xs"
                    onClick={() => onSelectPart(p)}
                  >
                    <span className="icon-[tabler--info-circle] size-3"></span>
                    Details
                  </button>
                </td>
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

/** Delivery contacts table rendered inside the ManageMenu details component */
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
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {pageContacts.map(c => (
              <tr key={c.poContactNum}>
                <td className="font-mono text-xs">{c.poContactNum}</td>
                <td className="text-sm">{c.contactName}</td>
                <td className="text-sm">{c.contactNumber}</td>
                <td>
                  <button
                    className="btn btn-soft btn-primary btn-xs"
                    onClick={() => onSelectContact(c)}
                  >
                    <span className="icon-[tabler--info-circle] size-3"></span>
                    Details
                  </button>
                </td>
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

/** Small modal showing all details of a single delivery contact */
function ContactDetailsModal({ contact, onClose }) {
  if (!contact) return null
  return (
    <>
      <div className="fixed inset-0 bg-base-300/40 z-[55]" onClick={onClose} />
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div className="modal-content w-full max-w-sm">
          <div className="modal-header">
            <div>
              <h3 className="modal-title">Contact #{contact.poContactNum}</h3>
              <span className="text-sm text-base-content/50">{contact.contactName}</span>
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
      </div>
    </>
  )
}

/** Small modal showing all details of a single part */
function PartDetailsModal({ part, onClose }) {
  if (!part) return null
  return (
    <>
      {/* Backdrop — higher z than ManageMenu so it doesn't close that modal */}
      <div
        className="fixed inset-0 bg-base-300/40 z-[55]"
        onClick={onClose}
      />
      {/* Modal panel */}
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div className="modal-content w-full max-w-sm">
          <div className="modal-header">
            <div>
              <h3 className="modal-title">Part #{part.partId}</h3>
              <span className="text-sm text-base-content/50">{part.name}</span>
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
          <div className="modal-body">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-base-content/50 uppercase tracking-wide">Part ID</span>
                <span className="text-sm font-medium font-mono">{part.partId}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-base-content/50 uppercase tracking-wide">Status</span>
                <span className={`badge badge-soft ${partStatusBadge(part.status)} text-xs w-fit`}>{part.status}</span>
              </div>
              <div className="col-span-2 flex flex-col gap-0.5">
                <span className="text-xs text-base-content/50 uppercase tracking-wide">Name</span>
                <span className="text-sm font-medium">{part.name}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-base-content/50 uppercase tracking-wide">Quantity</span>
                <span className="text-sm font-medium">{part.quantity} {part.quantityType}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-base-content/50 uppercase tracking-wide">Unit Price</span>
                <span className="text-sm font-medium">{formatCurrency(part.unitPrice)}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-base-content/50 uppercase tracking-wide">Subtotal</span>
                <span className="text-sm font-medium text-primary">{formatCurrency(Number(part.quantity) * Number(part.unitPrice ?? 0))}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-base-content/50 uppercase tracking-wide">Supplier</span>
                <span className="text-sm font-medium">({part.supplierId}) {part.supplierName ?? '—'}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-base-content/50 uppercase tracking-wide">Order Date</span>
                <span className="text-sm font-medium">{formatDate(part.orderDate)}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-base-content/50 uppercase tracking-wide">PO Number</span>
                <span className="text-sm font-medium font-mono">{part.poNum}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-base-content/50 uppercase tracking-wide">Added On</span>
                <span className="text-sm font-medium">{formatDate(part.addedOn)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default function PurchaseOrders() {
  const { apiFetch, hasRole } = useAuth()
  const { srNumber } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const srNumberInt = Number(srNumber)
  const projectName = location.state?.projectName ?? '...'
  const projNum = location.state?.projNum ?? null

  const canEdit = hasRole('ADMIN', 'ACCOUNTING', 'STAFF')

  // Add PO modal
  const EMPTY_FORM = { purpose: '', terms: '', paymentMethod: '', paymentDetails: '', deliveryAddress: '', remarks: '' }
  const [addModalOpen, setAddModalOpen]   = useState(false)
  const [form, setForm]                   = useState(EMPTY_FORM)
  const [formError, setFormError]         = useState({})
  const [submitting, setSubmitting]       = useState(false)

  function openAddModal() { setForm(EMPTY_FORM); setFormError({}); setAddModalOpen(true) }
  function closeAddModal() { setAddModalOpen(false); setForm(EMPTY_FORM); setFormError({}) }

  function handleFormChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  // Update PO modal
  const [editModalOpen, setEditModalOpen]   = useState(false)
  const [editingPO, setEditingPO]           = useState(null)
  const [editForm, setEditForm]             = useState(EMPTY_FORM)
  const [editFormError, setEditFormError]   = useState({})
  const [editSubmitting, setEditSubmitting] = useState(false)

  function openEditModal(o) {
    setEditForm({
      purpose:        o.purpose ?? '',
      terms:          o.terms ?? '',
      paymentMethod:  o.paymentMethod ?? '',
      paymentDetails: o.paymentDetails ?? '',
      deliveryAddress: o.deliveryAddress ?? '',
      remarks:        o.remarks ?? '',
    })
    setEditingPO(o)
    setEditFormError({})
    setEditModalOpen(true)
  }

  function closeEditModal() {
    setEditModalOpen(false)
    setEditingPO(null)
    setEditForm(EMPTY_FORM)
    setEditFormError({})
  }

  function handleEditFormChange(e) {
    const { name, value } = e.target
    setEditForm(prev => ({ ...prev, [name]: value }))
  }

  async function handleUpdateSubmit(e) {
    e.preventDefault()
    setEditFormError({})
    setEditSubmitting(true)
    try {
      const res = await apiFetch(`/api/purchase-orders/${editingPO.poNum}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editForm,
          poNum:   editingPO.poNum,
          projNum: editingPO.projNum,
          srNum:   editingPO.srNum,
        }),
      })
      if (!res.ok) {
        setEditFormError(await parseApiError(res))
        notyfError('Update failed')
        return
      }
      closeEditModal()
      setTimeout(() => notyfSuccess(`Purchase Order "${editingPO.poNum}" updated successfully.`), 150)
      setRefreshKey(k => k + 1)
    } catch (err) {
      setEditFormError({ _general: err.message })
    } finally {
      setEditSubmitting(false)
    }
  }

  // Manage Parts modal
  const EMPTY_PART_FORM = { name: '', quantity: '', quantityType: '', unitPrice: '', supplierId: '', status: 'ordered' }
  const [managePartsOpen, setManagePartsOpen]         = useState(false)
  const [managePartsOrder, setManagePartsOrder]       = useState(null)
  const [manageParts, setManageParts]                 = useState([])
  const [managePartsLoading, setManagePartsLoading]   = useState(false)
  const [managePartsRefresh, setManagePartsRefresh]   = useState(0)
  const [addPartOpen, setAddPartOpen]                 = useState(false)
  const [partForm, setPartForm]                       = useState(EMPTY_PART_FORM)
  const [partFormError, setPartFormError]             = useState({})
  const [partFormSubmitting, setPartFormSubmitting]   = useState(false)
  const [deletingPartId, setDeletingPartId]           = useState(null)
  const [supplierPickerFor, setSupplierPickerFor]     = useState(null) // 'add' | 'update'
  const [addSupplierDisplay, setAddSupplierDisplay]   = useState('')
  const [updateSupplierDisplay, setUpdateSupplierDisplay] = useState('')

  useEffect(() => {
    if (!managePartsOpen || !managePartsOrder) { setManageParts([]); return }
    let active = true
    setManagePartsLoading(true)
    const params = new URLSearchParams({ poNum: managePartsOrder.poNum, size: '100', sort: 'partId,asc' })
    apiFetch(`/api/parts?${params}`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => { if (active) setManageParts(data.content ?? []) })
      .catch(() => { if (active) setManageParts([]) })
      .finally(() => { if (active) setManagePartsLoading(false) })
    return () => { active = false }
  }, [apiFetch, managePartsOpen, managePartsOrder, managePartsRefresh])

  function openManageParts(o) { setManagePartsOrder(o); setManagePartsOpen(true); setAddPartOpen(false) }
  function closeManageParts() { setManagePartsOpen(false); setManagePartsOrder(null); setManageParts([]); setAddPartOpen(false); setPartForm(EMPTY_PART_FORM); setPartFormError({}); setAddSupplierDisplay('') }

  function handlePartFormChange(e) {
    const { name, value } = e.target
    setPartForm(prev => ({ ...prev, [name]: value }))
  }

  async function handleAddPartSubmit(e) {
    e.preventDefault()
    setPartFormError({})
    setPartFormSubmitting(true)
    try {
      const res = await apiFetch('/api/parts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...partForm,
          quantity: Number(partForm.quantity),
          unitPrice: Number(partForm.unitPrice),
          supplierId: Number(partForm.supplierId),
          poNum: managePartsOrder.poNum,
        }),
      })
      if (!res.ok) {
        setPartFormError(await parseApiError(res))
        notyfError('Add part failed')
        return
      }
      setAddPartOpen(false)
      setPartForm(EMPTY_PART_FORM)
      setPartFormError({})
      notyfSuccess('Part added successfully.')
      setManagePartsRefresh(k => k + 1)
    } catch (err) {
      setPartFormError({ _general: err.message })
    } finally {
      setPartFormSubmitting(false)
    }
  }

  // Update Part sub-modal
  const [updatePartOpen, setUpdatePartOpen]         = useState(false)
  const [updatingPart, setUpdatingPart]             = useState(null)
  const [updatePartForm, setUpdatePartForm]         = useState({})
  const [updatePartFormError, setUpdatePartFormError] = useState({})
  const [updatePartSubmitting, setUpdatePartSubmitting] = useState(false)

  function openUpdatePart(p) {
    setUpdatePartForm({
      name:          p.name,
      quantity:      p.quantity,
      quantityType:  p.quantityType,
      unitPrice:     p.unitPrice,
      supplierId:    p.supplierId,
      status:        p.status,
    })
    setUpdateSupplierDisplay(`${p.supplierName ?? 'Supplier'} (#${p.supplierId})`)
    setUpdatingPart(p)
    setUpdatePartFormError({})
    setUpdatePartOpen(true)
  }

  function closeUpdatePart() {
    setUpdatePartOpen(false)
    setUpdatingPart(null)
    setUpdatePartForm({})
    setUpdatePartFormError({})
    setUpdateSupplierDisplay('')
  }

  function handleUpdatePartFormChange(e) {
    const { name, value } = e.target
    setUpdatePartForm(prev => ({ ...prev, [name]: value }))
  }

  async function handleUpdatePartSubmit(e) {
    e.preventDefault()
    setUpdatePartFormError({})
    setUpdatePartSubmitting(true)
    try {
      const res = await apiFetch(`/api/parts/${updatingPart.partId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...updatePartForm,
          quantity:   Number(updatePartForm.quantity),
          unitPrice:  Number(updatePartForm.unitPrice),
          supplierId: Number(updatePartForm.supplierId),
          poNum:      updatingPart.poNum,
          orderDate:  updatingPart.orderDate,
        }),
      })
      if (!res.ok) {
        setUpdatePartFormError(await parseApiError(res))
        notyfError('Update failed')
        return
      }
      closeUpdatePart()
      notyfSuccess(`Part #${updatingPart.partId} updated successfully.`)
      setManagePartsRefresh(k => k + 1)
    } catch (err) {
      setUpdatePartFormError({ _general: err.message })
    } finally {
      setUpdatePartSubmitting(false)
    }
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
      setManagePartsRefresh(k => k + 1)
    } catch {
      notyfError('Delete failed — server error')
    } finally {
      setDeletingPartId(null)
    }
  }

  // Manage Delivery Contacts modal
  const EMPTY_CONTACT_FORM = { contactName: '', contactNumber: '' }
  const [manageContactsOpen, setManageContactsOpen]       = useState(false)
  const [manageContactsOrder, setManageContactsOrder]     = useState(null)
  const [manageContacts, setManageContacts]               = useState([])
  const [manageContactsLoading, setManageContactsLoading] = useState(false)
  const [manageContactsRefresh, setManageContactsRefresh] = useState(0)
  const [addContactOpen, setAddContactOpen]               = useState(false)
  const [contactForm, setContactForm]                     = useState(EMPTY_CONTACT_FORM)
  const [contactFormError, setContactFormError]           = useState({})
  const [contactFormSubmitting, setContactFormSubmitting] = useState(false)
  const [deletingContactId, setDeletingContactId]         = useState(null)

  // Update Contact sub-modal
  const [updateContactOpen, setUpdateContactOpen]           = useState(false)
  const [updatingContact, setUpdatingContact]               = useState(null)
  const [updateContactForm, setUpdateContactForm]           = useState({})
  const [updateContactFormError, setUpdateContactFormError] = useState({})
  const [updateContactSubmitting, setUpdateContactSubmitting] = useState(false)

  useEffect(() => {
    if (!manageContactsOpen || !manageContactsOrder) { setManageContacts([]); return }
    let active = true
    setManageContactsLoading(true)
    const params = new URLSearchParams({ poNum: manageContactsOrder.poNum, size: '100', sort: 'poContactNum,asc' })
    apiFetch(`/api/purchase-order-delivery-contacts?${params}`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => { if (active) setManageContacts(data.content ?? []) })
      .catch(() => { if (active) setManageContacts([]) })
      .finally(() => { if (active) setManageContactsLoading(false) })
    return () => { active = false }
  }, [apiFetch, manageContactsOpen, manageContactsOrder, manageContactsRefresh])

  function openManageContacts(o) { setManageContactsOrder(o); setManageContactsOpen(true); setAddContactOpen(false) }
  function closeManageContacts() { setManageContactsOpen(false); setManageContactsOrder(null); setManageContacts([]); setAddContactOpen(false); setContactForm(EMPTY_CONTACT_FORM); setContactFormError({}) }

  function handleContactFormChange(e) {
    const { name, value } = e.target
    setContactForm(prev => ({ ...prev, [name]: value }))
  }

  async function handleAddContactSubmit(e) {
    e.preventDefault()
    setContactFormError({})
    setContactFormSubmitting(true)
    try {
      const res = await apiFetch('/api/purchase-order-delivery-contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...contactForm, poNum: manageContactsOrder.poNum }),
      })
      if (!res.ok) {
        setContactFormError(await parseApiError(res))
        notyfError('Add contact failed')
        return
      }
      setAddContactOpen(false)
      setContactForm(EMPTY_CONTACT_FORM)
      setContactFormError({})
      notyfSuccess('Delivery contact added successfully.')
      setManageContactsRefresh(k => k + 1)
    } catch (err) {
      setContactFormError({ _general: err.message })
    } finally {
      setContactFormSubmitting(false)
    }
  }

  function openUpdateContact(c) {
    setUpdateContactForm({ contactName: c.contactName, contactNumber: c.contactNumber })
    setUpdatingContact(c)
    setUpdateContactFormError({})
    setUpdateContactOpen(true)
  }

  function closeUpdateContact() {
    setUpdateContactOpen(false)
    setUpdatingContact(null)
    setUpdateContactForm({})
    setUpdateContactFormError({})
  }

  function handleUpdateContactFormChange(e) {
    const { name, value } = e.target
    setUpdateContactForm(prev => ({ ...prev, [name]: value }))
  }

  async function handleUpdateContactSubmit(e) {
    e.preventDefault()
    setUpdateContactFormError({})
    setUpdateContactSubmitting(true)
    try {
      const res = await apiFetch(`/api/purchase-order-delivery-contacts/${updatingContact.poContactNum}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updateContactForm, poNum: updatingContact.poNum }),
      })
      if (!res.ok) {
        setUpdateContactFormError(await parseApiError(res))
        notyfError('Update failed')
        return
      }
      closeUpdateContact()
      notyfSuccess(`Contact #${updatingContact.poContactNum} updated successfully.`)
      setManageContactsRefresh(k => k + 1)
    } catch (err) {
      setUpdateContactFormError({ _general: err.message })
    } finally {
      setUpdateContactSubmitting(false)
    }
  }

  async function handleDeleteContact(poContactNum) {
    setDeletingContactId(poContactNum)
    try {
      const res = await apiFetch(`/api/purchase-order-delivery-contacts/${poContactNum}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        notyfError(data.error ?? data.message ?? 'Delete failed')
        return
      }
      notyfSuccess(`Contact #${poContactNum} deleted.`)
      setManageContactsRefresh(k => k + 1)
    } catch {
      notyfError('Delete failed — server error')
    } finally {
      setDeletingContactId(null)
    }
  }

  async function handleAddSubmit(e) {
    e.preventDefault()
    setFormError({})
    setSubmitting(true)
    try {
      const res = await apiFetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, srNum: srNumberInt, projNum }),
      })
      if (!res.ok) {
        setFormError(await parseApiError(res))
        notyfError('Add failed')
        return
      }
      const data = await res.json().catch(() => ({}))
      closeAddModal()
      setTimeout(() => notyfSuccess(`Purchase Order "${data.poNum}" created successfully.`), 150)
      setPage(0)
      setRefreshKey(k => k + 1)
    } catch (err) {
      setFormError({ _general: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  const [orders, setOrders]               = useState([])
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState(null)
  const [search, setSearch]               = useState('')
  const [page, setPage]                   = useState(0)
  const [totalPages, setTotalPages]       = useState(0)
  const [totalElements, setTotalElements] = useState(0)
  const [refreshKey, setRefreshKey]       = useState(0)

  const [selectedOrder, setSelectedOrder]     = useState(null)
  const [parts, setParts]                     = useState([])
  const [partsLoading, setPartsLoading]       = useState(false)
  const [selectedPart, setSelectedPart]       = useState(null)
  const [contacts, setContacts]               = useState([])
  const [contactsLoading, setContactsLoading] = useState(false)
  const [selectedContact, setSelectedContact] = useState(null)

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

  /** Fetches parts whenever a PO is selected. */
  useEffect(() => {
    if (!selectedOrder) {
      setParts([])
      return
    }
    let active = true
    setPartsLoading(true)
    const params = new URLSearchParams({
      poNum: selectedOrder.poNum,
      size: '100',
      sort: 'partId,asc',
    })
    apiFetch(`/api/parts?${params}`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => { if (active) setParts(data.content ?? []) })
      .catch(() => { if (active) setParts([]) })
      .finally(() => { if (active) setPartsLoading(false) })
    return () => { active = false }
  }, [apiFetch, selectedOrder])

  /** Fetches delivery contacts whenever a PO is selected. */
  useEffect(() => {
    if (!selectedOrder) {
      setContacts([])
      return
    }
    let active = true
    setContactsLoading(true)
    const params = new URLSearchParams({
      poNum: selectedOrder.poNum,
      size: '100',
      sort: 'poContactNum,asc',
    })
    apiFetch(`/api/purchase-order-delivery-contacts?${params}`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => { if (active) setContacts(data.content ?? []) })
      .catch(() => { if (active) setContacts([]) })
      .finally(() => { if (active) setContactsLoading(false) })
    return () => { active = false }
  }, [apiFetch, selectedOrder])

  const filtered = orders.filter(o => {
    if (search === '') return true
    const q = search.toLowerCase()
    return (
      (o.poNum ?? '').toLowerCase().includes(q) ||
      (o.purpose ?? '').toLowerCase().includes(q) ||
      (o.terms ?? '').toLowerCase().includes(q)
    )
  })

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
              onClick={openAddModal}
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
                      <div className="card-actions mt-2 flex-col gap-2">
                        <button
                          className="btn btn-soft btn-primary btn-sm w-full"
                          onClick={() => setSelectedOrder(o)}
                        >
                          <span className="icon-[tabler--settings] size-4"></span>
                          View Details
                        </button>
                        <button
                          className="btn btn-soft btn-secondary btn-sm w-full"
                          onClick={() => openEditModal(o)}
                        >
                          <span className="icon-[tabler--pencil] size-4"></span>
                          Update Purchase Order
                        </button>
                        <button
                          className="btn btn-soft btn-secondary btn-sm w-full"
                          onClick={() => openManageParts(o)}
                        >
                          <span className="icon-[tabler--package] size-4"></span>
                          Manage Parts
                        </button>
                        <button
                          className="btn btn-soft btn-secondary btn-sm w-full"
                          onClick={() => openManageContacts(o)}
                        >
                          <span className="icon-[tabler--address-book] size-4"></span>
                          Manage Delivery Contacts
                        </button>
                        <button
                          className="btn btn-soft btn-secondary btn-sm w-full"
                          onClick={() => navigate(`/service-report/${srNumber}/purchase-orders/${o.poNum}/documents`, {
                            state: { projectName, srNumber: srNumberInt, poNum: o.poNum },
                          })}
                        >
                          <span className="icon-[tabler--files] size-4"></span>
                          Manage Documents
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

      {/* Purchase Order Manage Modal */}
      <ManageMenu
        title={selectedOrder ? `PO ${selectedOrder.poNum}` : ''}
        subtitle={selectedOrder ? `SR #${selectedOrder.srNum} · ${selectedOrder.purpose}` : ''}
        item={selectedOrder}
        details={selectedOrder ? [
          { label: 'PO Number',       value: selectedOrder.poNum },
          { label: 'SR #',            value: selectedOrder.srNum ?? '—' },
          { label: 'Terms',           value: selectedOrder.terms },
          { label: 'Payment Method',  value: selectedOrder.paymentMethod },
          { label: 'Payment Details', value: selectedOrder.paymentDetails ?? '—' },
          { label: 'Added On',        value: formatDate(selectedOrder.addedOn) },
          { label: 'Total Cost',       value: selectedOrder.totalCost != null ? Number(selectedOrder.totalCost).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' }) : '₱0.00' },
          { label: 'Delivery Address', value: selectedOrder.deliveryAddress ?? '—', fullWidth: true },
          { label: 'Remarks',          value: selectedOrder.remarks ?? '—', fullWidth: true },
          {
            fullWidth: true,
            component: (
              <div className="flex flex-col gap-3">
                <span className="text-xs text-base-content/50 uppercase tracking-wide">Ordered Parts</span>
                <PartsTable parts={parts} loading={partsLoading} onSelectPart={setSelectedPart} />
              </div>
            ),
          },
          {
            fullWidth: true,
            component: (
              <div className="flex flex-col gap-3">
                <span className="text-xs text-base-content/50 uppercase tracking-wide">Delivery Contacts</span>
                <DeliveryContactsTable contacts={contacts} loading={contactsLoading} onSelectContact={setSelectedContact} />
              </div>
            ),
          },
        ] : []}
        isOpen={!!selectedOrder}
        onClose={() => { setSelectedOrder(null); setSelectedPart(null); setSelectedContact(null) }}
        hasRole={hasRole}
        menuItems={PO_MENU_ITEMS}
        onMenuSelect={(key, order) => {
          setSelectedOrder(null)
        }}
      />

      {/* Part Details Modal — sits above ManageMenu via higher z-index */}
      <PartDetailsModal part={selectedPart} onClose={() => setSelectedPart(null)} />

      {/* Contact Details Modal — sits above ManageMenu via higher z-index */}
      <ContactDetailsModal contact={selectedContact} onClose={() => setSelectedContact(null)} />

      {/* Add Purchase Order Modal */}
      <Modal
        isOpen={addModalOpen}
        onClose={closeAddModal}
        title="New Purchase Order"
        footer={
          <>
            <button type="button" className="btn btn-soft btn-secondary" onClick={closeAddModal}>
              Cancel
            </button>
            <button type="submit" form="add-po-form" className="btn btn-primary" disabled={submitting}>
              {submitting
                ? <span className="loading loading-spinner loading-sm"></span>
                : <span className="icon-[tabler--plus] size-4"></span>
              }
              Add Purchase Order
            </button>
          </>
        }
      >
        <form id="add-po-form" onSubmit={handleAddSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Purpose <span className="text-error">*</span></label>
              <input type="text" name="purpose"
                className={`input input-bordered w-full${formError.purpose ? ' is-invalid' : ''}`}
                placeholder="e.g. Repair Parts" maxLength={30} required
                value={form.purpose} onChange={handleFormChange} />
              {formError.purpose && <span className="helper-text">{formError.purpose}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Terms <span className="text-error">*</span></label>
              <input type="text" name="terms"
                className={`input input-bordered w-full${formError.terms ? ' is-invalid' : ''}`}
                placeholder="e.g. net30" maxLength={16} required
                value={form.terms} onChange={handleFormChange} />
              {formError.terms && <span className="helper-text">{formError.terms}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Payment Method</label>
              <input type="text" name="paymentMethod"
                className={`input input-bordered w-full${formError.paymentMethod ? ' is-invalid' : ''}`}
                placeholder="e.g. cash" maxLength={16}
                value={form.paymentMethod} onChange={handleFormChange} />
              {formError.paymentMethod && <span className="helper-text">{formError.paymentMethod}</span>}
            </div>

            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="label-text font-medium">Payment Details</label>
              <input type="text" name="paymentDetails"
                className={`input input-bordered w-full${formError.paymentDetails ? ' is-invalid' : ''}`}
                placeholder="e.g. BDO #1234567890" maxLength={60}
                value={form.paymentDetails} onChange={handleFormChange} />
              {formError.paymentDetails && <span className="helper-text">{formError.paymentDetails}</span>}
            </div>

            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="label-text font-medium">Delivery Address</label>
              <textarea name="deliveryAddress"
                className={`textarea textarea-bordered w-full${formError.deliveryAddress ? ' is-invalid' : ''}`}
                placeholder="Full delivery address" maxLength={600} rows={2}
                value={form.deliveryAddress} onChange={handleFormChange} />
              {formError.deliveryAddress && <span className="helper-text">{formError.deliveryAddress}</span>}
            </div>

            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="label-text font-medium">Remarks</label>
              <textarea name="remarks"
                className={`textarea textarea-bordered w-full${formError.remarks ? ' is-invalid' : ''}`}
                placeholder="Optional notes" maxLength={255} rows={2}
                value={form.remarks} onChange={handleFormChange} />
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
      </Modal>

      {/* Manage Parts Modal */}
      <Modal
        isOpen={managePartsOpen}
        onClose={addPartOpen ? undefined : closeManageParts}
        hideClose={addPartOpen}
        title={`Parts — ${managePartsOrder?.poNum ?? ''}`}
        size="max-w-3xl"
        footer={!addPartOpen && (
          <button type="button" className="btn btn-soft btn-secondary" onClick={closeManageParts}>
            Close
          </button>
        )}
      >
        {/* Add Part form (inline toggle) */}
        {addPartOpen ? (
          <form onSubmit={handleAddPartSubmit}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">

              <div className="sm:col-span-2 flex flex-col gap-1">
                <label className="label-text font-medium">Name <span className="text-error">*</span></label>
                <input type="text" name="name"
                  className={`input input-bordered w-full${partFormError.name ? ' is-invalid' : ''}`}
                  placeholder="e.g. Compressor Unit" maxLength={255} required
                  value={partForm.name} onChange={handlePartFormChange} />
                {partFormError.name && <span className="helper-text">{partFormError.name}</span>}
              </div>

              <div className="flex flex-col gap-1">
                <label className="label-text font-medium">Quantity <span className="text-error">*</span></label>
                <input type="number" name="quantity" min={0}
                  className={`input input-bordered w-full${partFormError.quantity ? ' is-invalid' : ''}`}
                  placeholder="e.g. 2" required
                  value={partForm.quantity} onChange={handlePartFormChange} />
                {partFormError.quantity && <span className="helper-text">{partFormError.quantity}</span>}
              </div>

              <div className="flex flex-col gap-1">
                <label className="label-text font-medium">Quantity Type <span className="text-error">*</span></label>
                <input type="text" name="quantityType" maxLength={30}
                  className={`input input-bordered w-full${partFormError.quantityType ? ' is-invalid' : ''}`}
                  placeholder="e.g. pcs" required
                  value={partForm.quantityType} onChange={handlePartFormChange} />
                {partFormError.quantityType && <span className="helper-text">{partFormError.quantityType}</span>}
              </div>

              <div className="flex flex-col gap-1">
                <label className="label-text font-medium">Unit Price <span className="text-error">*</span></label>
                <input type="number" name="unitPrice" min={0} step="0.01"
                  className={`input input-bordered w-full${partFormError.unitPrice ? ' is-invalid' : ''}`}
                  placeholder="e.g. 1500.00" required
                  value={partForm.unitPrice} onChange={handlePartFormChange} />
                {partFormError.unitPrice && <span className="helper-text">{partFormError.unitPrice}</span>}
              </div>

              <div className="flex flex-col gap-1">
                <label className="label-text font-medium">Supplier <span className="text-error">*</span></label>
                <div className="flex gap-2">
                  <input type="text" readOnly
                    className={`input input-bordered flex-1${partFormError.supplierId ? ' is-invalid' : ''}`}
                    placeholder="No supplier selected"
                    value={addSupplierDisplay} />
                  <button type="button" className="btn btn-soft btn-secondary shrink-0"
                    onClick={() => setSupplierPickerFor('add')}>
                    Pick
                  </button>
                </div>
                {partFormError.supplierId && <span className="helper-text">{partFormError.supplierId}</span>}
              </div>

              <div className="flex flex-col gap-1">
                <label className="label-text font-medium">Status</label>
                <select name="status"
                  className={`select select-bordered w-full${partFormError.status ? ' is-invalid' : ''}`}
                  value={partForm.status} onChange={handlePartFormChange}>
                  <option value="ordered">ordered</option>
                  <option value="received">received</option>
                  <option value="cancelled">cancelled</option>
                  <option value="used">used</option>
                </select>
                {partFormError.status && <span className="helper-text">{partFormError.status}</span>}
              </div>

              {partFormError._general && (
                <div className="sm:col-span-2 alert alert-error py-2">
                  <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                  <span className="text-sm">{partFormError._general}</span>
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end">
              <button type="button" className="btn btn-soft btn-secondary btn-sm"
                onClick={() => { setAddPartOpen(false); setPartForm(EMPTY_PART_FORM); setPartFormError({}) }}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={partFormSubmitting}>
                {partFormSubmitting
                  ? <span className="loading loading-spinner loading-xs"></span>
                  : <span className="icon-[tabler--plus] size-4"></span>
                }
                Add Part
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="flex justify-end mb-3">
              <button type="button" className="btn btn-primary btn-sm"
                onClick={() => { setPartForm(EMPTY_PART_FORM); setPartFormError({}); setAddPartOpen(true) }}>
                <span className="icon-[tabler--plus] size-4"></span>
                Add Part
              </button>
            </div>

            {managePartsLoading ? (
              <div className="flex justify-center py-6">
                <span className="loading loading-spinner loading-sm text-primary"></span>
              </div>
            ) : manageParts.length === 0 ? (
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
                      <th>Quantity</th>
                      <th>Unit Price</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {manageParts.map(p => (
                      <tr key={p.partId}>
                        <td className="font-mono text-xs">{p.partId}</td>
                        <td className="text-sm max-w-40">
                          <span className="line-clamp-1" title={p.name}>{p.name}</span>
                        </td>
                        <td className="text-sm">{p.quantity} {p.quantityType}</td>
                        <td className="text-sm">{formatCurrency(p.unitPrice)}</td>
                        <td>
                          <span className={`badge badge-soft ${partStatusBadge(p.status)} text-xs`}>
                            {p.status}
                          </span>
                        </td>
                        <td>
                          <div className="flex gap-1">
                            <button
                              className="btn btn-soft btn-primary btn-xs"
                              onClick={() => setSelectedPart(p)}
                            >
                              <span className="icon-[tabler--info-circle] size-3"></span>
                              Details
                            </button>
                            <button
                              className="btn btn-soft btn-secondary btn-xs"
                              onClick={() => openUpdatePart(p)}
                            >
                              <span className="icon-[tabler--pencil] size-3"></span>
                              Update
                            </button>
                            <button
                              className="btn btn-soft btn-error btn-xs"
                              disabled={deletingPartId === p.partId}
                              onClick={() => handleDeletePart(p.partId)}
                            >
                              {deletingPartId === p.partId
                                ? <span className="loading loading-spinner loading-xs"></span>
                                : <span className="icon-[tabler--trash] size-3"></span>
                              }
                              Delete
                            </button>
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

      {/* Update Part Sub-modal — sits above Manage Parts via higher z-index */}
      {updatePartOpen && (
        <>
          <div className="fixed inset-0 bg-base-300/40 z-[55]" onClick={closeUpdatePart} />
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="modal-content w-full max-w-lg shadow-xl">
              <div className="modal-header">
                <div>
                  <h3 className="modal-title">Update Part #{updatingPart?.partId}</h3>
                  <span className="text-sm text-base-content/50">{updatingPart?.name}</span>
                </div>
                <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={closeUpdatePart}>
                  <span className="icon-[tabler--x] size-4"></span>
                </button>
              </div>
              <div className="modal-body">
                <form id="update-part-form" onSubmit={handleUpdatePartSubmit}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                    <div className="sm:col-span-2 flex flex-col gap-1">
                      <label className="label-text font-medium">Name <span className="text-error">*</span></label>
                      <input type="text" name="name"
                        className={`input input-bordered w-full${updatePartFormError.name ? ' is-invalid' : ''}`}
                        maxLength={255} required
                        value={updatePartForm.name} onChange={handleUpdatePartFormChange} />
                      {updatePartFormError.name && <span className="helper-text">{updatePartFormError.name}</span>}
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="label-text font-medium">Quantity <span className="text-error">*</span></label>
                      <input type="number" name="quantity" min={0}
                        className={`input input-bordered w-full${updatePartFormError.quantity ? ' is-invalid' : ''}`}
                        required value={updatePartForm.quantity} onChange={handleUpdatePartFormChange} />
                      {updatePartFormError.quantity && <span className="helper-text">{updatePartFormError.quantity}</span>}
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="label-text font-medium">Quantity Type <span className="text-error">*</span></label>
                      <input type="text" name="quantityType" maxLength={30}
                        className={`input input-bordered w-full${updatePartFormError.quantityType ? ' is-invalid' : ''}`}
                        required value={updatePartForm.quantityType} onChange={handleUpdatePartFormChange} />
                      {updatePartFormError.quantityType && <span className="helper-text">{updatePartFormError.quantityType}</span>}
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="label-text font-medium">Unit Price <span className="text-error">*</span></label>
                      <input type="number" name="unitPrice" min={0} step="0.01"
                        className={`input input-bordered w-full${updatePartFormError.unitPrice ? ' is-invalid' : ''}`}
                        required value={updatePartForm.unitPrice} onChange={handleUpdatePartFormChange} />
                      {updatePartFormError.unitPrice && <span className="helper-text">{updatePartFormError.unitPrice}</span>}
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="label-text font-medium">Supplier <span className="text-error">*</span></label>
                      <div className="flex gap-2">
                        <input type="text" readOnly
                          className={`input input-bordered flex-1${updatePartFormError.supplierId ? ' is-invalid' : ''}`}
                          placeholder="No supplier selected"
                          value={updateSupplierDisplay} />
                        <button type="button" className="btn btn-soft btn-secondary shrink-0"
                          onClick={() => setSupplierPickerFor('update')}>
                          Pick
                        </button>
                      </div>
                      {updatePartFormError.supplierId && <span className="helper-text">{updatePartFormError.supplierId}</span>}
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="label-text font-medium">Status</label>
                      <select name="status"
                        className={`select select-bordered w-full${updatePartFormError.status ? ' is-invalid' : ''}`}
                        value={updatePartForm.status} onChange={handleUpdatePartFormChange}>
                        <option value="ordered">ordered</option>
                        <option value="received">received</option>
                        <option value="cancelled">cancelled</option>
                      </select>
                      {updatePartFormError.status && <span className="helper-text">{updatePartFormError.status}</span>}
                    </div>

                    {updatePartFormError._general && (
                      <div className="sm:col-span-2 alert alert-error py-2">
                        <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                        <span className="text-sm">{updatePartFormError._general}</span>
                      </div>
                    )}
                  </div>
                </form>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-soft btn-secondary" onClick={closeUpdatePart}>
                  Cancel
                </button>
                <button type="submit" form="update-part-form" className="btn btn-primary" disabled={updatePartSubmitting}>
                  {updatePartSubmitting
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

      {/* Manage Delivery Contacts Modal */}
      <Modal
        isOpen={manageContactsOpen}
        onClose={addContactOpen ? undefined : closeManageContacts}
        hideClose={addContactOpen}
        title={`Delivery Contacts — ${manageContactsOrder?.poNum ?? ''}`}
        size="max-w-2xl"
        footer={!addContactOpen && (
          <button type="button" className="btn btn-soft btn-secondary" onClick={closeManageContacts}>
            Close
          </button>
        )}
      >
        {addContactOpen ? (
          <form onSubmit={handleAddContactSubmit}>
            <div className="flex flex-col gap-4 mb-4">

              <div className="flex flex-col gap-1">
                <label className="label-text font-medium">Contact Name <span className="text-error">*</span></label>
                <input type="text" name="contactName"
                  className={`input input-bordered w-full${contactFormError.contactName ? ' is-invalid' : ''}`}
                  placeholder="e.g. Juan Dela Cruz" maxLength={300} required
                  value={contactForm.contactName} onChange={handleContactFormChange} />
                {contactFormError.contactName && <span className="helper-text">{contactFormError.contactName}</span>}
              </div>

              <div className="flex flex-col gap-1">
                <label className="label-text font-medium">Contact Number <span className="text-error">*</span></label>
                <input type="text" name="contactNumber"
                  className={`input input-bordered w-full${contactFormError.contactNumber ? ' is-invalid' : ''}`}
                  placeholder="e.g. 09171234567" maxLength={16} required
                  value={contactForm.contactNumber} onChange={handleContactFormChange} />
                {contactFormError.contactNumber && <span className="helper-text">{contactFormError.contactNumber}</span>}
              </div>

              {contactFormError._general && (
                <div className="alert alert-error py-2">
                  <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                  <span className="text-sm">{contactFormError._general}</span>
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end">
              <button type="button" className="btn btn-soft btn-secondary btn-sm"
                onClick={() => { setAddContactOpen(false); setContactForm(EMPTY_CONTACT_FORM); setContactFormError({}) }}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={contactFormSubmitting}>
                {contactFormSubmitting
                  ? <span className="loading loading-spinner loading-xs"></span>
                  : <span className="icon-[tabler--plus] size-4"></span>
                }
                Add Contact
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="flex justify-end mb-3">
              <button type="button" className="btn btn-primary btn-sm"
                onClick={() => { setContactForm(EMPTY_CONTACT_FORM); setContactFormError({}); setAddContactOpen(true) }}>
                <span className="icon-[tabler--plus] size-4"></span>
                Add Contact
              </button>
            </div>

            {manageContactsLoading ? (
              <div className="flex justify-center py-6">
                <span className="loading loading-spinner loading-sm text-primary"></span>
              </div>
            ) : manageContacts.length === 0 ? (
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
                    {manageContacts.map(c => (
                      <tr key={c.poContactNum}>
                        <td className="font-mono text-xs">{c.poContactNum}</td>
                        <td className="text-sm">{c.contactName}</td>
                        <td className="text-sm">{c.contactNumber}</td>
                        <td>
                          <div className="flex gap-1">
                            <button
                              className="btn btn-soft btn-primary btn-xs"
                              onClick={() => setSelectedContact(c)}
                            >
                              <span className="icon-[tabler--info-circle] size-3"></span>
                              Details
                            </button>
                            <button
                              className="btn btn-soft btn-secondary btn-xs"
                              onClick={() => openUpdateContact(c)}
                            >
                              <span className="icon-[tabler--pencil] size-3"></span>
                              Update
                            </button>
                            <button
                              className="btn btn-soft btn-error btn-xs"
                              disabled={deletingContactId === c.poContactNum}
                              onClick={() => handleDeleteContact(c.poContactNum)}
                            >
                              {deletingContactId === c.poContactNum
                                ? <span className="loading loading-spinner loading-xs"></span>
                                : <span className="icon-[tabler--trash] size-3"></span>
                              }
                              Delete
                            </button>
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

      {/* Update Contact Sub-modal — sits above Manage Contacts via higher z-index */}
      {updateContactOpen && (
        <>
          <div className="fixed inset-0 bg-base-300/40 z-[55]" onClick={closeUpdateContact} />
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="modal-content w-full max-w-sm shadow-xl">
              <div className="modal-header">
                <div>
                  <h3 className="modal-title">Update Contact #{updatingContact?.poContactNum}</h3>
                  <span className="text-sm text-base-content/50">{updatingContact?.contactName}</span>
                </div>
                <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={closeUpdateContact}>
                  <span className="icon-[tabler--x] size-4"></span>
                </button>
              </div>
              <div className="modal-body">
                <form id="update-contact-form" onSubmit={handleUpdateContactSubmit}>
                  <div className="flex flex-col gap-4">

                    <div className="flex flex-col gap-1">
                      <label className="label-text font-medium">Contact Name <span className="text-error">*</span></label>
                      <input type="text" name="contactName"
                        className={`input input-bordered w-full${updateContactFormError.contactName ? ' is-invalid' : ''}`}
                        maxLength={300} required
                        value={updateContactForm.contactName} onChange={handleUpdateContactFormChange} />
                      {updateContactFormError.contactName && <span className="helper-text">{updateContactFormError.contactName}</span>}
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="label-text font-medium">Contact Number <span className="text-error">*</span></label>
                      <input type="text" name="contactNumber"
                        className={`input input-bordered w-full${updateContactFormError.contactNumber ? ' is-invalid' : ''}`}
                        maxLength={16} required
                        value={updateContactForm.contactNumber} onChange={handleUpdateContactFormChange} />
                      {updateContactFormError.contactNumber && <span className="helper-text">{updateContactFormError.contactNumber}</span>}
                    </div>

                    {updateContactFormError._general && (
                      <div className="alert alert-error py-2">
                        <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                        <span className="text-sm">{updateContactFormError._general}</span>
                      </div>
                    )}
                  </div>
                </form>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-soft btn-secondary" onClick={closeUpdateContact}>
                  Cancel
                </button>
                <button type="submit" form="update-contact-form" className="btn btn-primary" disabled={updateContactSubmitting}>
                  {updateContactSubmitting
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

      {/* Supplier Picker — used by Add Part and Update Part forms */}
      <SupplierPickerModal
        isOpen={!!supplierPickerFor}
        onClose={() => setSupplierPickerFor(null)}
        onSelect={s => {
          if (supplierPickerFor === 'add') {
            setPartForm(prev => ({ ...prev, supplierId: s.supplierId }))
            setAddSupplierDisplay(`${s.name} (#${s.supplierId})`)
          } else if (supplierPickerFor === 'update') {
            setUpdatePartForm(prev => ({ ...prev, supplierId: s.supplierId }))
            setUpdateSupplierDisplay(`${s.name} (#${s.supplierId})`)
          }
          setSupplierPickerFor(null)
        }}
      />

      {/* Update Purchase Order Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={closeEditModal}
        title={`Update ${editingPO?.poNum ?? 'Purchase Order'}`}
        footer={
          <>
            <button type="button" className="btn btn-soft btn-secondary" onClick={closeEditModal}>
              Cancel
            </button>
            <button type="submit" form="update-po-form" className="btn btn-primary" disabled={editSubmitting}>
              {editSubmitting
                ? <span className="loading loading-spinner loading-sm"></span>
                : <span className="icon-[tabler--device-floppy] size-4"></span>
              }
              Save Changes
            </button>
          </>
        }
      >
        <form id="update-po-form" onSubmit={handleUpdateSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Purpose <span className="text-error">*</span></label>
              <input type="text" name="purpose"
                className={`input input-bordered w-full${editFormError.purpose ? ' is-invalid' : ''}`}
                placeholder="e.g. Repair Parts" maxLength={30} required
                value={editForm.purpose} onChange={handleEditFormChange} />
              {editFormError.purpose && <span className="helper-text">{editFormError.purpose}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Terms <span className="text-error">*</span></label>
              <input type="text" name="terms"
                className={`input input-bordered w-full${editFormError.terms ? ' is-invalid' : ''}`}
                placeholder="e.g. net30" maxLength={16} required
                value={editForm.terms} onChange={handleEditFormChange} />
              {editFormError.terms && <span className="helper-text">{editFormError.terms}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Payment Method</label>
              <input type="text" name="paymentMethod"
                className={`input input-bordered w-full${editFormError.paymentMethod ? ' is-invalid' : ''}`}
                placeholder="e.g. cash" maxLength={16}
                value={editForm.paymentMethod} onChange={handleEditFormChange} />
              {editFormError.paymentMethod && <span className="helper-text">{editFormError.paymentMethod}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Payment Details</label>
              <input type="text" name="paymentDetails"
                className={`input input-bordered w-full${editFormError.paymentDetails ? ' is-invalid' : ''}`}
                placeholder="e.g. BDO #1234567890" maxLength={60}
                value={editForm.paymentDetails} onChange={handleEditFormChange} />
              {editFormError.paymentDetails && <span className="helper-text">{editFormError.paymentDetails}</span>}
            </div>

            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="label-text font-medium">Delivery Address</label>
              <textarea name="deliveryAddress"
                className={`textarea textarea-bordered w-full${editFormError.deliveryAddress ? ' is-invalid' : ''}`}
                placeholder="Full delivery address" maxLength={600} rows={2}
                value={editForm.deliveryAddress} onChange={handleEditFormChange} />
              {editFormError.deliveryAddress && <span className="helper-text">{editFormError.deliveryAddress}</span>}
            </div>

            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="label-text font-medium">Remarks</label>
              <textarea name="remarks"
                className={`textarea textarea-bordered w-full${editFormError.remarks ? ' is-invalid' : ''}`}
                placeholder="Optional notes" maxLength={255} rows={2}
                value={editForm.remarks} onChange={handleEditFormChange} />
              {editFormError.remarks && <span className="helper-text">{editFormError.remarks}</span>}
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
    </Layout>
  )
}
