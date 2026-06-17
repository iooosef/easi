import { isImage } from '../utils/documents'

/**
 * Full-screen overlay for viewing a document blob (image or PDF).
 * Clicking the backdrop closes the viewer.
 */
export default function DocumentViewer({ isOpen, onClose, fileName, fileType, blobUrl, loading }) {
  if (!isOpen) return null
  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-[50]" onClick={onClose} />
      <div className="fixed inset-0 z-[51] flex flex-col items-center justify-center p-4 gap-3">
        <div className="flex items-center justify-between w-full max-w-5xl">
          <span className="text-white font-medium truncate">{fileName ?? 'Document'}</span>
          <button type="button" className="btn btn-circle btn-sm btn-secondary text-white" onClick={onClose}>
            <span className="icon-[tabler--x] size-5"></span>
          </button>
        </div>
        <div
          className="w-full max-w-5xl flex-1 overflow-hidden rounded-box bg-base-100 flex items-center justify-center"
          style={{ maxHeight: '80vh' }}
        >
          {loading ? (
            <span className="loading loading-spinner loading-lg text-primary"></span>
          ) : blobUrl && isImage(fileType) ? (
            <img src={blobUrl} alt={fileName} className="max-w-full max-h-full object-contain" />
          ) : blobUrl ? (
            <embed src={blobUrl} type="application/pdf" style={{ width: '100%', height: '70vh' }} />
          ) : null}
        </div>
      </div>
    </>
  )
}
