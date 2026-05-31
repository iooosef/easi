import { useState, useEffect, useRef } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { useAuth } from './auth'
import Layout from './Layout'
import Modal from './Modal'
import { notyfSuccess, notyfError } from './notyf'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
const ACCEPTED_EXTENSIONS = '.jpg,.jpeg,.png,.gif,.webp,.pdf'

/** Parses a failed API response into field-level or general errors. */
async function parseApiError(res) {
  const data = await res.json().catch(() => ({}))
  if (data.errors) return data.errors
  return { _general: data.message ?? data.error ?? `Error ${res.status}` }
}

/** Returns whether the file type is an image. */
function isImage(fileType) {
  return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes((fileType ?? '').toLowerCase())
}

/**
 * Page for managing documents attached to a specific purchase order.
 * Each PurchaseOrderDocument record has an invoiceId and an optional linked document file.
 */
export default function PurchaseOrderDocuments() {
  const { apiFetch, hasRole } = useAuth()
  const { srNumber, poNum } = useParams()
  const location = useLocation()
  const projectName = location.state?.projectName ?? '...'
  const srNum = location.state?.srNumber ?? srNumber

  const canEdit = hasRole('ADMIN', 'ACCOUNTING', 'STAFF')

  const [poDocuments, setPoDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  // Add record modal
  const [addOpen, setAddOpen] = useState(false)
  const [addInvoiceId, setAddInvoiceId] = useState('')
  const [addFile, setAddFile] = useState(null)
  const [addError, setAddError] = useState({})
  const [addSubmitting, setAddSubmitting] = useState(false)
  const addFileRef = useRef(null)

  // Update Invoice ID modal
  const [updateOpen, setUpdateOpen] = useState(false)
  const [updatingDoc, setUpdatingDoc] = useState(null)
  const [updateInvoiceId, setUpdateInvoiceId] = useState('')
  const [updateError, setUpdateError] = useState({})
  const [updateSubmitting, setUpdateSubmitting] = useState(false)

  // Upload document modal (for a record with no linked file)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadingDoc, setUploadingDoc] = useState(null)
  const [uploadFile, setUploadFile] = useState(null)
  const [uploadDescription, setUploadDescription] = useState('')
  const [uploadError, setUploadError] = useState({})
  const [uploadSubmitting, setUploadSubmitting] = useState(false)
  const uploadFileRef = useRef(null)

  // Replace file modal
  const [replaceOpen, setReplaceOpen] = useState(false)
  const [replacingDoc, setReplacingDoc] = useState(null)
  const [replaceFile, setReplaceFile] = useState(null)
  const [replaceError, setReplaceError] = useState({})
  const [replaceSubmitting, setReplaceSubmitting] = useState(false)
  const replaceFileRef = useRef(null)

  // View document modal
  const [viewOpen, setViewOpen] = useState(false)
  const [viewDocMeta, setViewDocMeta] = useState(null)
  const [viewBlobUrl, setViewBlobUrl] = useState(null)
  const [viewLoading, setViewLoading] = useState(false)

  /** Fetches all PO document records for this purchase order. */
  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    apiFetch(`/api/purchase-order-documents?poNum=${encodeURIComponent(poNum)}&size=100&sort=poDocNum,asc`)
      .then(res => {
        if (!res.ok) throw new Error(`Failed to load PO documents (${res.status})`)
        return res.json()
      })
      .then(data => { if (active) setPoDocuments(data.content ?? []) })
      .catch(err => { if (active) setError(err.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [apiFetch, poNum, refreshKey])

  // Revoke blob URL on unmount
  useEffect(() => {
    return () => { if (viewBlobUrl) URL.revokeObjectURL(viewBlobUrl) }
  }, [viewBlobUrl])

  function openAdd() { setAddInvoiceId(''); setAddFile(null); setAddError({}); setAddOpen(true) }
  function closeAdd() { setAddOpen(false); setAddInvoiceId(''); setAddFile(null); setAddError({}) }

  function handleAddFileChange(e) {
    const file = e.target.files?.[0] ?? null
    if (file && !ACCEPTED_TYPES.includes(file.type)) {
      setAddError(prev => ({ ...prev, file: 'Only images and PDFs are accepted.' }))
      setAddFile(null)
      return
    }
    setAddError(prev => { const n = { ...prev }; delete n.file; return n })
    setAddFile(file)
  }

  /** Creates a new PO document record, optionally uploading a file first. */
  async function handleAddSubmit(e) {
    e.preventDefault()
    setAddError({})
    setAddSubmitting(true)
    try {
      let docuId = null
      if (addFile) {
        const formData = new FormData()
        formData.append('file', addFile)
        const uploadRes = await apiFetch('/api/documents', { method: 'POST', body: formData })
        if (!uploadRes.ok) {
          setAddError(await parseApiError(uploadRes))
          notyfError('File upload failed')
          return
        }
        const uploaded = await uploadRes.json()
        docuId = uploaded.docuId
      }
      const res = await apiFetch('/api/purchase-order-documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poNum, invoiceId: addInvoiceId, docuId }),
      })
      if (!res.ok) {
        setAddError(await parseApiError(res))
        notyfError('Add failed')
        return
      }
      closeAdd()
      setTimeout(() => notyfSuccess('Document record added.'), 150)
      setRefreshKey(k => k + 1)
    } catch (err) {
      setAddError({ _general: err.message })
    } finally {
      setAddSubmitting(false)
    }
  }

  function openUpdateInvoice(doc) { setUpdatingDoc(doc); setUpdateInvoiceId(doc.invoiceId); setUpdateError({}); setUpdateOpen(true) }
  function closeUpdateInvoice() { setUpdateOpen(false); setUpdatingDoc(null); setUpdateInvoiceId(''); setUpdateError({}) }

  /** Updates the invoice ID of an existing PO document record. */
  async function handleUpdateInvoiceSubmit(e) {
    e.preventDefault()
    setUpdateError({})
    setUpdateSubmitting(true)
    try {
      const res = await apiFetch(`/api/purchase-order-documents/${updatingDoc.poDocNum}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poNum, invoiceId: updateInvoiceId, docuId: updatingDoc.docuId ?? null }),
      })
      if (!res.ok) {
        setUpdateError(await parseApiError(res))
        notyfError('Update failed')
        return
      }
      closeUpdateInvoice()
      setTimeout(() => notyfSuccess('Invoice ID updated.'), 150)
      setRefreshKey(k => k + 1)
    } catch (err) {
      setUpdateError({ _general: err.message })
    } finally {
      setUpdateSubmitting(false)
    }
  }

  function openUpload(doc) { setUploadingDoc(doc); setUploadFile(null); setUploadDescription(''); setUploadError({}); setUploadOpen(true) }
  function closeUpload() { setUploadOpen(false); setUploadingDoc(null); setUploadFile(null); setUploadDescription(''); setUploadError({}) }

  function handleUploadFileChange(e) {
    const file = e.target.files?.[0] ?? null
    if (file && !ACCEPTED_TYPES.includes(file.type)) {
      setUploadError({ file: 'Only images and PDFs are accepted.' })
      setUploadFile(null)
      return
    }
    setUploadError({})
    setUploadFile(file)
  }

  /** Uploads a file and links it to the PO document record. */
  async function handleUploadSubmit(e) {
    e.preventDefault()
    setUploadError({})
    if (!uploadFile) { setUploadError({ file: 'Please select a file.' }); return }
    setUploadSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('file', uploadFile)
      if (uploadDescription.trim()) formData.append('description', uploadDescription.trim())
      const uploadRes = await apiFetch('/api/documents', { method: 'POST', body: formData })
      if (!uploadRes.ok) {
        setUploadError(await parseApiError(uploadRes))
        notyfError('Upload failed')
        return
      }
      const uploaded = await uploadRes.json()
      const res = await apiFetch(`/api/purchase-order-documents/${uploadingDoc.poDocNum}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poNum, invoiceId: uploadingDoc.invoiceId, docuId: uploaded.docuId }),
      })
      if (!res.ok) {
        setUploadError(await parseApiError(res))
        notyfError('Failed to link document')
        return
      }
      closeUpload()
      setTimeout(() => notyfSuccess('Document uploaded and linked.'), 150)
      setRefreshKey(k => k + 1)
    } catch (err) {
      setUploadError({ _general: err.message })
    } finally {
      setUploadSubmitting(false)
    }
  }

  function openReplace(doc) { setReplacingDoc(doc); setReplaceFile(null); setReplaceError({}); setReplaceOpen(true) }
  function closeReplace() { setReplaceOpen(false); setReplacingDoc(null); setReplaceFile(null); setReplaceError({}) }

  function handleReplaceFileChange(e) {
    const file = e.target.files?.[0] ?? null
    if (file && !ACCEPTED_TYPES.includes(file.type)) {
      setReplaceError({ file: 'Only images and PDFs are accepted.' })
      setReplaceFile(null)
      return
    }
    setReplaceError({})
    setReplaceFile(file)
  }

  /** Replaces the file of an existing linked document. */
  async function handleReplaceSubmit(e) {
    e.preventDefault()
    setReplaceError({})
    if (!replaceFile) { setReplaceError({ file: 'Please select a file.' }); return }
    setReplaceSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('file', replaceFile)
      const res = await apiFetch(`/api/documents/${replacingDoc.docuId}/file`, { method: 'PUT', body: formData })
      if (!res.ok) {
        setReplaceError(await parseApiError(res))
        notyfError('Replace failed')
        return
      }
      closeReplace()
      setTimeout(() => notyfSuccess('File replaced.'), 150)
      setRefreshKey(k => k + 1)
    } catch (err) {
      setReplaceError({ _general: err.message })
    } finally {
      setReplaceSubmitting(false)
    }
  }

  /** Fetches the document metadata and file blob then opens the viewer. */
  async function handleViewDocument(doc) {
    if (!doc.docuId) return
    setViewLoading(true)
    setViewOpen(true)
    setViewDocMeta(null)
    try {
      const [metaRes, fileRes] = await Promise.all([
        apiFetch(`/api/documents/${doc.docuId}`),
        apiFetch(`/api/documents/${doc.docuId}/file`),
      ])
      if (metaRes.ok) setViewDocMeta(await metaRes.json())
      if (!fileRes.ok) { notyfError('Could not load file'); setViewOpen(false); return }
      const blob = await fileRes.blob()
      if (viewBlobUrl) URL.revokeObjectURL(viewBlobUrl)
      setViewBlobUrl(URL.createObjectURL(blob))
    } catch {
      notyfError('Could not load file')
      setViewOpen(false)
    } finally {
      setViewLoading(false)
    }
  }

  function closeView() {
    setViewOpen(false)
    setViewDocMeta(null)
    if (viewBlobUrl) { URL.revokeObjectURL(viewBlobUrl); setViewBlobUrl(null) }
  }

  return (
    <Layout activePage="service-report">
      {/* Header */}
      <div className="flex items-stretch justify-between h-16 mb-6">
        <div>
          <h1 className="text-3xl font-semibold">PO Documents — {poNum}</h1>
          <p className="text-base-content/60 mt-1">
            {projectName} · SR #{srNum} — Manage documents for this purchase order
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-2 items-center h-full">
            <button type="button" className="btn btn-primary h-full min-h-0" onClick={openAdd}>
              <span className="icon-[tabler--plus] size-4"></span>
              Add Document Record
            </button>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="alert alert-error mb-4">
          <span className="icon-[tabler--alert-circle] size-5"></span>
          <span>{error}</span>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-20">
          <span className="loading loading-spinner loading-lg text-primary"></span>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && poDocuments.length === 0 && (
        <div className="text-center py-24 text-base-content/40">
          <span className="icon-[tabler--files-off] size-16 mx-auto mb-4 block"></span>
          <p className="text-lg font-medium mb-1">No document records</p>
          <p className="text-sm mb-6">Add a document record for this purchase order.</p>
          {canEdit && (
            <button type="button" className="btn btn-primary" onClick={openAdd}>
              <span className="icon-[tabler--plus] size-4"></span>
              Add Document Record
            </button>
          )}
        </div>
      )}

      {/* Document record cards */}
      {!loading && !error && poDocuments.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {poDocuments.map(doc => (
            <div key={doc.poDocNum} className="group">
              <div className="card bg-base-100 border border-base-300 transition-transform duration-300 group-hover:-translate-y-2 h-full">
                <div className="card-body gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="badge badge-soft badge-neutral text-xs">PO Doc #{doc.poDocNum}</span>
                    {doc.docuId
                      ? <span className="badge badge-soft badge-success text-xs">Document linked</span>
                      : <span className="badge badge-soft badge-warning text-xs">No document</span>
                    }
                  </div>
                  <div>
                    <p className="text-xs text-base-content/50 uppercase tracking-wide">Invoice ID</p>
                    <p className="font-semibold font-mono text-sm">{doc.invoiceId}</p>
                  </div>
                  {doc.docuId && (
                    <p className="text-xs text-base-content/50">Doc #{doc.docuId}</p>
                  )}
                  <div className="card-actions flex-col gap-2 mt-auto">
                    {doc.docuId ? (
                      <>
                        <button
                          className="btn btn-soft btn-primary btn-sm w-full"
                          onClick={() => handleViewDocument(doc)}
                        >
                          <span className="icon-[tabler--eye] size-4"></span>
                          View Document
                        </button>
                        {canEdit && (
                          <button
                            className="btn btn-soft btn-warning btn-sm w-full"
                            onClick={() => openReplace(doc)}
                          >
                            <span className="icon-[tabler--replace] size-4"></span>
                            Replace File
                          </button>
                        )}
                      </>
                    ) : canEdit && (
                      <button
                        className="btn btn-soft btn-primary btn-sm w-full"
                        onClick={() => openUpload(doc)}
                      >
                        <span className="icon-[tabler--upload] size-4"></span>
                        Upload Document
                      </button>
                    )}
                    {canEdit && (
                      <button
                        className="btn btn-soft btn-secondary btn-sm w-full"
                        onClick={() => openUpdateInvoice(doc)}
                      >
                        <span className="icon-[tabler--pencil] size-4"></span>
                        Update Invoice ID
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Document Record Modal */}
      <Modal
        isOpen={addOpen}
        onClose={closeAdd}
        title="Add Document Record"
        footer={
          <>
            <button type="button" className="btn btn-soft btn-secondary" onClick={closeAdd}>Cancel</button>
            <button type="submit" form="add-po-doc-form" className="btn btn-primary" disabled={addSubmitting}>
              {addSubmitting
                ? <span className="loading loading-spinner loading-sm"></span>
                : <span className="icon-[tabler--plus] size-4"></span>
              }
              Add Record
            </button>
          </>
        }
      >
        <form id="add-po-doc-form" onSubmit={handleAddSubmit}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Invoice ID <span className="text-error">*</span></label>
              <input
                type="text"
                className={`input input-bordered w-full${addError.invoiceId ? ' is-invalid' : ''}`}
                placeholder="e.g. INV-001"
                maxLength={16}
                required
                value={addInvoiceId}
                onChange={e => setAddInvoiceId(e.target.value)}
              />
              {addError.invoiceId && <span className="helper-text">{addError.invoiceId}</span>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">
                File <span className="text-base-content/50 text-xs ml-1">(optional — images or PDF)</span>
              </label>
              <input ref={addFileRef} type="file" accept={ACCEPTED_EXTENSIONS} className="hidden" onChange={handleAddFileChange} />
              <button
                type="button"
                className={`btn btn-outline w-full justify-start font-normal${addError.file ? ' btn-error' : ''}`}
                onClick={() => addFileRef.current?.click()}
              >
                <span className="icon-[tabler--paperclip] size-4"></span>
                {addFile ? addFile.name : 'Choose file…'}
              </button>
              {addError.file && <span className="helper-text">{addError.file}</span>}
              {addFile && <span className="text-xs text-base-content/50">{(addFile.size / 1024).toFixed(1)} KB</span>}
            </div>
            {addError._general && (
              <div className="alert alert-error py-2">
                <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                <span className="text-sm">{addError._general}</span>
              </div>
            )}
          </div>
        </form>
      </Modal>

      {/* Update Invoice ID Modal */}
      <Modal
        isOpen={updateOpen}
        onClose={closeUpdateInvoice}
        title={`Update Invoice ID — PO Doc #${updatingDoc?.poDocNum ?? ''}`}
        footer={
          <>
            <button type="button" className="btn btn-soft btn-secondary" onClick={closeUpdateInvoice}>Cancel</button>
            <button type="submit" form="update-invoice-form" className="btn btn-primary" disabled={updateSubmitting}>
              {updateSubmitting
                ? <span className="loading loading-spinner loading-sm"></span>
                : <span className="icon-[tabler--device-floppy] size-4"></span>
              }
              Save Changes
            </button>
          </>
        }
      >
        <form id="update-invoice-form" onSubmit={handleUpdateInvoiceSubmit}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Invoice ID <span className="text-error">*</span></label>
              <input
                type="text"
                className={`input input-bordered w-full${updateError.invoiceId ? ' is-invalid' : ''}`}
                maxLength={16}
                required
                value={updateInvoiceId}
                onChange={e => setUpdateInvoiceId(e.target.value)}
              />
              {updateError.invoiceId && <span className="helper-text">{updateError.invoiceId}</span>}
            </div>
            {updateError._general && (
              <div className="alert alert-error py-2">
                <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                <span className="text-sm">{updateError._general}</span>
              </div>
            )}
          </div>
        </form>
      </Modal>

      {/* Upload Document Modal */}
      <Modal
        isOpen={uploadOpen}
        onClose={closeUpload}
        title={`Upload Document — PO Doc #${uploadingDoc?.poDocNum ?? ''}`}
        footer={
          <>
            <button type="button" className="btn btn-soft btn-secondary" onClick={closeUpload}>Cancel</button>
            <button type="submit" form="upload-po-doc-form" className="btn btn-primary" disabled={uploadSubmitting}>
              {uploadSubmitting
                ? <span className="loading loading-spinner loading-sm"></span>
                : <span className="icon-[tabler--upload] size-4"></span>
              }
              Upload
            </button>
          </>
        }
      >
        <form id="upload-po-doc-form" onSubmit={handleUploadSubmit}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">
                File <span className="text-error">*</span>
                <span className="text-xs text-base-content/50 ml-1">(images or PDF only)</span>
              </label>
              <input ref={uploadFileRef} type="file" accept={ACCEPTED_EXTENSIONS} className="hidden" onChange={handleUploadFileChange} />
              <button
                type="button"
                className={`btn btn-outline w-full justify-start font-normal${uploadError.file ? ' btn-error' : ''}`}
                onClick={() => uploadFileRef.current?.click()}
              >
                <span className="icon-[tabler--paperclip] size-4"></span>
                {uploadFile ? uploadFile.name : 'Choose file…'}
              </button>
              {uploadError.file && <span className="helper-text">{uploadError.file}</span>}
              {uploadFile && <span className="text-xs text-base-content/50">{(uploadFile.size / 1024).toFixed(1)} KB</span>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Description</label>
              <textarea
                className="textarea textarea-bordered w-full"
                placeholder="Optional description..."
                maxLength={600}
                rows={3}
                value={uploadDescription}
                onChange={e => setUploadDescription(e.target.value)}
              />
            </div>
            {uploadError._general && (
              <div className="alert alert-error py-2">
                <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                <span className="text-sm">{uploadError._general}</span>
              </div>
            )}
          </div>
        </form>
      </Modal>

      {/* Replace File Modal */}
      <Modal
        isOpen={replaceOpen}
        onClose={closeReplace}
        title={`Replace File — PO Doc #${replacingDoc?.poDocNum ?? ''}`}
        footer={
          <>
            <button type="button" className="btn btn-soft btn-secondary" onClick={closeReplace}>Cancel</button>
            <button type="submit" form="replace-po-doc-form" className="btn btn-warning" disabled={replaceSubmitting}>
              {replaceSubmitting
                ? <span className="loading loading-spinner loading-sm"></span>
                : <span className="icon-[tabler--replace] size-4"></span>
              }
              Replace File
            </button>
          </>
        }
      >
        <form id="replace-po-doc-form" onSubmit={handleReplaceSubmit}>
          <div className="flex flex-col gap-4">
            <div className="alert alert-warning py-2">
              <span className="icon-[tabler--alert-triangle] size-4 shrink-0"></span>
              <span className="text-sm">The current file will be permanently replaced.</span>
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">
                New File <span className="text-error">*</span>
                <span className="text-xs text-base-content/50 ml-1">(images or PDF only)</span>
              </label>
              <input ref={replaceFileRef} type="file" accept={ACCEPTED_EXTENSIONS} className="hidden" onChange={handleReplaceFileChange} />
              <button
                type="button"
                className={`btn btn-outline w-full justify-start font-normal${replaceError.file ? ' btn-error' : ''}`}
                onClick={() => replaceFileRef.current?.click()}
              >
                <span className="icon-[tabler--paperclip] size-4"></span>
                {replaceFile ? replaceFile.name : 'Choose file…'}
              </button>
              {replaceError.file && <span className="helper-text">{replaceError.file}</span>}
              {replaceFile && <span className="text-xs text-base-content/50">{(replaceFile.size / 1024).toFixed(1)} KB</span>}
            </div>
            {replaceError._general && (
              <div className="alert alert-error py-2">
                <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                <span className="text-sm">{replaceError._general}</span>
              </div>
            )}
          </div>
        </form>
      </Modal>

      {/* View Document Modal */}
      {viewOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 z-[50]" onClick={closeView} />
          <div className="fixed inset-0 z-[51] flex flex-col items-center justify-center p-4 gap-3">
            <div className="flex items-center justify-between w-full max-w-5xl">
              <span className="text-white font-medium truncate">{viewDocMeta?.fileName ?? 'Document'}</span>
              <button type="button" className="btn btn-circle btn-sm btn-secondary text-white" onClick={closeView}>
                <span className="icon-[tabler--x] size-5"></span>
              </button>
            </div>
            <div
              className="w-full max-w-5xl flex-1 overflow-hidden rounded-box bg-base-100 flex items-center justify-center"
              style={{ maxHeight: '80vh' }}
            >
              {viewLoading ? (
                <span className="loading loading-spinner loading-lg text-primary"></span>
              ) : viewBlobUrl && isImage(viewDocMeta?.fileType) ? (
                <img src={viewBlobUrl} alt={viewDocMeta?.fileName} className="max-w-full max-h-full object-contain" />
              ) : viewBlobUrl ? (
                <embed src={viewBlobUrl} type="application/pdf" style={{ width: '100%', height: '70vh' }} />
              ) : null}
            </div>
          </div>
        </>
      )}
    </Layout>
  )
}
