import { useState, useEffect } from 'react'
import { useAuth } from './auth'
import Layout from './Layout'
import Modal from './Modal'
import { notyfSuccess, notyfError } from './notyf'

const SR_PAGE_SIZE = 10

/** Parses a failed API response into field-level or general errors. */
async function parseApiError(res) {
  const data = await res.json().catch(() => ({}))
  if (data.errors) return data.errors
  return { _general: data.message ?? data.error ?? `Error ${res.status}` }
}

/** Formats a date/datetime string to YYYY-MM-DD */
function formatDate(dt) {
  if (!dt) return '—'
  return String(dt).slice(0, 10)
}

/** Formats a number as PHP currency */
function formatCurrency(val) {
  if (val == null) return '—'
  return Number(val).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })
}

/** Returns badge class for report status */
function statusBadgeClass(status) {
  if (status === 'paid')    return 'badge-success'
  if (status === 'partial') return 'badge-warning'
  return 'badge-neutral'
}

/** Computes subtotal from an array of items with quantity and unitPrice */
function subtotal(items) {
  return items.reduce((sum, i) => sum + (i.quantity ?? 0) * Number(i.unitPrice ?? 0), 0)
}

const EMPTY_BILLING_FORM = { description: '', quantity: '', unitPrice: '' }

/** Modal for adding and updating billing items for an SR — modeled after Manage Parts */
export function ManageBillingModal({ report, apiFetch, onClose }) {
  const [items, setItems]           = useState([])
  const [loading, setLoading]       = useState(false)
  const [refresh, setRefresh]       = useState(0)

  // Add form
  const [addOpen, setAddOpen]               = useState(false)
  const [addForm, setAddForm]               = useState(EMPTY_BILLING_FORM)
  const [addFormError, setAddFormError]     = useState({})
  const [addSubmitting, setAddSubmitting]   = useState(false)

  // Update sub-modal
  const [updateOpen, setUpdateOpen]               = useState(false)
  const [updatingItem, setUpdatingItem]           = useState(null)
  const [updateForm, setUpdateForm]               = useState(EMPTY_BILLING_FORM)
  const [updateFormError, setUpdateFormError]     = useState({})
  const [updateSubmitting, setUpdateSubmitting]   = useState(false)

  useEffect(() => {
    if (!report) { setItems([]); return }
    let active = true
    setLoading(true)
    const params = new URLSearchParams({ srNumber: String(report.srNumber), page: '0', size: '1000', sort: 'srBillingNum,asc' })
    apiFetch(`/api/service-report-billing-items?${params}`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => { if (active) setItems(data.content ?? []) })
      .catch(() => { if (active) setItems([]) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [apiFetch, report, refresh])

  function handleAddChange(e) {
    const { name, value } = e.target
    setAddForm(prev => ({ ...prev, [name]: value }))
  }

  async function handleAddSubmit(e) {
    e.preventDefault()
    setAddFormError({})
    setAddSubmitting(true)
    try {
      const res = await apiFetch('/api/service-report-billing-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          srNumber:    report.srNumber,
          description: addForm.description,
          quantity:    Number(addForm.quantity),
          unitPrice:   Number(addForm.unitPrice),
        }),
      })
      if (!res.ok) {
        setAddFormError(await parseApiError(res))
        notyfError('Add billing item failed')
        return
      }
      setAddOpen(false)
      setAddForm(EMPTY_BILLING_FORM)
      setAddFormError({})
      notyfSuccess('Billing item added.')
      setRefresh(k => k + 1)
    } catch (err) {
      setAddFormError({ _general: err.message })
    } finally {
      setAddSubmitting(false)
    }
  }

  function openUpdate(item) {
    setUpdateForm({ description: item.description, quantity: item.quantity, unitPrice: item.unitPrice })
    setUpdatingItem(item)
    setUpdateFormError({})
    setUpdateOpen(true)
  }

  function closeUpdate() {
    setUpdateOpen(false)
    setUpdatingItem(null)
    setUpdateForm(EMPTY_BILLING_FORM)
    setUpdateFormError({})
  }

  function handleUpdateChange(e) {
    const { name, value } = e.target
    setUpdateForm(prev => ({ ...prev, [name]: value }))
  }

  async function handleUpdateSubmit(e) {
    e.preventDefault()
    setUpdateFormError({})
    setUpdateSubmitting(true)
    try {
      const res = await apiFetch(`/api/service-report-billing-items/${updatingItem.srBillingNum}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          srNumber:    report.srNumber,
          description: updateForm.description,
          quantity:    Number(updateForm.quantity),
          unitPrice:   Number(updateForm.unitPrice),
        }),
      })
      if (!res.ok) {
        setUpdateFormError(await parseApiError(res))
        notyfError('Update failed')
        return
      }
      closeUpdate()
      notyfSuccess(`Billing item #${updatingItem.srBillingNum} updated.`)
      setRefresh(k => k + 1)
    } catch (err) {
      setUpdateFormError({ _general: err.message })
    } finally {
      setUpdateSubmitting(false)
    }
  }

  return (
    <>
      <Modal
        isOpen={!!report}
        onClose={addOpen ? undefined : onClose}
        hideClose={addOpen}
        title={`Billing Items — SR #${report?.srNumber ?? ''}`}
        size="max-w-2xl"
        footer={!addOpen && (
          <button type="button" className="btn btn-soft btn-secondary" onClick={onClose}>
            Close
          </button>
        )}
      >
        {/* Add form (inline toggle) */}
        {addOpen ? (
          <form onSubmit={handleAddSubmit}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">

              <div className="sm:col-span-2 flex flex-col gap-1">
                <label className="label-text font-medium">Description <span className="text-error">*</span></label>
                <input type="text" name="description" maxLength={255} required
                  className={`input input-bordered w-full${addFormError.description ? ' is-invalid' : ''}`}
                  placeholder="e.g. Labor — Coil Cleaning"
                  value={addForm.description} onChange={handleAddChange} />
                {addFormError.description && <span className="helper-text">{addFormError.description}</span>}
              </div>

              <div className="flex flex-col gap-1">
                <label className="label-text font-medium">Quantity <span className="text-error">*</span></label>
                <input type="number" name="quantity" min={1} required
                  className={`input input-bordered w-full${addFormError.quantity ? ' is-invalid' : ''}`}
                  placeholder="e.g. 1"
                  value={addForm.quantity} onChange={handleAddChange} />
                {addFormError.quantity && <span className="helper-text">{addFormError.quantity}</span>}
              </div>

              <div className="flex flex-col gap-1">
                <label className="label-text font-medium">Unit Price <span className="text-error">*</span></label>
                <input type="number" name="unitPrice" min={0} step="0.01" required
                  className={`input input-bordered w-full${addFormError.unitPrice ? ' is-invalid' : ''}`}
                  placeholder="e.g. 800.00"
                  value={addForm.unitPrice} onChange={handleAddChange} />
                {addFormError.unitPrice && <span className="helper-text">{addFormError.unitPrice}</span>}
              </div>

              {addFormError._general && (
                <div className="sm:col-span-2 alert alert-error py-2">
                  <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                  <span className="text-sm">{addFormError._general}</span>
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end">
              <button type="button" className="btn btn-soft btn-secondary btn-sm"
                onClick={() => { setAddOpen(false); setAddForm(EMPTY_BILLING_FORM); setAddFormError({}) }}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={addSubmitting}>
                {addSubmitting
                  ? <span className="loading loading-spinner loading-xs"></span>
                  : <span className="icon-[tabler--plus] size-4"></span>
                }
                Add Item
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="flex justify-end mb-3">
              <button type="button" className="btn btn-primary btn-sm"
                onClick={() => { setAddForm(EMPTY_BILLING_FORM); setAddFormError({}); setAddOpen(true) }}>
                <span className="icon-[tabler--plus] size-4"></span>
                Add Billing Item
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <span className="loading loading-spinner loading-sm text-primary"></span>
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-8 text-base-content/40 text-sm">No billing items yet.</div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-box border border-base-300">
                  <table className="table table-zebra table-sm w-full">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Description</th>
                        <th className="text-right">Qty</th>
                        <th className="text-right">Unit Price</th>
                        <th className="text-right">Amount</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map(item => (
                        <tr key={item.srBillingNum}>
                          <td className="font-mono text-xs">{item.srBillingNum}</td>
                          <td className="max-w-48">
                            <span className="line-clamp-2 text-sm" title={item.description}>{item.description}</span>
                          </td>
                          <td className="text-right text-sm">{item.quantity}</td>
                          <td className="text-right text-sm">{formatCurrency(item.unitPrice)}</td>
                          <td className="text-right text-sm font-medium">
                            {formatCurrency(item.quantity * Number(item.unitPrice))}
                          </td>
                          <td>
                            <button className="btn btn-soft btn-secondary btn-xs" onClick={() => openUpdate(item)}>
                              <span className="icon-[tabler--pencil] size-3"></span>
                              Update
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={4} className="text-right text-sm font-semibold">Subtotal</td>
                        <td className="text-right text-sm font-semibold">{formatCurrency(subtotal(items))}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </Modal>

      {/* Update sub-modal — sits above Manage modal */}
      {updateOpen && (
        <>
          <div className="fixed inset-0 bg-base-300/40 z-[55]" onClick={closeUpdate} />
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="modal-content w-full max-w-md shadow-xl">
              <div className="modal-header">
                <div>
                  <h3 className="modal-title">Update Billing Item #{updatingItem?.srBillingNum}</h3>
                  <span className="text-sm text-base-content/50 line-clamp-1">{updatingItem?.description}</span>
                </div>
                <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={closeUpdate}>
                  <span className="icon-[tabler--x] size-4"></span>
                </button>
              </div>
              <div className="modal-body">
                <form id="update-billing-form" onSubmit={handleUpdateSubmit}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                    <div className="sm:col-span-2 flex flex-col gap-1">
                      <label className="label-text font-medium">Description <span className="text-error">*</span></label>
                      <input type="text" name="description" maxLength={255} required
                        className={`input input-bordered w-full${updateFormError.description ? ' is-invalid' : ''}`}
                        value={updateForm.description} onChange={handleUpdateChange} />
                      {updateFormError.description && <span className="helper-text">{updateFormError.description}</span>}
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="label-text font-medium">Quantity <span className="text-error">*</span></label>
                      <input type="number" name="quantity" min={1} required
                        className={`input input-bordered w-full${updateFormError.quantity ? ' is-invalid' : ''}`}
                        value={updateForm.quantity} onChange={handleUpdateChange} />
                      {updateFormError.quantity && <span className="helper-text">{updateFormError.quantity}</span>}
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="label-text font-medium">Unit Price <span className="text-error">*</span></label>
                      <input type="number" name="unitPrice" min={0} step="0.01" required
                        className={`input input-bordered w-full${updateFormError.unitPrice ? ' is-invalid' : ''}`}
                        value={updateForm.unitPrice} onChange={handleUpdateChange} />
                      {updateFormError.unitPrice && <span className="helper-text">{updateFormError.unitPrice}</span>}
                    </div>

                    {updateFormError._general && (
                      <div className="sm:col-span-2 alert alert-error py-2">
                        <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                        <span className="text-sm">{updateFormError._general}</span>
                      </div>
                    )}
                  </div>
                </form>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-soft btn-secondary" onClick={closeUpdate}>Cancel</button>
                <button type="submit" form="update-billing-form" className="btn btn-primary" disabled={updateSubmitting}>
                  {updateSubmitting
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
    </>
  )
}

/** Modal showing SR details, billing items, parts from POs, and totals */
function BillingModal({ report, apiFetch, onClose }) {
  const [billingItems, setBillingItems]     = useState([])
  const [billingLoading, setBillingLoading] = useState(true)
  const [billingError, setBillingError]     = useState(null)

  const [parts, setParts]             = useState([])
  const [partsLoading, setPartsLoading] = useState(true)
  const [partsError, setPartsError]   = useState(null)

  useEffect(() => {
    if (!report) return
    let active = true
    setBillingLoading(true)
    setBillingError(null)
    const params = new URLSearchParams({ srNumber: String(report.srNumber), page: '0', size: '1000', sort: 'srBillingNum,asc' })
    apiFetch(`/api/service-report-billing-items?${params}`)
      .then(res => {
        if (!res.ok) throw new Error(`Failed to load billing items (${res.status})`)
        return res.json()
      })
      .then(data => { if (active) setBillingItems(data.content ?? []) })
      .catch(err => { if (active) setBillingError(err.message) })
      .finally(() => { if (active) setBillingLoading(false) })
    return () => { active = false }
  }, [apiFetch, report])

  useEffect(() => {
    if (!report) return
    let active = true
    setPartsLoading(true)
    setPartsError(null)
    const poParams = new URLSearchParams({ srNum: String(report.srNumber), size: '100' })
    apiFetch(`/api/purchase-orders?${poParams}`)
      .then(res => {
        if (!res.ok) throw new Error(`Failed to load purchase orders (${res.status})`)
        return res.json()
      })
      .then(async data => {
        if (!active) return
        const pos = data.content ?? []
        if (pos.length === 0) { setParts([]); return }
        const partPages = await Promise.all(
          pos.map(po =>
            apiFetch(`/api/parts?poNum=${encodeURIComponent(po.poNum)}&size=100`)
              .then(r => r.ok ? r.json() : { content: [] })
              .then(d => d.content ?? [])
          )
        )
        if (active) setParts(partPages.flat())
      })
      .catch(err => { if (active) setPartsError(err.message) })
      .finally(() => { if (active) setPartsLoading(false) })
    return () => { active = false }
  }, [apiFetch, report])

  if (!report) return null

  const billingSubtotal = subtotal(billingItems)
  const partsSubtotal   = subtotal(parts)
  const grandTotal      = billingSubtotal + partsSubtotal

  return (
    <>
      <div className="fixed inset-0 bg-base-300/60 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
        <div className="modal-content w-full max-w-3xl my-auto">

          <div className="modal-header">
            <div>
              <h3 className="modal-title">SR #{report.srNumber} — Billing</h3>
              <span className="text-sm text-base-content/50">{report.projectName}</span>
            </div>
            <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" aria-label="Close" onClick={onClose}>
              <span className="icon-[tabler--x] size-4"></span>
            </button>
          </div>

          <div className="modal-body flex flex-col gap-6">

            {/* SR Details */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
              <div className="col-span-2 sm:col-span-3 flex flex-col gap-0.5">
                <span className="text-xs text-base-content/50 uppercase tracking-wide">Complaint</span>
                <span className="text-sm font-medium">{report.complaint ?? '—'}</span>
              </div>
              <div className="col-span-2 sm:col-span-3 flex flex-col gap-0.5">
                <span className="text-xs text-base-content/50 uppercase tracking-wide">Work Done</span>
                <span className="text-sm font-medium">{report.workDone ?? '—'}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-base-content/50 uppercase tracking-wide">Location</span>
                <span className="text-sm font-medium">{report.location ?? '—'}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-base-content/50 uppercase tracking-wide">Status</span>
                <span className={`badge badge-soft ${statusBadgeClass(report.status)} text-xs`}>{report.status}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-base-content/50 uppercase tracking-wide">Payment Method</span>
                <span className="text-sm font-medium">{report.paymentMethod ?? '—'}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-base-content/50 uppercase tracking-wide">Schedule Date</span>
                <span className="text-sm font-medium">{formatDate(report.scheduleDate)}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-base-content/50 uppercase tracking-wide">Receipt Date</span>
                <span className="text-sm font-medium">{formatDate(report.receiptReceiveDate)}</span>
              </div>
            </div>

            <div className="divider my-0"></div>

            {/* Billing Items */}
            <div>
              <p className="text-xs text-base-content/50 uppercase tracking-wide mb-3">Services &amp; Labor</p>
              {billingLoading && <div className="flex justify-center py-6"><span className="loading loading-spinner loading-md text-primary"></span></div>}
              {billingError && <div className="alert alert-error py-2 text-sm"><span className="icon-[tabler--alert-circle] size-4"></span>{billingError}</div>}
              {!billingLoading && !billingError && billingItems.length === 0 && (
                <p className="text-sm text-base-content/40 text-center py-4">No billing items.</p>
              )}
              {!billingLoading && !billingError && billingItems.length > 0 && (
                <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
                  <table className="table table-zebra table-sm w-full">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Description</th>
                        <th className="text-right">Qty</th>
                        <th className="text-right">Unit Price</th>
                        <th className="text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {billingItems.map(item => (
                        <tr key={item.srBillingNum}>
                          <td className="font-mono text-xs">{item.srBillingNum}</td>
                          <td className="max-w-48"><span className="line-clamp-2 text-sm" title={item.description}>{item.description}</span></td>
                          <td className="text-right text-sm">{item.quantity}</td>
                          <td className="text-right text-sm">{formatCurrency(item.unitPrice)}</td>
                          <td className="text-right text-sm font-medium">{formatCurrency(item.quantity * Number(item.unitPrice))}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={4} className="text-right text-sm font-semibold">Services Subtotal</td>
                        <td className="text-right text-sm font-semibold">{formatCurrency(billingSubtotal)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* Parts */}
            <div>
              <p className="text-xs text-base-content/50 uppercase tracking-wide mb-3">Parts (from Purchase Orders)</p>
              {partsLoading && <div className="flex justify-center py-6"><span className="loading loading-spinner loading-md text-primary"></span></div>}
              {partsError && <div className="alert alert-error py-2 text-sm"><span className="icon-[tabler--alert-circle] size-4"></span>{partsError}</div>}
              {!partsLoading && !partsError && parts.length === 0 && (
                <p className="text-sm text-base-content/40 text-center py-4">No parts linked to this service report.</p>
              )}
              {!partsLoading && !partsError && parts.length > 0 && (
                <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
                  <table className="table table-zebra table-sm w-full">
                    <thead>
                      <tr>
                        <th>PO #</th>
                        <th>Part</th>
                        <th className="text-right">Qty</th>
                        <th className="text-right">Unit Price</th>
                        <th className="text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parts.map(part => (
                        <tr key={part.partId}>
                          <td className="font-mono text-xs">{part.poNum}</td>
                          <td className="max-w-48"><span className="line-clamp-2 text-sm" title={part.name}>{part.name}</span></td>
                          <td className="text-right text-sm">{part.quantity} {part.quantityType}</td>
                          <td className="text-right text-sm">{formatCurrency(part.unitPrice)}</td>
                          <td className="text-right text-sm font-medium">{formatCurrency(part.quantity * Number(part.unitPrice))}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={4} className="text-right text-sm font-semibold">Parts Subtotal</td>
                        <td className="text-right text-sm font-semibold">{formatCurrency(partsSubtotal)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* Grand Total */}
            {!billingLoading && !partsLoading && (
              <div className="flex justify-end">
                <div className="rounded-box border border-base-300 bg-base-200 px-6 py-3 flex items-center gap-8">
                  <span className="text-sm font-semibold text-base-content/70">Grand Total</span>
                  <span className="text-lg font-bold text-primary">{formatCurrency(grandTotal)}</span>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  )
}

export default function Billing() {
  const { apiFetch, hasRole } = useAuth()
  const canEdit = hasRole('ADMIN', 'ACCOUNTING')

  const [reports, setReports]             = useState([])
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState(null)
  const [search, setSearch]               = useState('')
  const [page, setPage]                   = useState(0)
  const [totalPages, setTotalPages]       = useState(0)
  const [totalElements, setTotalElements] = useState(0)

  const [viewReport, setViewReport]     = useState(null)
  const [manageReport, setManageReport] = useState(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ page: String(page), size: String(SR_PAGE_SIZE), sort: 'srNumber,asc' })
    apiFetch(`/api/service-reports?${params}`)
      .then(res => {
        if (!res.ok) throw new Error(`Failed to load service reports (${res.status})`)
        return res.json()
      })
      .then(data => {
        if (!active) return
        setReports(data.content ?? [])
        setTotalPages(data.totalPages ?? 0)
        setTotalElements(data.totalElements ?? 0)
      })
      .catch(err => { if (active) setError(err.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [apiFetch, page])

  const filtered = reports.filter(r => {
    if (search === '') return true
    const q = search.toLowerCase()
    return String(r.srNumber).includes(q) || (r.projectName ?? '').toLowerCase().includes(q)
  })

  return (
    <Layout activePage="billing">
      <div className="flex items-stretch justify-between h-16 mb-6">
        <div>
          <h1 className="text-3xl font-semibold">Service Report Billing</h1>
          <p className="text-base-content/60 mt-1">Select a service report to view its billing breakdown</p>
        </div>
      </div>

      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <span className="icon-[tabler--search] size-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none"></span>
          <input
            type="text"
            className="input input-bordered w-full pl-9"
            placeholder="Search by SR # or project name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-20">
          <span className="loading loading-spinner loading-lg text-primary"></span>
        </div>
      )}

      {error && (
        <div className="alert alert-error">
          <span className="icon-[tabler--alert-circle] size-5"></span>
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && (
        <>
          <p className="text-sm text-base-content/50 mb-3">
            {totalElements} report{totalElements !== 1 ? 's' : ''} total
            {search && ` · ${filtered.length} shown`}
          </p>

          {filtered.length === 0 ? (
            <div className="text-center py-20 text-base-content/40">
              <span className="icon-[tabler--file-off] size-12 mx-auto mb-3 block"></span>
              <p>No service reports found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
              <table className="table table-zebra w-full">
                <thead>
                  <tr>
                    <th>SR #</th>
                    <th>Project</th>
                    <th>Complaint</th>
                    <th>Schedule Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.srNumber}>
                      <td className="font-mono font-semibold">{r.srNumber}</td>
                      <td className="max-w-36">
                        <span className="line-clamp-1 text-sm" title={r.projectName}>{r.projectName}</span>
                      </td>
                      <td className="max-w-40">
                        <span className="line-clamp-1 text-sm" title={r.complaint}>{r.complaint}</span>
                      </td>
                      <td className="text-sm">{formatDate(r.scheduleDate)}</td>
                      <td>
                        <span className={`badge badge-soft ${statusBadgeClass(r.status)} text-xs`}>{r.status}</span>
                      </td>
                      <td>
                        <div className="flex gap-1">
                          <button className="btn btn-soft btn-primary btn-xs" title="View Billing" onClick={() => setViewReport(r)}>
                            <span className="icon-[tabler--receipt] size-3.5"></span>
                            View
                          </button>
                          {canEdit && (
                            <button className="btn btn-soft btn-secondary btn-xs" title="Update Billing" onClick={() => setManageReport(r)}>
                              <span className="icon-[tabler--pencil] size-3.5"></span>
                              Update
                            </button>
                          )}
                        </div>
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

      <BillingModal
        report={viewReport}
        apiFetch={apiFetch}
        onClose={() => setViewReport(null)}
      />

      <ManageBillingModal
        report={manageReport}
        apiFetch={apiFetch}
        onClose={() => setManageReport(null)}
      />
    </Layout>
  )
}
