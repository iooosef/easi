import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { useModal } from '../modals/index.js'
import Layout from '../components/Layout'
import { notyfSuccess, notyfError } from '../notyf'

/** Parses a failed API response into field-level or general errors. */
async function parseApiError(res) {
  const data = await res.json().catch(() => ({}))
  if (data.errors) return data.errors
  return { _general: data.message ?? data.error ?? `Error ${res.status}` }
}

/** Formats a datetime string to YYYY-MM-DD */
function formatDate(dt) {
  if (!dt) return '—'
  return String(dt).slice(0, 10)
}

const PAGE_SIZE = 10
const EMPTY_SUPPLIER_FORM = { name: '', address: '' }

/** Modal component for updating an existing supplier. */
function UpdateSupplierModal({ supplier, onSuccess }) {
  const { popModal } = useModal()
  const { apiFetch } = useAuth()
  const [form, setForm] = useState({ name: supplier.name, address: supplier.address })
  const [formError, setFormError] = useState({})
  const [submitting, setSubmitting] = useState(false)

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError({})
    setSubmitting(true)
    try {
      const res = await apiFetch(`/api/suppliers/${supplier.supplierId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        setFormError(await parseApiError(res))
        notyfError('Update failed')
        return
      }
      notyfSuccess(`Supplier #${supplier.supplierId} updated successfully.`)
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
          <h3 className="modal-title">Update Supplier #{supplier.supplierId}</h3>
          <span className="text-sm text-base-content/50">{supplier.name}</span>
        </div>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body">
        <form id="supplier-update-form" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4">

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Name <span className="text-error">*</span></label>
              <input type="text" name="name"
                className={`input input-bordered w-full${formError.name ? ' is-invalid' : ''}`}
                maxLength={120} required
                value={form.name} onChange={handleChange} />
              {formError.name && <span className="helper-text">{formError.name}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Address <span className="text-error">*</span></label>
              <textarea name="address"
                className={`textarea textarea-bordered w-full${formError.address ? ' is-invalid' : ''}`}
                maxLength={600} rows={3} required
                value={form.address} onChange={handleChange} />
              {formError.address && <span className="helper-text">{formError.address}</span>}
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
        <button type="button" className="btn btn-soft btn-secondary" onClick={popModal}>
          Cancel
        </button>
        <button type="submit" form="supplier-update-form" className="btn btn-primary" disabled={submitting}>
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

/** Modal component for adding a new supplier. */
function AddSupplierModal({ onSuccess }) {
  const { popModal } = useModal()
  const { apiFetch } = useAuth()
  const [form, setForm] = useState(EMPTY_SUPPLIER_FORM)
  const [formError, setFormError] = useState({})
  const [submitting, setSubmitting] = useState(false)

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError({})
    setSubmitting(true)
    try {
      const res = await apiFetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        setFormError(await parseApiError(res))
        notyfError('Add supplier failed')
        return
      }
      notyfSuccess('Supplier added successfully.')
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
        <h3 className="modal-title">Add Supplier</h3>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body">
        <form id="supplier-add-form" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4">

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Name <span className="text-error">*</span></label>
              <input type="text" name="name"
                className={`input input-bordered w-full${formError.name ? ' is-invalid' : ''}`}
                placeholder="e.g. ABC Industrial Supply" maxLength={120} required
                value={form.name} onChange={handleChange} />
              {formError.name && <span className="helper-text">{formError.name}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Address <span className="text-error">*</span></label>
              <textarea name="address"
                className={`textarea textarea-bordered w-full${formError.address ? ' is-invalid' : ''}`}
                placeholder="Full address" maxLength={600} rows={3} required
                value={form.address} onChange={handleChange} />
              {formError.address && <span className="helper-text">{formError.address}</span>}
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
        <button type="button" className="btn btn-soft btn-secondary" onClick={popModal}>
          Cancel
        </button>
        <button type="submit" form="supplier-add-form" className="btn btn-primary" disabled={submitting}>
          {submitting
            ? <span className="loading loading-spinner loading-sm"></span>
            : <span className="icon-[tabler--plus] size-4"></span>
          }
          Add Supplier
        </button>
      </div>
    </div>
  )
}

export default function InventorySuppliers() {
  const { apiFetch, hasRole } = useAuth()
  const { pushModal } = useModal()
  const canEdit = hasRole('ADMIN', 'ACCOUNTING', 'STAFF')
  const [searchParams] = useSearchParams()

  const [suppliers, setSuppliers]       = useState([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState(null)
  const [page, setPage]                 = useState(0)
  const [totalPages, setTotalPages]     = useState(0)
  const [totalElements, setTotalElements] = useState(0)
  const [refreshKey, setRefreshKey]     = useState(0)

  function openAddSupplier() {
    pushModal(<AddSupplierModal onSuccess={() => { setPage(0); setRefreshKey(k => k + 1) }} />)
  }

  // Auto-open Add Supplier modal when ?addSupplier=1 is in the URL
  useEffect(() => {
    if (canEdit && searchParams.get('addSupplier') === '1') {
      openAddSupplier()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /** Fetches suppliers, sorted by name ascending. */
  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({
      page: String(page),
      size: String(PAGE_SIZE),
      sort: 'name,asc',
    })
    apiFetch(`/api/suppliers?${params}`)
      .then(res => {
        if (!res.ok) throw new Error(`Failed to load suppliers (${res.status})`)
        return res.json()
      })
      .then(data => {
        if (!active) return
        setSuppliers(data.content ?? [])
        setTotalPages(data.totalPages ?? 0)
        setTotalElements(data.totalElements ?? 0)
      })
      .catch(err => { if (active) setError(err.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [apiFetch, page, refreshKey])

  function openUpdate(s) {
    pushModal(<UpdateSupplierModal supplier={s} onSuccess={() => setRefreshKey(k => k + 1)} />)
  }

  return (
    <Layout activePage="inventory">
      {/* Header */}
      <div className="flex items-stretch justify-between h-16 mb-6">
        <div>
          <h1 className="text-3xl font-semibold">Suppliers</h1>
          <p className="text-base-content/60 mt-1">Manage supplier records used across purchase orders</p>
        </div>
        {canEdit && (
          <button
            type="button"
            className="btn btn-primary h-full min-h-0"
            onClick={openAddSupplier}
          >
            <span className="icon-[tabler--plus] size-4"></span>
            Add Supplier
          </button>
        )}
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
            {totalElements} supplier{totalElements !== 1 ? 's' : ''} total
          </p>

          {suppliers.length === 0 ? (
            <div className="text-center py-20 text-base-content/40">
              <span className="icon-[tabler--building-store] size-12 mx-auto mb-3 block"></span>
              <p>No suppliers found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
              <table className="table table-zebra w-full">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Address</th>
                    <th>Added On</th>
                    {canEdit && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map(s => (
                    <tr key={s.supplierId}>
                      <td className="font-mono font-semibold">{s.supplierId}</td>
                      <td className="font-medium max-w-48">
                        <span className="line-clamp-1" title={s.name}>{s.name}</span>
                      </td>
                      <td className="max-w-64 text-base-content/70 whitespace-pre-wrap break-words">
                        {s.address}
                      </td>
                      <td className="text-sm">{formatDate(s.addedOn)}</td>
                      {canEdit && (
                        <td>
                          <button
                            className="btn btn-soft btn-secondary btn-sm"
                            onClick={() => openUpdate(s)}
                          >
                            <span className="icon-[tabler--pencil] size-4"></span>
                            Update
                          </button>
                        </td>
                      )}
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
