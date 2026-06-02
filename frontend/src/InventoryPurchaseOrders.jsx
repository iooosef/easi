import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from './auth'
import Layout from './Layout'
import ManageMenu from './ManageMenu'
import SupplierPickerModal from './SupplierPickerModal'
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

function getPoMenuItems(order) {
  const hasSR = !!(order?.srNum)
  return [
    { key: 'update',    label: 'Update Details',   icon: 'icon-[tabler--pencil]',       roles: ['ADMIN', 'ACCOUNTING', 'STAFF'] },
    hasSR
      ? { key: 'parts',     label: 'Manage Parts',     icon: 'icon-[tabler--package]', roles: ['ADMIN', 'ACCOUNTING', 'STAFF'] }
      : { key: 'equipment', label: 'Manage Equipment', icon: 'icon-[tabler--tool]',     roles: ['ADMIN', 'STAFF'] },
    { key: 'contacts',  label: 'Delivery Contacts', icon: 'icon-[tabler--address-book]', roles: ['ADMIN', 'ACCOUNTING', 'STAFF'] },
    { key: 'documents', label: 'Documents',         icon: 'icon-[tabler--files]',        roles: ['ADMIN', 'ACCOUNTING', 'STAFF'] },
  ]
}

const EMPTY_PO_FORM = { purpose: '', terms: '', paymentMethod: '', paymentDetails: '', deliveryAddress: '', remarks: '' }
const EMPTY_PART_FORM = { name: '', quantityOrdered: '', quantityType: '', unitPrice: '', supplierId: '', status: 'ordered' }
const EMPTY_CONTACT_FORM = { contactName: '', contactNumber: '' }
const EMPTY_EQUIP_FORM = { name: '', type: 'durable', model: '', serialNumber: '', description: '', stock: '1', acquisitionCost: '', status: 'active' }
const EMPTY_NEW_PO_PART_FORM = { name: '', quantityOrdered: '', quantityType: '', unitPrice: '', supplierId: '', _supplierName: '', orderDate: '' }

/** Paginated parts table inside a panel */
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

export default function InventoryPurchaseOrders() {
  const { apiFetch, hasRole } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const srNumFilter = searchParams.get('srNum') ? Number(searchParams.get('srNum')) : null
  const canEdit = hasRole('ADMIN', 'ACCOUNTING', 'STAFF')

  // ── List ─────────────────────────────────────────────────────────────────
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

  // ── Manage panel ─────────────────────────────────────────────────────────
  const [selectedOrder, setSelectedOrder] = useState(null)

  // ── Update PO modal ───────────────────────────────────────────────────────
  const [updatePoOpen, setUpdatePoOpen]       = useState(false)
  const [updatingPO, setUpdatingPO]           = useState(null)
  const [updatePoForm, setUpdatePoForm]       = useState(EMPTY_PO_FORM)
  const [updatePoError, setUpdatePoError]     = useState({})
  const [updatePoSubmitting, setUpdatePoSubmitting] = useState(false)

  // ── Active sub-panel ('parts' | 'equipment' | 'contacts' | null) ──────────
  const [activePanel, setActivePanel] = useState(null)
  const panelOrder = activePanel ? (orders.find(o => o.poNum === activePanel.poNum) ?? activePanel) : null

  // ── Parts panel ───────────────────────────────────────────────────────────
  const [parts, setParts]                   = useState([])
  const [partsLoading, setPartsLoading]     = useState(false)
  const [partsRefreshKey, setPartsRefreshKey] = useState(0)
  const [addPartOpen, setAddPartOpen]       = useState(false)
  const [partForm, setPartForm]             = useState(EMPTY_PART_FORM)
  const [partFormError, setPartFormError]   = useState({})
  const [partFormSubmitting, setPartFormSubmitting] = useState(false)
  const [deletingPartId, setDeletingPartId] = useState(null)
  const [supplierPickerFor, setSupplierPickerFor] = useState(null) // 'add' | 'update'
  const [addSupplierDisplay, setAddSupplierDisplay] = useState('')
  const [updateSupplierDisplay, setUpdateSupplierDisplay] = useState('')

  // ── Selected part sub-modal ───────────────────────────────────────────────
  const [selectedPart, setSelectedPart]     = useState(null)
  const [partUsageHistory, setPartUsageHistory] = useState([])
  const [partUsageLoading, setPartUsageLoading] = useState(false)
  const [partUsageRefresh, setPartUsageRefresh] = useState(0)

  // ── Update part modal ─────────────────────────────────────────────────────
  const [updatePartOpen, setUpdatePartOpen]       = useState(false)
  const [updatingPart, setUpdatingPart]           = useState(null)
  const [updatePartForm, setUpdatePartForm]       = useState({})
  const [updatePartError, setUpdatePartError]     = useState({})
  const [updatePartSubmitting, setUpdatePartSubmitting] = useState(false)

  // ── Log usage modal ───────────────────────────────────────────────────────
  const [logUsageOpen, setLogUsageOpen]         = useState(false)
  const [logUsageForm, setLogUsageForm]         = useState({ srNumber: '', qtyUsed: '', notes: '' })
  const [logUsageError, setLogUsageError]       = useState({})
  const [logUsageSubmitting, setLogUsageSubmitting] = useState(false)

  // ── Edit usage modal ──────────────────────────────────────────────────────
  const [editUsageOpen, setEditUsageOpen]       = useState(false)
  const [editingUsage, setEditingUsage]         = useState(null)
  const [editUsageForm, setEditUsageForm]       = useState({})
  const [editUsageError, setEditUsageError]     = useState({})
  const [editUsageSubmitting, setEditUsageSubmitting] = useState(false)

  // ── New PO modal (SR context) ─────────────────────────────────────────────
  const [newPoOpen, setNewPoOpen]               = useState(false)
  const [newPoForm, setNewPoForm]               = useState(EMPTY_PO_FORM)
  const [newPoError, setNewPoError]             = useState({})
  const [newPoSubmitting, setNewPoSubmitting]   = useState(false)
  const [newPoContacts, setNewPoContacts]       = useState([])
  const [newPoContactModalOpen, setNewPoContactModalOpen] = useState(false)
  const [newPoContactForm, setNewPoContactForm] = useState(EMPTY_CONTACT_FORM)
  const [newPoContactError, setNewPoContactError] = useState({})
  const [newPoParts, setNewPoParts]             = useState([])
  const [newPoPartModalOpen, setNewPoPartModalOpen] = useState(false)
  const [newPoPartForm, setNewPoPartForm]       = useState(EMPTY_NEW_PO_PART_FORM)
  const [newPoPartError, setNewPoPartError]     = useState({})
  const [suppliers, setSuppliers]               = useState([])

  // ── New PO wizard (base page) ────────────────────────────────────────────
  const [wizardOpen, setWizardOpen]             = useState(false)
  const [wizardStep, setWizardStep]             = useState(1)
  const [wizardType, setWizardType]             = useState(null)  // 'sr' | 'equipment'
  // SR path
  const [wizardProject, setWizardProject]       = useState(null)
  const [wizardSR, setWizardSR]                 = useState(null)
  const [wizardProjects, setWizardProjects]     = useState([])
  const [wizardProjLoading, setWizardProjLoading] = useState(false)
  const [wizardProjPage, setWizardProjPage]     = useState(0)
  const [wizardProjTotal, setWizardProjTotal]   = useState(0)
  const [wizardProjSearch, setWizardProjSearch] = useState('')
  const [wizardProjInput, setWizardProjInput]   = useState('')
  const [wizardSRs, setWizardSRs]               = useState([])
  const [wizardSRLoading, setWizardSRLoading]   = useState(false)
  const [wizardSRPage, setWizardSRPage]         = useState(0)
  const [wizardSRTotal, setWizardSRTotal]       = useState(0)
  const [wizardSRInput, setWizardSRInput]       = useState('')
  const [wizardSRSearch, setWizardSRSearch]     = useState('')
  // Equipment path
  const [wizardEquipPoForm, setWizardEquipPoForm]       = useState(EMPTY_PO_FORM)
  const [wizardEquipPoError, setWizardEquipPoError]     = useState({})
  const [wizardEquipList, setWizardEquipList]           = useState([])
  const [wizardEquipForm, setWizardEquipForm]           = useState(EMPTY_WIZARD_EQUIP)
  const [wizardEquipFormError, setWizardEquipFormError] = useState({})
  const [wizardAddingEquip, setWizardAddingEquip]       = useState(false)
  const [wizardDocList, setWizardDocList]               = useState([])
  const [wizardDocForm, setWizardDocForm]               = useState({ invoiceId: '', file: null })
  const [wizardDocFormError, setWizardDocFormError]     = useState({})
  const [wizardAddingDoc, setWizardAddingDoc]           = useState(false)
  const [wizardSubmitError, setWizardSubmitError]       = useState({})
  const wizardDocFileRef = useRef(null)

  // ── Equipment panel ───────────────────────────────────────────────────────
  const [equipList, setEquipList]         = useState([])
  const [equipLoading, setEquipLoading]   = useState(false)
  const [equipRefreshKey, setEquipRefreshKey] = useState(0)
  const [addEquipOpen, setAddEquipOpen]   = useState(false)
  const [addEquipForm, setAddEquipForm]   = useState(EMPTY_EQUIP_FORM)
  const [addEquipError, setAddEquipError] = useState({})
  const [addEquipSubmitting, setAddEquipSubmitting] = useState(false)
  const [editEquipOpen, setEditEquipOpen]     = useState(false)
  const [editingEquip, setEditingEquip]       = useState(null)
  const [editEquipForm, setEditEquipForm]     = useState({})
  const [editEquipError, setEditEquipError]   = useState({})
  const [editEquipSubmitting, setEditEquipSubmitting] = useState(false)

  // ── Contacts panel ────────────────────────────────────────────────────────
  const [contacts, setContacts]                   = useState([])
  const [contactsLoading, setContactsLoading]     = useState(false)
  const [contactsRefreshKey, setContactsRefreshKey] = useState(0)
  const [addContactOpen, setAddContactOpen]       = useState(false)
  const [contactForm, setContactForm]             = useState(EMPTY_CONTACT_FORM)
  const [contactFormError, setContactFormError]   = useState({})
  const [contactFormSubmitting, setContactFormSubmitting] = useState(false)
  const [deletingContactId, setDeletingContactId] = useState(null)
  const [updateContactOpen, setUpdateContactOpen]       = useState(false)
  const [updatingContact, setUpdatingContact]           = useState(null)
  const [updateContactForm, setUpdateContactForm]       = useState({})
  const [updateContactError, setUpdateContactError]     = useState({})
  const [updateContactSubmitting, setUpdateContactSubmitting] = useState(false)

  // ── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    let active = true
    setLoading(true); setError(null)
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
    if (!activePanel || activePanel.type !== 'parts') { setParts([]); return }
    let active = true; setPartsLoading(true)
    apiFetch(`/api/parts?poNum=${activePanel.poNum}&size=100&sort=partId,asc`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { if (active) setParts(d.content ?? []) })
      .catch(() => { if (active) setParts([]) })
      .finally(() => { if (active) setPartsLoading(false) })
    return () => { active = false }
  }, [apiFetch, activePanel, partsRefreshKey])

  useEffect(() => {
    if (!selectedPart) { setPartUsageHistory([]); return }
    let active = true; setPartUsageLoading(true)
    apiFetch(`/api/part-usages?partId=${selectedPart.partId}&size=100&sort=usedOn,desc`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { if (active) setPartUsageHistory(d.content ?? []) })
      .catch(() => { if (active) setPartUsageHistory([]) })
      .finally(() => { if (active) setPartUsageLoading(false) })
    return () => { active = false }
  }, [apiFetch, selectedPart, partUsageRefresh])

  useEffect(() => {
    if (!activePanel || activePanel.type !== 'equipment') { setEquipList([]); return }
    let active = true; setEquipLoading(true)
    apiFetch(`/api/equipment?poNum=${encodeURIComponent(activePanel.poNum)}&size=100&sort=equipmentId,asc`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { if (active) setEquipList(d.content ?? []) })
      .catch(() => { if (active) setEquipList([]) })
      .finally(() => { if (active) setEquipLoading(false) })
    return () => { active = false }
  }, [apiFetch, activePanel, equipRefreshKey])

  useEffect(() => {
    if (!activePanel || activePanel.type !== 'contacts') { setContacts([]); return }
    let active = true; setContactsLoading(true)
    apiFetch(`/api/purchase-order-delivery-contacts?poNum=${activePanel.poNum}&size=100&sort=poContactNum,asc`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { if (active) setContacts(d.content ?? []) })
      .catch(() => { if (active) setContacts([]) })
      .finally(() => { if (active) setContactsLoading(false) })
    return () => { active = false }
  }, [apiFetch, activePanel, contactsRefreshKey])

  useEffect(() => {
    if (!srNumFilter && !(wizardOpen && wizardStep === 4)) return
    apiFetch('/api/suppliers?size=200&sort=name,asc')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setSuppliers(d.content ?? []))
      .catch(() => {})
  }, [apiFetch, srNumFilter, wizardOpen, wizardStep])

  // Auto-open wizard when ?newPO=1 is in the URL
  useEffect(() => {
    if (canEdit && searchParams.get('newPO') === '1') setWizardOpen(true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Wizard: load projects (step 2)
  useEffect(() => {
    if (!wizardOpen || wizardStep !== 2) return
    let active = true; setWizardProjLoading(true)
    const params = new URLSearchParams({ page: String(wizardProjPage), size: '8', sort: 'name,asc' })
    if (wizardProjSearch) params.set('search', wizardProjSearch)
    apiFetch(`/api/projects?${params}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { if (active) { setWizardProjects(d.content ?? []); setWizardProjTotal(d.totalPages ?? 0) } })
      .catch(() => { if (active) setWizardProjects([]) })
      .finally(() => { if (active) setWizardProjLoading(false) })
    return () => { active = false }
  }, [apiFetch, wizardOpen, wizardStep, wizardProjPage, wizardProjSearch])

  // Wizard: load service reports (step 3)
  useEffect(() => {
    if (!wizardOpen || wizardStep !== 3 || !wizardProject) return
    let active = true; setWizardSRLoading(true)
    const params = new URLSearchParams({ page: String(wizardSRPage), size: '50', sort: 'srNumber,desc' })
    apiFetch(`/api/service-reports?projNum=${wizardProject.projNum}&${params}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { if (active) { setWizardSRs(d.content ?? []); setWizardSRTotal(d.totalPages ?? 0) } })
      .catch(() => { if (active) setWizardSRs([]) })
      .finally(() => { if (active) setWizardSRLoading(false) })
    return () => { active = false }
  }, [apiFetch, wizardOpen, wizardStep, wizardProject, wizardSRPage])

  // ── Helpers ───────────────────────────────────────────────────────────────

  function commitSearch() { setPage(0); setSearch(inputValue) }

  function openPanel(type, order) { setActivePanel({ ...order, type }) }
  function closePanel() {
    setActivePanel(null)
    setAddPartOpen(false); setPartForm(EMPTY_PART_FORM); setPartFormError({}); setAddSupplierDisplay('')
    setSelectedPart(null); setUpdatePartOpen(false); setLogUsageOpen(false); setEditUsageOpen(false)
    setAddContactOpen(false); setContactForm(EMPTY_CONTACT_FORM); setContactFormError({})
    setUpdateContactOpen(false); setUpdatingContact(null)
    setAddEquipOpen(false); setAddEquipForm(EMPTY_EQUIP_FORM); setAddEquipError({})
    setEditEquipOpen(false); setEditingEquip(null); setEditEquipError({})
  }

  function handleMenuSelect(key, order) {
    setSelectedOrder(null)
    if (key === 'update') {
      setUpdatePoForm({ purpose: order.purpose ?? '', terms: order.terms ?? '', paymentMethod: order.paymentMethod ?? '', paymentDetails: order.paymentDetails ?? '', deliveryAddress: order.deliveryAddress ?? '', remarks: order.remarks ?? '' })
      setUpdatingPO(order); setUpdatePoError({}); setUpdatePoOpen(true)
    } else if (key === 'documents') {
      const url = order.srNum
        ? `/service-report/${order.srNum}/purchase-orders/${order.poNum}/documents`
        : `/inventory/purchase-orders/${order.poNum}/documents`
      navigate(url)
    } else {
      openPanel(key, order)
    }
  }

  const computedAvailableQty = selectedPart
    ? (selectedPart.quantityOrdered ?? 0) - partUsageHistory.reduce((s, u) => s + u.qtyUsed, 0)
    : 0

  // ── Update PO ─────────────────────────────────────────────────────────────

  async function handleUpdatePoSubmit(e) {
    e.preventDefault(); setUpdatePoError({}); setUpdatePoSubmitting(true)
    try {
      const res = await apiFetch(`/api/purchase-orders/${updatingPO.poNum}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updatePoForm, poNum: updatingPO.poNum, srNum: updatingPO.srNum }),
      })
      if (!res.ok) { setUpdatePoError(await parseApiError(res)); notyfError('Update failed'); return }
      setUpdatePoOpen(false); setUpdatingPO(null)
      notyfSuccess(`Purchase Order "${updatingPO.poNum}" updated.`)
      setRefreshKey(k => k + 1)
    } catch (err) { setUpdatePoError({ _general: err.message }) }
    finally { setUpdatePoSubmitting(false) }
  }

  // ── Parts CRUD ────────────────────────────────────────────────────────────

  async function handleAddPartSubmit(e) {
    e.preventDefault(); setPartFormError({}); setPartFormSubmitting(true)
    try {
      const res = await apiFetch('/api/parts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...partForm, quantityOrdered: Number(partForm.quantityOrdered), unitPrice: Number(partForm.unitPrice), supplierId: Number(partForm.supplierId), poNum: activePanel.poNum }),
      })
      if (!res.ok) { setPartFormError(await parseApiError(res)); notyfError('Add part failed'); return }
      setAddPartOpen(false); setPartForm(EMPTY_PART_FORM); setPartFormError({}); setAddSupplierDisplay('')
      notyfSuccess('Part added.'); setPartsRefreshKey(k => k + 1); setRefreshKey(k => k + 1)
    } catch (err) { setPartFormError({ _general: err.message }) }
    finally { setPartFormSubmitting(false) }
  }

  async function handleDeletePart(partId) {
    setDeletingPartId(partId)
    try {
      const res = await apiFetch(`/api/parts/${partId}`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json().catch(() => ({})); notyfError(d.error ?? 'Delete failed'); return }
      notyfSuccess(`Part #${partId} deleted.`); setPartsRefreshKey(k => k + 1); setRefreshKey(k => k + 1)
    } catch { notyfError('Delete failed') }
    finally { setDeletingPartId(null) }
  }

  function openUpdatePart(p) {
    setUpdatePartForm({ name: p.name, quantityOrdered: p.quantityOrdered, quantityType: p.quantityType, unitPrice: p.unitPrice, supplierId: p.supplierId, status: p.status })
    setUpdateSupplierDisplay(`${p.supplierName ?? 'Supplier'} (#${p.supplierId})`)
    setUpdatingPart(p); setUpdatePartError({}); setUpdatePartOpen(true)
  }

  async function handleUpdatePartSubmit(e) {
    e.preventDefault(); setUpdatePartError({}); setUpdatePartSubmitting(true)
    try {
      const res = await apiFetch(`/api/parts/${updatingPart.partId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updatePartForm, quantityOrdered: Number(updatePartForm.quantityOrdered), unitPrice: Number(updatePartForm.unitPrice), supplierId: Number(updatePartForm.supplierId), poNum: updatingPart.poNum, orderDate: updatingPart.orderDate }),
      })
      if (!res.ok) { setUpdatePartError(await parseApiError(res)); notyfError('Update failed'); return }
      setUpdatePartOpen(false); setUpdatingPart(null); setSelectedPart(null)
      notyfSuccess(`Part #${updatingPart.partId} updated.`); setPartsRefreshKey(k => k + 1); setRefreshKey(k => k + 1)
    } catch (err) { setUpdatePartError({ _general: err.message }) }
    finally { setUpdatePartSubmitting(false) }
  }

  async function handleLogUsageSubmit(e) {
    e.preventDefault(); setLogUsageError({}); setLogUsageSubmitting(true)
    try {
      const res = await apiFetch('/api/part-usages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partId: selectedPart.partId, srNumber: logUsageForm.srNumber ? Number(logUsageForm.srNumber) : null, qtyUsed: Number(logUsageForm.qtyUsed), notes: logUsageForm.notes || null }),
      })
      if (!res.ok) { setLogUsageError(await parseApiError(res)); notyfError('Log usage failed'); return }
      setLogUsageOpen(false); setLogUsageForm({ srNumber: '', qtyUsed: '', notes: '' })
      notyfSuccess('Usage logged.'); setPartUsageRefresh(k => k + 1); setPartsRefreshKey(k => k + 1); setRefreshKey(k => k + 1)
    } catch (err) { setLogUsageError({ _general: err.message }) }
    finally { setLogUsageSubmitting(false) }
  }

  async function handleEditUsageSubmit(e) {
    e.preventDefault(); setEditUsageError({}); setEditUsageSubmitting(true)
    try {
      const res = await apiFetch(`/api/part-usages/${editingUsage.usageId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ srNumber: editUsageForm.srNumber ? Number(editUsageForm.srNumber) : null, qtyUsed: Number(editUsageForm.qtyUsed), notes: editUsageForm.notes || null }),
      })
      if (!res.ok) { setEditUsageError(await parseApiError(res)); notyfError('Update failed'); return }
      setEditUsageOpen(false); setEditingUsage(null)
      notyfSuccess(`Usage #${editingUsage.usageId} updated.`); setPartUsageRefresh(k => k + 1); setPartsRefreshKey(k => k + 1)
    } catch (err) { setEditUsageError({ _general: err.message }) }
    finally { setEditUsageSubmitting(false) }
  }

  // ── Contacts CRUD ─────────────────────────────────────────────────────────

  async function handleAddContactSubmit(e) {
    e.preventDefault(); setContactFormError({}); setContactFormSubmitting(true)
    try {
      const res = await apiFetch('/api/purchase-order-delivery-contacts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...contactForm, poNum: activePanel.poNum }),
      })
      if (!res.ok) { setContactFormError(await parseApiError(res)); notyfError('Add contact failed'); return }
      setAddContactOpen(false); setContactForm(EMPTY_CONTACT_FORM); setContactFormError({})
      notyfSuccess('Contact added.'); setContactsRefreshKey(k => k + 1)
    } catch (err) { setContactFormError({ _general: err.message }) }
    finally { setContactFormSubmitting(false) }
  }

  async function handleDeleteContact(poContactNum) {
    setDeletingContactId(poContactNum)
    try {
      const res = await apiFetch(`/api/purchase-order-delivery-contacts/${poContactNum}`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json().catch(() => ({})); notyfError(d.error ?? 'Delete failed'); return }
      notyfSuccess(`Contact #${poContactNum} deleted.`); setContactsRefreshKey(k => k + 1)
    } catch { notyfError('Delete failed') }
    finally { setDeletingContactId(null) }
  }

  async function handleUpdateContactSubmit(e) {
    e.preventDefault(); setUpdateContactError({}); setUpdateContactSubmitting(true)
    try {
      const res = await apiFetch(`/api/purchase-order-delivery-contacts/${updatingContact.poContactNum}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updateContactForm, poNum: updatingContact.poNum }),
      })
      if (!res.ok) { setUpdateContactError(await parseApiError(res)); notyfError('Update failed'); return }
      setUpdateContactOpen(false); setUpdatingContact(null)
      notyfSuccess(`Contact #${updatingContact.poContactNum} updated.`); setContactsRefreshKey(k => k + 1)
    } catch (err) { setUpdateContactError({ _general: err.message }) }
    finally { setUpdateContactSubmitting(false) }
  }

  // ── New PO (SR context) ───────────────────────────────────────────────────

  function resetNewPo() {
    setNewPoForm(EMPTY_PO_FORM); setNewPoError({})
    setNewPoContacts([]); setNewPoContactForm(EMPTY_CONTACT_FORM); setNewPoContactError({}); setNewPoContactModalOpen(false)
    setNewPoParts([]); setNewPoPartForm(EMPTY_NEW_PO_PART_FORM); setNewPoPartError({}); setNewPoPartModalOpen(false)
  }

  function handleAddNewPoContact(e) {
    e.preventDefault()
    const errors = {}
    if (!newPoContactForm.contactName.trim()) errors.contactName = 'Contact name is required.'
    if (!newPoContactForm.contactNumber.trim()) errors.contactNumber = 'Contact number is required.'
    if (Object.keys(errors).length > 0) { setNewPoContactError(errors); return }
    setNewPoContacts(list => [...list, { ...newPoContactForm, _tempId: Date.now() }])
    setNewPoContactForm(EMPTY_CONTACT_FORM); setNewPoContactError({}); setNewPoContactModalOpen(false)
  }

  function handleAddNewPoPart(e) {
    e.preventDefault()
    const errors = {}
    if (!newPoPartForm.name.trim()) errors.name = 'Name is required.'
    if (!newPoPartForm.quantityOrdered || Number(newPoPartForm.quantityOrdered) < 1) errors.quantityOrdered = 'Quantity must be at least 1.'
    if (!newPoPartForm.quantityType.trim()) errors.quantityType = 'Quantity type is required.'
    if (newPoPartForm.unitPrice === '' || Number(newPoPartForm.unitPrice) < 0) errors.unitPrice = 'Unit price must be 0 or greater.'
    if (!newPoPartForm.supplierId) errors.supplierId = 'Please select a supplier.'
    if (Object.keys(errors).length > 0) { setNewPoPartError(errors); return }
    setNewPoParts(list => [...list, { ...newPoPartForm, _tempId: Date.now() }])
    setNewPoPartForm(EMPTY_NEW_PO_PART_FORM); setNewPoPartError({}); setNewPoPartModalOpen(false)
  }

  async function handleNewPoSubmit(e) {
    e.preventDefault()
    const errors = {}
    if (!newPoForm.purpose.trim()) errors.purpose = 'Purpose is required.'
    if (!newPoForm.terms.trim()) errors.terms = 'Terms are required.'
    if (Object.keys(errors).length > 0) { setNewPoError(errors); return }
    setNewPoSubmitting(true)
    try {
      const res = await apiFetch('/api/purchase-orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purpose: newPoForm.purpose, terms: newPoForm.terms, paymentMethod: newPoForm.paymentMethod || null, paymentDetails: newPoForm.paymentDetails || null, deliveryAddress: newPoForm.deliveryAddress || null, remarks: newPoForm.remarks || null, srNum: srNumFilter }),
      })
      if (!res.ok) { setNewPoError(await parseApiError(res)); notyfError('Failed to create purchase order'); return }
      const createdPo = await res.json()
      for (const c of newPoContacts) {
        await apiFetch('/api/purchase-order-delivery-contacts', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ poNum: createdPo.poNum, contactName: c.contactName, contactNumber: c.contactNumber }),
        })
      }
      for (const p of newPoParts) {
        await apiFetch('/api/parts', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ poNum: createdPo.poNum, name: p.name, quantityOrdered: Number(p.quantityOrdered), quantityType: p.quantityType, unitPrice: Number(p.unitPrice), supplierId: Number(p.supplierId), orderDate: p.orderDate || null, status: 'ordered' }),
        })
      }
      setNewPoOpen(false); resetNewPo()
      notyfSuccess(`Purchase Order ${createdPo.poNum} created.`)
      setRefreshKey(k => k + 1)
    } catch (err) { setNewPoError({ _general: err.message }) }
    finally { setNewPoSubmitting(false) }
  }

  // ── Equipment CRUD ────────────────────────────────────────────────────────

  async function handleAddEquipSubmit(e) {
    e.preventDefault(); setAddEquipError({}); setAddEquipSubmitting(true)
    try {
      const res = await apiFetch('/api/equipment', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...addEquipForm, stock: Number(addEquipForm.stock), acquisitionCost: addEquipForm.acquisitionCost ? Number(addEquipForm.acquisitionCost) : null, status: 'active', poNum: activePanel.poNum }),
      })
      if (!res.ok) { setAddEquipError(await parseApiError(res)); notyfError('Add equipment failed'); return }
      setAddEquipOpen(false); setAddEquipForm(EMPTY_EQUIP_FORM); setAddEquipError({})
      notyfSuccess('Equipment added.'); setEquipRefreshKey(k => k + 1)
    } catch (err) { setAddEquipError({ _general: err.message }) }
    finally { setAddEquipSubmitting(false) }
  }

  async function handleEditEquipSubmit(e) {
    e.preventDefault(); setEditEquipError({}); setEditEquipSubmitting(true)
    try {
      const res = await apiFetch(`/api/equipment/${editingEquip.equipmentId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editEquipForm, stock: Number(editEquipForm.stock), acquisitionCost: editEquipForm.acquisitionCost ? Number(editEquipForm.acquisitionCost) : null, poNum: editingEquip.poNum }),
      })
      if (!res.ok) { setEditEquipError(await parseApiError(res)); notyfError('Update failed'); return }
      setEditEquipOpen(false); setEditingEquip(null)
      notyfSuccess(`Equipment #${editingEquip.equipmentId} updated.`); setEquipRefreshKey(k => k + 1)
    } catch (err) { setEditEquipError({ _general: err.message }) }
    finally { setEditEquipSubmitting(false) }
  }

  // ── Wizard helpers ────────────────────────────────────────────────────────

  function resetWizard() {
    setWizardStep(1); setWizardType(null)
    setWizardProject(null); setWizardSR(null)
    setWizardProjects([]); setWizardProjPage(0); setWizardProjTotal(0)
    setWizardProjSearch(''); setWizardProjInput('')
    setWizardSRs([]); setWizardSRPage(0); setWizardSRTotal(0); setWizardSRInput(''); setWizardSRSearch('')
    setWizardEquipPoForm(EMPTY_PO_FORM); setWizardEquipPoError({})
    setWizardEquipList([]); setWizardEquipForm(EMPTY_WIZARD_EQUIP); setWizardEquipFormError({}); setWizardAddingEquip(false)
    setWizardDocList([]); setWizardDocForm({ invoiceId: '', file: null }); setWizardDocFormError({}); setWizardAddingDoc(false)
    setWizardSubmitError({})
    resetNewPo()
  }

  function handleNextWizardEquipStep2() {
    const errors = {}
    if (!wizardEquipPoForm.purpose.trim()) errors.purpose = 'Purpose is required.'
    if (!wizardEquipPoForm.terms.trim()) errors.terms = 'Terms are required.'
    if (Object.keys(errors).length > 0) { setWizardEquipPoError(errors); return }
    setWizardEquipPoError({}); setWizardStep(3)
  }

  function handleNextWizardEquipStep3() {
    if (wizardEquipList.length === 0) {
      setWizardSubmitError({ _general: 'Add at least one equipment item before continuing.' }); return
    }
    setWizardSubmitError({}); setWizardStep(4)
  }

  function handleAddWizardEquipItem(e) {
    e.preventDefault()
    const errors = {}
    if (!wizardEquipForm.name.trim()) errors.name = 'Name is required.'
    if (!wizardEquipForm.stock || Number(wizardEquipForm.stock) < 0) errors.stock = 'Stock must be 0 or more.'
    if (Object.keys(errors).length > 0) { setWizardEquipFormError(errors); return }
    setWizardEquipFormError({})
    setWizardEquipList(prev => [...prev, { ...wizardEquipForm, _key: Date.now() }])
    setWizardEquipForm(EMPTY_WIZARD_EQUIP); setWizardAddingEquip(false)
  }

  function handleWizardDocFileChange(e) {
    const file = e.target.files?.[0] ?? null
    if (file && !ACCEPTED_TYPES.includes(file.type)) {
      setWizardDocFormError(prev => ({ ...prev, file: 'Only images and PDFs are accepted.' }))
      e.target.value = ''; return
    }
    setWizardDocFormError(prev => { const n = { ...prev }; delete n.file; return n })
    setWizardDocForm(prev => ({ ...prev, file }))
  }

  function handleAddWizardDocItem(e) {
    e.preventDefault()
    const errors = {}
    if (!wizardDocForm.invoiceId.trim()) errors.invoiceId = 'Invoice ID is required.'
    if (Object.keys(errors).length > 0) { setWizardDocFormError(errors); return }
    setWizardDocFormError({})
    setWizardDocList(prev => [...prev, { ...wizardDocForm, _key: Date.now() }])
    setWizardDocForm({ invoiceId: '', file: null }); setWizardAddingDoc(false)
    if (wizardDocFileRef.current) wizardDocFileRef.current.value = ''
  }

  async function handleWizardEquipSubmit() {
    setWizardSubmitError({})
    setNewPoSubmitting(true)
    try {
      const poRes = await apiFetch('/api/purchase-orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purpose: wizardEquipPoForm.purpose, terms: wizardEquipPoForm.terms, paymentMethod: wizardEquipPoForm.paymentMethod || null, paymentDetails: wizardEquipPoForm.paymentDetails || null, deliveryAddress: wizardEquipPoForm.deliveryAddress || null, remarks: wizardEquipPoForm.remarks || null, srNum: null }),
      })
      if (!poRes.ok) { setWizardSubmitError(await parseApiError(poRes)); notyfError('Failed to create purchase order'); return }
      const createdPo = await poRes.json()
      const poNum = createdPo.poNum
      for (const item of wizardEquipList) {
        await apiFetch('/api/equipment', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: item.name, type: item.type, status: 'active', model: item.model || null, serialNumber: item.serialNumber || null, description: item.description || null, stock: Number(item.stock), acquisitionCost: item.acquisitionCost ? Number(item.acquisitionCost) : null, poNum }),
        })
      }
      for (const doc of wizardDocList) {
        let docuId = null
        if (doc.file) {
          const fd = new FormData(); fd.append('file', doc.file)
          const up = await apiFetch('/api/documents', { method: 'POST', body: fd })
          if (up.ok) { const u = await up.json(); docuId = u.docuId }
        }
        await apiFetch('/api/purchase-order-documents', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ poNum, invoiceId: doc.invoiceId, docuId }),
        })
      }
      setWizardOpen(false); resetWizard()
      notyfSuccess(`Purchase Order ${poNum} created with ${wizardEquipList.length} equipment item(s).`)
      setRefreshKey(k => k + 1)
    } catch (err) { setWizardSubmitError({ _general: err.message }) }
    finally { setNewPoSubmitting(false) }
  }

  function openWizard() { resetWizard(); setWizardOpen(true) }

  async function handleWizardPoSubmit(e) {
    e.preventDefault()
    const errors = {}
    if (!newPoForm.purpose.trim()) errors.purpose = 'Purpose is required.'
    if (!newPoForm.terms.trim()) errors.terms = 'Terms are required.'
    if (Object.keys(errors).length > 0) { setNewPoError(errors); return }
    setNewPoSubmitting(true)
    try {
      const res = await apiFetch('/api/purchase-orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purpose: newPoForm.purpose, terms: newPoForm.terms, paymentMethod: newPoForm.paymentMethod || null, paymentDetails: newPoForm.paymentDetails || null, deliveryAddress: newPoForm.deliveryAddress || null, remarks: newPoForm.remarks || null, srNum: wizardSR.srNumber }),
      })
      if (!res.ok) { setNewPoError(await parseApiError(res)); notyfError('Failed to create purchase order'); return }
      const createdPo = await res.json()
      for (const c of newPoContacts) {
        await apiFetch('/api/purchase-order-delivery-contacts', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ poNum: createdPo.poNum, contactName: c.contactName, contactNumber: c.contactNumber }),
        })
      }
      for (const p of newPoParts) {
        await apiFetch('/api/parts', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ poNum: createdPo.poNum, name: p.name, quantityOrdered: Number(p.quantityOrdered), quantityType: p.quantityType, unitPrice: Number(p.unitPrice), supplierId: Number(p.supplierId), orderDate: p.orderDate || null, status: 'ordered' }),
        })
      }
      setWizardOpen(false); resetWizard()
      notyfSuccess(`Purchase Order ${createdPo.poNum} created.`)
      setRefreshKey(k => k + 1)
    } catch (err) { setNewPoError({ _general: err.message }) }
    finally { setNewPoSubmitting(false) }
  }

  const filterLabel = filterBy === 'parts' ? 'Parts' : filterBy === 'equipment' ? 'Equipment' : 'All'

  // ── Render ────────────────────────────────────────────────────────────────

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
              onClick={srNumFilter ? () => { resetNewPo(); setNewPoOpen(true) } : openWizard}>
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
            value={inputValue} onChange={e => setInputValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') commitSearch() }} />
        </div>
        <button type="button" className="btn btn-secondary shrink-0" onClick={commitSearch}>
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

      {/* Loading */}
      {loading && <div className="flex justify-center py-20"><span className="loading loading-spinner loading-lg text-primary"></span></div>}

      {/* Error */}
      {error && <div className="alert alert-error"><span className="icon-[tabler--alert-circle] size-5"></span><span>{error}</span></div>}

      {/* Table */}
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
                    <th>PO Number</th><th>Purpose</th><th>Total Cost</th><th>SR #</th><th>Added On</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(o => (
                    <tr key={o.poNum}>
                      <td className="font-mono font-semibold text-sm">{o.poNum}</td>
                      <td className="max-w-48"><span className="line-clamp-1 text-sm font-medium" title={o.purpose}>{o.purpose}</span></td>
                      <td className="text-sm font-medium">{formatCurrency(o.totalCost)}</td>
                      <td className="text-sm">
                        {o.srNum ? <span className="badge badge-soft badge-neutral text-xs">SR #{o.srNum}</span> : <span className="text-base-content/40">—</span>}
                      </td>
                      <td className="text-sm">{formatDate(o.addedOn)}</td>
                      <td>
                        <button className="btn btn-soft btn-primary btn-sm" onClick={() => setSelectedOrder(o)}>
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

      {/* ── ManageMenu ───────────────────────────────────────────────────────── */}
      <ManageMenu
        title={selectedOrder ? `PO ${selectedOrder.poNum}` : ''}
        subtitle={selectedOrder ? selectedOrder.purpose : ''}
        item={selectedOrder}
        isOpen={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        hasRole={hasRole}
        menuItems={getPoMenuItems(selectedOrder)}
        onMenuSelect={handleMenuSelect}
        details={selectedOrder ? [
          { label: 'PO Number',       value: selectedOrder.poNum },
          { label: 'Terms',           value: selectedOrder.terms },
          { label: 'Payment Method',  value: selectedOrder.paymentMethod ?? '—' },
          { label: 'Payment Details', value: selectedOrder.paymentDetails ?? '—' },
          { label: 'Total Cost',      value: formatCurrency(selectedOrder.totalCost) },
          { label: 'SR #',            value: selectedOrder.srNum ?? '—' },
          { label: 'Added On',        value: formatDate(selectedOrder.addedOn) },
          { label: 'Delivery Address', value: selectedOrder.deliveryAddress ?? '—', fullWidth: true },
          { label: 'Remarks',          value: selectedOrder.remarks ?? '—', fullWidth: true },
        ] : []}
      />

      {/* ── Update PO modal (z-45/z-50) ──────────────────────────────────────── */}
      {updatePoOpen && updatingPO && (
        <>
          <div className="fixed inset-0 bg-base-300/40 z-[45]" onClick={() => setUpdatePoOpen(false)} />
          <div className="fixed inset-0 z-[50] flex items-center justify-center p-4 overflow-y-auto">
            <div className="modal-content w-full max-w-lg my-auto shadow-xl">
              <div className="modal-header">
                <div><h3 className="modal-title">Update {updatingPO.poNum}</h3><span className="text-sm text-base-content/50">{updatingPO.purpose}</span></div>
                <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={() => setUpdatePoOpen(false)}>
                  <span className="icon-[tabler--x] size-4"></span>
                </button>
              </div>
              <div className="modal-body">
                <form id="inv-po-update-form" onSubmit={handleUpdatePoSubmit}>
                  <POFormFields form={updatePoForm} onChange={e => setUpdatePoForm(p => ({ ...p, [e.target.name]: e.target.value }))} errors={updatePoError} />
                </form>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-soft btn-secondary" onClick={() => setUpdatePoOpen(false)}>Cancel</button>
                <button type="submit" form="inv-po-update-form" className="btn btn-primary" disabled={updatePoSubmitting}>
                  {updatePoSubmitting ? <span className="loading loading-spinner loading-sm"></span> : <span className="icon-[tabler--device-floppy] size-4"></span>}
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Parts sub-panel (z-45/z-50) ──────────────────────────────────────── */}
      {activePanel?.type === 'parts' && (
        <>
          <div className="fixed inset-0 bg-base-300/40 z-[45]" onClick={closePanel} />
          <div className="fixed inset-0 z-[50] flex items-center justify-center p-4 overflow-y-auto">
            <div className="modal-content w-full max-w-2xl my-auto shadow-xl">
              <div className="modal-header">
                <div><h3 className="modal-title">Parts — {activePanel.poNum}</h3><span className="text-sm text-base-content/50">{activePanel.purpose}</span></div>
                <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={closePanel}>
                  <span className="icon-[tabler--x] size-4"></span>
                </button>
              </div>
              <div className="modal-body flex flex-col gap-4">
                <PartsTable parts={parts} loading={partsLoading} onSelectPart={p => { setSelectedPart(p); setLogUsageOpen(false); setEditUsageOpen(false) }} />

                {canEdit && !addPartOpen && (
                  <button type="button" className="btn btn-soft btn-primary btn-sm w-full"
                    onClick={() => { setAddPartOpen(true); setPartForm(EMPTY_PART_FORM); setPartFormError({}); setAddSupplierDisplay('') }}>
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
                            <input type="text" name="name" maxLength={120} required
                              className={`input input-bordered w-full${partFormError.name ? ' is-invalid' : ''}`}
                              value={partForm.name} onChange={e => setPartForm(p => ({ ...p, name: e.target.value }))} />
                            {partFormError.name && <span className="helper-text">{partFormError.name}</span>}
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="label-text font-medium">Qty Ordered <span className="text-error">*</span></label>
                            <input type="number" min={1} required
                              className={`input input-bordered w-full${partFormError.quantityOrdered ? ' is-invalid' : ''}`}
                              value={partForm.quantityOrdered} onChange={e => setPartForm(p => ({ ...p, quantityOrdered: e.target.value }))} />
                            {partFormError.quantityOrdered && <span className="helper-text">{partFormError.quantityOrdered}</span>}
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="label-text font-medium">Qty Type <span className="text-error">*</span></label>
                            <input type="text" maxLength={30} required
                              className={`input input-bordered w-full${partFormError.quantityType ? ' is-invalid' : ''}`}
                              placeholder="e.g. pcs, kg, m"
                              value={partForm.quantityType} onChange={e => setPartForm(p => ({ ...p, quantityType: e.target.value }))} />
                            {partFormError.quantityType && <span className="helper-text">{partFormError.quantityType}</span>}
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="label-text font-medium">Unit Price <span className="text-error">*</span></label>
                            <input type="number" min={0} step="0.01" required
                              className={`input input-bordered w-full${partFormError.unitPrice ? ' is-invalid' : ''}`}
                              value={partForm.unitPrice} onChange={e => setPartForm(p => ({ ...p, unitPrice: e.target.value }))} />
                            {partFormError.unitPrice && <span className="helper-text">{partFormError.unitPrice}</span>}
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="label-text font-medium">Status <span className="text-error">*</span></label>
                            <select className="select select-bordered w-full" value={partForm.status}
                              onChange={e => setPartForm(p => ({ ...p, status: e.target.value }))}>
                              {['ordered','received','cancelled','used'].map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="label-text font-medium">Supplier <span className="text-error">*</span></label>
                            <div className="flex gap-2">
                              <input type="text" readOnly className={`input input-bordered flex-1${partFormError.supplierId ? ' is-invalid' : ''}`}
                                placeholder="Select supplier…" value={addSupplierDisplay} />
                              <button type="button" className="btn btn-soft btn-secondary shrink-0" onClick={() => setSupplierPickerFor('add')}>Pick</button>
                            </div>
                            {partFormError.supplierId && <span className="helper-text">{partFormError.supplierId}</span>}
                          </div>
                          {partFormError._general && (
                            <div className="sm:col-span-2 alert alert-error py-2">
                              <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                              <span className="text-sm">{partFormError._general}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2 justify-end mt-3">
                          <button type="button" className="btn btn-soft btn-secondary btn-sm"
                            onClick={() => { setAddPartOpen(false); setPartForm(EMPTY_PART_FORM); setPartFormError({}); setAddSupplierDisplay('') }}>Cancel</button>
                          <button type="submit" className="btn btn-primary btn-sm" disabled={partFormSubmitting}>
                            {partFormSubmitting ? <span className="loading loading-spinner loading-xs"></span> : <span className="icon-[tabler--plus] size-4"></span>}
                            Add Part
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Part detail sub-modal (z-55/z-60) */}
          {selectedPart && (
            <>
              <div className="fixed inset-0 bg-base-300/40 z-[55]" onClick={() => { setSelectedPart(null); setLogUsageOpen(false); setEditUsageOpen(false) }} />
              <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 overflow-y-auto">
                <div className="modal-content w-full max-w-xl my-auto">
                  <div className="modal-header">
                    <div><h3 className="modal-title">Part #{selectedPart.partId}</h3><span className="text-sm text-base-content/50">{selectedPart.name}</span></div>
                    <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3"
                      onClick={() => { setSelectedPart(null); setLogUsageOpen(false); setEditUsageOpen(false) }}>
                      <span className="icon-[tabler--x] size-4"></span>
                    </button>
                  </div>
                  <div className="modal-body flex flex-col gap-5">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
                      <PartDetailField label="Part ID"><span className="font-mono">{selectedPart.partId}</span></PartDetailField>
                      <PartDetailField label="Status"><span className={`badge badge-soft ${partStatusBadge(selectedPart.status)} text-xs`}>{selectedPart.status}</span></PartDetailField>
                      <PartDetailField label="PO Number"><span className="font-mono">{selectedPart.poNum}</span></PartDetailField>
                      <div className="col-span-2 sm:col-span-3 flex flex-col gap-0.5">
                        <span className="text-xs text-base-content/50 uppercase tracking-wide">Name</span>
                        <span className="text-sm font-medium">{selectedPart.name}</span>
                      </div>
                      <PartDetailField label="Ordered">{selectedPart.quantityOrdered} {selectedPart.quantityType}</PartDetailField>
                      <PartDetailField label="Available">
                        <span className={computedAvailableQty === 0 ? 'text-error font-semibold' : 'text-success font-semibold'}>
                          {partUsageLoading ? '…' : computedAvailableQty} {selectedPart.quantityType}
                        </span>
                      </PartDetailField>
                      <PartDetailField label="Unit Price">{formatCurrency(selectedPart.unitPrice)}</PartDetailField>
                      <PartDetailField label="Subtotal">{formatCurrency(Number(selectedPart.quantityOrdered) * Number(selectedPart.unitPrice ?? 0))}</PartDetailField>
                      <PartDetailField label="Supplier">({selectedPart.supplierId}) {selectedPart.supplierName ?? '—'}</PartDetailField>
                      <PartDetailField label="Order Date">{formatDate(selectedPart.orderDate)}</PartDetailField>
                    </div>
                    <div className="divider my-0"></div>
                    <div className="flex flex-col gap-2">
                      <span className="text-xs text-base-content/50 uppercase tracking-wide">Usage History</span>
                      {partUsageLoading ? (
                        <div className="flex justify-center py-4"><span className="loading loading-spinner loading-sm text-primary"></span></div>
                      ) : partUsageHistory.length === 0 ? (
                        <div className="text-center py-4 text-base-content/40 text-sm">No usage recorded.</div>
                      ) : (
                        <div className="overflow-x-auto rounded-box border border-base-300">
                          <table className="table table-zebra table-sm w-full">
                            <thead><tr><th>ID</th><th>SR #</th><th>Qty Used</th><th>Used On</th>{canEdit && <th></th>}</tr></thead>
                            <tbody>
                              {partUsageHistory.map(u => (
                                <tr key={u.usageId}>
                                  <td className="font-mono text-xs">{u.usageId}</td>
                                  <td className="text-sm">{u.srNumber ?? '—'}</td>
                                  <td className="text-sm">{u.qtyUsed} {selectedPart.quantityType}</td>
                                  <td className="text-sm">{formatDate(u.usedOn)}</td>
                                  {canEdit && (
                                    <td><button className="btn btn-soft btn-secondary btn-xs"
                                      onClick={() => { setEditingUsage(u); setEditUsageForm({ srNumber: u.srNumber ?? '', qtyUsed: u.qtyUsed, notes: u.notes ?? '' }); setEditUsageError({}); setEditUsageOpen(true) }}>
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
                            <button type="button" className="group w-full"
                              onClick={() => { openUpdatePart(selectedPart); setSelectedPart(null) }}>
                              <div className="card bg-base-100 border border-base-300 h-full transition-transform duration-300 group-hover:-translate-y-2">
                                <div className="card-body items-center justify-center text-center gap-2 py-5 px-3">
                                  <span className="icon-[tabler--pencil] size-8 text-primary"></span>
                                  <p className="text-xs font-medium leading-tight">Update Details</p>
                                </div>
                              </div>
                            </button>
                            <button type="button"
                              className={`group w-full${computedAvailableQty === 0 ? ' cursor-not-allowed opacity-40' : ''}`}
                              disabled={computedAvailableQty === 0}
                              title={computedAvailableQty === 0 ? 'No stock available' : undefined}
                              onClick={() => computedAvailableQty > 0 && (setLogUsageForm({ srNumber: '', qtyUsed: '', notes: '' }), setLogUsageError({}), setLogUsageOpen(true))}>
                              <div className={`card bg-base-100 border border-base-300 h-full${computedAvailableQty > 0 ? ' transition-transform duration-300 group-hover:-translate-y-2' : ''}`}>
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
              </div>

              {/* Update part (z-65/z-70) */}
              {updatePartOpen && updatingPart && (
                <>
                  <div className="fixed inset-0 bg-base-300/40 z-[65]" onClick={() => { setUpdatePartOpen(false); setUpdatingPart(null) }} />
                  <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 overflow-y-auto">
                    <div className="modal-content w-full max-w-md my-auto shadow-xl">
                      <div className="modal-header">
                        <h3 className="modal-title">Update Part #{updatingPart.partId}</h3>
                        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={() => { setUpdatePartOpen(false); setUpdatingPart(null) }}>
                          <span className="icon-[tabler--x] size-4"></span>
                        </button>
                      </div>
                      <div className="modal-body">
                        <form id="inv-update-part-form" onSubmit={handleUpdatePartSubmit}>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="sm:col-span-2 flex flex-col gap-1">
                              <label className="label-text font-medium">Name <span className="text-error">*</span></label>
                              <input type="text" maxLength={120} required
                                className={`input input-bordered w-full${updatePartError.name ? ' is-invalid' : ''}`}
                                value={updatePartForm.name} onChange={e => setUpdatePartForm(p => ({ ...p, name: e.target.value }))} />
                              {updatePartError.name && <span className="helper-text">{updatePartError.name}</span>}
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="label-text font-medium">Qty Ordered <span className="text-error">*</span></label>
                              <input type="number" min={1} required
                                className={`input input-bordered w-full${updatePartError.quantityOrdered ? ' is-invalid' : ''}`}
                                value={updatePartForm.quantityOrdered} onChange={e => setUpdatePartForm(p => ({ ...p, quantityOrdered: e.target.value }))} />
                              {updatePartError.quantityOrdered && <span className="helper-text">{updatePartError.quantityOrdered}</span>}
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="label-text font-medium">Qty Type <span className="text-error">*</span></label>
                              <input type="text" maxLength={30} required
                                className={`input input-bordered w-full${updatePartError.quantityType ? ' is-invalid' : ''}`}
                                value={updatePartForm.quantityType} onChange={e => setUpdatePartForm(p => ({ ...p, quantityType: e.target.value }))} />
                              {updatePartError.quantityType && <span className="helper-text">{updatePartError.quantityType}</span>}
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="label-text font-medium">Unit Price <span className="text-error">*</span></label>
                              <input type="number" min={0} step="0.01" required
                                className={`input input-bordered w-full${updatePartError.unitPrice ? ' is-invalid' : ''}`}
                                value={updatePartForm.unitPrice} onChange={e => setUpdatePartForm(p => ({ ...p, unitPrice: e.target.value }))} />
                              {updatePartError.unitPrice && <span className="helper-text">{updatePartError.unitPrice}</span>}
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="label-text font-medium">Status <span className="text-error">*</span></label>
                              <select className="select select-bordered w-full" value={updatePartForm.status}
                                onChange={e => setUpdatePartForm(p => ({ ...p, status: e.target.value }))}>
                                {['ordered','received','cancelled','used'].map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="label-text font-medium">Supplier <span className="text-error">*</span></label>
                              <div className="flex gap-2">
                                <input type="text" readOnly className={`input input-bordered flex-1${updatePartError.supplierId ? ' is-invalid' : ''}`}
                                  placeholder="Select supplier…" value={updateSupplierDisplay} />
                                <button type="button" className="btn btn-soft btn-secondary shrink-0" onClick={() => setSupplierPickerFor('update')}>Pick</button>
                              </div>
                              {updatePartError.supplierId && <span className="helper-text">{updatePartError.supplierId}</span>}
                            </div>
                            {updatePartError._general && (
                              <div className="sm:col-span-2 alert alert-error py-2">
                                <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                                <span className="text-sm">{updatePartError._general}</span>
                              </div>
                            )}
                          </div>
                        </form>
                      </div>
                      <div className="modal-footer">
                        <button type="button" className="btn btn-soft btn-secondary" onClick={() => { setUpdatePartOpen(false); setUpdatingPart(null) }}>Cancel</button>
                        <button type="submit" form="inv-update-part-form" className="btn btn-primary" disabled={updatePartSubmitting}>
                          {updatePartSubmitting ? <span className="loading loading-spinner loading-sm"></span> : <span className="icon-[tabler--device-floppy] size-4"></span>}
                          Save Changes
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Log usage (z-65/z-70) */}
              {logUsageOpen && (
                <>
                  <div className="fixed inset-0 bg-base-300/40 z-[65]" onClick={() => setLogUsageOpen(false)} />
                  <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                    <div className="modal-content w-full max-w-sm shadow-xl">
                      <div className="modal-header">
                        <div><h3 className="modal-title">Log Usage — Part #{selectedPart.partId}</h3><span className="text-sm text-base-content/50">{selectedPart.name}</span></div>
                        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={() => setLogUsageOpen(false)}>
                          <span className="icon-[tabler--x] size-4"></span>
                        </button>
                      </div>
                      <div className="modal-body">
                        <form id="inv-log-usage-form" onSubmit={handleLogUsageSubmit}>
                          <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-1">
                              <label className="label-text font-medium">SR # <span className="text-base-content/50 font-normal">(optional)</span></label>
                              <input type="number" min={1}
                                className={`input input-bordered w-full${logUsageError.srNumber ? ' is-invalid' : ''}`}
                                placeholder="Leave blank if not tied to an SR"
                                value={logUsageForm.srNumber} onChange={e => setLogUsageForm(p => ({ ...p, srNumber: e.target.value }))} />
                              {logUsageError.srNumber && <span className="helper-text">{logUsageError.srNumber}</span>}
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="label-text font-medium">Qty Used <span className="text-error">*</span></label>
                              <input type="number" min={1} max={computedAvailableQty} required
                                className={`input input-bordered w-full${logUsageError.qtyUsed ? ' is-invalid' : ''}`}
                                value={logUsageForm.qtyUsed} onChange={e => setLogUsageForm(p => ({ ...p, qtyUsed: e.target.value }))} />
                              {logUsageError.qtyUsed ? <span className="helper-text">{logUsageError.qtyUsed}</span>
                                : <span className="text-xs text-base-content/40">Max: {computedAvailableQty} {selectedPart.quantityType}</span>}
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="label-text font-medium">Notes</label>
                              <input type="text" maxLength={255}
                                className="input input-bordered w-full"
                                value={logUsageForm.notes} onChange={e => setLogUsageForm(p => ({ ...p, notes: e.target.value }))} />
                            </div>
                            {logUsageError._general && (
                              <div className="alert alert-error py-2"><span className="icon-[tabler--alert-circle] size-4 shrink-0"></span><span className="text-sm">{logUsageError._general}</span></div>
                            )}
                          </div>
                        </form>
                      </div>
                      <div className="modal-footer">
                        <button type="button" className="btn btn-soft btn-secondary" onClick={() => setLogUsageOpen(false)}>Cancel</button>
                        <button type="submit" form="inv-log-usage-form" className="btn btn-primary" disabled={logUsageSubmitting}>
                          {logUsageSubmitting ? <span className="loading loading-spinner loading-sm"></span> : <span className="icon-[tabler--tool] size-4"></span>}
                          Log Usage
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Edit usage (z-65/z-70) */}
              {editUsageOpen && editingUsage && (
                <>
                  <div className="fixed inset-0 bg-base-300/40 z-[65]" onClick={() => setEditUsageOpen(false)} />
                  <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                    <div className="modal-content w-full max-w-sm shadow-xl">
                      <div className="modal-header">
                        <h3 className="modal-title">Edit Usage #{editingUsage.usageId}</h3>
                        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={() => setEditUsageOpen(false)}>
                          <span className="icon-[tabler--x] size-4"></span>
                        </button>
                      </div>
                      <div className="modal-body">
                        <form id="inv-edit-usage-form" onSubmit={handleEditUsageSubmit}>
                          <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-1">
                              <label className="label-text font-medium">SR #</label>
                              <input type="number" min={1}
                                className={`input input-bordered w-full${editUsageError.srNumber ? ' is-invalid' : ''}`}
                                value={editUsageForm.srNumber} onChange={e => setEditUsageForm(p => ({ ...p, srNumber: e.target.value }))} />
                              {editUsageError.srNumber && <span className="helper-text">{editUsageError.srNumber}</span>}
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="label-text font-medium">Qty Used <span className="text-error">*</span></label>
                              <input type="number" min={1} required
                                className={`input input-bordered w-full${editUsageError.qtyUsed ? ' is-invalid' : ''}`}
                                value={editUsageForm.qtyUsed} onChange={e => setEditUsageForm(p => ({ ...p, qtyUsed: e.target.value }))} />
                              {editUsageError.qtyUsed && <span className="helper-text">{editUsageError.qtyUsed}</span>}
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="label-text font-medium">Notes</label>
                              <input type="text" maxLength={255}
                                className="input input-bordered w-full"
                                value={editUsageForm.notes} onChange={e => setEditUsageForm(p => ({ ...p, notes: e.target.value }))} />
                            </div>
                            {editUsageError._general && (
                              <div className="alert alert-error py-2"><span className="icon-[tabler--alert-circle] size-4 shrink-0"></span><span className="text-sm">{editUsageError._general}</span></div>
                            )}
                          </div>
                        </form>
                      </div>
                      <div className="modal-footer">
                        <button type="button" className="btn btn-soft btn-secondary" onClick={() => setEditUsageOpen(false)}>Cancel</button>
                        <button type="submit" form="inv-edit-usage-form" className="btn btn-primary" disabled={editUsageSubmitting}>
                          {editUsageSubmitting ? <span className="loading loading-spinner loading-sm"></span> : <span className="icon-[tabler--device-floppy] size-4"></span>}
                          Save
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}

      {/* ── Equipment sub-panel (z-45/z-50) ──────────────────────────────────── */}
      {activePanel?.type === 'equipment' && (
        <>
          <div className="fixed inset-0 bg-base-300/40 z-[45]" onClick={closePanel} />
          <div className="fixed inset-0 z-[50] flex items-center justify-center p-4 overflow-y-auto">
            <div className="modal-content w-full max-w-2xl my-auto shadow-xl">
              <div className="modal-header">
                <div><h3 className="modal-title">Equipment — {activePanel.poNum}</h3><span className="text-sm text-base-content/50">{activePanel.purpose}</span></div>
                <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={closePanel}>
                  <span className="icon-[tabler--x] size-4"></span>
                </button>
              </div>
              <div className="modal-body flex flex-col gap-4">
                {equipLoading ? (
                  <div className="flex justify-center py-10"><span className="loading loading-spinner loading-lg text-primary"></span></div>
                ) : equipList.length === 0 ? (
                  <div className="text-center py-10 text-base-content/40">
                    <span className="icon-[tabler--tool-off] size-10 mx-auto mb-2 block"></span>
                    <p>No equipment linked to this purchase order.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-box border border-base-300">
                    <table className="table table-zebra table-sm w-full">
                      <thead><tr><th>ID</th><th>Name</th><th>Type</th><th>Stock</th><th>Status</th>{canEdit && <th></th>}</tr></thead>
                      <tbody>
                        {equipList.map(eq => (
                          <tr key={eq.equipmentId}>
                            <td className="font-mono text-xs">{eq.equipmentId}</td>
                            <td className="text-sm font-medium max-w-40"><span className="line-clamp-1" title={eq.name}>{eq.name}</span></td>
                            <td><span className={`badge badge-soft ${eq.type === 'durable' ? 'badge-info' : 'badge-warning'} text-xs`}>{eq.type}</span></td>
                            <td className="text-sm">{eq.stock}</td>
                            <td><span className={`badge badge-soft ${eq.status === 'active' ? 'badge-success' : eq.status === 'under_maintenance' ? 'badge-warning' : eq.status === 'retired' ? 'badge-neutral' : 'badge-error'} text-xs`}>{eq.status}</span></td>
                            {canEdit && (
                              <td>
                                <button className="btn btn-soft btn-secondary btn-xs"
                                  onClick={() => { setEditingEquip(eq); setEditEquipForm({ name: eq.name, type: eq.type, model: eq.model ?? '', serialNumber: eq.serialNumber ?? '', description: eq.description ?? '', stock: String(eq.stock), acquisitionCost: eq.acquisitionCost ?? '', status: eq.status }); setEditEquipError({}); setEditEquipOpen(true) }}>
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

                {canEdit && !addEquipOpen && (
                  <button type="button" className="btn btn-soft btn-primary btn-sm w-full"
                    onClick={() => { setAddEquipOpen(true); setAddEquipForm(EMPTY_EQUIP_FORM); setAddEquipError({}) }}>
                    <span className="icon-[tabler--plus] size-4"></span>Add Equipment
                  </button>
                )}

                {addEquipOpen && (
                  <div className="card border border-base-300 bg-base-200/40">
                    <div className="card-body gap-3">
                      <p className="text-xs font-semibold text-base-content/50 uppercase tracking-wide">New Equipment</p>
                      <form id="inv-add-equip-form" onSubmit={handleAddEquipSubmit}>
                        <EquipFormFields form={addEquipForm} onChange={e => setAddEquipForm(p => ({ ...p, [e.target.name]: e.target.value }))} errors={addEquipError} showStatus={false} />
                        <div className="flex gap-2 justify-end mt-3">
                          <button type="button" className="btn btn-soft btn-secondary btn-sm"
                            onClick={() => { setAddEquipOpen(false); setAddEquipForm(EMPTY_EQUIP_FORM); setAddEquipError({}) }}>Cancel</button>
                          <button type="submit" className="btn btn-primary btn-sm" disabled={addEquipSubmitting}>
                            {addEquipSubmitting ? <span className="loading loading-spinner loading-xs"></span> : <span className="icon-[tabler--plus] size-4"></span>}
                            Add
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Edit equipment modal (z-55/z-60) */}
          {editEquipOpen && editingEquip && (
            <>
              <div className="fixed inset-0 bg-base-300/40 z-[55]" onClick={() => { setEditEquipOpen(false); setEditingEquip(null) }} />
              <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 overflow-y-auto">
                <div className="modal-content w-full max-w-lg my-auto shadow-xl">
                  <div className="modal-header">
                    <div><h3 className="modal-title">Edit Equipment #{editingEquip.equipmentId}</h3><span className="text-sm text-base-content/50">{editingEquip.name}</span></div>
                    <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={() => { setEditEquipOpen(false); setEditingEquip(null) }}>
                      <span className="icon-[tabler--x] size-4"></span>
                    </button>
                  </div>
                  <div className="modal-body">
                    <form id="inv-edit-equip-form" onSubmit={handleEditEquipSubmit}>
                      <EquipFormFields form={editEquipForm} onChange={e => setEditEquipForm(p => ({ ...p, [e.target.name]: e.target.value }))} errors={editEquipError} showStatus={true} />
                    </form>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-soft btn-secondary" onClick={() => { setEditEquipOpen(false); setEditingEquip(null) }}>Cancel</button>
                    <button type="submit" form="inv-edit-equip-form" className="btn btn-primary" disabled={editEquipSubmitting}>
                      {editEquipSubmitting ? <span className="loading loading-spinner loading-sm"></span> : <span className="icon-[tabler--device-floppy] size-4"></span>}
                      Save Changes
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ── Contacts sub-panel (z-45/z-50) ───────────────────────────────────── */}
      {activePanel?.type === 'contacts' && (
        <>
          <div className="fixed inset-0 bg-base-300/40 z-[45]" onClick={closePanel} />
          <div className="fixed inset-0 z-[50] flex items-center justify-center p-4 overflow-y-auto">
            <div className="modal-content w-full max-w-lg my-auto shadow-xl">
              <div className="modal-header">
                <div><h3 className="modal-title">Delivery Contacts — {activePanel.poNum}</h3><span className="text-sm text-base-content/50">{activePanel.purpose}</span></div>
                <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={closePanel}>
                  <span className="icon-[tabler--x] size-4"></span>
                </button>
              </div>
              <div className="modal-body flex flex-col gap-4">
                {contactsLoading ? (
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
                                  <button className="btn btn-soft btn-secondary btn-xs"
                                    onClick={() => { setUpdatingContact(c); setUpdateContactForm({ contactName: c.contactName, contactNumber: c.contactNumber }); setUpdateContactError({}); setUpdateContactOpen(true) }}>
                                    <span className="icon-[tabler--pencil] size-3"></span>Edit
                                  </button>
                                  <button className="btn btn-soft btn-error btn-xs" disabled={deletingContactId === c.poContactNum}
                                    onClick={() => handleDeleteContact(c.poContactNum)}>
                                    {deletingContactId === c.poContactNum ? <span className="loading loading-spinner loading-xs"></span> : <span className="icon-[tabler--x] size-3"></span>}
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {canEdit && !addContactOpen && (
                  <button type="button" className="btn btn-soft btn-primary btn-sm w-full"
                    onClick={() => { setAddContactOpen(true); setContactForm(EMPTY_CONTACT_FORM); setContactFormError({}) }}>
                    <span className="icon-[tabler--plus] size-4"></span>Add Contact
                  </button>
                )}

                {addContactOpen && (
                  <div className="card border border-base-300 bg-base-200/40">
                    <div className="card-body gap-3">
                      <p className="text-xs font-semibold text-base-content/50 uppercase tracking-wide">New Contact</p>
                      <form id="inv-add-contact-form" onSubmit={handleAddContactSubmit}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="flex flex-col gap-1">
                            <label className="label-text font-medium">Name <span className="text-error">*</span></label>
                            <input type="text" maxLength={120} required
                              className={`input input-bordered w-full${contactFormError.contactName ? ' is-invalid' : ''}`}
                              value={contactForm.contactName} onChange={e => setContactForm(p => ({ ...p, contactName: e.target.value }))} />
                            {contactFormError.contactName && <span className="helper-text">{contactFormError.contactName}</span>}
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="label-text font-medium">Number <span className="text-error">*</span></label>
                            <input type="text" maxLength={30} required
                              className={`input input-bordered w-full${contactFormError.contactNumber ? ' is-invalid' : ''}`}
                              value={contactForm.contactNumber} onChange={e => setContactForm(p => ({ ...p, contactNumber: e.target.value }))} />
                            {contactFormError.contactNumber && <span className="helper-text">{contactFormError.contactNumber}</span>}
                          </div>
                          {contactFormError._general && (
                            <div className="sm:col-span-2 alert alert-error py-2">
                              <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                              <span className="text-sm">{contactFormError._general}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2 justify-end mt-3">
                          <button type="button" className="btn btn-soft btn-secondary btn-sm"
                            onClick={() => { setAddContactOpen(false); setContactForm(EMPTY_CONTACT_FORM); setContactFormError({}) }}>Cancel</button>
                          <button type="submit" className="btn btn-primary btn-sm" disabled={contactFormSubmitting}>
                            {contactFormSubmitting ? <span className="loading loading-spinner loading-xs"></span> : <span className="icon-[tabler--plus] size-4"></span>}
                            Add
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Update contact (z-55/z-60) */}
          {updateContactOpen && updatingContact && (
            <>
              <div className="fixed inset-0 bg-base-300/40 z-[55]" onClick={() => { setUpdateContactOpen(false); setUpdatingContact(null) }} />
              <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                <div className="modal-content w-full max-w-sm shadow-xl">
                  <div className="modal-header">
                    <h3 className="modal-title">Edit Contact #{updatingContact.poContactNum}</h3>
                    <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={() => { setUpdateContactOpen(false); setUpdatingContact(null) }}>
                      <span className="icon-[tabler--x] size-4"></span>
                    </button>
                  </div>
                  <div className="modal-body">
                    <form id="inv-update-contact-form" onSubmit={handleUpdateContactSubmit}>
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1">
                          <label className="label-text font-medium">Name <span className="text-error">*</span></label>
                          <input type="text" maxLength={120} required
                            className={`input input-bordered w-full${updateContactError.contactName ? ' is-invalid' : ''}`}
                            value={updateContactForm.contactName} onChange={e => setUpdateContactForm(p => ({ ...p, contactName: e.target.value }))} />
                          {updateContactError.contactName && <span className="helper-text">{updateContactError.contactName}</span>}
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="label-text font-medium">Number <span className="text-error">*</span></label>
                          <input type="text" maxLength={30} required
                            className={`input input-bordered w-full${updateContactError.contactNumber ? ' is-invalid' : ''}`}
                            value={updateContactForm.contactNumber} onChange={e => setUpdateContactForm(p => ({ ...p, contactNumber: e.target.value }))} />
                          {updateContactError.contactNumber && <span className="helper-text">{updateContactError.contactNumber}</span>}
                        </div>
                        {updateContactError._general && (
                          <div className="alert alert-error py-2"><span className="icon-[tabler--alert-circle] size-4 shrink-0"></span><span className="text-sm">{updateContactError._general}</span></div>
                        )}
                      </div>
                    </form>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-soft btn-secondary" onClick={() => { setUpdateContactOpen(false); setUpdatingContact(null) }}>Cancel</button>
                    <button type="submit" form="inv-update-contact-form" className="btn btn-primary" disabled={updateContactSubmitting}>
                      {updateContactSubmitting ? <span className="loading loading-spinner loading-sm"></span> : <span className="icon-[tabler--device-floppy] size-4"></span>}
                      Save
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ── New PO modal (SR context) (z-40/z-45) ────────────────────────────── */}
      {newPoOpen && (
        <>
          <div className="fixed inset-0 bg-base-300/40 z-[40]" onClick={() => { setNewPoOpen(false); resetNewPo() }} />
          <div className="fixed inset-0 z-[45] flex items-center justify-center p-4 overflow-y-auto">
            <div className="modal-content w-full max-w-2xl my-auto shadow-xl">
              <div className="modal-header">
                <div>
                  <h3 className="modal-title">New Purchase Order</h3>
                  <span className="text-sm text-base-content/50">Linked to SR #{srNumFilter}</span>
                </div>
                <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3"
                  onClick={() => { setNewPoOpen(false); resetNewPo() }}>
                  <span className="icon-[tabler--x] size-4"></span>
                </button>
              </div>
              <div className="modal-body flex flex-col gap-5">
                <form id="inv-new-po-form" onSubmit={handleNewPoSubmit}>
                  <POFormFields form={newPoForm} onChange={e => setNewPoForm(p => ({ ...p, [e.target.name]: e.target.value }))} errors={newPoError} />
                </form>

                {/* Delivery Contacts */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Delivery Contacts</span>
                    <button type="button" className="btn btn-soft btn-accent btn-sm"
                      onClick={() => { setNewPoContactForm(EMPTY_CONTACT_FORM); setNewPoContactError({}); setNewPoContactModalOpen(true) }}>
                      <span className="icon-[tabler--address-book] size-4"></span>Add Contact
                    </button>
                  </div>
                  {newPoContacts.length === 0 ? (
                    <p className="text-sm text-base-content/40">No delivery contacts added yet.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-box border border-base-300">
                      <table className="table table-sm">
                        <thead><tr><th>#</th><th>Name</th><th>Number</th><th></th></tr></thead>
                        <tbody>
                          {newPoContacts.map((c, i) => (
                            <tr key={c._tempId}>
                              <td className="text-base-content/40 font-mono">{i + 1}</td>
                              <td>{c.contactName}</td>
                              <td>{c.contactNumber}</td>
                              <td className="text-end">
                                <button type="button" className="btn btn-error btn-xs btn-square"
                                  onClick={() => setNewPoContacts(l => l.filter(x => x._tempId !== c._tempId))}>
                                  <span className="icon-[tabler--x] size-3.5"></span>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Parts */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Parts</span>
                    <button type="button" className="btn btn-soft btn-accent btn-sm"
                      onClick={() => { setNewPoPartForm(EMPTY_NEW_PO_PART_FORM); setNewPoPartError({}); setNewPoPartModalOpen(true) }}>
                      <span className="icon-[tabler--package] size-4"></span>Add Part
                    </button>
                  </div>
                  {newPoParts.length === 0 ? (
                    <p className="text-sm text-base-content/40">No parts added yet.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-box border border-base-300">
                      <table className="table table-sm">
                        <thead><tr><th>#</th><th>Name</th><th>Qty</th><th>Unit Price</th><th>Supplier</th><th></th></tr></thead>
                        <tbody>
                          {newPoParts.map((p, i) => (
                            <tr key={p._tempId}>
                              <td className="text-base-content/40 font-mono">{i + 1}</td>
                              <td>{p.name}</td>
                              <td>{p.quantityOrdered} {p.quantityType}</td>
                              <td>₱{Number(p.unitPrice).toFixed(2)}</td>
                              <td>{p._supplierName}</td>
                              <td className="text-end">
                                <button type="button" className="btn btn-error btn-xs btn-square"
                                  onClick={() => setNewPoParts(l => l.filter(x => x._tempId !== p._tempId))}>
                                  <span className="icon-[tabler--x] size-3.5"></span>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-soft btn-secondary" onClick={() => { setNewPoOpen(false); resetNewPo() }}>Cancel</button>
                <button type="submit" form="inv-new-po-form" className="btn btn-primary" disabled={newPoSubmitting}>
                  {newPoSubmitting ? <span className="loading loading-spinner loading-sm"></span> : <span className="icon-[tabler--plus] size-4"></span>}
                  Create Purchase Order
                </button>
              </div>
            </div>
          </div>

        </>
      )}

      {/* ── New PO wizard (base page) (z-40/z-45) ────────────────────────────── */}
      {wizardOpen && (
        <>
          <div className="fixed inset-0 bg-base-300/40 z-[40]" onClick={() => { setWizardOpen(false); resetWizard() }} />
          <div className="fixed inset-0 z-[45] flex items-center justify-center p-4 overflow-y-auto">
            <div className="modal-content w-full max-w-2xl my-auto shadow-xl">
              <div className="modal-header">
                <h3 className="modal-title">New Purchase Order</h3>
                <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3"
                  onClick={() => { setWizardOpen(false); resetWizard() }}>
                  <span className="icon-[tabler--x] size-4"></span>
                </button>
              </div>

              <div className="modal-body flex flex-col gap-4">
                {/* Progress bar */}
                <div className="flex items-center gap-x-1">
                  {[1,2,3,4].map(n => (
                    <div key={n}
                      className={`progress-step transition-colors ${wizardStep >= n ? 'bg-primary' : 'bg-primary/10'}`}
                      role="progressbar"
                      aria-valuenow={wizardStep >= n ? 100 : 0}
                      aria-valuemin="0"
                      aria-valuemax="100"
                    />
                  ))}
                  <p className="text-xs text-primary ms-1 font-medium">{wizardStep}/4</p>
                </div>

                <p className="text-xs font-semibold text-base-content/40 uppercase tracking-wide -mb-2">
                  {wizardStep === 1 && 'Step 1 — Choose Type'}
                  {wizardStep === 2 && wizardType === 'equipment' && 'Step 2 — Purchase Order Details'}
                  {wizardStep === 2 && wizardType !== 'equipment' && 'Step 2 — Select Project'}
                  {wizardStep === 3 && wizardType === 'equipment' && 'Step 3 — Equipment Items'}
                  {wizardStep === 3 && wizardType !== 'equipment' && 'Step 3 — Select Service Report'}
                  {wizardStep === 4 && wizardType === 'equipment' && 'Step 4 — PO Documents (optional)'}
                  {wizardStep === 4 && wizardType !== 'equipment' && `Step 4 — PO Details — SR #${wizardSR?.srNumber}`}
                </p>

                {/* ── Step 1: Choose type ── */}
                {wizardStep === 1 && (
                  <div className="grid grid-cols-2 gap-4">
                    <button type="button" onClick={() => { setWizardType('sr'); setWizardStep(2) }}>
                      <div className="card bg-base-100 border-2 border-base-300 hover:border-primary transition-colors h-full">
                        <div className="card-body items-center justify-center text-center gap-3 py-8 px-4">
                          <span className="icon-[tabler--report] size-12 text-primary"></span>
                          <div>
                            <p className="font-semibold">For Service Report</p>
                            <p className="text-xs text-base-content/50 mt-1">Link PO to an existing SR and add parts</p>
                          </div>
                        </div>
                      </div>
                    </button>
                    <button type="button" onClick={() => { setWizardType('equipment'); setWizardStep(2) }}>
                      <div className="card bg-base-100 border-2 border-base-300 hover:border-primary transition-colors h-full">
                        <div className="card-body items-center justify-center text-center gap-3 py-8 px-4">
                          <span className="icon-[tabler--tool] size-12 text-primary"></span>
                          <div>
                            <p className="font-semibold">For Equipment</p>
                            <p className="text-xs text-base-content/50 mt-1">Create an equipment purchase order</p>
                          </div>
                        </div>
                      </div>
                    </button>
                  </div>
                )}

                {/* ── Step 2 (SR): Select project ── */}
                {wizardStep === 2 && wizardType === 'sr' && (
                  <div className="flex flex-col gap-3">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <span className="icon-[tabler--search] size-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none"></span>
                        <input type="text" className="input input-bordered w-full pl-9" placeholder="Search by name or project #..."
                          value={wizardProjInput}
                          onChange={e => setWizardProjInput(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') { setWizardProjPage(0); setWizardProjSearch(wizardProjInput) } }} />
                      </div>
                      <button type="button" className="btn btn-soft btn-secondary shrink-0"
                        onClick={() => { setWizardProjPage(0); setWizardProjSearch(wizardProjInput) }}>
                        <span className="icon-[tabler--search] size-4"></span>Search
                      </button>
                    </div>
                    {wizardProjLoading ? (
                      <div className="flex justify-center py-8"><span className="loading loading-spinner loading-md text-primary"></span></div>
                    ) : wizardProjects.length === 0 ? (
                      <p className="text-center py-8 text-base-content/40 text-sm">No projects found.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
                        {wizardProjects.map(proj => (
                          <div key={proj.projNum} className="card bg-base-100 border border-base-300">
                            <div className="card-body py-3 px-4">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm line-clamp-1">{proj.name}</p>
                                  <p className="text-xs text-base-content/50">#{proj.projNum} · {proj.type}</p>
                                  <p className="text-xs text-base-content/60 line-clamp-1 mt-0.5">{proj.address}</p>
                                </div>
                                <button type="button" className="btn btn-primary btn-sm shrink-0"
                                  onClick={() => { setWizardProject(proj); setWizardSRPage(0); setWizardSRs([]); setWizardStep(3) }}>
                                  Select
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {wizardProjTotal > 1 && (
                      <div className="flex items-center justify-center gap-2">
                        <button className="btn btn-sm btn-secondary" disabled={wizardProjPage === 0}
                          onClick={() => setWizardProjPage(p => p - 1)}>
                          <span className="icon-[tabler--chevron-left] size-4"></span>Prev
                        </button>
                        <span className="text-sm text-base-content/60">Page {wizardProjPage + 1} of {wizardProjTotal}</span>
                        <button className="btn btn-sm btn-secondary" disabled={wizardProjPage >= wizardProjTotal - 1}
                          onClick={() => setWizardProjPage(p => p + 1)}>
                          Next<span className="icon-[tabler--chevron-right] size-4"></span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Step 3 (SR): Select service report ── */}
                {wizardStep === 3 && wizardType === 'sr' && (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-sm text-base-content/60 bg-base-200 rounded-lg px-3 py-2">
                      <span className="icon-[tabler--building] size-4 shrink-0"></span>
                      <span>Project: <span className="font-medium">{wizardProject?.name}</span></span>
                    </div>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <span className="icon-[tabler--search] size-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none"></span>
                        <input type="text" className="input input-bordered w-full pl-9" placeholder="Search by SR #, date, or complaint..."
                          value={wizardSRInput}
                          onChange={e => setWizardSRInput(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') setWizardSRSearch(wizardSRInput) }} />
                      </div>
                      <button type="button" className="btn btn-soft btn-secondary shrink-0"
                        onClick={() => setWizardSRSearch(wizardSRInput)}>
                        <span className="icon-[tabler--search] size-4"></span>Search
                      </button>
                    </div>
                    {wizardSRLoading ? (
                      <div className="flex justify-center py-8"><span className="loading loading-spinner loading-md text-primary"></span></div>
                    ) : (() => {
                      const q = wizardSRSearch.toLowerCase()
                      const filtered = q
                        ? wizardSRs.filter(sr =>
                            String(sr.srNumber).includes(q) ||
                            (sr.serviceDate && String(sr.serviceDate).includes(q)) ||
                            (sr.complaint?.toLowerCase().includes(q))
                          )
                        : wizardSRs
                      return filtered.length === 0 ? (
                        <p className="text-center py-8 text-base-content/40 text-sm">
                          {wizardSRs.length === 0 ? 'No service reports found for this project.' : 'No results match your search.'}
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
                          {filtered.map(sr => (
                          <div key={sr.srNumber} className="card bg-base-100 border border-base-300">
                            <div className="card-body py-3 px-4">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm">SR #{sr.srNumber}</p>
                                  <p className="text-xs text-base-content/50">{sr.serviceDate ? String(sr.serviceDate).slice(0, 10) : '—'}</p>
                                  {sr.complaint && (
                                    <p className="text-xs text-base-content/50 mt-0.5 line-clamp-2">{sr.complaint}</p>
                                  )}
                                </div>
                                <button type="button" className="btn btn-primary btn-sm shrink-0"
                                  onClick={() => { setWizardSR(sr); resetNewPo(); setWizardStep(4) }}>
                                  Select
                                </button>
                              </div>
                            </div>
                          </div>
                          ))}
                        </div>
                      )
                    })()}
                    {!wizardSRSearch && wizardSRTotal > 1 && (
                      <div className="flex items-center justify-center gap-2">
                        <button className="btn btn-sm btn-secondary" disabled={wizardSRPage === 0}
                          onClick={() => setWizardSRPage(p => p - 1)}>
                          <span className="icon-[tabler--chevron-left] size-4"></span>Prev
                        </button>
                        <span className="text-sm text-base-content/60">Page {wizardSRPage + 1} of {wizardSRTotal}</span>
                        <button className="btn btn-sm btn-secondary" disabled={wizardSRPage >= wizardSRTotal - 1}
                          onClick={() => setWizardSRPage(p => p + 1)}>
                          Next<span className="icon-[tabler--chevron-right] size-4"></span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Step 4 (SR): PO form + contacts + parts ── */}
                {wizardStep === 4 && wizardType === 'sr' && (
                  <div className="flex flex-col gap-5">
                    <form id="inv-wizard-po-form" onSubmit={handleWizardPoSubmit}>
                      <POFormFields form={newPoForm} onChange={e => setNewPoForm(p => ({ ...p, [e.target.name]: e.target.value }))} errors={newPoError} />
                    </form>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Delivery Contacts</span>
                        <button type="button" className="btn btn-soft btn-accent btn-sm"
                          onClick={() => { setNewPoContactForm(EMPTY_CONTACT_FORM); setNewPoContactError({}); setNewPoContactModalOpen(true) }}>
                          <span className="icon-[tabler--address-book] size-4"></span>Add Contact
                        </button>
                      </div>
                      {newPoContacts.length === 0 ? (
                        <p className="text-sm text-base-content/40">No delivery contacts added yet.</p>
                      ) : (
                        <div className="overflow-x-auto rounded-box border border-base-300">
                          <table className="table table-sm">
                            <thead><tr><th>#</th><th>Name</th><th>Number</th><th></th></tr></thead>
                            <tbody>
                              {newPoContacts.map((c, i) => (
                                <tr key={c._tempId}>
                                  <td className="text-base-content/40 font-mono">{i + 1}</td>
                                  <td>{c.contactName}</td><td>{c.contactNumber}</td>
                                  <td className="text-end">
                                    <button type="button" className="btn btn-error btn-xs btn-square"
                                      onClick={() => setNewPoContacts(l => l.filter(x => x._tempId !== c._tempId))}>
                                      <span className="icon-[tabler--x] size-3.5"></span>
                                    </button>
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
                          onClick={() => { setNewPoPartForm(EMPTY_NEW_PO_PART_FORM); setNewPoPartError({}); setNewPoPartModalOpen(true) }}>
                          <span className="icon-[tabler--package] size-4"></span>Add Part
                        </button>
                      </div>
                      {newPoParts.length === 0 ? (
                        <p className="text-sm text-base-content/40">No parts added yet.</p>
                      ) : (
                        <div className="overflow-x-auto rounded-box border border-base-300">
                          <table className="table table-sm">
                            <thead><tr><th>#</th><th>Name</th><th>Qty</th><th>Unit Price</th><th>Supplier</th><th></th></tr></thead>
                            <tbody>
                              {newPoParts.map((p, i) => (
                                <tr key={p._tempId}>
                                  <td className="text-base-content/40 font-mono">{i + 1}</td>
                                  <td>{p.name}</td><td>{p.quantityOrdered} {p.quantityType}</td>
                                  <td>₱{Number(p.unitPrice).toFixed(2)}</td><td>{p._supplierName}</td>
                                  <td className="text-end">
                                    <button type="button" className="btn btn-error btn-xs btn-square"
                                      onClick={() => setNewPoParts(l => l.filter(x => x._tempId !== p._tempId))}>
                                      <span className="icon-[tabler--x] size-3.5"></span>
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Step 2 (Equipment): PO form ── */}
                {wizardStep === 2 && wizardType === 'equipment' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="label-text font-medium">Purpose <span className="text-error">*</span></label>
                      <input type="text" maxLength={30} className={`input input-bordered w-full${wizardEquipPoError.purpose ? ' is-invalid' : ''}`}
                        placeholder="e.g. Equipment procurement"
                        value={wizardEquipPoForm.purpose} onChange={e => setWizardEquipPoForm(p => ({ ...p, purpose: e.target.value }))} />
                      {wizardEquipPoError.purpose
                        ? <span className="helper-text">{wizardEquipPoError.purpose}</span>
                        : <span className="text-xs text-base-content/40">{wizardEquipPoForm.purpose.length}/30</span>}
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="label-text font-medium">Terms <span className="text-error">*</span></label>
                      <input type="text" maxLength={16} className={`input input-bordered w-full${wizardEquipPoError.terms ? ' is-invalid' : ''}`}
                        placeholder="e.g. Net 30"
                        value={wizardEquipPoForm.terms} onChange={e => setWizardEquipPoForm(p => ({ ...p, terms: e.target.value }))} />
                      {wizardEquipPoError.terms
                        ? <span className="helper-text">{wizardEquipPoError.terms}</span>
                        : <span className="text-xs text-base-content/40">{wizardEquipPoForm.terms.length}/16</span>}
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="label-text font-medium">Payment Method</label>
                      <input type="text" maxLength={16} className="input input-bordered w-full" placeholder="e.g. Bank Transfer"
                        value={wizardEquipPoForm.paymentMethod} onChange={e => setWizardEquipPoForm(p => ({ ...p, paymentMethod: e.target.value }))} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="label-text font-medium">Payment Details</label>
                      <input type="text" maxLength={60} className="input input-bordered w-full" placeholder="e.g. Account #1234-5678"
                        value={wizardEquipPoForm.paymentDetails} onChange={e => setWizardEquipPoForm(p => ({ ...p, paymentDetails: e.target.value }))} />
                    </div>
                    <div className="sm:col-span-2 flex flex-col gap-1">
                      <label className="label-text font-medium">Delivery Address</label>
                      <textarea maxLength={600} rows={2} className="textarea textarea-bordered w-full" placeholder="Full delivery address"
                        value={wizardEquipPoForm.deliveryAddress} onChange={e => setWizardEquipPoForm(p => ({ ...p, deliveryAddress: e.target.value }))} />
                    </div>
                    <div className="sm:col-span-2 flex flex-col gap-1">
                      <label className="label-text font-medium">Remarks</label>
                      <textarea maxLength={255} rows={2} className="textarea textarea-bordered w-full" placeholder="Additional notes or instructions"
                        value={wizardEquipPoForm.remarks} onChange={e => setWizardEquipPoForm(p => ({ ...p, remarks: e.target.value }))} />
                    </div>
                    {wizardEquipPoError._general && (
                      <div className="sm:col-span-2 alert alert-error py-2">
                        <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                        <span className="text-sm">{wizardEquipPoError._general}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Step 3 (Equipment): Equipment items ── */}
                {wizardStep === 3 && wizardType === 'equipment' && (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-2 text-sm text-base-content/60 bg-base-200 rounded-lg px-3 py-2">
                      <span className="icon-[tabler--file-invoice] size-4 shrink-0"></span>
                      <span>PO: <span className="font-medium">{wizardEquipPoForm.purpose}</span></span>
                    </div>
                    {wizardEquipList.length === 0 ? (
                      <p className="text-sm text-base-content/40">No equipment added yet. Add at least one item.</p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {wizardEquipList.map(item => (
                          <div key={item._key} className="card border border-base-300 bg-base-100">
                            <div className="card-body py-2 px-3 gap-0">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm">{item.name}</p>
                                  <p className="text-xs text-base-content/50">
                                    {item.type} · stock: {item.stock}
                                    {item.model && ` · ${item.model}`}
                                    {item.acquisitionCost && ` · ₱${Number(item.acquisitionCost).toLocaleString()}`}
                                  </p>
                                </div>
                                <button type="button" className="btn btn-error btn-xs btn-square shrink-0"
                                  onClick={() => setWizardEquipList(prev => prev.filter(e => e._key !== item._key))}>
                                  <span className="icon-[tabler--x] size-3.5"></span>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {wizardAddingEquip ? (
                      <div className="card border border-base-300 bg-base-200/40">
                        <div className="card-body gap-3">
                          <p className="text-xs font-semibold text-base-content/50 uppercase tracking-wide">New Equipment Item</p>
                          <form id="inv-wizard-equip-form" onSubmit={handleAddWizardEquipItem}>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="sm:col-span-2 flex flex-col gap-1">
                                <label className="label-text font-medium">Name <span className="text-error">*</span></label>
                                <input type="text" maxLength={150} required
                                  className={`input input-bordered w-full${wizardEquipFormError.name ? ' is-invalid' : ''}`}
                                  placeholder="e.g. Industrial Vacuum Pump"
                                  value={wizardEquipForm.name} onChange={e => setWizardEquipForm(p => ({ ...p, name: e.target.value }))} />
                                {wizardEquipFormError.name && <span className="helper-text">{wizardEquipFormError.name}</span>}
                              </div>
                              <div className="flex flex-col gap-1">
                                <label className="label-text font-medium">Type <span className="text-error">*</span></label>
                                <select className="select select-bordered w-full"
                                  value={wizardEquipForm.type} onChange={e => setWizardEquipForm(p => ({ ...p, type: e.target.value }))}>
                                  <option value="durable">durable</option>
                                  <option value="consumable">consumable</option>
                                </select>
                              </div>
                              <div className="flex flex-col gap-1">
                                <label className="label-text font-medium">Model</label>
                                <input type="text" maxLength={100} className="input input-bordered w-full" placeholder="e.g. VP-300X"
                                  value={wizardEquipForm.model} onChange={e => setWizardEquipForm(p => ({ ...p, model: e.target.value }))} />
                              </div>
                              <div className="flex flex-col gap-1">
                                <label className="label-text font-medium">Serial Number</label>
                                <input type="text" maxLength={100} className="input input-bordered w-full" placeholder="e.g. SN-001"
                                  value={wizardEquipForm.serialNumber} onChange={e => setWizardEquipForm(p => ({ ...p, serialNumber: e.target.value }))} />
                              </div>
                              <div className="flex flex-col gap-1">
                                <label className="label-text font-medium">Stock <span className="text-error">*</span></label>
                                <input type="number" min={0} required
                                  className={`input input-bordered w-full${wizardEquipFormError.stock ? ' is-invalid' : ''}`}
                                  placeholder="1"
                                  value={wizardEquipForm.stock} onChange={e => setWizardEquipForm(p => ({ ...p, stock: e.target.value }))} />
                                {wizardEquipFormError.stock && <span className="helper-text">{wizardEquipFormError.stock}</span>}
                              </div>
                              <div className="flex flex-col gap-1">
                                <label className="label-text font-medium">Acquisition Cost</label>
                                <input type="number" min={0} step="0.01" className="input input-bordered w-full" placeholder="e.g. 12500.00"
                                  value={wizardEquipForm.acquisitionCost} onChange={e => setWizardEquipForm(p => ({ ...p, acquisitionCost: e.target.value }))} />
                              </div>
                              <div className="sm:col-span-2 flex flex-col gap-1">
                                <label className="label-text font-medium">Description</label>
                                <textarea maxLength={500} rows={2} className="textarea textarea-bordered w-full"
                                  placeholder="Brief description of the equipment"
                                  value={wizardEquipForm.description} onChange={e => setWizardEquipForm(p => ({ ...p, description: e.target.value }))} />
                              </div>
                              {wizardEquipFormError._general && (
                                <div className="sm:col-span-2 alert alert-error py-2">
                                  <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                                  <span className="text-sm">{wizardEquipFormError._general}</span>
                                </div>
                              )}
                            </div>
                            <div className="flex gap-2 justify-end mt-3">
                              <button type="button" className="btn btn-soft btn-secondary btn-sm"
                                onClick={() => { setWizardAddingEquip(false); setWizardEquipForm(EMPTY_WIZARD_EQUIP); setWizardEquipFormError({}) }}>Cancel</button>
                              <button type="submit" className="btn btn-primary btn-sm">
                                <span className="icon-[tabler--plus] size-4"></span>Add to List
                              </button>
                            </div>
                          </form>
                        </div>
                      </div>
                    ) : (
                      <button type="button" className="btn btn-soft btn-primary btn-sm w-full"
                        onClick={() => { setWizardAddingEquip(true); setWizardEquipForm(EMPTY_WIZARD_EQUIP); setWizardEquipFormError({}) }}>
                        <span className="icon-[tabler--plus] size-4"></span>Add Equipment Item
                      </button>
                    )}
                    {wizardSubmitError._general && (
                      <div className="alert alert-error py-2">
                        <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                        <span className="text-sm">{wizardSubmitError._general}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Step 4 (Equipment): Documents ── */}
                {wizardStep === 4 && wizardType === 'equipment' && (
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1 text-sm text-base-content/60 bg-base-200 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="icon-[tabler--file-invoice] size-4 shrink-0"></span>
                        <span>PO: <span className="font-medium">{wizardEquipPoForm.purpose}</span></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="icon-[tabler--tool] size-4 shrink-0"></span>
                        <span>{wizardEquipList.length} equipment item{wizardEquipList.length !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    {wizardDocList.length === 0 ? (
                      <p className="text-sm text-base-content/40">No documents added. You can skip this step.</p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {wizardDocList.map(doc => (
                          <div key={doc._key} className="card border border-base-300 bg-base-100">
                            <div className="card-body py-2 px-3 gap-0">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm font-mono">{doc.invoiceId}</p>
                                  <p className="text-xs text-base-content/50">
                                    {doc.file
                                      ? <><span className="icon-[tabler--paperclip] size-3 inline-block mr-0.5"></span>{doc.file.name}</>
                                      : 'No file attached'}
                                  </p>
                                </div>
                                <button type="button" className="btn btn-error btn-xs btn-square shrink-0"
                                  onClick={() => setWizardDocList(prev => prev.filter(d => d._key !== doc._key))}>
                                  <span className="icon-[tabler--x] size-3.5"></span>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {wizardAddingDoc ? (
                      <div className="card border border-base-300 bg-base-200/40">
                        <div className="card-body gap-3">
                          <p className="text-xs font-semibold text-base-content/50 uppercase tracking-wide">New Document Record</p>
                          <form id="inv-wizard-doc-form" onSubmit={handleAddWizardDocItem}>
                            <div className="flex flex-col gap-3">
                              <div className="flex flex-col gap-1">
                                <label className="label-text font-medium">Invoice ID <span className="text-error">*</span></label>
                                <input type="text" maxLength={16} required
                                  className={`input input-bordered w-full${wizardDocFormError.invoiceId ? ' is-invalid' : ''}`}
                                  placeholder="e.g. INV-001"
                                  value={wizardDocForm.invoiceId}
                                  onChange={e => setWizardDocForm(prev => ({ ...prev, invoiceId: e.target.value }))} />
                                {wizardDocFormError.invoiceId && <span className="helper-text">{wizardDocFormError.invoiceId}</span>}
                              </div>
                              <div className="flex flex-col gap-1">
                                <label className="label-text font-medium">File <span className="text-base-content/40 font-normal">(optional — images or PDF)</span></label>
                                <input ref={wizardDocFileRef} type="file" accept={ACCEPTED_EXTENSIONS} className="hidden" onChange={handleWizardDocFileChange} />
                                <button type="button"
                                  className={`btn btn-outline w-full justify-start font-normal${wizardDocFormError.file ? ' btn-error' : ''}`}
                                  onClick={() => wizardDocFileRef.current?.click()}>
                                  <span className="icon-[tabler--paperclip] size-4"></span>
                                  {wizardDocForm.file ? wizardDocForm.file.name : 'Choose file…'}
                                </button>
                                {wizardDocFormError.file && <span className="helper-text">{wizardDocFormError.file}</span>}
                                {wizardDocForm.file && <span className="text-xs text-base-content/50">{(wizardDocForm.file.size / 1024).toFixed(1)} KB</span>}
                              </div>
                              {wizardDocFormError._general && (
                                <div className="alert alert-error py-2">
                                  <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                                  <span className="text-sm">{wizardDocFormError._general}</span>
                                </div>
                              )}
                            </div>
                            <div className="flex gap-2 justify-end mt-3">
                              <button type="button" className="btn btn-soft btn-secondary btn-sm"
                                onClick={() => { setWizardAddingDoc(false); setWizardDocForm({ invoiceId: '', file: null }); setWizardDocFormError({}); if (wizardDocFileRef.current) wizardDocFileRef.current.value = '' }}>Cancel</button>
                              <button type="submit" className="btn btn-primary btn-sm">
                                <span className="icon-[tabler--plus] size-4"></span>Add to List
                              </button>
                            </div>
                          </form>
                        </div>
                      </div>
                    ) : (
                      <button type="button" className="btn btn-soft btn-primary btn-sm w-full"
                        onClick={() => { setWizardAddingDoc(true); setWizardDocForm({ invoiceId: '', file: null }); setWizardDocFormError({}) }}>
                        <span className="icon-[tabler--plus] size-4"></span>Add Document Record
                      </button>
                    )}
                    {wizardSubmitError._general && (
                      <div className="alert alert-error py-2">
                        <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                        <span className="text-sm">{wizardSubmitError._general}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="modal-footer">
                {wizardStep > 1 && (
                  <button type="button" className="btn btn-soft btn-secondary me-auto"
                    onClick={() => {
                      setWizardSubmitError({})
                      if (wizardStep === 2) { setWizardType(null); setWizardStep(1) }
                      else setWizardStep(s => s - 1)
                    }}>
                    <span className="icon-[tabler--arrow-left] size-4"></span>Back
                  </button>
                )}
                <button type="button" className="btn btn-ghost" onClick={() => { setWizardOpen(false); resetWizard() }}>Cancel</button>
                {wizardStep === 2 && wizardType === 'equipment' && (
                  <button type="button" className="btn btn-primary" onClick={handleNextWizardEquipStep2}>
                    Next <span className="icon-[tabler--arrow-right] size-4"></span>
                  </button>
                )}
                {wizardStep === 3 && wizardType === 'equipment' && (
                  <button type="button" className="btn btn-primary" disabled={wizardAddingEquip} onClick={handleNextWizardEquipStep3}>
                    Next <span className="icon-[tabler--arrow-right] size-4"></span>
                  </button>
                )}
                {wizardStep === 4 && wizardType === 'sr' && (
                  <button type="submit" form="inv-wizard-po-form" className="btn btn-primary" disabled={newPoSubmitting}>
                    {newPoSubmitting ? <span className="loading loading-spinner loading-sm"></span> : <span className="icon-[tabler--plus] size-4"></span>}
                    Create Purchase Order
                  </button>
                )}
                {wizardStep === 4 && wizardType === 'equipment' && (
                  <button type="button" className="btn btn-primary" disabled={newPoSubmitting || wizardAddingDoc} onClick={handleWizardEquipSubmit}>
                    {newPoSubmitting ? <span className="loading loading-spinner loading-sm"></span> : <span className="icon-[tabler--plus] size-4"></span>}
                    Add Purchase Order &amp; Equipment
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Add Contact sub-modal (z-50/z-55) — shared by New PO & Wizard ────── */}
      {newPoContactModalOpen && (
        <>
          <div className="fixed inset-0 bg-base-300/40 z-[50]" onClick={() => setNewPoContactModalOpen(false)} />
          <div className="fixed inset-0 z-[55] flex items-center justify-center p-4">
            <div className="modal-content w-full max-w-sm shadow-xl">
              <div className="modal-header">
                <h3 className="modal-title">Add Delivery Contact</h3>
                <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={() => setNewPoContactModalOpen(false)}>
                  <span className="icon-[tabler--x] size-4"></span>
                </button>
              </div>
              <div className="modal-body">
                <form id="inv-new-po-contact-form" onSubmit={handleAddNewPoContact}>
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="label-text font-medium">Contact Name <span className="text-error">*</span></label>
                      <input type="text" name="contactName" maxLength={120}
                        className={`input input-bordered w-full${newPoContactError.contactName ? ' is-invalid' : ''}`}
                        value={newPoContactForm.contactName}
                        onChange={e => setNewPoContactForm(p => ({ ...p, contactName: e.target.value }))} />
                      {newPoContactError.contactName && <span className="helper-text">{newPoContactError.contactName}</span>}
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="label-text font-medium">Contact Number <span className="text-error">*</span></label>
                      <input type="text" name="contactNumber" maxLength={30}
                        className={`input input-bordered w-full${newPoContactError.contactNumber ? ' is-invalid' : ''}`}
                        value={newPoContactForm.contactNumber}
                        onChange={e => setNewPoContactForm(p => ({ ...p, contactNumber: e.target.value }))} />
                      {newPoContactError.contactNumber && <span className="helper-text">{newPoContactError.contactNumber}</span>}
                    </div>
                  </div>
                </form>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-soft btn-secondary" onClick={() => setNewPoContactModalOpen(false)}>Cancel</button>
                <button type="submit" form="inv-new-po-contact-form" className="btn btn-primary">
                  <span className="icon-[tabler--plus] size-4"></span>Add
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Add Part sub-modal (z-50/z-55) — shared by New PO & Wizard ─────────── */}
      {newPoPartModalOpen && (
        <>
          <div className="fixed inset-0 bg-base-300/40 z-[50]" onClick={() => setNewPoPartModalOpen(false)} />
          <div className="fixed inset-0 z-[55] flex items-center justify-center p-4">
            <div className="modal-content w-full max-w-lg shadow-xl">
              <div className="modal-header">
                <h3 className="modal-title">Add Part</h3>
                <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={() => setNewPoPartModalOpen(false)}>
                  <span className="icon-[tabler--x] size-4"></span>
                </button>
              </div>
              <div className="modal-body">
                <form id="inv-new-po-part-form" onSubmit={handleAddNewPoPart}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2 flex flex-col gap-1">
                      <label className="label-text font-medium">Name <span className="text-error">*</span></label>
                      <input type="text" maxLength={120}
                        className={`input input-bordered w-full${newPoPartError.name ? ' is-invalid' : ''}`}
                        value={newPoPartForm.name}
                        onChange={e => setNewPoPartForm(p => ({ ...p, name: e.target.value }))} />
                      {newPoPartError.name && <span className="helper-text">{newPoPartError.name}</span>}
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="label-text font-medium">Quantity <span className="text-error">*</span></label>
                      <input type="number" min={1}
                        className={`input input-bordered w-full${newPoPartError.quantityOrdered ? ' is-invalid' : ''}`}
                        value={newPoPartForm.quantityOrdered}
                        onChange={e => setNewPoPartForm(p => ({ ...p, quantityOrdered: e.target.value }))} />
                      {newPoPartError.quantityOrdered && <span className="helper-text">{newPoPartError.quantityOrdered}</span>}
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="label-text font-medium">Qty Type <span className="text-error">*</span></label>
                      <input type="text" maxLength={30} placeholder="e.g. pcs, kg, m"
                        className={`input input-bordered w-full${newPoPartError.quantityType ? ' is-invalid' : ''}`}
                        value={newPoPartForm.quantityType}
                        onChange={e => setNewPoPartForm(p => ({ ...p, quantityType: e.target.value }))} />
                      {newPoPartError.quantityType && <span className="helper-text">{newPoPartError.quantityType}</span>}
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="label-text font-medium">Unit Price <span className="text-error">*</span></label>
                      <input type="number" min={0} step="0.01"
                        className={`input input-bordered w-full${newPoPartError.unitPrice ? ' is-invalid' : ''}`}
                        value={newPoPartForm.unitPrice}
                        onChange={e => setNewPoPartForm(p => ({ ...p, unitPrice: e.target.value }))} />
                      {newPoPartError.unitPrice && <span className="helper-text">{newPoPartError.unitPrice}</span>}
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="label-text font-medium">Supplier <span className="text-error">*</span></label>
                      <select className={`select select-bordered w-full${newPoPartError.supplierId ? ' is-invalid' : ''}`}
                        value={newPoPartForm.supplierId}
                        onChange={e => {
                          const s = suppliers.find(x => String(x.supplierId) === e.target.value)
                          setNewPoPartForm(p => ({ ...p, supplierId: e.target.value, _supplierName: s?.name ?? '' }))
                        }}>
                        <option value="">Select supplier...</option>
                        {suppliers.map(s => <option key={s.supplierId} value={s.supplierId}>{s.name}</option>)}
                      </select>
                      {newPoPartError.supplierId && <span className="helper-text">{newPoPartError.supplierId}</span>}
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="label-text font-medium">Order Date</label>
                      <input type="date" className="input input-bordered w-full"
                        value={newPoPartForm.orderDate}
                        onChange={e => setNewPoPartForm(p => ({ ...p, orderDate: e.target.value }))} />
                    </div>
                    {newPoPartError._general && (
                      <div className="sm:col-span-2 alert alert-error py-2">
                        <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                        <span className="text-sm">{newPoPartError._general}</span>
                      </div>
                    )}
                  </div>
                </form>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-soft btn-secondary" onClick={() => setNewPoPartModalOpen(false)}>Cancel</button>
                <button type="submit" form="inv-new-po-part-form" className="btn btn-primary">
                  <span className="icon-[tabler--plus] size-4"></span>Add Part
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Supplier picker ───────────────────────────────────────────────────── */}
      <SupplierPickerModal
        isOpen={!!supplierPickerFor}
        onClose={() => setSupplierPickerFor(null)}
        onSelect={s => {
          if (supplierPickerFor === 'add') {
            setPartForm(p => ({ ...p, supplierId: s.supplierId }))
            setAddSupplierDisplay(`${s.name} (#${s.supplierId})`)
          } else {
            setUpdatePartForm(p => ({ ...p, supplierId: s.supplierId }))
            setUpdateSupplierDisplay(`${s.name} (#${s.supplierId})`)
          }
          setSupplierPickerFor(null)
        }}
      />
    </Layout>
  )
}

function PartDetailField({ label, children }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-base-content/50 uppercase tracking-wide">{label}</span>
      <span className="text-sm font-medium text-base-content">{children}</span>
    </div>
  )
}

function EquipFormFields({ form, onChange, errors, showStatus }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="sm:col-span-2 flex flex-col gap-1">
        <label className="label-text font-medium">Name <span className="text-error">*</span></label>
        <input type="text" name="name" maxLength={150} required
          className={`input input-bordered w-full${errors.name ? ' is-invalid' : ''}`}
          value={form.name} onChange={onChange} />
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
        <input type="number" name="stock" min={0} required
          className={`input input-bordered w-full${errors.stock ? ' is-invalid' : ''}`}
          value={form.stock} onChange={onChange} />
        {errors.stock && <span className="helper-text">{errors.stock}</span>}
      </div>
      <div className="flex flex-col gap-1">
        <label className="label-text font-medium">Model</label>
        <input type="text" name="model" maxLength={100}
          className={`input input-bordered w-full${errors.model ? ' is-invalid' : ''}`}
          value={form.model} onChange={onChange} />
        {errors.model && <span className="helper-text">{errors.model}</span>}
      </div>
      <div className="flex flex-col gap-1">
        <label className="label-text font-medium">Serial Number</label>
        <input type="text" name="serialNumber" maxLength={100}
          className={`input input-bordered w-full${errors.serialNumber ? ' is-invalid' : ''}`}
          value={form.serialNumber} onChange={onChange} />
        {errors.serialNumber && <span className="helper-text">{errors.serialNumber}</span>}
      </div>
      <div className="flex flex-col gap-1">
        <label className="label-text font-medium">Acquisition Cost</label>
        <input type="number" name="acquisitionCost" min={0} step="0.01"
          className={`input input-bordered w-full${errors.acquisitionCost ? ' is-invalid' : ''}`}
          value={form.acquisitionCost} onChange={onChange} />
        {errors.acquisitionCost && <span className="helper-text">{errors.acquisitionCost}</span>}
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
        <textarea name="description" maxLength={500} rows={2}
          className={`textarea textarea-bordered w-full${errors.description ? ' is-invalid' : ''}`}
          value={form.description} onChange={onChange} />
        {errors.description && <span className="helper-text">{errors.description}</span>}
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

function POFormFields({ form, onChange, errors }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="flex flex-col gap-1">
        <label className="label-text font-medium">Purpose <span className="text-error">*</span></label>
        <input type="text" name="purpose" maxLength={30} required
          className={`input input-bordered w-full${errors.purpose ? ' is-invalid' : ''}`}
          placeholder="e.g. Equipment procurement"
          value={form.purpose} onChange={onChange} />
        {errors.purpose ? <span className="helper-text">{errors.purpose}</span> : <span className="text-xs text-base-content/40">{form.purpose.length}/30</span>}
      </div>
      <div className="flex flex-col gap-1">
        <label className="label-text font-medium">Terms <span className="text-error">*</span></label>
        <input type="text" name="terms" maxLength={16} required
          className={`input input-bordered w-full${errors.terms ? ' is-invalid' : ''}`}
          placeholder="e.g. Net 30"
          value={form.terms} onChange={onChange} />
        {errors.terms ? <span className="helper-text">{errors.terms}</span> : <span className="text-xs text-base-content/40">{form.terms.length}/16</span>}
      </div>
      <div className="flex flex-col gap-1">
        <label className="label-text font-medium">Payment Method</label>
        <input type="text" name="paymentMethod" maxLength={16}
          className={`input input-bordered w-full${errors.paymentMethod ? ' is-invalid' : ''}`}
          placeholder="e.g. Bank Transfer"
          value={form.paymentMethod} onChange={onChange} />
        {errors.paymentMethod && <span className="helper-text">{errors.paymentMethod}</span>}
      </div>
      <div className="flex flex-col gap-1">
        <label className="label-text font-medium">Payment Details</label>
        <input type="text" name="paymentDetails" maxLength={60}
          className={`input input-bordered w-full${errors.paymentDetails ? ' is-invalid' : ''}`}
          placeholder="e.g. Account #1234-5678"
          value={form.paymentDetails} onChange={onChange} />
        {errors.paymentDetails && <span className="helper-text">{errors.paymentDetails}</span>}
      </div>
      <div className="sm:col-span-2 flex flex-col gap-1">
        <label className="label-text font-medium">Delivery Address</label>
        <textarea name="deliveryAddress" maxLength={600} rows={2}
          className={`textarea textarea-bordered w-full${errors.deliveryAddress ? ' is-invalid' : ''}`}
          placeholder="Full delivery address"
          value={form.deliveryAddress} onChange={onChange} />
        {errors.deliveryAddress && <span className="helper-text">{errors.deliveryAddress}</span>}
      </div>
      <div className="sm:col-span-2 flex flex-col gap-1">
        <label className="label-text font-medium">Remarks</label>
        <textarea name="remarks" maxLength={255} rows={2}
          className={`textarea textarea-bordered w-full${errors.remarks ? ' is-invalid' : ''}`}
          placeholder="Additional notes or instructions"
          value={form.remarks} onChange={onChange} />
        {errors.remarks && <span className="helper-text">{errors.remarks}</span>}
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
