import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth";
import { useModal } from "../modals/index.js";
import Layout from "../components/Layout";
import FilePicker from "../components/FilePicker";
import DocumentViewer from "../components/DocumentViewer";
import { notyfSuccess, notyfError } from "../notyf";
import { parseApiError } from "../utils/api";
import { ACCEPTED_TYPES, isImage, fileTypeLabel } from "../utils/documents";

/** Formats a datetime string to "YYYY-MM-DD HH:MM" for display. */
function formatDateTime(dt) {
  if (!dt) return "—";
  return String(dt).slice(0, 16).replace("T", " ");
}

// ─── Upload Document Modal ────────────────────────────────────────────────────

/**
 * Modal for uploading a new file and linking it to the maintenance log.
 * POSTs to /api/documents (with optional description), then links via
 * /api/vehicle-maintenance-log-documents.
 */
function UploadDocumentModal({ mntLogId, onSuccess }) {
  const { popModal } = useModal();
  const { apiFetch } = useAuth();

  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState("");

  function handleFileChange(selectedFile) {
    if (selectedFile && !ACCEPTED_TYPES.includes(selectedFile.type)) {
      setFileError("Only images (JPEG, PNG, GIF, WebP) and PDFs are accepted.");
      setFile(null);
      return;
    }
    setFileError("");
    setFile(selectedFile);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) {
      setFileError("Please select a file.");
      return;
    }
    setFileError("");
    setGeneralError("");
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (description.trim()) formData.append("description", description.trim());

      const uploadRes = await apiFetch("/api/documents", {
        method: "POST",
        body: formData,
      });
      if (!uploadRes.ok) {
        const err = await parseApiError(uploadRes);
        setGeneralError(err._general ?? "File upload failed.");
        notyfError("File upload failed.");
        return;
      }
      const uploaded = await uploadRes.json();

      const linkRes = await apiFetch("/api/vehicle-maintenance-log-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mntLogId: Number(mntLogId), docuId: uploaded.docuId }),
      });
      if (!linkRes.ok) {
        const err = await parseApiError(linkRes);
        setGeneralError(err._general ?? "Failed to link document.");
        notyfError("Failed to link document.");
        return;
      }

      popModal();
      setTimeout(() => notyfSuccess("Document uploaded and linked."), 150);
      onSuccess?.();
    } catch (err) {
      setGeneralError(err.message ?? "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-content w-full max-w-lg my-auto">
      <div className="modal-header">
        <h3 className="modal-title">Upload Document</h3>
        <button
          type="button"
          className="btn btn-text btn-circle btn-sm absolute end-3 top-3"
          onClick={popModal}
        >
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="modal-body">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">
                File <span className="text-error">*</span>
                <span className="text-xs text-base-content/50 ml-1">(Images or PDF only)</span>
              </label>
              <FilePicker file={file} onChange={handleFileChange} error={fileError} />
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Description</label>
              <textarea
                className="textarea textarea-bordered w-full"
                placeholder="Optional description..."
                maxLength={600}
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {generalError && (
              <div className="alert alert-error py-2">
                <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                <span className="text-sm">{generalError}</span>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-soft btn-secondary" onClick={popModal}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? (
              <span className="loading loading-spinner loading-sm"></span>
            ) : (
              <span className="icon-[tabler--upload] size-4"></span>
            )}
            Upload
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Update Description Modal ─────────────────────────────────────────────────

/**
 * Modal for editing the description of an already-linked document.
 * PUTs to /api/documents/{docuId} with the updated description string.
 */
function UpdateDescriptionModal({ doc, onSuccess }) {
  const { popModal } = useModal();
  const { apiFetch } = useAuth();

  const [description, setDescription] = useState(doc.description ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setGeneralError("");
    setSubmitting(true);
    try {
      const res = await apiFetch(`/api/documents/${doc.docuId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      if (!res.ok) {
        const err = await parseApiError(res);
        setGeneralError(err._general ?? "Update failed.");
        notyfError("Update failed.");
        return;
      }
      popModal();
      setTimeout(() => notyfSuccess("Description updated."), 150);
      onSuccess?.();
    } catch (err) {
      setGeneralError(err.message ?? "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-content w-full max-w-lg my-auto">
      <div className="modal-header">
        <h3 className="modal-title">Update Description</h3>
        <button
          type="button"
          className="btn btn-text btn-circle btn-sm absolute end-3 top-3"
          onClick={popModal}
        >
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="modal-body">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Description</label>
              <textarea
                className="textarea textarea-bordered w-full"
                placeholder="Optional description..."
                maxLength={600}
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {generalError && (
              <div className="alert alert-error py-2">
                <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                <span className="text-sm">{generalError}</span>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-soft btn-secondary" onClick={popModal}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? (
              <span className="loading loading-spinner loading-sm"></span>
            ) : (
              <span className="icon-[tabler--device-floppy] size-4"></span>
            )}
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Replace File Modal ───────────────────────────────────────────────────────

/**
 * Modal for swapping the physical file of an existing document.
 * PUTs the new file to /api/documents/{docuId}/file. Description is kept.
 */
function ReplaceFileModal({ doc, onSuccess }) {
  const { popModal } = useModal();
  const { apiFetch } = useAuth();

  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState("");

  function handleFileChange(selectedFile) {
    if (selectedFile && !ACCEPTED_TYPES.includes(selectedFile.type)) {
      setFileError("Only images and PDFs are accepted.");
      setFile(null);
      return;
    }
    setFileError("");
    setFile(selectedFile);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) {
      setFileError("Please select a file.");
      return;
    }
    setFileError("");
    setGeneralError("");
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await apiFetch(`/api/documents/${doc.docuId}/file`, {
        method: "PUT",
        body: formData,
      });
      if (!res.ok) {
        const err = await parseApiError(res);
        setGeneralError(err._general ?? "Replace failed.");
        notyfError("Replace failed.");
        return;
      }
      popModal();
      setTimeout(() => notyfSuccess("File replaced successfully."), 150);
      onSuccess?.();
    } catch (err) {
      setGeneralError(err.message ?? "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-content w-full max-w-lg my-auto">
      <div className="modal-header">
        <h3 className="modal-title">Replace File — {doc.fileName}</h3>
        <button
          type="button"
          className="btn btn-text btn-circle btn-sm absolute end-3 top-3"
          onClick={popModal}
        >
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="modal-body">
          <div className="flex flex-col gap-4">
            <div className="alert alert-warning py-2">
              <span className="icon-[tabler--alert-triangle] size-4 shrink-0"></span>
              <span className="text-sm">
                The current file will be permanently replaced. The description is kept.
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">
                New File <span className="text-error">*</span>
                <span className="text-xs text-base-content/50 ml-1">(Images or PDF only)</span>
              </label>
              <FilePicker file={file} onChange={handleFileChange} error={fileError} />
            </div>

            {generalError && (
              <div className="alert alert-error py-2">
                <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                <span className="text-sm">{generalError}</span>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-soft btn-secondary" onClick={popModal}>
            Cancel
          </button>
          <button type="submit" className="btn btn-warning" disabled={submitting}>
            {submitting ? (
              <span className="loading loading-spinner loading-sm"></span>
            ) : (
              <span className="icon-[tabler--replace] size-4"></span>
            )}
            Replace File
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

/**
 * Page listing all documents linked to a specific maintenance log.
 * Route: /vehicle-logs/:vehicleLogId/maintenance/:mntLogId/documents
 */
export default function VehicleMaintenanceDocuments() {
  const { vehicleLogId, mntLogId } = useParams();
  const { apiFetch, hasRole } = useAuth();
  const { pushModal } = useModal();
  const navigate = useNavigate();

  const canEdit = hasRole("ADMIN", "STAFF");

  const [maintenanceLog, setMaintenanceLog] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Viewer overlay state
  const [viewOpen, setViewOpen] = useState(false);
  const [viewDocMeta, setViewDocMeta] = useState(null);
  const [viewBlobUrl, setViewBlobUrl] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);

  /** Fetches the parent maintenance log to display in the header. */
  useEffect(() => {
    apiFetch(`/api/vehicle-maintenance-logs/${mntLogId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setMaintenanceLog(data))
      .catch(() => {});
  }, [apiFetch, mntLogId]);

  /** Fetches all documents linked to this maintenance log. */
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    apiFetch(
      `/api/vehicle-maintenance-log-documents?mntLogId=${mntLogId}&size=100&sort=mntLogDocId,asc`,
    )
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load documents (${res.status})`);
        return res.json();
      })
      .then((data) => {
        if (active) setDocuments(data.content ?? []);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [apiFetch, mntLogId, refreshKey]);

  // Revoke object URL on unmount to avoid memory leaks
  useEffect(() => {
    return () => {
      if (viewBlobUrl) URL.revokeObjectURL(viewBlobUrl);
    };
  }, [viewBlobUrl]);

  function refresh() {
    setRefreshKey((k) => k + 1);
  }

  /** Fetches the file blob and opens the viewer overlay. */
  async function handleView(doc) {
    setViewLoading(true);
    setViewOpen(true);
    setViewDocMeta(doc);
    try {
      const res = await apiFetch(`/api/documents/${doc.docuId}/file`);
      if (!res.ok) {
        notyfError("Could not load file.");
        setViewOpen(false);
        return;
      }
      const blob = await res.blob();
      if (viewBlobUrl) URL.revokeObjectURL(viewBlobUrl);
      setViewBlobUrl(URL.createObjectURL(blob));
    } catch {
      notyfError("Could not load file.");
      setViewOpen(false);
    } finally {
      setViewLoading(false);
    }
  }

  function closeView() {
    setViewOpen(false);
    setViewDocMeta(null);
    if (viewBlobUrl) {
      URL.revokeObjectURL(viewBlobUrl);
      setViewBlobUrl(null);
    }
  }

  const subtitle = maintenanceLog
    ? `${maintenanceLog.mntType} · Invoice ${maintenanceLog.invoiceId}`
    : `Maintenance #${mntLogId}`;

  return (
    <Layout activePage="vehicles">
      {/* Header */}
      <div className="flex items-stretch justify-between h-16 mb-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="btn btn-secondary btn-sm btn-circle"
            onClick={() => navigate(-1)}
          >
            <span className="icon-[tabler--arrow-left] size-5"></span>
          </button>
          <div>
            <h1 className="text-3xl font-semibold">Documents — Maintenance #{mntLogId}</h1>
            <p className="text-base-content/60 mt-1">{subtitle}</p>
          </div>
        </div>
        {canEdit && (
          <div className="flex gap-2 items-center h-full">
            <button
              type="button"
              className="btn btn-primary h-full min-h-0"
              onClick={() =>
                pushModal(<UploadDocumentModal mntLogId={mntLogId} onSuccess={refresh} />)
              }
            >
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
          {canEdit && (
            <>
              <p className="text-sm mb-6">Upload a file to attach it to this maintenance log.</p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() =>
                  pushModal(<UploadDocumentModal mntLogId={mntLogId} onSuccess={refresh} />)
                }
              >
                <span className="icon-[tabler--upload] size-4"></span>
                Upload Document
              </button>
            </>
          )}
        </div>
      )}

      {/* Document card grid */}
      {!loading && !error && documents.length > 0 && (
        <>
          <p className="text-sm text-base-content/50 mb-3">
            {documents.length} document{documents.length !== 1 ? "s" : ""} attached
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {documents.map((doc) => (
              <div key={doc.mntLogDocId} className="group">
                <div className="card bg-base-100 border border-base-300 transition-transform duration-300 group-hover:-translate-y-2 h-full">
                  <div className="card-body gap-3">
                    {/* File icon + name + badge */}
                    <div className="flex items-center gap-3">
                      <span
                        className={`size-8 shrink-0 ${
                          isImage(doc.fileType)
                            ? "icon-[tabler--photo]"
                            : "icon-[tabler--file-type-pdf]"
                        } text-primary`}
                      ></span>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate" title={doc.fileName}>
                          {doc.fileName}
                        </p>
                        <p className="text-xs text-base-content/50">
                          {fileTypeLabel(doc.fileType)}
                        </p>
                      </div>
                      <span className="badge badge-soft badge-neutral text-xs ml-auto shrink-0">
                        #{doc.docuId}
                      </span>
                    </div>

                    {/* Description */}
                    {doc.description ? (
                      <p className="text-sm text-base-content/70 border-l-2 border-base-300 pl-3 line-clamp-2">
                        {doc.description}
                      </p>
                    ) : (
                      <p className="text-sm text-base-content/40 italic">No description.</p>
                    )}

                    {/* Upload timestamp */}
                    <div className="text-xs text-base-content/50">
                      Uploaded: {formatDateTime(doc.addedOn)}
                    </div>

                    {/* Actions */}
                    <div className="card-actions flex-col gap-2 mt-auto">
                      <button
                        className="btn btn-soft btn-primary btn-sm w-full"
                        onClick={() => handleView(doc)}
                      >
                        <span className="icon-[tabler--eye] size-4"></span>
                        View Document
                      </button>
                      {canEdit && (
                        <>
                          <button
                            className="btn btn-soft btn-secondary btn-sm w-full"
                            onClick={() =>
                              pushModal(
                                <UpdateDescriptionModal doc={doc} onSuccess={refresh} />,
                              )
                            }
                          >
                            <span className="icon-[tabler--pencil] size-4"></span>
                            Update Description
                          </button>
                          <button
                            className="btn btn-soft btn-warning btn-sm w-full"
                            onClick={() =>
                              pushModal(<ReplaceFileModal doc={doc} onSuccess={refresh} />)
                            }
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

      {/* Document viewer overlay */}
      <DocumentViewer
        isOpen={viewOpen}
        onClose={closeView}
        fileName={viewDocMeta?.fileName}
        fileType={viewDocMeta?.fileType}
        blobUrl={viewBlobUrl}
        loading={viewLoading}
      />
    </Layout>
  );
}
