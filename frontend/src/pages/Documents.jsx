import { useState, useEffect, useRef } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { useAuth } from './auth'
import Layout from './Layout'
import Modal from './modals/Modal'
import { notyfSuccess, notyfError } from './notyf'

/**
 * Entity-specific config table for document management.
 * To support a new entity, add an entry keyed by entityType string.
 * fetchEntityEndpoint: API path to GET the entity (must return a docuId field or use docuIdField)
 * getDocuId: extracts the current docuId from the entity response
 * linkEndpoint: API path for PATCH to link/unlink a document
 */
const ENTITY_CONFIGS = {
  'service-report': {
    getEntityEndpoint: (id) => `/api/service-reports/${id}`,
    getDocuId: (entity) => entity.docuId ?? null,
    linkEndpoint: (id) => `/api/service-reports/${id}/document`,
  },
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
const ACCEPTED_EXTENSIONS = '.jpg,.jpeg,.png,.gif,.webp,.pdf'

/** Parses a failed API response into field-level or general error object. */
async function parseApiError(res) {
  const data = await res.json().catch(() => ({}))
  if (data.errors) return data.errors
  return { _general: data.message ?? data.error ?? `Error ${res.status}` }
}

/** Formats a datetime string to YYYY-MM-DD HH:MM */
function formatDateTime(dt) {
  if (!dt) return '—'
  return String(dt).slice(0, 16).replace('T', ' ')
}

/** Returns a human-readable file type label. */
function fileTypeLabel(fileType) {
  if (!fileType) return 'Unknown'
  const map = { pdf: 'PDF', jpg: 'JPEG Image', jpeg: 'JPEG Image', png: 'PNG Image', gif: 'GIF Image', webp: 'WebP Image' }
  return map[fileType.toLowerCase()] ?? fileType.toUpperCase()
}

/** Determines whether the file type is an image (vs PDF). */
function isImage(fileType) {
  return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes((fileType ?? '').toLowerCase())
}

/**
 * Reusable document management page.
 * Reads entityType and entityId from URL params + location.state.
 * Supports any entity defined in ENTITY_CONFIGS.
 */
export default function Documents() {
  const { apiFetch, hasRole } = useAuth()
  const location = useLocation()
  const params = useParams()

  // Entity config passed via navigation state
  const entityType = location.state?.entityType ?? 'service-report'
  const entityId   = location.state?.entityId   ?? params.srNumber
  const entityLabel  = location.state?.entityLabel  ?? `#${entityId}`
  const parentLabel  = location.state?.parentLabel  ?? null

  const config = ENTITY_CONFIGS[entityType]

  const canEdit = hasRole('ADMIN', 'STAFF')

  // Current document state
  const [docuId, setDocuId]           = useState(location.state?.docuId ?? null)
  const [document, setDocument]       = useState(null)
  const [docLoading, setDocLoading]   = useState(false)
  const [pageError, setPageError]     = useState(null)
  const [refreshKey, setRefreshKey]   = useState(0)

  // Add document modal
  const [addOpen, setAddOpen]           = useState(false)
  const [addFile, setAddFile]           = useState(null)
  const [addDescription, setAddDescription] = useState('')
  const [addError, setAddError]         = useState({})
  const [addSubmitting, setAddSubmitting] = useState(false)
  const fileInputRef = useRef(null)

  // Update description modal
  const [updateOpen, setUpdateOpen]         = useState(false)
  const [updateDesc, setUpdateDesc]         = useState('')
  const [updateError, setUpdateError]       = useState({})
  const [updateSubmitting, setUpdateSubmitting] = useState(false)

  // Replace file modal
  const [replaceOpen, setReplaceOpen]           = useState(false)
  const [replaceFile, setReplaceFile]           = useState(null)
  const [replaceError, setReplaceError]         = useState({})
  const [replaceSubmitting, setReplaceSubmitting] = useState(false)
  const replaceFileInputRef = useRef(null)

  // View document modal
  const [viewOpen, setViewOpen]       = useState(false)
  const [viewBlobUrl, setViewBlobUrl] = useState(null)
  const [viewLoading, setViewLoading] = useState(false)

  // Fetch entity to get the latest docuId
  useEffect(() => {
    if (!config || !entityId) return
    let active = true
    apiFetch(config.getEntityEndpoint(entityId))
      .then(res => res.ok ? res.json() : Promise.reject(new Error(`Failed to load (${res.status})`)))
      .then(data => { if (active) setDocuId(config.getDocuId(data)) })
      .catch(err => { if (active) setPageError(err.message) })
    return () => { active = false }
  }, [apiFetch, config, entityId, refreshKey])

  // Fetch document metadata whenever docuId changes
  useEffect(() => {
    if (!docuId) { setDocument(null); return }
    let active = true
    setDocLoading(true)
    setPageError(null)
    apiFetch(`/api/documents/${docuId}`)
      .then(res => res.ok ? res.json() : Promise.reject(new Error(`Document not found (${res.status})`)))
      .then(data => { if (active) setDocument(data) })
      .catch(err => { if (active) setPageError(err.message) })
      .finally(() => { if (active) setDocLoading(false) })
    return () => { active = false }
  }, [apiFetch, docuId, refreshKey])

  // Revoke blob URL on unmount to avoid memory leaks
  useEffect(() => {
    return () => { if (viewBlobUrl) URL.revokeObjectURL(viewBlobUrl) }
  }, [viewBlobUrl])

  function openAdd() {
    setAddFile(null)
    setAddDescription('')
    setAddError({})
    setAddOpen(true)
  }

  function closeAdd() {
    setAddOpen(false)
    setAddFile(null)
    setAddDescription('')
    setAddError({})
  }

  function openReplace() {
    setReplaceFile(null)
    setReplaceError({})
    setReplaceOpen(true)
  }

  function closeReplace() {
    setReplaceOpen(false)
    setReplaceFile(null)
    setReplaceError({})
  }

  function handleReplaceFileChange(e) {
    const file = e.target.files?.[0] ?? null
    if (file && !ACCEPTED_TYPES.includes(file.type)) {
      setReplaceError({ file: 'Only images (JPEG, PNG, GIF, WebP) and PDFs are accepted.' })
      setReplaceFile(null)
      return
    }
    setReplaceError({})
    setReplaceFile(file)
  }

  /** Uploads a new file to replace the existing document file on disk. */
  async function handleReplaceSubmit(e) {
    e.preventDefault()
    setReplaceError({})

    if (!replaceFile) {
      setReplaceError({ file: 'Please select a file.' })
      return
    }

    setReplaceSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('file', replaceFile)

      const res = await apiFetch(`/api/documents/${docuId}/file`, { method: 'PUT', body: formData })
      if (!res.ok) {
        setReplaceError(await parseApiError(res))
        notyfError('Replace failed')
        return
      }
      closeReplace()
      setTimeout(() => notyfSuccess('File replaced successfully.'), 150)
      setRefreshKey(k => k + 1)
    } catch (err) {
      setReplaceError({ _general: err.message })
    } finally {
      setReplaceSubmitting(false)
    }
  }

  function openUpdate() {
    setUpdateDesc(document?.description ?? '')
    setUpdateError({})
    setUpdateOpen(true)
  }

  function closeUpdate() {
    setUpdateOpen(false)
    setUpdateDesc('')
    setUpdateError({})
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0] ?? null
    if (file && !ACCEPTED_TYPES.includes(file.type)) {
      setAddError({ file: 'Only images (JPEG, PNG, GIF, WebP) and PDFs are accepted.' })
      setAddFile(null)
      return
    }
    setAddError({})
    setAddFile(file)
  }

  /** Uploads a file, creates a document record, then links it to the entity. */
  async function handleAddSubmit(e) {
    e.preventDefault()
    setAddError({})

    if (!addFile) {
      setAddError({ file: 'Please select a file.' })
      return
    }

    setAddSubmitting(true)
    try {
      // Step 1: Upload file to create document record
      const formData = new FormData()
      formData.append('file', addFile)
      if (addDescription.trim()) formData.append('description', addDescription.trim())

      const uploadRes = await apiFetch('/api/documents', { method: 'POST', body: formData })
      if (!uploadRes.ok) {
        setAddError(await parseApiError(uploadRes))
        notyfError('Upload failed')
        return
      }
      const uploaded = await uploadRes.json()

      // Step 2: Link document to entity
      const linkRes = await apiFetch(config.linkEndpoint(entityId), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docuId: uploaded.docuId }),
      })
      if (!linkRes.ok) {
        setAddError(await parseApiError(linkRes))
        notyfError('Failed to link document')
        return
      }

      closeAdd()
      setTimeout(() => notyfSuccess('Document uploaded and linked successfully.'), 150)
      setRefreshKey(k => k + 1)
    } catch (err) {
      setAddError({ _general: err.message })
    } finally {
      setAddSubmitting(false)
    }
  }

  /** Updates the document description only. */
  async function handleUpdateSubmit(e) {
    e.preventDefault()
    setUpdateError({})
    setUpdateSubmitting(true)
    try {
      const res = await apiFetch(`/api/documents/${docuId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: updateDesc }),
      })
      if (!res.ok) {
        setUpdateError(await parseApiError(res))
        notyfError('Update failed')
        return
      }
      closeUpdate()
      setTimeout(() => notyfSuccess('Description updated.'), 150)
      setRefreshKey(k => k + 1)
    } catch (err) {
      setUpdateError({ _general: err.message })
    } finally {
      setUpdateSubmitting(false)
    }
  }

  /** Fetches the raw file as a blob and opens it in the viewer modal. */
  async function handleViewDocument() {
    if (!docuId) return
    setViewLoading(true)
    setViewOpen(true)
    try {
      const res = await apiFetch(`/api/documents/${docuId}/file`)
      if (!res.ok) { notyfError('Could not load file'); setViewOpen(false); return }
      const blob = await res.blob()
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
    if (viewBlobUrl) {
      URL.revokeObjectURL(viewBlobUrl)
      setViewBlobUrl(null)
    }
  }

  if (!config) {
    return (
      <Layout activePage="service-report">
        <div className="alert alert-error">
          <span>Unknown entity type: {entityType}</span>
        </div>
      </Layout>
    )
  }

  return (
    <Layout activePage="service-report">
      {/* Header */}
      <div className="flex items-stretch justify-between h-16 mb-6">
        <div>
          <h1 className="text-3xl font-semibold">Document — {entityLabel}</h1>
          {parentLabel && (
            <p className="text-base-content/60 mt-1">{parentLabel} — Manage the attached document</p>
          )}
        </div>
        {canEdit && !docuId && (
          <div className="flex gap-2 items-center h-full">
            <button type="button" className="btn btn-primary h-full min-h-0" onClick={openAdd}>
              <span className="icon-[tabler--upload] size-4"></span>
              Upload Document
            </button>
          </div>
        )}
      </div>

      {/* Page error */}
      {pageError && (
        <div className="alert alert-error mb-4">
          <span className="icon-[tabler--alert-circle] size-5"></span>
          <span>{pageError}</span>
        </div>
      )}

      {/* Loading */}
      {docLoading && (
        <div className="flex justify-center py-20">
          <span className="loading loading-spinner loading-lg text-primary"></span>
        </div>
      )}

      {/* No document state */}
      {!docLoading && !docuId && (
        <div className="text-center py-24 text-base-content/40">
          <span className="icon-[tabler--file-off] size-16 mx-auto mb-4 block"></span>
          <p className="text-lg font-medium mb-1">No document attached</p>
          {canEdit && <p className="text-sm mb-6">Upload an image or PDF to attach a document to this {entityType.replace('-', ' ')}.</p>}
          {canEdit && (
            <button type="button" className="btn btn-primary" onClick={openAdd}>
              <span className="icon-[tabler--upload] size-4"></span>
              Upload Document
            </button>
          )}
        </div>
      )}

      {/* Document card */}
      {!docLoading && document && (
        <div className="max-w-lg">
          <div className="card bg-base-100 border border-base-300">
            <div className="card-body gap-3">
              {/* File icon + name */}
              <div className="flex items-center gap-3">
                <span className={`size-10 shrink-0 ${isImage(document.fileType) ? 'icon-[tabler--photo]' : 'icon-[tabler--file-type-pdf]'} text-primary`}></span>
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate" title={document.fileName}>{document.fileName}</p>
                  <p className="text-xs text-base-content/50">{fileTypeLabel(document.fileType)}</p>
                </div>
                <span className="badge badge-soft badge-neutral text-xs ml-auto shrink-0">#{document.docuId}</span>
              </div>

              {/* Description */}
              {document.description ? (
                <p className="text-sm text-base-content/70 border-l-2 border-base-300 pl-3">
                  {document.description}
                </p>
              ) : (
                <p className="text-sm text-base-content/40 italic">No description provided.</p>
              )}

              {/* Meta */}
              <div className="text-xs text-base-content/50">
                Added on: {formatDateTime(document.addedOn)}
              </div>

              {/* Actions */}
              <div className="card-actions flex-col gap-2 mt-1">
                <button
                  type="button"
                  className="btn btn-soft btn-primary btn-sm w-full"
                  onClick={handleViewDocument}
                >
                  <span className="icon-[tabler--eye] size-4"></span>
                  View Document
                </button>
                {canEdit && (
                  <>
                    <button
                      type="button"
                      className="btn btn-soft btn-secondary btn-sm w-full"
                      onClick={openUpdate}
                    >
                      <span className="icon-[tabler--pencil] size-4"></span>
                      Update Description
                    </button>
                    <button
                      type="button"
                      className="btn btn-soft btn-warning btn-sm w-full"
                      onClick={openReplace}
                    >
                      <span className="icon-[tabler--replace] size-4"></span>
                      Replace File
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Document Modal */}
      <Modal
        isOpen={addOpen}
        onClose={closeAdd}
        title="Upload Document"
        footer={
          <>
            <button type="button" className="btn btn-soft btn-secondary" onClick={closeAdd}>
              Cancel
            </button>
            <button type="submit" form="add-document-form" className="btn btn-primary" disabled={addSubmitting}>
              {addSubmitting
                ? <span className="loading loading-spinner loading-sm"></span>
                : <span className="icon-[tabler--upload] size-4"></span>
              }
              Upload
            </button>
          </>
        }
      >
        <form id="add-document-form" onSubmit={handleAddSubmit}>
          <div className="flex flex-col gap-4">

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">
                File <span className="text-error">*</span>
                <span className="text-xs text-base-content/50 ml-1">(Images or PDF only)</span>
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_EXTENSIONS}
                className="hidden"
                onChange={handleFileChange}
              />
              <button
                type="button"
                className={`btn btn-outline w-full justify-start font-normal${addError.file ? ' btn-error' : ''}`}
                onClick={() => fileInputRef.current?.click()}
              >
                <span className="icon-[tabler--paperclip] size-4"></span>
                {addFile ? addFile.name : 'Choose file…'}
              </button>
              {addError.file && <span className="helper-text">{addError.file}</span>}
              {addFile && (
                <span className="text-xs text-base-content/50">{(addFile.size / 1024).toFixed(1)} KB</span>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Description</label>
              <textarea
                className={`textarea textarea-bordered w-full${addError.description ? ' is-invalid' : ''}`}
                placeholder="Optional description..."
                maxLength={600}
                rows={3}
                value={addDescription}
                onChange={e => setAddDescription(e.target.value)}
              />
              {addError.description && <span className="helper-text">{addError.description}</span>}
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

      {/* Replace File Modal */}
      <Modal
        isOpen={replaceOpen}
        onClose={closeReplace}
        title="Replace File"
        footer={
          <>
            <button type="button" className="btn btn-soft btn-secondary" onClick={closeReplace}>
              Cancel
            </button>
            <button type="submit" form="replace-file-form" className="btn btn-warning" disabled={replaceSubmitting}>
              {replaceSubmitting
                ? <span className="loading loading-spinner loading-sm"></span>
                : <span className="icon-[tabler--replace] size-4"></span>
              }
              Replace File
            </button>
          </>
        }
      >
        <form id="replace-file-form" onSubmit={handleReplaceSubmit}>
          <div className="flex flex-col gap-4">
            <div className="alert alert-warning py-2">
              <span className="icon-[tabler--alert-triangle] size-4 shrink-0"></span>
              <span className="text-sm">The current file will be permanently replaced. The description is kept.</span>
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">
                New File <span className="text-error">*</span>
                <span className="text-xs text-base-content/50 ml-1">(Images or PDF only)</span>
              </label>
              <input
                ref={replaceFileInputRef}
                type="file"
                accept={ACCEPTED_EXTENSIONS}
                className="hidden"
                onChange={handleReplaceFileChange}
              />
              <button
                type="button"
                className={`btn btn-outline w-full justify-start font-normal${replaceError.file ? ' btn-error' : ''}`}
                onClick={() => replaceFileInputRef.current?.click()}
              >
                <span className="icon-[tabler--paperclip] size-4"></span>
                {replaceFile ? replaceFile.name : 'Choose file…'}
              </button>
              {replaceError.file && <span className="helper-text">{replaceError.file}</span>}
              {replaceFile && (
                <span className="text-xs text-base-content/50">{(replaceFile.size / 1024).toFixed(1)} KB</span>
              )}
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

      {/* Update Description Modal */}
      <Modal
        isOpen={updateOpen}
        onClose={closeUpdate}
        title="Update Description"
        footer={
          <>
            <button type="button" className="btn btn-soft btn-secondary" onClick={closeUpdate}>
              Cancel
            </button>
            <button type="submit" form="update-document-form" className="btn btn-primary" disabled={updateSubmitting}>
              {updateSubmitting
                ? <span className="loading loading-spinner loading-sm"></span>
                : <span className="icon-[tabler--device-floppy] size-4"></span>
              }
              Save Changes
            </button>
          </>
        }
      >
        <form id="update-document-form" onSubmit={handleUpdateSubmit}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Description</label>
              <textarea
                className={`textarea textarea-bordered w-full${updateError.description ? ' is-invalid' : ''}`}
                placeholder="Optional description..."
                maxLength={600}
                rows={4}
                value={updateDesc}
                onChange={e => setUpdateDesc(e.target.value)}
              />
              {updateError.description && <span className="helper-text">{updateError.description}</span>}
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

      {/* View Document Modal */}
      {viewOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 z-[50]" onClick={closeView} />
          <div className="fixed inset-0 z-[51] flex flex-col items-center justify-center p-4 gap-3">
            <div className="flex items-center justify-between w-full max-w-5xl">
              <span className="text-white font-medium truncate">{document?.fileName}</span>
              <button
                type="button"
                className="btn btn-circle btn-sm btn-secondary text-white"
                onClick={closeView}
              >
                <span className="icon-[tabler--x] size-5"></span>
              </button>
            </div>

            <div className="w-full max-w-5xl flex-1 overflow-hidden rounded-box bg-base-100 flex items-center justify-center" style={{ maxHeight: '80vh' }}>
              {viewLoading ? (
                <span className="loading loading-spinner loading-lg text-primary"></span>
              ) : viewBlobUrl && isImage(document?.fileType) ? (
                <img
                  src={viewBlobUrl}
                  alt={document?.fileName}
                  className="max-w-full max-h-full object-contain"
                />
              ) : viewBlobUrl ? (
                <embed
                  src={viewBlobUrl}
                  type="application/pdf"
                  style={{ width: '100%', height: '70vh' }}
                />
              ) : null}
            </div>
          </div>
        </>
      )}
    </Layout>
  )
}
