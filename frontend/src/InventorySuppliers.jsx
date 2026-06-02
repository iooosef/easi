import { useState, useEffect } from 'react'
import { useAuth } from './auth'
import Layout from './Layout'
import { notyfSuccess, notyfError } from './notyf'

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

export default function InventorySuppliers() {
  const { apiFetch, hasRole } = useAuth()
  const canEdit = hasRole('ADMIN', 'ACCOUNTING', 'STAFF')

  const [suppliers, setSuppliers]       = useState([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState(null)
  const [page, setPage]                 = useState(0)
  const [totalPages, setTotalPages]     = useState(0)
  const [totalElements, setTotalElements] = useState(0)
  const [refreshKey, setRefreshKey]     = useState(0)

  // Add Supplier inline panel
  const [addOpen, setAddOpen]                   = useState(false)
  const [supplierForm, setSupplierForm]         = useState(EMPTY_SUPPLIER_FORM)
  const [supplierFormError, setSupplierFormError] = useState({})
  const [supplierFormSubmitting, setSupplierFormSubmitting] = useState(false)

  // Update Supplier sub-modal
  const [updateOpen, setUpdateOpen]                   = useState(false)
  const [updatingSupplier, setUpdatingSupplier]       = useState(null)
  const [updateForm, setUpdateForm]                   = useState({})
  const [updateFormError, setUpdateFormError]         = useState({})
  const [updateSubmitting, setUpdateSubmitting]       = useState(false)

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

  function handleSupplierFormChange(e) {
    const { name, value } = e.target
    setSupplierForm(prev => ({ ...prev, [name]: value }))
  }

  async function handleAddSubmit(e) {
    e.preventDefault()
    setSupplierFormError({})
    setSupplierFormSubmitting(true)
    try {
      const res = await apiFetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(supplierForm),
      })
      if (!res.ok) {
        setSupplierFormError(await parseApiError(res))
        notyfError('Add supplier failed')
        return
      }
      setAddOpen(false)
      setSupplierForm(EMPTY_SUPPLIER_FORM)
      setSupplierFormError({})
      notyfSuccess('Supplier added successfully.')
      setPage(0)
      setRefreshKey(k => k + 1)
    } catch (err) {
      setSupplierFormError({ _general: err.message })
    } finally {
      setSupplierFormSubmitting(false)
    }
  }

  function openUpdate(s) {
    setUpdateForm({ name: s.name, address: s.address })
    setUpdatingSupplier(s)
    setUpdateFormError({})
    setUpdateOpen(true)
  }

  function closeUpdate() {
    setUpdateOpen(false)
    setUpdatingSupplier(null)
    setUpdateForm({})
    setUpdateFormError({})
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
      const res = await apiFetch(`/api/suppliers/${updatingSupplier.supplierId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateForm),
      })
      if (!res.ok) {
        setUpdateFormError(await parseApiError(res))
        notyfError('Update failed')
        return
      }
      closeUpdate()
      notyfSuccess(`Supplier #${updatingSupplier.supplierId} updated successfully.`)
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
          <h1 className="text-3xl font-semibold">Suppliers</h1>
          <p className="text-base-content/60 mt-1">Manage supplier records used across purchase orders</p>
        </div>
        {canEdit && !addOpen && (
          <button
            type="button"
            className="btn btn-primary h-full min-h-0"
            onClick={() => { setSupplierForm(EMPTY_SUPPLIER_FORM); setSupplierFormError({}); setAddOpen(true) }}
          >
            <span className="icon-[tabler--plus] size-4"></span>
            Add Supplier
          </button>
        )}
      </div>

      {/* Inline Add Supplier Form */}
      {addOpen && (
        <div className="card bg-base-100 border border-base-300 mb-6">
          <div className="card-body">
            <h2 className="card-title text-base mb-2">New Supplier</h2>
            <form onSubmit={handleAddSubmit}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">

                <div className="sm:col-span-2 flex flex-col gap-1">
                  <label className="label-text font-medium">Name <span className="text-error">*</span></label>
                  <input type="text" name="name"
                    className={`input input-bordered w-full${supplierFormError.name ? ' is-invalid' : ''}`}
                    placeholder="e.g. ABC Industrial Supply" maxLength={120} required
                    value={supplierForm.name} onChange={handleSupplierFormChange} />
                  {supplierFormError.name && <span className="helper-text">{supplierFormError.name}</span>}
                </div>

                <div className="sm:col-span-2 flex flex-col gap-1">
                  <label className="label-text font-medium">Address <span className="text-error">*</span></label>
                  <textarea name="address"
                    className={`textarea textarea-bordered w-full${supplierFormError.address ? ' is-invalid' : ''}`}
                    placeholder="Full address" maxLength={600} rows={3} required
                    value={supplierForm.address} onChange={handleSupplierFormChange} />
                  {supplierFormError.address && <span className="helper-text">{supplierFormError.address}</span>}
                </div>

                {supplierFormError._general && (
                  <div className="sm:col-span-2 alert alert-error py-2">
                    <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                    <span className="text-sm">{supplierFormError._general}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 justify-end">
                <button type="button" className="btn btn-soft btn-secondary btn-sm"
                  onClick={() => { setAddOpen(false); setSupplierForm(EMPTY_SUPPLIER_FORM); setSupplierFormError({}) }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={supplierFormSubmitting}>
                  {supplierFormSubmitting
                    ? <span className="loading loading-spinner loading-xs"></span>
                    : <span className="icon-[tabler--plus] size-4"></span>
                  }
                  Add Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                      <td className="max-w-64 text-base-content/70">
                        <span className="line-clamp-1" title={s.address}>{s.address}</span>
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

      {/* Update Supplier Sub-modal */}
      {updateOpen && (
        <>
          <div className="fixed inset-0 bg-base-300/40 z-[45]" onClick={closeUpdate} />
          <div className="fixed inset-0 z-[50] flex items-center justify-center p-4">
            <div className="modal-content w-full max-w-md shadow-xl">
              <div className="modal-header">
                <div>
                  <h3 className="modal-title">Update Supplier #{updatingSupplier?.supplierId}</h3>
                  <span className="text-sm text-base-content/50">{updatingSupplier?.name}</span>
                </div>
                <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={closeUpdate}>
                  <span className="icon-[tabler--x] size-4"></span>
                </button>
              </div>
              <div className="modal-body">
                <form id="supplier-update-form" onSubmit={handleUpdateSubmit}>
                  <div className="flex flex-col gap-4">

                    <div className="flex flex-col gap-1">
                      <label className="label-text font-medium">Name <span className="text-error">*</span></label>
                      <input type="text" name="name"
                        className={`input input-bordered w-full${updateFormError.name ? ' is-invalid' : ''}`}
                        maxLength={120} required
                        value={updateForm.name} onChange={handleUpdateFormChange} />
                      {updateFormError.name && <span className="helper-text">{updateFormError.name}</span>}
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="label-text font-medium">Address <span className="text-error">*</span></label>
                      <textarea name="address"
                        className={`textarea textarea-bordered w-full${updateFormError.address ? ' is-invalid' : ''}`}
                        maxLength={600} rows={3} required
                        value={updateForm.address} onChange={handleUpdateFormChange} />
                      {updateFormError.address && <span className="helper-text">{updateFormError.address}</span>}
                    </div>

                    {updateFormError._general && (
                      <div className="alert alert-error py-2">
                        <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                        <span className="text-sm">{updateFormError._general}</span>
                      </div>
                    )}
                  </div>
                </form>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-soft btn-secondary" onClick={closeUpdate}>
                  Cancel
                </button>
                <button type="submit" form="supplier-update-form" className="btn btn-primary" disabled={updateSubmitting}>
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
    </Layout>
  )
}
