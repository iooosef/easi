import { useState, useEffect, useRef } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { useAuth } from './auth'
import Layout from './Layout'
import Modal from './modals/Modal'
import { notyfSuccess, notyfError } from './notyf'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
const ACCEPTED_EXTENSIONS = '.jpg,.jpeg,.png,.gif,.webp,.pdf'

/** Parses a failed API response into field-level or general errors. */
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

/** Returns whether the file type is an image. */
function isImage(fileType) {
  return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes((fileType ?? '').toLowerCase())
}

/** Returns a human-readable file type label. */
function fileTypeLabel(fileType) {
  if (!fileType) return 'Unknown'
  const map = { pdf: 'PDF', jpg: 'JPEG Image', jpeg: 'JPEG Image', png: 'PNG Image', gif: 'GIF Image', webp: 'WebP Image' }
  return map[fileType.toLowerCase()] ?? fileType.toUpperCase()
}

/**
 * Page for managing multiple documents attached to a project.
 * Supports uploading, viewing, updating description, replacing files, and removing links.
 */
export default function ProjectDocuments() {
  const { apiFetch, hasRole } = useAuth()
  const { projNum } = useParams()
  const location = useLocation()
  const projectName = location.state?.projectName ?? `Project #${projNum}`

  const canEdit = hasRole('ADMIN', 'STAFF')

  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  // Upload new document modal
  const [addOpen, setAddOpen] = useState(false)
  const [addFile, setAddFile] = useState(null)
  const [addDescription, setAddDescription] = useState('')
  const [addError, setAddError] = useState({})
  const [addSubmitting, setAddSubmitting] = useState(false)
  const addFileRef = useRef(null)

  // Update description modal
  const [updateOpen, setUpdateOpen] = useState(false)
  const [updatingDoc, setUpdatingDoc] = useState(null)
  const [updateDesc, setUpdateDesc] = useState('')
  const [updateError, setUpdateError] = useState({})
  const [updateSubmitting, setUpdateSubmitting] = useState(false)

  // Replace file modal
  const [replaceOpen, setReplaceOpen] = useState(false)
  const [replacingDoc, setReplacingDoc] = useState(null)
  const [replaceFile, setReplaceFile] = useState(null)
  const [replaceError, setReplaceError] = useState({})
  const [replaceSubmitting, setReplaceSubmitting] = useState(false)
  const replaceFileRef = useRef(null)

  // Remove link confirmation modal
  const [removeOpen, setRemoveOpen] = useState(false)
  const [removingDoc, setRemovingDoc] = useState(null)
  const [removeSubmitting, setRemoveSubmitting] = useState(false)

  // View document modal
  const [viewOpen, setViewOpen] = useState(false)
  const [viewDocMeta, setViewDocMeta] = useState(null)
  const [viewBlobUrl, setViewBlobUrl] = useState(null)
  const [viewLoading, setViewLoading] = useState(false)

  /** Fetches all document links for this project. */
  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    apiFetch(`/api/project-documents?projNum=${projNum}&size=100&sort=projDocId,asc`)
      .then(res => {
        if (!res.ok) throw new Error(`Failed to load documents (${res.status})`)
        return res.json()
      })
      .then(data => { if (active) setDocuments(data.content ?? []) })
      .catch(err => { if (active) setError(err.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [apiFetch, projNum, refreshKey])

  // Revoke blob URL on unmount
  useEffect(() => {
    return () => { if (viewBlobUrl) URL.revokeObjectURL(viewBlobUrl) }
  }, [viewBlobUrl])

  function openAdd() { setAddFile(null); setAddDescription(''); setAddError({}); setAddOpen(true) }
  function closeAdd() { setAddOpen(false); setAddFile(null); setAddDescription(''); setAddError({}) }

  function handleAddFileChange(e) {
    const file = e.target.files?.[0] ?? null
    if (file && !ACCEPTED_TYPES.includes(file.type)) {
      setAddError({ file: 'Only images (JPEG, PNG, GIF, WebP) and PDFs are accepted.' })
      setAddFile(null)
      return
    }
    setAddError({})
    setAddFile(file)
  }

  /** Uploads a file, creates a document record, then links it to the project. */
  async function handleAddSubmit(e) {
    e.preventDefault()
    setAddError({})
    if (!addFile) { setAddError({ file: 'Please select a file.' }); return }
    setAddSubmitting(true)
    try {
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

      const linkRes = await apiFetch('/api/project-documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projNum: Number(projNum), docuId: uploaded.docuId }),
      })
      if (!linkRes.ok) {
        setAddError(await parseApiError(linkRes))
        notyfError('Failed to link document')
        return
      }

      closeAdd()
      setTimeout(() => notyfSuccess('Document uploaded and linked to project.'), 150)
      setRefreshKey(k => k + 1)
    } catch (err) {
      setAddError({ _general: err.message })
    } finally {
      setAddSubmitting(false)
    }
  }

  function openUpdate(doc) { setUpdatingDoc(doc); setUpdateDesc(doc.description ?? ''); setUpdateError({}); setUpdateOpen(true) }
  function closeUpdate() { setUpdateOpen(false); setUpdatingDoc(null); setUpdateDesc(''); setUpdateError({}) }

  /** Updates the description of the linked document. */
  async function handleUpdateSubmit(e) {
    e.preventDefault()
    setUpdateError({})
    setUpdateSubmitting(true)
    try {
      const res = await apiFetch(`/api/documents/${updatingDoc.docuId}`, {
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
      setTimeout(() => notyfSuccess('File replaced successfully.'), 150)
      setRefreshKey(k => k + 1)
    } catch (err) {
      setReplaceError({ _general: err.message })
    } finally {
      setReplaceSubmitting(false)
    }
  }

  function openRemove(doc) { setRemovingDoc(doc); setRemoveOpen(true) }
  function closeRemove() { setRemoveOpen(false); setRemovingDoc(null) }

  /** Removes the project-document link (does not delete the document file). */
  async function handleRemoveConfirm() {
    setRemoveSubmitting(true)
    try {
      const res = await apiFetch(`/api/project-documents/${removingDoc.projDocId}`, { method: 'DELETE' })
      if (!res.ok) {
        notyfError('Remove failed')
        return
      }
      closeRemove()
      setTimeout(() => notyfSuccess('Document removed from project.'), 150)
      setRefreshKey(k => k + 1)
    } catch {
      notyfError('Remove failed')
    } finally {
      setRemoveSubmitting(false)
    }
  }

  /** Fetches the document file blob and opens the viewer. */
  async function handleViewDocument(doc) {
    setViewLoading(true)
    setViewOpen(true)
    setViewDocMeta(doc)
    try {
      const res = await apiFetch(`/api/documents/${doc.docuId}/file`)
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
    setViewDocMeta(null)
    if (viewBlobUrl) { URL.revokeObjectURL(viewBlobUrl); setViewBlobUrl(null) }
  }

  return (
    <Layout activePage="projects">
      {/* Header */}
      <div className="flex items-stretch justify-between h-16 mb-6">
        <div>
          <h1 className="text-3xl font-semibold">Documents — {projectName}</h1>
          <p className="text-base-content/60 mt-1">Manage documents attached to this project</p>
        </div>
        {canEdit && (
          <div className="flex gap-2 items-center h-full">
            <button type="button" className="btn btn-primary h-full min-h-0" onClick={openAdd}>
              <span className="icon-[tabler--upload] size-4"></span>
              Upload Document
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
      {!loading && !error && documents.length === 0 && (
        <div className="text-center py-24 text-base-content/40">
          <span className="icon-[tabler--files-off] size-16 mx-auto mb-4 block"></span>
          <p className="text-lg font-medium mb-1">No documents attached</p>
          {canEdit && <p className="text-sm mb-6">Upload a file to attach a document to this project.</p>}
          {canEdit && (
            <button type="button" className="btn btn-primary" onClick={openAdd}>
              <span className="icon-[tabler--upload] size-4"></span>
              Upload Document
            </button>
          )}
        </div>
      )}

      {/* Document cards */}
      {!loading && !error && documents.length > 0 && (
        <>
          <p className="text-sm text-base-content/50 mb-3">
            {documents.length} document{documents.length !== 1 ? 's' : ''} attached
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {documents.map(doc => (
              <div key={doc.projDocId} className="group">
                <div className="card bg-base-100 border border-base-300 transition-transform duration-300 group-hover:-translate-y-2 h-full">
                  <div className="card-body gap-3">
                    {/* File icon + name */}
                    <div className="flex items-center gap-3">
                      <span className={`size-8 shrink-0 ${isImage(doc.fileType) ? 'icon-[tabler--photo]' : 'icon-[tabler--file-type-pdf]'} text-primary`}></span>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate" title={doc.fileName}>{doc.fileName}</p>
                        <p className="text-xs text-base-content/50">{fileTypeLabel(doc.fileType)}</p>
                      </div>
                      <span className="badge badge-soft badge-neutral text-xs ml-auto shrink-0">#{doc.docuId}</span>
                    </div>

                    {/* Description */}
                    {doc.description ? (
                      <p className="text-sm text-base-content/70 border-l-2 border-base-300 pl-3 line-clamp-2">
                        {doc.description}
                      </p>
                    ) : (
                      <p className="text-sm text-base-content/40 italic">No description.</p>
                    )}

                    {/* Added on */}
                    <div className="text-xs text-base-content/50">
                      Uploaded: {formatDateTime(doc.addedOn)}
                    </div>

                    {/* Actions */}
                    <div className="card-actions flex-col gap-2 mt-auto">
                      <button
                        className="btn btn-soft btn-primary btn-sm w-full"
                        onClick={() => handleViewDocument(doc)}
                      >
                        <span className="icon-[tabler--eye] size-4"></span>
                        View Document
                      </button>
                      {canEdit && (
                        <>
                          <button
                            className="btn btn-soft btn-secondary btn-sm w-full"
                            onClick={() => openUpdate(doc)}
                          >
                            <span className="icon-[tabler--pencil] size-4"></span>
                            Update Description
                          </button>
                          <button
                            className="btn btn-soft btn-warning btn-sm w-full"
                            onClick={() => openReplace(doc)}
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
            ))}
          </div>
        </>
      )}

      {/* Upload Document Modal */}
      <Modal
        isOpen={addOpen}
        onClose={closeAdd}
        title="Upload Document"
        footer={
          <>
            <button type="button" className="btn btn-soft btn-secondary" onClick={closeAdd}>Cancel</button>
            <button type="submit" form="add-proj-doc-form" className="btn btn-primary" disabled={addSubmitting}>
              {addSubmitting
                ? <span className="loading loading-spinner loading-sm"></span>
                : <span className="icon-[tabler--upload] size-4"></span>
              }
              Upload
            </button>
          </>
        }
      >
        <form id="add-proj-doc-form" onSubmit={handleAddSubmit}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">
                File <span className="text-error">*</span>
                <span className="text-xs text-base-content/50 ml-1">(Images or PDF only)</span>
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

      {/* Update Description Modal */}
      <Modal
        isOpen={updateOpen}
        onClose={closeUpdate}
        title="Update Description"
        footer={
          <>
            <button type="button" className="btn btn-soft btn-secondary" onClick={closeUpdate}>Cancel</button>
            <button type="submit" form="update-proj-doc-form" className="btn btn-primary" disabled={updateSubmitting}>
              {updateSubmitting
                ? <span className="loading loading-spinner loading-sm"></span>
                : <span className="icon-[tabler--device-floppy] size-4"></span>
              }
              Save Changes
            </button>
          </>
        }
      >
        <form id="update-proj-doc-form" onSubmit={handleUpdateSubmit}>
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

      {/* Replace File Modal */}
      <Modal
        isOpen={replaceOpen}
        onClose={closeReplace}
        title={`Replace File — ${replacingDoc?.fileName ?? ''}`}
        footer={
          <>
            <button type="button" className="btn btn-soft btn-secondary" onClick={closeReplace}>Cancel</button>
            <button type="submit" form="replace-proj-doc-form" className="btn btn-warning" disabled={replaceSubmitting}>
              {replaceSubmitting
                ? <span className="loading loading-spinner loading-sm"></span>
                : <span className="icon-[tabler--replace] size-4"></span>
              }
              Replace File
            </button>
          </>
        }
      >
        <form id="replace-proj-doc-form" onSubmit={handleReplaceSubmit}>
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

      {/* Remove Confirmation Modal */}
      <Modal
        isOpen={removeOpen}
        onClose={closeRemove}
        title="Remove Document from Project"
        footer={
          <>
            <button type="button" className="btn btn-soft btn-secondary" onClick={closeRemove}>Cancel</button>
            <button type="button" className="btn btn-error" disabled={removeSubmitting} onClick={handleRemoveConfirm}>
              {removeSubmitting
                ? <span className="loading loading-spinner loading-sm"></span>
                : <span className="icon-[tabler--unlink] size-4"></span>
              }
              Remove
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm">
            Remove <span className="font-semibold">{removingDoc?.fileName}</span> from this project?
          </p>
          <div className="alert alert-warning py-2">
            <span className="icon-[tabler--alert-triangle] size-4 shrink-0"></span>
            <span className="text-sm">The document file is not deleted — only the link to this project is removed.</span>
          </div>
        </div>
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
