import { useState, useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useAuth } from "../auth";
import { useModal } from "../modals/index.js";
import Layout from "../components/Layout";
import { notyfSuccess, notyfError } from "../notyf";
import { parseApiError } from "../utils/api";
import { ACCEPTED_TYPES, isImage, fileTypeLabel } from "../utils/documents";
import DocumentViewer from "../components/DocumentViewer";
import FilePicker from "../components/FilePicker";

/** Formats a LocalDateTime string to "YYYY-MM-DD HH:MM" for display. */
function formatDateTime(dt) {
  if (!dt) return "—";
  return String(dt).slice(0, 16).replace("T", " ");
}

// ─── Upload Document Modal ────────────────────────────────────────────────────

/**
 * Modal for uploading a new file and linking it to the employee.
 *
 * Two-step process:
 *   1. POST /api/documents to create the document record and store the file.
 *   2. POST /api/employee-documents to link that document to the employee.
 *
 * The file picker is managed outside react-hook-form (FilePicker exposes a
 * File object, not a DOM event), so its error is stored in component state.
 */
function UploadDocumentModal({ employeeId, onSuccess }) {
  const { popModal } = useModal();
  const { apiFetch } = useAuth();

  // react-hook-form handles the description textarea
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { description: "" } });

  // File and its validation error are kept outside RHF because FilePicker
  // returns a File object directly rather than a native change event.
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState("");

  /** Validates the selected file type before accepting it. */
  function handleFileChange(selectedFile) {
    if (selectedFile && !ACCEPTED_TYPES.includes(selectedFile.type)) {
      setFileError("Only images (JPEG, PNG, GIF, WebP) and PDFs are accepted.");
      setFile(null);
      return;
    }
    setFileError("");
    setFile(selectedFile);
  }

  /**
   * Runs on form submit.
   * Uploads the file first, then creates the employee-document link.
   * On any API failure the inline error is shown and submission stops.
   */
  async function onSubmit(data) {
    // Require a file before proceeding
    if (!file) {
      setFileError("Please select a file.");
      return;
    }
    setFileError("");

    // Step 1 — upload the file to create a document record
    const formData = new FormData();
    formData.append("file", file);
    if (data.description.trim()) formData.append("description", data.description.trim());

    const uploadRes = await apiFetch("/api/documents", { method: "POST", body: formData });
    if (!uploadRes.ok) {
      const apiErrors = await parseApiError(uploadRes);
      // Map API field errors back into RHF; fall back to _general for unknown keys
      Object.entries(apiErrors).forEach(([field, message]) => {
        if (field === "_general") setError("root.serverError", { message });
        else setError(field, { message });
      });
      notyfError("Upload failed");
      return;
    }
    const uploaded = await uploadRes.json();

    // Step 2 — link the uploaded document to the employee
    const linkRes = await apiFetch("/api/employee-documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId: Number(employeeId), docuId: uploaded.docuId }),
    });
    if (!linkRes.ok) {
      const apiErrors = await parseApiError(linkRes);
      setError("root.serverError", { message: apiErrors._general ?? "Failed to link document" });
      notyfError("Failed to link document");
      return;
    }

    popModal();
    setTimeout(() => notyfSuccess("Document uploaded and linked to employee."), 150);
    onSuccess?.();
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

      {/* handleSubmit from RHF wraps our async onSubmit */}
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="modal-body">
          <div className="flex flex-col gap-4">
            {/* File picker — managed outside RHF; its error lives in fileError state */}
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">
                File <span className="text-error">*</span>
                <span className="text-xs text-base-content/50 ml-1">(Images or PDF only)</span>
              </label>
              <FilePicker file={file} onChange={handleFileChange} error={fileError} />
            </div>

            {/* Description textarea — registered directly with RHF */}
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Description</label>
              <textarea
                className={`textarea textarea-bordered w-full${errors.description ? " is-invalid" : ""}`}
                placeholder="Optional description..."
                maxLength={600}
                rows={3}
                {...register("description")}
              />
              {errors.description && (
                <span className="helper-text">{errors.description.message}</span>
              )}
            </div>

            {/* Root / server-level error (e.g. network failure, unexpected 500) */}
            {errors.root?.serverError && (
              <div className="alert alert-error py-2">
                <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                <span className="text-sm">{errors.root.serverError.message}</span>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-soft btn-secondary" onClick={popModal}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? (
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
 * Modal for editing the text description of an already-linked document.
 * PUTs to /api/documents/{docuId} with the updated description string.
 *
 * Pre-populates the textarea with the current description so the user
 * can make targeted edits rather than retyping the whole thing.
 */
function UpdateDescriptionModal({ doc, onSuccess }) {
  const { popModal } = useModal();
  const { apiFetch } = useAuth();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { description: doc.description ?? "" } });

  /** Saves the updated description and closes this layer on success. */
  async function onSubmit(data) {
    // docuId is the document primary key returned by EmployeeDocumentResponse
    const res = await apiFetch(`/api/documents/${doc.docuId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: data.description }),
    });
    if (!res.ok) {
      const apiErrors = await parseApiError(res);
      Object.entries(apiErrors).forEach(([field, message]) => {
        if (field === "_general") setError("root.serverError", { message });
        else setError(field, { message });
      });
      notyfError("Update failed");
      return;
    }
    popModal();
    setTimeout(() => notyfSuccess("Description updated."), 150);
    onSuccess?.();
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

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="modal-body">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Description</label>
              <textarea
                className={`textarea textarea-bordered w-full${errors.description ? " is-invalid" : ""}`}
                placeholder="Optional description..."
                maxLength={600}
                rows={4}
                {...register("description")}
              />
              {errors.description && (
                <span className="helper-text">{errors.description.message}</span>
              )}
            </div>

            {errors.root?.serverError && (
              <div className="alert alert-error py-2">
                <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                <span className="text-sm">{errors.root.serverError.message}</span>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-soft btn-secondary" onClick={popModal}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? (
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
 * Modal for swapping the physical file of an existing document link.
 * PUTs the new file to /api/documents/{docuId}/file.
 *
 * The document description is preserved — only the stored file bytes change.
 * react-hook-form is used here purely for the submit lifecycle (isSubmitting);
 * the file itself is tracked in component state, same as UploadDocumentModal.
 */
function ReplaceFileModal({ doc, onSuccess }) {
  const { popModal } = useModal();
  const { apiFetch } = useAuth();

  const {
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm();

  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState("");

  /** Rejects non-image / non-PDF selections before storing them. */
  function handleFileChange(selectedFile) {
    if (selectedFile && !ACCEPTED_TYPES.includes(selectedFile.type)) {
      setFileError("Only images and PDFs are accepted.");
      setFile(null);
      return;
    }
    setFileError("");
    setFile(selectedFile);
  }

  /** Sends the replacement file; closes this layer on success. */
  async function onSubmit() {
    if (!file) {
      setFileError("Please select a file.");
      return;
    }
    setFileError("");

    const formData = new FormData();
    formData.append("file", file);
    const res = await apiFetch(`/api/documents/${doc.docuId}/file`, {
      method: "PUT",
      body: formData,
    });
    if (!res.ok) {
      const apiErrors = await parseApiError(res);
      setError("root.serverError", { message: apiErrors._general ?? "Replace failed" });
      notyfError("Replace failed");
      return;
    }
    popModal();
    setTimeout(() => notyfSuccess("File replaced successfully."), 150);
    onSuccess?.();
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

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="modal-body">
          <div className="flex flex-col gap-4">
            {/* Warn the user that the existing file is permanently overwritten */}
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

            {errors.root?.serverError && (
              <div className="alert alert-error py-2">
                <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                <span className="text-sm">{errors.root.serverError.message}</span>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-soft btn-secondary" onClick={popModal}>
            Cancel
          </button>
          <button type="submit" className="btn btn-warning" disabled={isSubmitting}>
            {isSubmitting ? (
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

// ─── Remove Confirmation Modal ────────────────────────────────────────────────

/**
 * Confirmation modal before removing an employee-document link.
 * DELETEs /api/employee-documents/{empDocId}.
 *
 * The underlying Document record and its stored file are NOT deleted —
 * only the many-to-many link between this employee and the document is removed.
 */
function RemoveDocumentModal({ doc, onSuccess }) {
  const { popModal } = useModal();
  const { apiFetch } = useAuth();

  // isSubmitting is the only RHF value we need here — no fields to register
  const { handleSubmit, formState: { isSubmitting } } = useForm();

  /** Deletes the employee-document link and closes this layer on success. */
  async function onSubmit() {
    const res = await apiFetch(`/api/employee-documents/${doc.empDocId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      notyfError("Remove failed");
      return;
    }
    popModal();
    setTimeout(() => notyfSuccess("Document removed from employee."), 150);
    onSuccess?.();
  }

  return (
    <div className="modal-content w-full max-w-sm my-auto">
      <div className="modal-header">
        <h3 className="modal-title">Remove Document</h3>
        <button
          type="button"
          className="btn btn-text btn-circle btn-sm absolute end-3 top-3"
          onClick={popModal}
        >
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="modal-body">
          <div className="flex flex-col gap-3">
            <p className="text-sm">
              Remove <span className="font-semibold">{doc.fileName}</span> from this employee?
            </p>
            {/* Clarify that only the link is removed, not the physical file */}
            <div className="alert alert-warning py-2">
              <span className="icon-[tabler--alert-triangle] size-4 shrink-0"></span>
              <span className="text-sm">
                The document file is not deleted — only the link to this employee is removed.
              </span>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-soft btn-secondary" onClick={popModal}>
            Cancel
          </button>
          <button type="submit" className="btn btn-error" disabled={isSubmitting}>
            {isSubmitting ? (
              <span className="loading loading-spinner loading-sm"></span>
            ) : (
              <span className="icon-[tabler--unlink] size-4"></span>
            )}
            Remove
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

/**
 * Page for viewing and managing documents attached to a specific employee.
 *
 * Displays a responsive card grid of linked documents. Each card shows the
 * file name, type, description, upload timestamp, and action buttons.
 *
 * Route:    /employees/:employeeId/documents
 * Nav state: { employeeName: string } — passed by the Employees page when navigating here.
 *
 * Permissions:
 *   - All authenticated users can view documents.
 *   - Only ADMIN and STAFF can upload, update, replace, or remove documents.
 */
export default function EmployeeDocuments() {
  const { apiFetch, hasRole } = useAuth();
  const { pushModal } = useModal();
  const { employeeId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  // Display name sourced from navigation state; falls back gracefully to the ID
  const employeeName = location.state?.employeeName ?? `Employee #${employeeId}`;

  // Only ADMIN and STAFF may mutate employee documents
  const canEdit = hasRole("ADMIN", "STAFF");

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Incrementing this key re-triggers the fetch effect after any mutation
  const [refreshKey, setRefreshKey] = useState(0);

  // Viewer overlay state — tracks the open/loading state and the blob URL
  const [viewOpen, setViewOpen] = useState(false);
  const [viewDocMeta, setViewDocMeta] = useState(null);
  const [viewBlobUrl, setViewBlobUrl] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);

  /**
   * Fetches all employee-document links for this employee, sorted by link ID.
   * Re-runs whenever employeeId or refreshKey changes.
   *
   * The `active` flag prevents state updates after the component unmounts
   * or when a newer request has already started.
   */
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    apiFetch(
      `/api/employee-documents?employee=${employeeId}&size=100&sort=empDocId,asc`,
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
  }, [apiFetch, employeeId, refreshKey]);

  // Revoke the object URL when the viewer closes to avoid memory leaks
  useEffect(() => {
    return () => {
      if (viewBlobUrl) URL.revokeObjectURL(viewBlobUrl);
    };
  }, [viewBlobUrl]);

  /** Bumps the refresh key to reload the document list after a mutation. */
  function refresh() {
    setRefreshKey((k) => k + 1);
  }

  /**
   * Fetches the raw file blob for a document and opens the viewer overlay.
   * Uses docuId (the underlying Document PK) to call the file endpoint.
   */
  async function handleViewDocument(doc) {
    setViewLoading(true);
    setViewOpen(true);
    setViewDocMeta(doc);
    try {
      const res = await apiFetch(`/api/documents/${doc.docuId}/file`);
      if (!res.ok) {
        notyfError("Could not load file");
        setViewOpen(false);
        return;
      }
      const blob = await res.blob();
      // Release the previous blob URL before creating a new one
      if (viewBlobUrl) URL.revokeObjectURL(viewBlobUrl);
      setViewBlobUrl(URL.createObjectURL(blob));
    } catch {
      notyfError("Could not load file");
      setViewOpen(false);
    } finally {
      setViewLoading(false);
    }
  }

  /** Closes the document viewer and frees the blob URL. */
  function closeView() {
    setViewOpen(false);
    setViewDocMeta(null);
    if (viewBlobUrl) {
      URL.revokeObjectURL(viewBlobUrl);
      setViewBlobUrl(null);
    }
  }

  return (
    <Layout activePage="employees">
      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="flex items-stretch justify-between h-16 mb-6">
        <div className="flex items-center gap-3">
          {/* Back button — returns to whichever page the user navigated from */}
          <button
            type="button"
            className="btn btn-secondary btn-sm btn-circle"
            onClick={() => navigate(-1)}
          >
            <span className="icon-[tabler--arrow-left] size-5"></span>
          </button>
          <div>
            <h1 className="text-3xl font-semibold">Documents — {employeeName}</h1>
            <p className="text-base-content/60 mt-1">
              Manage documents attached to this employee
            </p>
          </div>
        </div>

        {/* Upload button is only shown to editors (ADMIN / STAFF) */}
        {canEdit && (
          <div className="flex gap-2 items-center h-full">
            <button
              type="button"
              className="btn btn-primary h-full min-h-0"
              onClick={() =>
                pushModal(
                  <UploadDocumentModal employeeId={employeeId} onSuccess={refresh} />,
                )
              }
            >
              <span className="icon-[tabler--upload] size-4"></span>
              Upload Document
            </button>
          </div>
        )}
      </div>

      {/* ── Error banner ─────────────────────────────────────────────────────── */}
      {error && (
        <div className="alert alert-error mb-4">
          <span className="icon-[tabler--alert-circle] size-5"></span>
          <span>{error}</span>
        </div>
      )}

      {/* ── Loading spinner ───────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex justify-center py-20">
          <span className="loading loading-spinner loading-lg text-primary"></span>
        </div>
      )}

      {/* ── Empty state ───────────────────────────────────────────────────────── */}
      {!loading && !error && documents.length === 0 && (
        <div className="text-center py-24 text-base-content/40">
          <span className="icon-[tabler--files-off] size-16 mx-auto mb-4 block"></span>
          <p className="text-lg font-medium mb-1">No documents attached</p>
          {canEdit && (
            <>
              <p className="text-sm mb-6">
                Upload a file to attach a document to this employee.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() =>
                  pushModal(
                    <UploadDocumentModal employeeId={employeeId} onSuccess={refresh} />,
                  )
                }
              >
                <span className="icon-[tabler--upload] size-4"></span>
                Upload Document
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Document card grid ────────────────────────────────────────────────── */}
      {!loading && !error && documents.length > 0 && (
        <>
          <p className="text-sm text-base-content/50 mb-3">
            {documents.length} document{documents.length !== 1 ? "s" : ""} attached
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {documents.map((doc) => (
              // Subtle lift animation on hover to make the card feel interactive
              <div key={doc.empDocId} className="group">
                <div className="card bg-base-100 border border-base-300 transition-transform duration-300 group-hover:-translate-y-2 h-full">
                  <div className="card-body gap-3">

                    {/* ── File icon, name, and document ID badge ── */}
                    <div className="flex items-center gap-3">
                      <span
                        className={`size-8 shrink-0 ${
                          isImage(doc.fileType)
                            ? "icon-[tabler--photo]"
                            : "icon-[tabler--file-type-pdf]"
                        } text-primary`}
                      ></span>
                      <div className="min-w-0">
                        <p
                          className="font-semibold text-sm truncate"
                          title={doc.fileName}
                        >
                          {doc.fileName}
                        </p>
                        <p className="text-xs text-base-content/50">
                          {fileTypeLabel(doc.fileType)}
                        </p>
                      </div>
                      {/* Badge shows the underlying Document record's PK */}
                      <span className="badge badge-soft badge-neutral text-xs ml-auto shrink-0">
                        #{doc.docuId}
                      </span>
                    </div>

                    {/* ── Description or placeholder when none is set ── */}
                    {doc.description ? (
                      <p className="text-sm text-base-content/70 border-l-2 border-base-300 pl-3 line-clamp-2">
                        {doc.description}
                      </p>
                    ) : (
                      <p className="text-sm text-base-content/40 italic">No description.</p>
                    )}

                    {/* ── Upload timestamp ── */}
                    <div className="text-xs text-base-content/50">
                      Uploaded: {formatDateTime(doc.addedOn)}
                    </div>

                    {/* ── Action buttons ── */}
                    <div className="card-actions flex-col gap-2 mt-auto">
                      {/* View — fetches the blob and opens the overlay viewer */}
                      <button
                        className="btn btn-soft btn-primary btn-sm w-full"
                        onClick={() => handleViewDocument(doc)}
                      >
                        <span className="icon-[tabler--eye] size-4"></span>
                        View Document
                      </button>

                      {/* Edit actions are gated by role (ADMIN / STAFF only) */}
                      {canEdit && (
                        <>
                          {/* Update Description — edit the document's text metadata */}
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

                          {/* Replace File — swap the stored file, keep description */}
                          <button
                            className="btn btn-soft btn-warning btn-sm w-full"
                            onClick={() =>
                              pushModal(
                                <ReplaceFileModal doc={doc} onSuccess={refresh} />,
                              )
                            }
                          >
                            <span className="icon-[tabler--replace] size-4"></span>
                            Replace File
                          </button>

                          {/* Remove — deletes only the link, not the file */}
                          <button
                            className="btn btn-soft btn-error btn-sm w-full"
                            onClick={() =>
                              pushModal(
                                <RemoveDocumentModal doc={doc} onSuccess={refresh} />,
                              )
                            }
                          >
                            <span className="icon-[tabler--unlink] size-4"></span>
                            Remove
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

      {/* ── Document viewer overlay (image or PDF fullscreen) ────────────────── */}
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
