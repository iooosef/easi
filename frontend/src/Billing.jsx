import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from './auth'
import Layout from './Layout'
import Modal from './Modal'
import { useModal } from './modal/index.js'
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


/**
 * Layer 2 — billing items and payments list for a service report.
 * Pushed from ManageSRModal; pushes add/update layers on top.
 */
export function BillingManageModal({ report }) {
  const { pushModal, popModal } = useModal()
  const { apiFetch } = useAuth()

  const [items, setItems]                   = useState([])
  const [loading, setLoading]               = useState(true)
  const [refreshKey, setRefreshKey]         = useState(0)
  const [payments, setPayments]             = useState([])
  const [paymentsLoading, setPaymentsLoading] = useState(true)
  const [paymentsRefreshKey, setPaymentsRefreshKey] = useState(0)

  function refreshItems() { setRefreshKey(k => k + 1) }
  function refreshPayments() { setPaymentsRefreshKey(k => k + 1) }

  /** Fetches billing items for this service report. */
  useEffect(() => {
    let active = true
    setLoading(true)
    const params = new URLSearchParams({ srNumber: String(report.srNumber), page: '0', size: '1000', sort: 'srBillingNum,asc' })
    apiFetch(`/api/service-report-billing-items?${params}`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => { if (active) setItems(data.content ?? []) })
      .catch(() => { if (active) setItems([]) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [apiFetch, report.srNumber, refreshKey])

  /** Fetches payment logs for this service report. */
  useEffect(() => {
    let active = true
    setPaymentsLoading(true)
    apiFetch(`/api/payment-logs?srNumber=${encodeURIComponent(report.srNumber)}`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => { if (active) setPayments(Array.isArray(data) ? data : []) })
      .catch(() => { if (active) setPayments([]) })
      .finally(() => { if (active) setPaymentsLoading(false) })
    return () => { active = false }
  }, [apiFetch, report.srNumber, paymentsRefreshKey])

  return (
    <div className="modal-content w-full max-w-2xl my-auto">
      <div className="modal-header">
        <div>
          <h3 className="modal-title">Manage Billing — SR #{report.srNumber}</h3>
          <span className="text-sm text-base-content/50">{report.projectName}</span>
        </div>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body flex flex-col gap-4">
        <div className="flex justify-end">
          <button type="button" className="btn btn-primary btn-sm"
            onClick={() => pushModal(<AddBillingItemModal srNumber={report.srNumber} onSuccess={refreshItems} />)}>
            <span className="icon-[tabler--plus] size-4"></span>Add Billing Item
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><span className="loading loading-spinner loading-sm text-primary"></span></div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-base-content/40 text-sm">No billing items yet.</div>
        ) : (
          <div className="overflow-x-auto rounded-box border border-base-300">
            <table className="table table-zebra table-sm w-full">
              <thead>
                <tr><th>#</th><th>Description</th><th className="text-right">Qty</th><th className="text-right">Unit Price</th><th className="text-right">Amount</th><th>Action</th></tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.srBillingNum}>
                    <td className="font-mono text-xs">{item.srBillingNum}</td>
                    <td className="max-w-48"><span className="line-clamp-2 text-sm" title={item.description}>{item.description}</span></td>
                    <td className="text-right text-sm">{item.quantity}</td>
                    <td className="text-right text-sm">{formatCurrency(item.unitPrice)}</td>
                    <td className="text-right text-sm font-medium">{formatCurrency(item.quantity * Number(item.unitPrice))}</td>
                    <td>
                      <button className="btn btn-soft btn-secondary btn-xs"
                        onClick={() => pushModal(<UpdateBillingItemModal item={item} srNumber={report.srNumber} onSuccess={refreshItems} />)}>
                        <span className="icon-[tabler--pencil] size-3"></span>Update
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
        )}

        {!paymentsLoading && payments.length > 0 && (
          <>
            <div className="divider my-2 text-xs text-base-content/40">Payments</div>
            <div className="overflow-x-auto rounded-box border border-base-300">
              <table className="table table-zebra table-sm w-full">
                <thead>
                  <tr><th>Receipt Date</th><th>Paid By</th><th>Method</th><th>Receipt #</th><th className="text-right">Amount</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {payments.map(p => (
                    <tr key={p.logId}>
                      <td className="text-sm">{p.receiptDate ? String(p.receiptDate).slice(0, 10) : '—'}</td>
                      <td className="text-sm">{p.paidBy ?? '—'}</td>
                      <td className="text-sm">{formatPaymentMethod(p.paymentMethod)}</td>
                      <td className="font-mono text-xs">{p.receiptNumber ?? '—'}</td>
                      <td className="text-right text-sm font-medium">{formatCurrency(p.amount)}</td>
                      <td>
                        <button className="btn btn-soft btn-secondary btn-xs"
                          onClick={() => pushModal(<UpdatePaymentModal payment={p} items={items} payments={payments} srNumber={report.srNumber} onSuccess={refreshPayments} />)}>
                          <span className="icon-[tabler--pencil] size-3"></span>Update
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-soft btn-secondary" onClick={popModal}>Close</button>
      </div>
    </div>
  )
}

/** Add billing item form pushed from BillingManageModal. */
function AddBillingItemModal({ srNumber, onSuccess }) {
  const { popModal } = useModal()
  const { apiFetch } = useAuth()
  const [form, setForm] = useState(EMPTY_BILLING_FORM)
  const [formError, setFormError] = useState({})
  const [submitting, setSubmitting] = useState(false)

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  /** Submits the new billing item and closes this layer on success. */
  async function handleSubmit(e) {
    e.preventDefault()
    setFormError({})
    setSubmitting(true)
    try {
      const res = await apiFetch('/api/service-report-billing-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ srNumber, description: form.description, quantity: Number(form.quantity), unitPrice: Number(form.unitPrice) }),
      })
      if (!res.ok) { setFormError(await parseApiError(res)); notyfError('Add billing item failed'); return }
      popModal()
      notyfSuccess('Billing item added.')
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
        <h3 className="modal-title">Add Billing Item</h3>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body">
        <form id="add-billing-item-form" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="label-text font-medium">Description <span className="text-error">*</span></label>
              <input type="text" name="description" maxLength={255} required
                className={`input input-bordered w-full${formError.description ? ' is-invalid' : ''}`}
                placeholder="e.g. Labor — Coil Cleaning"
                value={form.description} onChange={handleChange} />
              {formError.description && <span className="helper-text">{formError.description}</span>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Quantity <span className="text-error">*</span></label>
              <input type="number" name="quantity" min={1} required
                className={`input input-bordered w-full${formError.quantity ? ' is-invalid' : ''}`}
                placeholder="e.g. 1"
                value={form.quantity} onChange={handleChange} />
              {formError.quantity && <span className="helper-text">{formError.quantity}</span>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Unit Price <span className="text-error">*</span></label>
              <input type="number" name="unitPrice" min={0} step="0.01" required
                className={`input input-bordered w-full${formError.unitPrice ? ' is-invalid' : ''}`}
                placeholder="e.g. 800.00"
                value={form.unitPrice} onChange={handleChange} />
              {formError.unitPrice && <span className="helper-text">{formError.unitPrice}</span>}
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
        <button type="submit" form="add-billing-item-form" className="btn btn-primary" disabled={submitting}>
          {submitting ? <span className="loading loading-spinner loading-sm"></span> : <span className="icon-[tabler--plus] size-4"></span>}
          Add Item
        </button>
      </div>
    </div>
  )
}

/** Update billing item form pushed from BillingManageModal. */
function UpdateBillingItemModal({ item, srNumber, onSuccess }) {
  const { popModal } = useModal()
  const { apiFetch } = useAuth()
  const [form, setForm] = useState({ description: item.description, quantity: item.quantity, unitPrice: item.unitPrice })
  const [formError, setFormError] = useState({})
  const [submitting, setSubmitting] = useState(false)

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  /** Submits the billing item update and closes this layer on success. */
  async function handleSubmit(e) {
    e.preventDefault()
    setFormError({})
    setSubmitting(true)
    try {
      const res = await apiFetch(`/api/service-report-billing-items/${item.srBillingNum}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ srNumber, description: form.description, quantity: Number(form.quantity), unitPrice: Number(form.unitPrice) }),
      })
      if (!res.ok) { setFormError(await parseApiError(res)); notyfError('Update failed'); return }
      popModal()
      notyfSuccess(`Billing item #${item.srBillingNum} updated.`)
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
          <h3 className="modal-title">Update Billing Item #{item.srBillingNum}</h3>
          <span className="text-sm text-base-content/50 line-clamp-1">{item.description}</span>
        </div>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body">
        <form id="update-billing-item-form" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="label-text font-medium">Description <span className="text-error">*</span></label>
              <input type="text" name="description" maxLength={255} required
                className={`input input-bordered w-full${formError.description ? ' is-invalid' : ''}`}
                value={form.description} onChange={handleChange} />
              {formError.description && <span className="helper-text">{formError.description}</span>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Quantity <span className="text-error">*</span></label>
              <input type="number" name="quantity" min={1} required
                className={`input input-bordered w-full${formError.quantity ? ' is-invalid' : ''}`}
                value={form.quantity} onChange={handleChange} />
              {formError.quantity && <span className="helper-text">{formError.quantity}</span>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Unit Price <span className="text-error">*</span></label>
              <input type="number" name="unitPrice" min={0} step="0.01" required
                className={`input input-bordered w-full${formError.unitPrice ? ' is-invalid' : ''}`}
                value={form.unitPrice} onChange={handleChange} />
              {formError.unitPrice && <span className="helper-text">{formError.unitPrice}</span>}
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
        <button type="submit" form="update-billing-item-form" className="btn btn-primary" disabled={submitting}>
          {submitting ? <span className="loading loading-spinner loading-sm"></span> : <span className="icon-[tabler--device-floppy] size-4"></span>}
          Save Changes
        </button>
      </div>
    </div>
  )
}

/** Update payment form pushed from BillingManageModal. */
function UpdatePaymentModal({ payment, items, payments, srNumber, onSuccess }) {
  const { popModal } = useModal()
  const { apiFetch } = useAuth()

  const updateBalance = Math.max(0, subtotal(items) -
    payments.reduce((s, p) => s + (p.logId !== payment.logId ? Number(p.amount ?? 0) : 0), 0))

  const [form, setForm] = useState({
    paidBy:        payment.paidBy ?? '',
    amount:        payment.amount ?? '',
    paymentMethod: payment.paymentMethod ?? 'cash',
    receiptDate:   payment.receiptDate ? String(payment.receiptDate).slice(0, 10) : '',
    receiptNumber: payment.receiptNumber ?? '',
    notes:         payment.notes ?? '',
  })
  const [formError, setFormError] = useState({})
  const [submitting, setSubmitting] = useState(false)

  function handleChange(e) {
    const { name, value } = e.target
    if (name === 'amount') {
      const num = parseFloat(value)
      if (!isNaN(num) && num < 0)              { setForm(prev => ({ ...prev, amount: '0' })); return }
      if (!isNaN(num) && num > updateBalance)  { setForm(prev => ({ ...prev, amount: updateBalance.toFixed(2) })); return }
    }
    setForm(prev => ({ ...prev, [name]: value }))
  }

  /** Submits the payment update and closes this layer on success. */
  async function handleSubmit(e) {
    e.preventDefault()
    setFormError({})
    setSubmitting(true)
    try {
      const res = await apiFetch(`/api/payment-logs/${payment.logId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          srNumber,
          paidBy:        form.paidBy,
          amount:        Number(form.amount),
          paymentMethod: form.paymentMethod,
          receiptDate:   form.receiptDate,
          receiptNumber: form.receiptNumber || null,
          notes:         form.notes || null,
        }),
      })
      if (!res.ok) { setFormError(await parseApiError(res)); notyfError('Update failed'); return }
      popModal()
      notyfSuccess(`Payment #${payment.logId} updated.`)
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
          <h3 className="modal-title">Update Payment #{payment.logId}</h3>
          <span className="text-sm text-base-content/50">{payment.paidBy}</span>
        </div>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body">
        <form id="update-payment-form" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="label-text font-medium">Paid By <span className="text-error">*</span></label>
              <input type="text" name="paidBy" maxLength={120} required
                className={`input input-bordered w-full${formError.paidBy ? ' is-invalid' : ''}`}
                value={form.paidBy} onChange={handleChange} />
              {formError.paidBy && <span className="helper-text">{formError.paidBy}</span>}
            </div>
            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="label-text font-medium">Amount <span className="text-error">*</span></label>
              <div className="flex gap-1 mb-1">
                {[25, 50, 75].map(p => (
                  <button key={p} type="button" className="btn btn-xs btn-soft btn-secondary flex-1"
                    onClick={() => setForm(prev => ({ ...prev, amount: ((p / 100) * updateBalance).toFixed(2) }))}>
                    {p}%
                  </button>
                ))}
                <button type="button" className="btn btn-xs btn-soft btn-primary flex-1"
                  onClick={() => setForm(prev => ({ ...prev, amount: updateBalance.toFixed(2) }))}>
                  Full
                </button>
              </div>
              <input type="number" name="amount" min="0.01" step="0.01" required
                className={`input input-bordered w-full${formError.amount ? ' is-invalid' : ''}`}
                value={form.amount} onChange={handleChange} />
              {formError.amount && <span className="helper-text">{formError.amount}</span>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Payment Method <span className="text-error">*</span></label>
              <select name="paymentMethod" required
                className={`select select-bordered w-full${formError.paymentMethod ? ' is-invalid' : ''}`}
                value={form.paymentMethod} onChange={handleChange}>
                <option value="cash">Cash</option>
                <option value="check">Check</option>
                <option value="gcash">GCash</option>
                <option value="bank">Bank Transfer</option>
              </select>
              {formError.paymentMethod && <span className="helper-text">{formError.paymentMethod}</span>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Receipt Date <span className="text-error">*</span></label>
              <input type="date" name="receiptDate" required
                className={`input input-bordered w-full${formError.receiptDate ? ' is-invalid' : ''}`}
                value={form.receiptDate} onChange={handleChange} />
              {formError.receiptDate && <span className="helper-text">{formError.receiptDate}</span>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Receipt #</label>
              <input type="text" name="receiptNumber" maxLength={60}
                className={`input input-bordered w-full${formError.receiptNumber ? ' is-invalid' : ''}`}
                placeholder="e.g. OR-2026-001"
                value={form.receiptNumber} onChange={handleChange} />
              {formError.receiptNumber && <span className="helper-text">{formError.receiptNumber}</span>}
            </div>
            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="label-text font-medium">Notes</label>
              <textarea name="notes" maxLength={255} rows={2}
                className={`textarea textarea-bordered w-full${formError.notes ? ' is-invalid' : ''}`}
                value={form.notes} onChange={handleChange} />
              {formError.notes && <span className="helper-text">{formError.notes}</span>}
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
        <button type="submit" form="update-payment-form" className="btn btn-primary" disabled={submitting}>
          {submitting ? <span className="loading loading-spinner loading-sm"></span> : <span className="icon-[tabler--device-floppy] size-4"></span>}
          Save Changes
        </button>
      </div>
    </div>
  )
}

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

  // Update billing sub-modal
  const [updateOpen, setUpdateOpen]               = useState(false)
  const [updatingItem, setUpdatingItem]           = useState(null)
  const [updateForm, setUpdateForm]               = useState(EMPTY_BILLING_FORM)
  const [updateFormError, setUpdateFormError]     = useState({})
  const [updateSubmitting, setUpdateSubmitting]   = useState(false)

  // Payments
  const [payments, setPayments]               = useState([])
  const [paymentsLoading, setPaymentsLoading] = useState(false)
  const [paymentsRefresh, setPaymentsRefresh] = useState(0)

  // Update payment sub-modal
  const [updatePaymentOpen, setUpdatePaymentOpen]             = useState(false)
  const [updatingPayment, setUpdatingPayment]                 = useState(null)
  const [updatePaymentForm, setUpdatePaymentForm]             = useState(EMPTY_PAYMENT_FORM)
  const [updatePaymentFormError, setUpdatePaymentFormError]   = useState({})
  const [updatePaymentSubmitting, setUpdatePaymentSubmitting] = useState(false)

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

  useEffect(() => {
    if (!report) { setPayments([]); return }
    let active = true
    setPaymentsLoading(true)
    apiFetch(`/api/payment-logs?srNumber=${encodeURIComponent(report.srNumber)}`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => { if (active) setPayments(Array.isArray(data) ? data : []) })
      .catch(() => { if (active) setPayments([]) })
      .finally(() => { if (active) setPaymentsLoading(false) })
    return () => { active = false }
  }, [apiFetch, report, paymentsRefresh])

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

  function openUpdatePayment(p) {
    setUpdatePaymentForm({
      paidBy:        p.paidBy ?? '',
      amount:        p.amount ?? '',
      paymentMethod: p.paymentMethod ?? 'cash',
      receiptDate:   p.receiptDate ? String(p.receiptDate).slice(0, 10) : '',
      receiptNumber: p.receiptNumber ?? '',
      notes:         p.notes ?? '',
    })
    setUpdatingPayment(p)
    setUpdatePaymentFormError({})
    setUpdatePaymentOpen(true)
  }

  function closeUpdatePayment() {
    setUpdatePaymentOpen(false)
    setUpdatingPayment(null)
    setUpdatePaymentForm(EMPTY_PAYMENT_FORM)
    setUpdatePaymentFormError({})
  }

  function handleUpdatePaymentChange(e) {
    const { name, value } = e.target
    if (name === 'amount') {
      const updateBalance = Math.max(0, subtotal(items) -
        payments.reduce((s, p) => s + (p.logId !== updatingPayment?.logId ? Number(p.amount ?? 0) : 0), 0))
      const num = parseFloat(value)
      if (!isNaN(num) && num < 0)             { setUpdatePaymentForm(prev => ({ ...prev, amount: '0' })); return }
      if (!isNaN(num) && num > updateBalance)  { setUpdatePaymentForm(prev => ({ ...prev, amount: updateBalance.toFixed(2) })); return }
    }
    setUpdatePaymentForm(prev => ({ ...prev, [name]: value }))
  }

  async function handleUpdatePaymentSubmit(e) {
    e.preventDefault()
    setUpdatePaymentFormError({})
    setUpdatePaymentSubmitting(true)
    try {
      const res = await apiFetch(`/api/payment-logs/${updatingPayment.logId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          srNumber:      report.srNumber,
          paidBy:        updatePaymentForm.paidBy,
          amount:        Number(updatePaymentForm.amount),
          paymentMethod: updatePaymentForm.paymentMethod,
          receiptDate:   updatePaymentForm.receiptDate,
          receiptNumber: updatePaymentForm.receiptNumber || null,
          notes:         updatePaymentForm.notes || null,
        }),
      })
      if (!res.ok) {
        setUpdatePaymentFormError(await parseApiError(res))
        notyfError('Update failed')
        return
      }
      closeUpdatePayment()
      notyfSuccess(`Payment #${updatingPayment.logId} updated.`)
      setPaymentsRefresh(k => k + 1)
    } catch (err) {
      setUpdatePaymentFormError({ _general: err.message })
    } finally {
      setUpdatePaymentSubmitting(false)
    }
  }

  return (
    <>
      <Modal
        isOpen={!!report}
        onClose={addOpen ? undefined : onClose}
        hideClose={addOpen}
        title={`Manage Billing — SR #${report?.srNumber ?? ''}`}
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

            {/* Payments section — shown when payments exist */}
            {!paymentsLoading && payments.length > 0 && (
              <>
                <div className="divider my-2 text-xs text-base-content/40">Payments</div>
                <div className="overflow-x-auto rounded-box border border-base-300">
                  <table className="table table-zebra table-sm w-full">
                    <thead>
                      <tr>
                        <th>Receipt Date</th>
                        <th>Paid By</th>
                        <th>Method</th>
                        <th>Receipt #</th>
                        <th className="text-right">Amount</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map(p => (
                        <tr key={p.logId}>
                          <td className="text-sm">{p.receiptDate ? String(p.receiptDate).slice(0, 10) : '—'}</td>
                          <td className="text-sm">{p.paidBy ?? '—'}</td>
                          <td className="text-sm">{formatPaymentMethod(p.paymentMethod)}</td>
                          <td className="font-mono text-xs">{p.receiptNumber ?? '—'}</td>
                          <td className="text-right text-sm font-medium">{formatCurrency(p.amount)}</td>
                          <td>
                            <button className="btn btn-soft btn-secondary btn-xs" onClick={() => openUpdatePayment(p)}>
                              <span className="icon-[tabler--pencil] size-3"></span>
                              Update
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </Modal>

      {/* Update billing sub-modal — sits above Manage modal */}
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
      {/* Update payment sub-modal — sits above Manage modal */}
      {updatePaymentOpen && (
        <>
          <div className="fixed inset-0 bg-base-300/40 z-[55]" onClick={closeUpdatePayment} />
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="modal-content w-full max-w-md shadow-xl">
              <div className="modal-header">
                <div>
                  <h3 className="modal-title">Update Payment #{updatingPayment?.logId}</h3>
                  <span className="text-sm text-base-content/50">{updatingPayment?.paidBy}</span>
                </div>
                <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={closeUpdatePayment}>
                  <span className="icon-[tabler--x] size-4"></span>
                </button>
              </div>
              <div className="modal-body">
                <form id="update-payment-form" onSubmit={handleUpdatePaymentSubmit}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                    <div className="sm:col-span-2 flex flex-col gap-1">
                      <label className="label-text font-medium">Paid By <span className="text-error">*</span></label>
                      <input type="text" name="paidBy" maxLength={120} required
                        className={`input input-bordered w-full${updatePaymentFormError.paidBy ? ' is-invalid' : ''}`}
                        value={updatePaymentForm.paidBy} onChange={handleUpdatePaymentChange} />
                      {updatePaymentFormError.paidBy && <span className="helper-text">{updatePaymentFormError.paidBy}</span>}
                    </div>


                    {(() => {
                      const updateBalance = Math.max(0, subtotal(items) -
                        payments.reduce((s, p) => s + (p.logId !== updatingPayment?.logId ? Number(p.amount ?? 0) : 0), 0))
                      return (
                        <div className="sm:col-span-2 flex flex-col gap-1">
                          <label className="label-text font-medium">Amount <span className="text-error">*</span></label>
                          <div className="flex gap-1 mb-1">
                            {[25, 50, 75].map(p => (
                              <button key={p} type="button"
                                className="btn btn-xs btn-soft btn-secondary flex-1"
                                onClick={() => setUpdatePaymentForm(prev => ({ ...prev, amount: ((p / 100) * updateBalance).toFixed(2) }))}>
                                {p}%
                              </button>
                            ))}
                            <button type="button"
                              className="btn btn-xs btn-soft btn-primary flex-1"
                              onClick={() => setUpdatePaymentForm(prev => ({ ...prev, amount: updateBalance.toFixed(2) }))}>
                              Full
                            </button>
                          </div>
                          <input type="number" name="amount" min="0.01" step="0.01" required
                            className={`input input-bordered w-full${updatePaymentFormError.amount ? ' is-invalid' : ''}`}
                            value={updatePaymentForm.amount} onChange={handleUpdatePaymentChange} />
                          {updatePaymentFormError.amount && <span className="helper-text">{updatePaymentFormError.amount}</span>}
                        </div>
                      )
                    })()}

                    <div className="flex flex-col gap-1">
                      <label className="label-text font-medium">Payment Method <span className="text-error">*</span></label>
                      <select name="paymentMethod" required
                        className={`select select-bordered w-full${updatePaymentFormError.paymentMethod ? ' is-invalid' : ''}`}
                        value={updatePaymentForm.paymentMethod} onChange={handleUpdatePaymentChange}>
                        <option value="cash">Cash</option>
                        <option value="check">Check</option>
                        <option value="gcash">GCash</option>
                        <option value="bank">Bank Transfer</option>
                      </select>
                      {updatePaymentFormError.paymentMethod && <span className="helper-text">{updatePaymentFormError.paymentMethod}</span>}
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="label-text font-medium">Receipt Date <span className="text-error">*</span></label>
                      <input type="date" name="receiptDate" required
                        className={`input input-bordered w-full${updatePaymentFormError.receiptDate ? ' is-invalid' : ''}`}
                        value={updatePaymentForm.receiptDate} onChange={handleUpdatePaymentChange} />
                      {updatePaymentFormError.receiptDate && <span className="helper-text">{updatePaymentFormError.receiptDate}</span>}
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="label-text font-medium">Receipt #</label>
                      <input type="text" name="receiptNumber" maxLength={60}
                        className={`input input-bordered w-full${updatePaymentFormError.receiptNumber ? ' is-invalid' : ''}`}
                        placeholder="e.g. OR-2026-001"
                        value={updatePaymentForm.receiptNumber} onChange={handleUpdatePaymentChange} />
                      {updatePaymentFormError.receiptNumber && <span className="helper-text">{updatePaymentFormError.receiptNumber}</span>}
                    </div>

                    <div className="sm:col-span-2 flex flex-col gap-1">
                      <label className="label-text font-medium">Notes</label>
                      <textarea name="notes" maxLength={255} rows={2}
                        className={`textarea textarea-bordered w-full${updatePaymentFormError.notes ? ' is-invalid' : ''}`}
                        value={updatePaymentForm.notes} onChange={handleUpdatePaymentChange} />
                      {updatePaymentFormError.notes && <span className="helper-text">{updatePaymentFormError.notes}</span>}
                    </div>

                    {updatePaymentFormError._general && (
                      <div className="sm:col-span-2 alert alert-error py-2">
                        <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                        <span className="text-sm">{updatePaymentFormError._general}</span>
                      </div>
                    )}
                  </div>
                </form>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-soft btn-secondary" onClick={closeUpdatePayment}>Cancel</button>
                <button type="submit" form="update-payment-form" className="btn btn-primary" disabled={updatePaymentSubmitting}>
                  {updatePaymentSubmitting
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

/** Formats a payment method string for display */
function formatPaymentMethod(m) {
  if (!m) return '—'
  const map = { cash: 'Cash', check: 'Check', gcash: 'GCash', bank: 'Bank Transfer', unset: 'Unset' }
  return map[m.toLowerCase()] ?? m
}

// ---------------------------------------------------------------------------
// Parts billing strategies
// Each function receives (apiFetch, srNumber) and resolves to an array of:
//   { _key, name, qty, unitPrice }
// To switch strategies, change the one assignment below.
// ---------------------------------------------------------------------------

/** Bills only parts that have a PartUsage record linked to this SR. */
async function fetchPartsByUsage(apiFetch, srNumber) {
  const res = await apiFetch(`/api/part-usages?srNumber=${encodeURIComponent(srNumber)}&size=1000`)
  if (!res.ok) throw new Error(`Failed to load part usages (${res.status})`)
  const data = await res.json()
  return (data.content ?? []).map(u => ({
    _key:      u.usageId,
    name:      u.partName,
    qty:       u.qtyUsed,
    unitPrice: u.unitPrice,
  }))
}

/** Bills all parts from Purchase Orders linked to this SR, regardless of usage. */
async function fetchPartsByPO(apiFetch, srNumber) {
  const poRes = await apiFetch(`/api/purchase-orders?srNum=${encodeURIComponent(srNumber)}&size=100`)
  if (!poRes.ok) throw new Error(`Failed to load purchase orders (${poRes.status})`)
  const poData = await poRes.json()
  const pos = poData.content ?? []
  if (pos.length === 0) return []
  const pages = await Promise.all(
    pos.map(po =>
      apiFetch(`/api/parts?poNum=${encodeURIComponent(po.poNum)}&size=100`)
        .then(r => r.ok ? r.json() : { content: [] })
        .then(d => d.content ?? [])
    )
  )
  return pages.flat().map(p => ({
    _key:      p.partId,
    name:      p.name,
    qty:       p.quantityOrdered,
    unitPrice: p.unitPrice,
  }))
}

// ← swap fetchPartsByUsage ↔ fetchPartsByPO to change billing strategy
const PARTS_BILLING_STRATEGY = fetchPartsByPO

// ---------------------------------------------------------------------------

/** Modal showing SR details, billing items, parts from POs, payments, and totals */
function BillingModal({ report, apiFetch, onClose }) {
  const [billingItems, setBillingItems]     = useState([])
  const [billingLoading, setBillingLoading] = useState(true)
  const [billingError, setBillingError]     = useState(null)

  const [parts, setParts]             = useState([])
  const [partsLoading, setPartsLoading] = useState(true)
  const [partsError, setPartsError]   = useState(null)

  const [payments, setPayments]             = useState([])
  const [paymentsLoading, setPaymentsLoading] = useState(true)
  const [paymentsError, setPaymentsError]   = useState(null)

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
    PARTS_BILLING_STRATEGY(apiFetch, report.srNumber)
      .then(items => { if (active) setParts(items) })
      .catch(err => { if (active) setPartsError(err.message) })
      .finally(() => { if (active) setPartsLoading(false) })
    return () => { active = false }
  }, [apiFetch, report])

  useEffect(() => {
    if (!report) return
    let active = true
    setPaymentsLoading(true)
    setPaymentsError(null)
    apiFetch(`/api/payment-logs?srNumber=${encodeURIComponent(report.srNumber)}`)
      .then(res => {
        if (!res.ok) throw new Error(`Failed to load payments (${res.status})`)
        return res.json()
      })
      .then(data => { if (active) setPayments(Array.isArray(data) ? data : []) })
      .catch(err => { if (active) setPaymentsError(err.message) })
      .finally(() => { if (active) setPaymentsLoading(false) })
    return () => { active = false }
  }, [apiFetch, report])

  if (!report) return null

  const billingSubtotal = subtotal(billingItems)
  const partsSubtotal   = parts.reduce((sum, p) => sum + (p.qty ?? 0) * Number(p.unitPrice ?? 0), 0)
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
                <span className="text-xs text-base-content/50 uppercase tracking-wide">Schedule Date</span>
                <span className="text-sm font-medium">{formatDate(report.scheduleDate)}</span>
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
                        <th>Part</th>
                        <th className="text-right">Qty</th>
                        <th className="text-right">Unit Price</th>
                        <th className="text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parts.map(part => (
                        <tr key={part._key}>
                          <td className="max-w-48"><span className="line-clamp-2 text-sm" title={part.name}>{part.name}</span></td>
                          <td className="text-right text-sm">{part.qty}</td>
                          <td className="text-right text-sm">{formatCurrency(part.unitPrice)}</td>
                          <td className="text-right text-sm font-medium">{formatCurrency(part.qty * Number(part.unitPrice))}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={3} className="text-right text-sm font-semibold">Parts Subtotal</td>
                        <td className="text-right text-sm font-semibold">{formatCurrency(partsSubtotal)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* Payments */}
            <div>
              <p className="text-xs text-base-content/50 uppercase tracking-wide mb-3">Payments</p>
              {paymentsLoading && <div className="flex justify-center py-6"><span className="loading loading-spinner loading-md text-primary"></span></div>}
              {paymentsError && <div className="alert alert-error py-2 text-sm"><span className="icon-[tabler--alert-circle] size-4"></span>{paymentsError}</div>}
              {!paymentsLoading && !paymentsError && payments.length === 0 && (
                <p className="text-sm text-base-content/40 text-center py-4">No payments recorded.</p>
              )}
              {!paymentsLoading && !paymentsError && payments.length > 0 && (
                <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
                  <table className="table table-zebra table-sm w-full">
                    <thead>
                      <tr>
                        <th>Receipt Date</th>
                        <th>Paid By</th>
                        <th>Method</th>
                        <th>Receipt #</th>
                        <th>Notes</th>
                        <th className="text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map(p => (
                        <tr key={p.logId}>
                          <td className="text-sm">{formatDate(p.receiptDate)}</td>
                          <td className="text-sm">{p.paidBy ?? '—'}</td>
                          <td className="text-sm">{formatPaymentMethod(p.paymentMethod)}</td>
                          <td className="font-mono text-xs">{p.receiptNumber ?? '—'}</td>
                          <td className="max-w-40"><span className="line-clamp-2 text-sm" title={p.notes}>{p.notes ?? '—'}</span></td>
                          <td className="text-right text-sm font-medium">{formatCurrency(p.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={5} className="text-right text-sm font-semibold">Total Paid</td>
                        <td className="text-right text-sm font-semibold text-success">
                          {formatCurrency(payments.reduce((s, p) => s + Number(p.amount ?? 0), 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* Grand Total */}
            {!billingLoading && !partsLoading && !paymentsLoading && (() => {
              const totalPaid = payments.reduce((s, p) => s + Number(p.amount ?? 0), 0)
              const balance   = grandTotal - totalPaid
              return (
                <div className="flex justify-end">
                  <div className="rounded-box border border-base-300 bg-base-200 px-6 py-3 flex flex-col sm:flex-row items-end sm:items-center gap-4 sm:gap-8">
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-base-content/70">Grand Total</span>
                      <span className="text-base font-bold">{formatCurrency(grandTotal)}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-base-content/70">Total Paid</span>
                      <span className="text-base font-bold text-success">{formatCurrency(totalPaid)}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-base-content/70">Balance</span>
                      <span className={`text-lg font-bold ${balance <= 0 ? 'text-success' : 'text-error'}`}>
                        {formatCurrency(Math.max(balance, 0))}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })()}

          </div>
        </div>
      </div>
    </>
  )
}

const EMPTY_PAYMENT_FORM = { paidBy: '', amount: '', paymentMethod: 'cash', receiptDate: '', receiptNumber: '', notes: '' }

/** Modal for recording a new payment against an SR */
function AddPaymentModal({ report, apiFetch, onClose, onSuccess }) {
  const [form, setForm]           = useState(EMPTY_PAYMENT_FORM)
  const [formError, setFormError] = useState({})
  const [submitting, setSubmitting] = useState(false)

  const balance = Math.max(0, Number(report?.totalBilled ?? 0) - Number(report?.totalPaid ?? 0))

  useEffect(() => {
    if (report) { setForm(EMPTY_PAYMENT_FORM); setFormError({}) }
  }, [report])

  function handleChange(e) {
    const { name, value } = e.target
    if (name === 'amount' && balance > 0) {
      const num = parseFloat(value)
      if (!isNaN(num) && num < 0)       { setForm(prev => ({ ...prev, amount: '0' })); return }
      if (!isNaN(num) && num > balance)  { setForm(prev => ({ ...prev, amount: balance.toFixed(2) })); return }
    }
    setForm(prev => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError({})
    setSubmitting(true)
    try {
      const res = await apiFetch('/api/payment-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          srNumber:      report.srNumber,
          paidBy:        form.paidBy,
          amount:        Number(form.amount),
          paymentMethod: form.paymentMethod,
          receiptDate:   form.receiptDate,
          receiptNumber: form.receiptNumber || null,
          notes:         form.notes || null,
        }),
      })
      if (!res.ok) {
        setFormError(await parseApiError(res))
        notyfError('Payment failed to record')
        return
      }
      notyfSuccess('Payment recorded.')
      onSuccess()
    } catch (err) {
      setFormError({ _general: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      isOpen={!!report}
      onClose={onClose}
      title={`Record Payment — SR #${report?.srNumber ?? ''}`}
      size="max-w-lg"
      footer={
        <>
          <button type="button" className="btn btn-soft btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" form="add-payment-form" className="btn btn-success" disabled={submitting}>
            {submitting
              ? <span className="loading loading-spinner loading-sm"></span>
              : <span className="icon-[tabler--cash] size-4"></span>
            }
            Record Payment
          </button>
        </>
      }
    >
      <form id="add-payment-form" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          <div className="sm:col-span-2 flex flex-col gap-1">
            <label className="label-text font-medium">Paid By <span className="text-error">*</span></label>
            <input type="text" name="paidBy" maxLength={120} required
              className={`input input-bordered w-full${formError.paidBy ? ' is-invalid' : ''}`}
              placeholder="Enter Name or Organization"
              value={form.paidBy} onChange={handleChange} />
            {formError.paidBy && <span className="helper-text">{formError.paidBy}</span>}
          </div>


          <div className="sm:col-span-2 flex flex-col gap-1">
            <label className="label-text font-medium">Amount <span className="text-error">*</span></label>
            <div className="flex gap-1 mb-1">
              {[25, 50, 75].map(p => (
                <button key={p} type="button"
                  className="btn btn-xs btn-soft btn-secondary flex-1"
                  onClick={() => setForm(prev => ({ ...prev, amount: ((p / 100) * balance).toFixed(2) }))}>
                  {p}%
                </button>
              ))}
              <button type="button"
                className="btn btn-xs btn-soft btn-primary flex-1"
                onClick={() => setForm(prev => ({ ...prev, amount: balance.toFixed(2) }))}>
                Full
              </button>
            </div>
            <input type="number" name="amount" min="0.01" step="0.01" required
              className={`input input-bordered w-full${formError.amount ? ' is-invalid' : ''}`}
              placeholder="e.g. 1500.00"
              value={form.amount} onChange={handleChange} />
            {formError.amount && <span className="helper-text">{formError.amount}</span>}
          </div>

          <div className="flex flex-col gap-1">
            <label className="label-text font-medium">Payment Method <span className="text-error">*</span></label>
            <select name="paymentMethod" required
              className={`select select-bordered w-full${formError.paymentMethod ? ' is-invalid' : ''}`}
              value={form.paymentMethod} onChange={handleChange}>
              <option value="cash">Cash</option>
              <option value="check">Check</option>
              <option value="gcash">GCash</option>
              <option value="bank">Bank Transfer</option>
            </select>
            {formError.paymentMethod && <span className="helper-text">{formError.paymentMethod}</span>}
          </div>

          <div className="flex flex-col gap-1">
            <label className="label-text font-medium">Receipt Date <span className="text-error">*</span></label>
            <input type="date" name="receiptDate" required
              className={`input input-bordered w-full${formError.receiptDate ? ' is-invalid' : ''}`}
              value={form.receiptDate} onChange={handleChange} />
            {formError.receiptDate && <span className="helper-text">{formError.receiptDate}</span>}
          </div>

          <div className="flex flex-col gap-1">
            <label className="label-text font-medium">Receipt #</label>
            <input type="text" name="receiptNumber" maxLength={60}
              className={`input input-bordered w-full${formError.receiptNumber ? ' is-invalid' : ''}`}
              placeholder="e.g. OR-2026-001"
              value={form.receiptNumber} onChange={handleChange} />
            {formError.receiptNumber && <span className="helper-text">{formError.receiptNumber}</span>}
          </div>

          <div className="sm:col-span-2 flex flex-col gap-1">
            <label className="label-text font-medium">Notes</label>
            <textarea name="notes" maxLength={255} rows={2}
              className={`textarea textarea-bordered w-full${formError.notes ? ' is-invalid' : ''}`}
              placeholder="Optional notes"
              value={form.notes} onChange={handleChange} />
            {formError.notes && <span className="helper-text">{formError.notes}</span>}
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
  )
}

export default function Billing() {
  const { apiFetch, hasRole } = useAuth()
  const canEdit = hasRole('ADMIN', 'ACCOUNTING')
  const [searchParams] = useSearchParams()

  const [reports, setReports]             = useState([])
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState(null)
  const [search, setSearch]               = useState('')
  const [statusFilter, setStatusFilter]   = useState(() => searchParams.get('status') ?? '')
  const [page, setPage]                   = useState(0)
  const [totalPages, setTotalPages]       = useState(0)
  const [totalElements, setTotalElements] = useState(0)
  const [refresh, setRefresh]             = useState(0)

  const [viewReport, setViewReport]     = useState(null)
  const [manageReport, setManageReport] = useState(null)
  const [payReport, setPayReport]       = useState(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ page: String(page), size: String(SR_PAGE_SIZE), sort: 'srNumber,asc' })
    if (statusFilter) params.set('status', statusFilter)
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
  }, [apiFetch, page, refresh, statusFilter])

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
        <select
          className="select select-bordered w-40 shrink-0"
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(0) }}
        >
          <option value="">All statuses</option>
          <option value="unpaid,partial">Unpaid &amp; Partial</option>
          <option value="unpaid">Unpaid</option>
          <option value="partial">Partial</option>
          <option value="paid">Paid</option>
        </select>
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
                        <div className="flex gap-1 flex-wrap">
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
                          {canEdit && (r.status === 'unpaid' || r.status === 'partial') && (
                            <button className="btn btn-soft btn-success btn-xs" title="Record Payment" onClick={() => setPayReport(r)}>
                              <span className="icon-[tabler--cash] size-3.5"></span>
                              Pay
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

      <AddPaymentModal
        report={payReport}
        apiFetch={apiFetch}
        onClose={() => setPayReport(null)}
        onSuccess={() => { setPayReport(null); setRefresh(k => k + 1) }}
      />
    </Layout>
  )
}
