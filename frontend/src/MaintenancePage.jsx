import { useState, useEffect, useCallback } from 'react'
import { useAuth } from './auth'
import Layout from './Layout'
import Modal from './modals/Modal'
import { notyfSuccess, notyfError } from './notyf'

/** Parses a failed API response into field-level or general errors. */
async function parseApiError(res) {
  const data = await res.json().catch(() => ({}))
  if (data.errors) return data.errors
  return { _general: data.message ?? data.error ?? `Error ${res.status}` }
}

/** Formats bytes to a human-readable size string. */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i]
}

/** Formats a LocalDateTime array or ISO string to yyyy-MM-dd HH:mm:ss. */
function formatDateTime(dt) {
  if (!dt) return '—'
  const d = new Date(Array.isArray(dt) ? new Date(...dt) : dt)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

const LOG_PAGE_SIZE = 20

export default function MaintenancePage() {
  const { apiFetch } = useAuth()

  // ── Backup state ──────────────────────────────────────────────
  const [backups, setBackups]               = useState([])
  const [backupsLoading, setBackupsLoading] = useState(true)
  const [creatingBackup, setCreatingBackup] = useState(false)

  // Restore state
  const [restoreFile, setRestoreFile]         = useState(null)
  const [restoreFormError, setRestoreFormError] = useState({})
  const [confirmRestoreOpen, setConfirmRestoreOpen] = useState(false)
  const [restoring, setRestoring]             = useState(false)

  // Delete backup confirmation
  const [deleteTarget, setDeleteTarget]     = useState(null)
  const [deleting, setDeleting]             = useState(false)

  // ── Logs state ────────────────────────────────────────────────
  const [logs, setLogs]                   = useState([])
  const [logsLoading, setLogsLoading]     = useState(true)
  const [logsError, setLogsError]         = useState(null)
  const [logPage, setLogPage]             = useState(0)
  const [logTotalPages, setLogTotalPages] = useState(0)
  const [logSort, setLogSort]             = useState('createdAt')
  const [logDir, setLogDir]               = useState('desc')
  const [selectedLog, setSelectedLog]     = useState(null)

  // ── Backup functions ──────────────────────────────────────────

  const fetchBackups = useCallback(async () => {
    setBackupsLoading(true)
    try {
      const res = await apiFetch('/api/maintenance/backups')
      if (!res.ok) throw new Error(`Failed to load backups (${res.status})`)
      setBackups(await res.json())
    } catch {
      /* silently leave list empty */
    } finally {
      setBackupsLoading(false)
    }
  }, [apiFetch])

  useEffect(() => { fetchBackups() }, [fetchBackups])

  async function handleCreateBackup() {
    setCreatingBackup(true)
    try {
      const res = await apiFetch('/api/maintenance/backup', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        notyfError(data.error ?? data.message ?? 'Backup failed')
        return
      }
      const data = await res.json()
      notyfSuccess(`Backup created: ${data.filename}`)
      await fetchBackups()
    } catch {
      notyfError('Backup failed — server error')
    } finally {
      setCreatingBackup(false)
    }
  }

  async function handleDeleteBackup() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await apiFetch(`/api/maintenance/backups/${encodeURIComponent(deleteTarget)}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        notyfError(data.error ?? data.message ?? 'Delete failed')
        return
      }
      notyfSuccess(`Backup "${deleteTarget}" deleted`)
      setDeleteTarget(null)
      await fetchBackups()
    } catch {
      notyfError('Delete failed — server error')
    } finally {
      setDeleting(false)
    }
  }

  async function handleDownloadBackup(filename) {
    try {
      const res = await apiFetch(`/api/maintenance/backups/${encodeURIComponent(filename)}`)
      if (!res.ok) {
        notyfError('Download failed — file not available')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      notyfError('Download failed — server error')
    }
  }

  function handleRestoreFileChange(e) {
    setRestoreFile(e.target.files[0] ?? null)
    setRestoreFormError({})
  }

  function openRestoreConfirm(e) {
    e.preventDefault()
    setRestoreFormError({})
    if (!restoreFile) {
      setRestoreFormError({ file: 'Please select a backup file.' })
      return
    }
    setConfirmRestoreOpen(true)
  }

  async function handleRestore() {
    if (!restoreFile) return
    setRestoring(true)
    try {
      const formData = new FormData()
      formData.append('file', restoreFile)
      const res = await apiFetch('/api/maintenance/restore', { method: 'POST', body: formData })
      if (!res.ok) {
        setConfirmRestoreOpen(false)
        setRestoreFormError(await parseApiError(res))
        notyfError('Restore failed')
        return
      }
      setConfirmRestoreOpen(false)
      setRestoreFile(null)
      notyfSuccess('Database restored successfully')
    } catch {
      setConfirmRestoreOpen(false)
      notyfError('Restore failed — server error')
    } finally {
      setRestoring(false)
    }
  }

  // ── Log functions ─────────────────────────────────────────────

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true)
    setLogsError(null)
    try {
      const params = new URLSearchParams({
        page: String(logPage),
        size: String(LOG_PAGE_SIZE),
        sort: logSort,
        direction: logDir,
      })
      const res = await apiFetch(`/api/logs?${params}`)
      if (!res.ok) throw new Error(`Failed to load logs (${res.status})`)
      const data = await res.json()
      setLogs(data.content ?? [])
      setLogTotalPages(data.totalPages ?? 0)
    } catch (err) {
      setLogsError(err.message)
    } finally {
      setLogsLoading(false)
    }
  }, [apiFetch, logPage, logSort, logDir])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  function handleSortClick(field) {
    if (logSort === field) {
      setLogDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setLogSort(field)
      setLogDir('desc')
    }
    setLogPage(0)
  }

  function SortIcon({ field }) {
    if (logSort !== field) return <span className="icon-[tabler--arrows-sort] size-3.5 opacity-30 ms-1"></span>
    return logDir === 'asc'
      ? <span className="icon-[tabler--sort-ascending] size-3.5 ms-1"></span>
      : <span className="icon-[tabler--sort-descending] size-3.5 ms-1"></span>
  }

  function severityBadge(sev) {
    const map = { INFO: 'badge-info', WARN: 'badge-warning', ERROR: 'badge-error' }
    return <span className={`badge badge-soft ${map[sev] ?? 'badge-neutral'} badge-sm`}>{sev}</span>
  }

  function typeBadge(type) {
    const map = { AUDIT: 'badge-primary', SECURITY: 'badge-warning', SYSTEM: 'badge-neutral' }
    return <span className={`badge badge-soft ${map[type] ?? 'badge-neutral'} badge-sm`}>{type}</span>
  }

  // ── Render ────────────────────────────────────────────────────

  return (
    <Layout activePage="maintenance">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-3xl font-semibold">Maintenance</h1>
        <p className="text-base-content/60 mt-1">Database backups, restores, and system audit logs</p>
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

        {/* ── LEFT COLUMN: Backup & Restore (1/3) ── */}
        <div className="flex flex-col gap-6">

          {/* Create Backup card */}
          <div className="card bg-base-100 border border-base-300">
            <div className="card-body gap-4">
              <h2 className="card-title text-base">
                <span className="icon-[tabler--database-export] size-5 text-primary"></span>
                Create Backup
              </h2>
              <p className="text-sm text-base-content/60">
                Generates a full pg_dump of the current database and saves it to the server.
              </p>
              <button
                className="btn btn-primary w-full"
                onClick={handleCreateBackup}
                disabled={creatingBackup}
              >
                {creatingBackup
                  ? <span className="loading loading-spinner loading-sm"></span>
                  : <span className="icon-[tabler--database-export] size-4"></span>
                }
                {creatingBackup ? 'Creating…' : 'Create Backup'}
              </button>
            </div>
          </div>

          {/* Existing backups card */}
          <div className="card bg-base-100 border border-base-300">
            <div className="card-body gap-3">
              <h2 className="card-title text-base">
                <span className="icon-[tabler--archive] size-5 text-primary"></span>
                Existing Backups
              </h2>

              {backupsLoading && (
                <div className="flex justify-center py-6">
                  <span className="loading loading-spinner loading-md text-primary"></span>
                </div>
              )}

              {!backupsLoading && backups.length === 0 && (
                <p className="text-sm text-base-content/40 text-center py-4">No backups found.</p>
              )}

              {!backupsLoading && backups.length > 0 && (
                <div className="flex flex-col gap-2">
                  {backups.map(b => (
                    <div key={b.filename} className="flex items-center justify-between gap-2 p-2 rounded-lg border border-base-200 bg-base-50 hover:bg-base-200/50 transition-colors">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-mono text-base-content truncate">{b.filename}</p>
                        <p className="text-xs text-base-content/50">{formatBytes(b.sizeBytes)} · {formatDateTime(b.createdAt)}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          className="btn btn-soft btn-accent btn-xs btn-square text-primary"
                          title="Download"
                          onClick={() => handleDownloadBackup(b.filename)}
                        >
                          <span className="icon-[tabler--download] size-4"></span>
                        </button>
                        <button
                          className="btn btn-soft btn-warning btn-xs btn-square text-error"
                          title="Delete"
                          onClick={() => setDeleteTarget(b.filename)}
                        >
                          <span className="icon-[tabler--x] size-4"></span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Restore card */}
          <div className="card bg-base-100 border border-base-300">
            <div className="card-body gap-4">
              <h2 className="card-title text-base">
                <span className="icon-[tabler--database-import] size-5 text-warning"></span>
                Restore from Backup
              </h2>
              <p className="text-sm text-base-content/60">
                Upload a <code>.sql</code> or <code>.dump</code> file to restore the database. This overwrites all current data.
              </p>
              <form onSubmit={openRestoreConfirm} className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="label-text font-medium text-sm">Backup File</label>
                  <input
                    type="file"
                    accept=".sql,.dump"
                    className={`file-input file-input-bordered w-full${restoreFormError.file ? ' is-invalid' : ''}`}
                    onChange={handleRestoreFileChange}
                  />
                  {restoreFormError.file && <span className="helper-text">{restoreFormError.file}</span>}
                </div>

                {restoreFormError._general && (
                  <div className="alert alert-error py-2">
                    <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                    <span className="text-sm">{restoreFormError._general}</span>
                  </div>
                )}

                <button type="submit" className="btn btn-warning w-full">
                  <span className="icon-[tabler--database-import] size-4"></span>
                  Restore
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN: Logs Table (2/3) ── */}
        <div className="lg:col-span-2">
          <div className="card bg-base-100 border border-base-300">
            <div className="card-body gap-4">
              <h2 className="card-title text-base">
                <span className="icon-[tabler--clipboard-list] size-5 text-primary"></span>
                System Logs
              </h2>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="table table-sm w-full">
                  <thead>
                    <tr>
                      <th className="cursor-pointer select-none" onClick={() => handleSortClick('logId')}>
                        <span className="flex items-center">ID <SortIcon field="logId" /></span>
                      </th>
                      <th className="cursor-pointer select-none" onClick={() => handleSortClick('user.email')}>
                        <span className="flex items-center">User <SortIcon field="user.email" /></span>
                      </th>
                      <th className="cursor-pointer select-none" onClick={() => handleSortClick('logType')}>
                        <span className="flex items-center">Type <SortIcon field="logType" /></span>
                      </th>
                      <th className="cursor-pointer select-none" onClick={() => handleSortClick('severity')}>
                        <span className="flex items-center">Severity <SortIcon field="severity" /></span>
                      </th>
                      <th className="cursor-pointer select-none" onClick={() => handleSortClick('createdAt')}>
                        <span className="flex items-center">Created At <SortIcon field="createdAt" /></span>
                      </th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {logsLoading && (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i}>
                          {Array.from({ length: 6 }).map((_, j) => (
                            <td key={j}><div className="skeleton h-4 w-full rounded"></div></td>
                          ))}
                        </tr>
                      ))
                    )}

                    {!logsLoading && logsError && (
                      <tr>
                        <td colSpan={6}>
                          <div className="alert alert-error py-2">
                            <span className="icon-[tabler--alert-circle] size-4"></span>
                            <span className="text-sm">{logsError}</span>
                          </div>
                        </td>
                      </tr>
                    )}

                    {!logsLoading && !logsError && logs.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center text-base-content/40 py-8">No log entries found.</td>
                      </tr>
                    )}

                    {!logsLoading && !logsError && logs.map(log => (
                      <tr key={log.logId} className="hover">
                        <td className="font-mono text-xs">{log.logId}</td>
                        <td className="text-xs max-w-32 truncate">
                          {log.userEmail ?? log.actorIdentifier ?? <span className="text-base-content/40">—</span>}
                        </td>
                        <td>{typeBadge(log.logType)}</td>
                        <td>{severityBadge(log.severity)}</td>
                        <td className="text-xs font-mono whitespace-nowrap">{formatDateTime(log.createdAt)}</td>
                        <td>
                          <button
                            className="btn btn-info btn-xs"
                            onClick={() => setSelectedLog(log)}
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {logTotalPages > 1 && (
                <div className="flex items-center justify-center gap-1 mt-2 flex-wrap">
                  <button
                    className="btn btn-sm btn-secondary"
                    disabled={logPage === 0}
                    onClick={() => setLogPage(p => p - 1)}
                  >
                    <span className="icon-[tabler--chevron-left] size-4"></span>
                    Prev
                  </button>

                  {Array.from({ length: logTotalPages }).map((_, i) => {
                    const near = Math.abs(i - logPage) <= 2 || i === 0 || i === logTotalPages - 1
                    const ellipsisBefore = i === 1 && logPage > 3
                    const ellipsisAfter = i === logTotalPages - 2 && logPage < logTotalPages - 4
                    if (!near) return null
                    if (ellipsisBefore || ellipsisAfter) {
                      return <span key={`e${i}`} className="px-1 text-base-content/40">…</span>
                    }
                    return (
                      <button
                        key={i}
                        className={`btn btn-sm ${logPage === i ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setLogPage(i)}
                      >
                        {i + 1}
                      </button>
                    )
                  })}

                  <button
                    className="btn btn-sm btn-secondary"
                    disabled={logPage >= logTotalPages - 1}
                    onClick={() => setLogPage(p => p + 1)}
                  >
                    Next
                    <span className="icon-[tabler--chevron-right] size-4"></span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Log Detail Modal ── */}
      <Modal
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title={`Log #${selectedLog?.logId}`}
        footer={
          <button className="btn btn-soft btn-secondary" onClick={() => setSelectedLog(null)}>
            Close
          </button>
        }
      >
        {selectedLog && (
          <div className="flex flex-col gap-2 text-sm">
            {[
              ['Log ID',       selectedLog.logId],
              ['User Email',   selectedLog.userEmail ?? '—'],
              ['Actor',        selectedLog.actorIdentifier ?? '—'],
              ['Log Type',     selectedLog.logType],
              ['Severity',     selectedLog.severity],
              ['Action',       selectedLog.action],
              ['Entity Type',  selectedLog.entityType ?? '—'],
              ['Entity ID',    selectedLog.entityId ?? '—'],
              ['Description',  selectedLog.description ?? '—'],
              ['IP Address',   selectedLog.ipAddress ?? '—'],
              ['Created At',   formatDateTime(selectedLog.createdAt)],
            ].map(([label, value]) => (
              <div key={label} className="flex gap-3 py-1.5 border-b border-base-200 last:border-0">
                <span className="w-28 shrink-0 font-medium text-base-content/60">{label}</span>
                <span className="break-all">{value}</span>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* ── Delete Backup Confirmation Modal ── */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Backup"
        footer={
          <>
            <button className="btn btn-soft btn-secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </button>
            <button className="btn btn-error" onClick={handleDeleteBackup} disabled={deleting}>
              {deleting
                ? <span className="loading loading-spinner loading-sm"></span>
                : <span className="icon-[tabler--x] size-4"></span>
              }
              Delete
            </button>
          </>
        }
      >
        <p className="text-sm">
          Are you sure you want to permanently delete <span className="font-mono font-semibold">{deleteTarget}</span>?
          This action cannot be undone.
        </p>
      </Modal>

      {/* ── Restore Confirmation Modal ── */}
      <Modal
        isOpen={confirmRestoreOpen}
        onClose={() => setConfirmRestoreOpen(false)}
        title="Confirm Restore"
        footer={
          <>
            <button className="btn btn-soft btn-secondary" onClick={() => setConfirmRestoreOpen(false)} disabled={restoring}>
              Cancel
            </button>
            <button className="btn btn-warning" onClick={handleRestore} disabled={restoring}>
              {restoring
                ? <span className="loading loading-spinner loading-sm"></span>
                : <span className="icon-[tabler--database-import] size-4"></span>
              }
              Yes, Restore
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="alert alert-warning py-3">
            <span className="icon-[tabler--alert-triangle] size-5 shrink-0"></span>
            <span className="text-sm font-medium">
              This will overwrite all current data with the contents of the uploaded backup. This action cannot be undone.
            </span>
          </div>
          <p className="text-sm text-base-content/70">
            File: <span className="font-mono font-semibold">{restoreFile?.name}</span>
          </p>
        </div>
      </Modal>
    </Layout>
  )
}
