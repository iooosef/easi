import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useAuth } from "../auth";
import { useModal } from "../modals/index.js";
import Layout from "../components/Layout";
import ModalNav from "../modals/ModalNav.jsx";
import FilePicker from "../components/FilePicker";
import { notyfSuccess, notyfError } from "../notyf";
import { parseApiError } from "../utils/api";
import { ACCEPTED_TYPES } from "../utils/documents";

/** Formats a number as PHP currency. */
function formatCurrency(value) {
  if (value == null) return "—";
  return Number(value).toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP",
  });
}

const MANAGE_MENU_ITEMS = [
  {
    key: "update",
    label: "Update Details",
    icon: "icon-[tabler--pencil]",
    roles: ["ADMIN", "STAFF", "CREW"],
  },
  {
    key: "documents",
    label: "Documents",
    icon: "icon-[tabler--files]",
    roles: ["ADMIN", "STAFF", "CREW"],
  },
];

const PAGE_SIZE = 10;

// ─── Step 1: Enter Maintenance Details ───────────────────────────────────────

/**
 * Step 1 of the 2-step Record New Maintenance flow.
 * Collects mntType, invoiceId, and amount via react-hook-form.
 * On Next, replaces itself with Step 2, passing the form data forward.
 */
function AddMaintenanceStep1Modal({ vehicleLogId, onSuccess, defaultValues }) {
  const { popModal, replaceModal } = useModal();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: defaultValues ?? { mntType: "", invoiceId: "", amount: "" },
  });

  function onNext(data) {
    replaceModal(
      <AddMaintenanceStep2Modal
        vehicleLogId={vehicleLogId}
        step1Data={data}
        onSuccess={onSuccess}
      />,
    );
  }

  return (
    <div className="modal-content w-full max-w-sm my-auto">
      <div className="modal-header">
        <div>
          <h3 className="modal-title">Record Maintenance</h3>
          <span className="text-sm text-base-content/50">Step 1 of 2 — Details</span>
        </div>
        <button
          type="button"
          className="btn btn-text btn-circle btn-sm absolute end-3 top-3"
          onClick={popModal}
        >
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>

      <form onSubmit={handleSubmit(onNext)}>
        <div className="modal-body">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">
                Maintenance Type <span className="text-error">*</span>
              </label>
              <input
                type="text"
                className={`input input-bordered w-full${errors.mntType ? " is-invalid" : ""}`}
                placeholder="e.g. Oil Change, Tire Rotation"
                maxLength={30}
                {...register("mntType", { required: "Maintenance type is required." })}
              />
              {errors.mntType && (
                <span className="helper-text">{errors.mntType.message}</span>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">
                Invoice ID <span className="text-error">*</span>
              </label>
              <input
                type="text"
                className={`input input-bordered w-full${errors.invoiceId ? " is-invalid" : ""}`}
                placeholder="e.g. INV-001"
                maxLength={16}
                {...register("invoiceId", { required: "Invoice ID is required." })}
              />
              {errors.invoiceId && (
                <span className="helper-text">{errors.invoiceId.message}</span>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">
                Amount <span className="text-error">*</span>
              </label>
              <input
                type="number"
                className={`input input-bordered w-full${errors.amount ? " is-invalid" : ""}`}
                placeholder="e.g. 1500.00"
                min="0"
                step="0.01"
                {...register("amount", {
                  required: "Amount is required.",
                  min: { value: 0, message: "Amount must be non-negative." },
                })}
              />
              {errors.amount && (
                <span className="helper-text">{errors.amount.message}</span>
              )}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-soft btn-secondary" onClick={popModal}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            <span className="icon-[tabler--arrow-right] size-4"></span>
            Next
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Step 2: Attach Documents ─────────────────────────────────────────────────

/**
 * Step 2 of the 2-step Record New Maintenance flow.
 * Allows attaching zero or more files. On Save, all data is committed to the DB:
 *   1. POST /api/vehicle-maintenance-logs to create the log record.
 *   2. For each file: POST /api/documents → POST /api/vehicle-maintenance-log-documents.
 */
function AddMaintenanceStep2Modal({ vehicleLogId, step1Data, onSuccess }) {
  const { popModal, replaceModal } = useModal();
  const { apiFetch } = useAuth();

  const [files, setFiles] = useState([]);
  const [pickerFile, setPickerFile] = useState(null);
  const [fileError, setFileError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState("");

  /** Validates and stages a file for attachment. */
  function handleFileChange(file) {
    if (file && !ACCEPTED_TYPES.includes(file.type)) {
      setFileError("Only images (JPEG, PNG, GIF, WebP) and PDFs are accepted.");
      setPickerFile(null);
      return;
    }
    setFileError("");
    setPickerFile(file);
  }

  /** Adds the currently-selected file to the staged list. */
  function addFile() {
    if (!pickerFile) {
      setFileError("Please select a file first.");
      return;
    }
    setFiles((prev) => [...prev, pickerFile]);
    setPickerFile(null);
    setFileError("");
  }

  /** Removes a staged file by index. */
  function removeFile(index) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  /** Goes back to Step 1, preserving the entered form data. */
  function goBack() {
    replaceModal(
      <AddMaintenanceStep1Modal
        vehicleLogId={vehicleLogId}
        onSuccess={onSuccess}
        defaultValues={step1Data}
      />,
    );
  }

  /**
   * Saves all data to the database:
   * 1. Creates the maintenance log.
   * 2. Uploads each staged file and links it to the log.
   */
  async function handleSave() {
    setGeneralError("");
    setSubmitting(true);
    try {
      // Step 1 — create the maintenance log record
      const logRes = await apiFetch("/api/vehicle-maintenance-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleLogId: Number(vehicleLogId),
          amount: Number(step1Data.amount),
          invoiceId: step1Data.invoiceId,
          mntType: step1Data.mntType,
        }),
      });
      if (!logRes.ok) {
        const err = await parseApiError(logRes);
        setGeneralError(err._general ?? "Failed to create maintenance log.");
        notyfError("Failed to create maintenance log.");
        return;
      }
      const logData = await logRes.json();
      const mntLogId = logData.mntLogId;

      // Step 2 — upload and link each staged file
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        const uploadRes = await apiFetch("/api/documents", {
          method: "POST",
          body: fd,
        });
        if (!uploadRes.ok) {
          const err = await parseApiError(uploadRes);
          setGeneralError(err._general ?? "A file upload failed.");
          notyfError("A file upload failed.");
          return;
        }
        const docData = await uploadRes.json();

        const linkRes = await apiFetch("/api/vehicle-maintenance-log-documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mntLogId, docuId: docData.docuId }),
        });
        if (!linkRes.ok) {
          setGeneralError("Failed to link a document to the maintenance log.");
          notyfError("Failed to link document.");
          return;
        }
      }

      popModal();
      setTimeout(() => notyfSuccess("Maintenance log recorded successfully."), 150);
      onSuccess?.();
    } catch (err) {
      setGeneralError(err.message ?? "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-content w-full max-w-sm my-auto">
      <div className="modal-header">
        <div>
          <h3 className="modal-title">Record Maintenance</h3>
          <span className="text-sm text-base-content/50">Step 2 of 2 — Attach Documents</span>
        </div>
        <button
          type="button"
          className="btn btn-text btn-circle btn-sm absolute end-3 top-3"
          onClick={popModal}
          disabled={submitting}
        >
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>

      <div className="modal-body">
        <div className="flex flex-col gap-4">
          {/* Summary of step 1 data */}
          <div className="grid grid-cols-2 gap-2 text-sm bg-base-200 rounded-box p-3">
            <span className="text-base-content/50">Type</span>
            <span className="font-medium">{step1Data.mntType}</span>
            <span className="text-base-content/50">Invoice ID</span>
            <span className="font-medium font-mono">{step1Data.invoiceId}</span>
            <span className="text-base-content/50">Amount</span>
            <span className="font-medium">{formatCurrency(step1Data.amount)}</span>
          </div>

          {/* File picker + Add button */}
          <div className="flex flex-col gap-1">
            <label className="label-text font-medium">
              Add Document{" "}
              <span className="text-base-content/40 font-normal">(optional)</span>
            </label>
            <FilePicker file={pickerFile} onChange={handleFileChange} error={fileError} />
            <button
              type="button"
              className="btn btn-soft btn-secondary btn-sm mt-1"
              onClick={addFile}
              disabled={!pickerFile}
            >
              <span className="icon-[tabler--plus] size-4"></span>
              Add to List
            </button>
          </div>

          {/* Staged file list */}
          {files.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-base-content/60">
                Files to attach ({files.length})
              </p>
              {files.map((f, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between bg-base-200 rounded-btn px-3 py-2 text-sm"
                >
                  <span className="truncate max-w-[200px]" title={f.name}>
                    {f.name}
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs btn-circle text-error shrink-0 ml-2"
                    onClick={() => removeFile(i)}
                  >
                    <span className="icon-[tabler--trash] size-4"></span>
                  </button>
                </div>
              ))}
            </div>
          )}

          {generalError && (
            <div className="alert alert-error py-2">
              <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
              <span className="text-sm">{generalError}</span>
            </div>
          )}
        </div>
      </div>

      <div className="modal-footer">
        <button
          type="button"
          className="btn btn-soft btn-secondary"
          onClick={goBack}
          disabled={submitting}
        >
          <span className="icon-[tabler--arrow-left] size-4"></span>
          Back
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleSave}
          disabled={submitting}
        >
          {submitting ? (
            <span className="loading loading-spinner loading-xs"></span>
          ) : (
            <span className="icon-[tabler--device-floppy] size-4"></span>
          )}
          Save
        </button>
      </div>
    </div>
  );
}

// ─── Manage Maintenance Modal ─────────────────────────────────────────────────

/**
 * L1 manage panel for a single maintenance log.
 * Provides navigation to Update Details or the Documents sub-page.
 */
function ManageMaintenanceModal({ log, vehicleLogId, onRefresh }) {
  const { pushModal, popModal } = useModal();
  const { hasRole } = useAuth();
  const navigate = useNavigate();

  function handleAction(key) {
    if (key === "update")
      pushModal(
        <UpdateMaintenanceModal log={log} vehicleLogId={vehicleLogId} onRefresh={onRefresh} />,
      );
    if (key === "documents") {
      popModal();
      navigate(`/vehicle-logs/${vehicleLogId}/maintenance/${log.mntLogId}/documents`);
    }
  }

  return (
    <div className="modal-content w-full max-w-sm my-auto">
      <div className="modal-header">
        <div>
          <h3 className="modal-title">Maintenance #{log.mntLogId}</h3>
          <span className="text-sm text-base-content/50">{log.mntType}</span>
        </div>
        <button
          type="button"
          className="btn btn-text btn-circle btn-sm absolute end-3 top-3"
          onClick={popModal}
        >
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-base-content/50 uppercase tracking-wide">Type</span>
            <span className="font-medium">{log.mntType}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-base-content/50 uppercase tracking-wide">Invoice ID</span>
            <span className="font-medium font-mono">{log.invoiceId}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-base-content/50 uppercase tracking-wide">Amount</span>
            <span className="font-medium">{formatCurrency(log.amount)}</span>
          </div>
        </div>
        <ModalNav
          items={MANAGE_MENU_ITEMS}
          hasRole={hasRole}
          onSelect={handleAction}
          cols={3}
        />
      </div>
    </div>
  );
}

// ─── Update Maintenance Modal ─────────────────────────────────────────────────

/**
 * L2 modal for updating a maintenance log's details.
 * Pre-fills fields from the existing log and PUTs on submit.
 */
function UpdateMaintenanceModal({ log, vehicleLogId, onRefresh }) {
  const { popModal } = useModal();
  const { apiFetch } = useAuth();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      mntType: log.mntType,
      invoiceId: log.invoiceId,
      amount: String(log.amount),
    },
  });

  /** Submits the updated maintenance log details. */
  async function onSubmit(data) {
    const res = await apiFetch(`/api/vehicle-maintenance-logs/${log.mntLogId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vehicleLogId: Number(vehicleLogId),
        amount: Number(data.amount),
        invoiceId: data.invoiceId,
        mntType: data.mntType,
      }),
    });
    if (!res.ok) {
      const apiErrors = await parseApiError(res);
      Object.entries(apiErrors).forEach(([field, message]) => {
        if (field === "_general") setError("root.serverError", { message });
        else setError(field, { message });
      });
      notyfError("Update failed.");
      return;
    }
    popModal();
    setTimeout(() => notyfSuccess(`Maintenance #${log.mntLogId} updated.`), 150);
    onRefresh?.();
  }

  return (
    <div className="modal-content w-full max-w-sm my-auto">
      <div className="modal-header">
        <h3 className="modal-title">Update Maintenance #{log.mntLogId}</h3>
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
              <label className="label-text font-medium">
                Maintenance Type <span className="text-error">*</span>
              </label>
              <input
                type="text"
                className={`input input-bordered w-full${errors.mntType ? " is-invalid" : ""}`}
                placeholder="e.g. Oil Change, Tire Rotation"
                maxLength={30}
                {...register("mntType", { required: "Maintenance type is required." })}
              />
              {errors.mntType && (
                <span className="helper-text">{errors.mntType.message}</span>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">
                Invoice ID <span className="text-error">*</span>
              </label>
              <input
                type="text"
                className={`input input-bordered w-full${errors.invoiceId ? " is-invalid" : ""}`}
                placeholder="e.g. INV-001"
                maxLength={16}
                {...register("invoiceId", { required: "Invoice ID is required." })}
              />
              {errors.invoiceId && (
                <span className="helper-text">{errors.invoiceId.message}</span>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">
                Amount <span className="text-error">*</span>
              </label>
              <input
                type="number"
                className={`input input-bordered w-full${errors.amount ? " is-invalid" : ""}`}
                placeholder="e.g. 1500.00"
                min="0"
                step="0.01"
                {...register("amount", {
                  required: "Amount is required.",
                  min: { value: 0, message: "Amount must be non-negative." },
                })}
              />
              {errors.amount && (
                <span className="helper-text">{errors.amount.message}</span>
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

// ─── Main Page ────────────────────────────────────────────────────────────────

/**
 * Page listing all maintenance logs for a specific vehicle log.
 * Accessible at /vehicle-logs/:vehicleLogId/maintenance.
 */
export default function VehicleMaintenanceLogs() {
  const { vehicleLogId } = useParams();
  const { apiFetch, hasRole } = useAuth();
  const { pushModal } = useModal();
  const navigate = useNavigate();

  const canRecord = hasRole("ADMIN", "STAFF", "CREW");

  const [vehicleLog, setVehicleLog] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  /** Fetches the parent vehicle log to display in the page header. */
  useEffect(() => {
    apiFetch(`/api/vehicle-logs/${vehicleLogId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setVehicleLog(data))
      .catch(() => {});
  }, [apiFetch, vehicleLogId]);

  /** Fetches paginated maintenance logs for this vehicle log. */
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      vehicleLogId: String(vehicleLogId),
      page: String(page),
      size: String(PAGE_SIZE),
      sort: "mntLogId,desc",
    });
    apiFetch(`/api/vehicle-maintenance-logs?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load maintenance logs (${res.status})`);
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        setLogs(data.content ?? []);
        setTotalPages(data.totalPages ?? 0);
        setTotalElements(data.totalElements ?? 0);
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
  }, [apiFetch, vehicleLogId, page, refreshKey]);

  function refresh() {
    setPage(0);
    setRefreshKey((k) => k + 1);
  }

  const vehicleLabel = vehicleLog
    ? `${vehicleLog.vehicleModel} · ${vehicleLog.vehiclePlateNum}`
    : `Log #${vehicleLogId}`;

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
            <h1 className="text-3xl font-semibold">Maintenance Logs</h1>
            <p className="text-base-content/60 mt-1">
              Vehicle Log #{vehicleLogId} — {vehicleLabel}
            </p>
          </div>
        </div>
        {canRecord && (
          <div className="flex gap-2 items-center h-full">
            <button
              type="button"
              className="btn btn-primary h-full min-h-0"
              onClick={() =>
                pushModal(
                  <AddMaintenanceStep1Modal vehicleLogId={vehicleLogId} onSuccess={refresh} />,
                )
              }
            >
              <span className="icon-[tabler--tool] size-4"></span>
              Record New Maintenance
            </button>
          </div>
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
        <div className="alert alert-error mb-4">
          <span className="icon-[tabler--alert-circle] size-5"></span>
          <span>{error}</span>
        </div>
      )}

      {/* Table */}
      {!loading && !error && (
        <>
          <p className="text-sm text-base-content/50 mb-3">
            {totalElements} maintenance log{totalElements !== 1 ? "s" : ""} total
          </p>

          {logs.length === 0 ? (
            <div className="text-center py-20 text-base-content/40">
              <span className="icon-[tabler--tool-off] size-12 mx-auto mb-3 block"></span>
              <p>No maintenance logs recorded for this vehicle log.</p>
              {canRecord && (
                <button
                  type="button"
                  className="btn btn-primary mt-6"
                  onClick={() =>
                    pushModal(
                      <AddMaintenanceStep1Modal
                        vehicleLogId={vehicleLogId}
                        onSuccess={refresh}
                      />,
                    )
                  }
                >
                  <span className="icon-[tabler--tool] size-4"></span>
                  Record New Maintenance
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
              <table className="table table-zebra w-full">
                <thead>
                  <tr>
                    <th>Mnt Log #</th>
                    <th>Type</th>
                    <th>Invoice ID</th>
                    <th>Amount</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.mntLogId}>
                      <td className="font-mono font-semibold">{log.mntLogId}</td>
                      <td className="font-medium">{log.mntType}</td>
                      <td className="font-mono text-sm">{log.invoiceId}</td>
                      <td className="text-sm">{formatCurrency(log.amount)}</td>
                      <td>
                        <button
                          className="btn btn-soft btn-primary btn-sm"
                          onClick={() =>
                            pushModal(
                              <ManageMaintenanceModal
                                log={log}
                                vehicleLogId={vehicleLogId}
                                onRefresh={refresh}
                              />,
                            )
                          }
                        >
                          <span className="icon-[tabler--settings] size-4"></span>
                          Manage
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                className="btn btn-sm btn-secondary"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                <span className="icon-[tabler--chevron-left] size-4"></span>
                Prev
              </button>
              <span className="text-sm text-base-content/60">
                Page {page + 1} of {totalPages}
              </span>
              <button
                className="btn btn-sm btn-secondary"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
                <span className="icon-[tabler--chevron-right] size-4"></span>
              </button>
            </div>
          )}
        </>
      )}
    </Layout>
  );
}
