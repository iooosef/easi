import { useState, useEffect } from 'react'
import { useAuth } from './auth'
import Layout from './Layout'

const PRINT_STYLES = `
  @media print {
    nav, aside, .no-print { display: none !important; }
    main { margin: 0 !important; padding: 1rem !important; }
    body { background: white !important; }
    #print-area table { border-collapse: collapse; width: 100%; }
    #print-area th, #print-area td { border: 1px solid #ccc; padding: 4px 8px; font-size: 11px; }
    #print-area th { background: #f0f0f0; }
  }
`

/** Formats a date/datetime string to YYYY-MM-DD */
function formatDate(dt) {
  if (!dt) return '—'
  return String(dt).slice(0, 10)
}

/** Formats a datetime string to a readable local format */
function formatDateTime(dt) {
  if (!dt) return '—'
  return new Date(dt).toLocaleString('en-PH')
}

/** Formats a number as PHP currency */
function formatCurrency(val) {
  if (val == null) return '—'
  return Number(val).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })
}

/** Returns badge class for service report payment status */
function statusBadgeClass(status) {
  if (status === 'paid') return 'badge-success'
  if (status === 'partial') return 'badge-warning'
  return 'badge-neutral'
}

export default function Reports() {
  const { apiFetch } = useAuth()

  // Filters
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [projNum, setProjNum] = useState('')
  const [status, setStatus] = useState('')

  // Results
  const [rows, setRows] = useState(null)       // null = not yet generated
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [generatedAt, setGeneratedAt] = useState(null)
  const [appliedFilters, setAppliedFilters] = useState(null)

  // Inject print-specific CSS; removed on unmount
  useEffect(() => {
    const style = document.createElement('style')
    style.id = 'reports-print-style'
    style.textContent = PRINT_STYLES
    document.head.appendChild(style)
    return () => document.getElementById('reports-print-style')?.remove()
  }, [])

  async function handleGenerate(e) {
    e.preventDefault()
    setRows(null)
    setError(null)
    setLoading(true)

    const params = new URLSearchParams({ startDate, endDate })
    if (projNum) params.set('projNum', projNum)
    if (status) params.set('status', status)

    try {
      const res = await apiFetch(`/api/reports/service-report-summary?${params}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.message ?? data.error ?? `Error ${res.status}`)
        return
      }
      const data = await res.json()
      setRows(data)
      setGeneratedAt(new Date())
      setAppliedFilters({ startDate, endDate, projNum, status })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const grandTotal = rows?.reduce((sum, r) => sum + Number(r.totalBilled ?? 0), 0) ?? 0

  return (
    <Layout activePage="reports">
      <style>{PRINT_STYLES}</style>

      {/* Page header */}
      <div className="no-print mb-6">
        <h1 className="text-3xl font-semibold">Reports</h1>
        <p className="text-base-content/60 mt-1">Generate and print filtered reports</p>
      </div>

      {/* Filter form */}
      <form className="no-print card bg-base-100 border border-base-300 p-6 mb-6" onSubmit={handleGenerate}>
        <p className="text-sm font-semibold text-base-content/70 mb-4 uppercase tracking-wide">
          Service Report Summary
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">

          <div className="flex flex-col gap-1">
            <label className="label-text font-medium">Start Date <span className="text-error">*</span></label>
            <input
              type="date"
              required
              className="input input-bordered w-full"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="label-text font-medium">End Date <span className="text-error">*</span></label>
            <input
              type="date"
              required
              className="input input-bordered w-full"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="label-text font-medium">Project # <span className="text-base-content/40 font-normal">(optional)</span></label>
            <input
              type="number"
              min={1}
              className="input input-bordered w-full"
              placeholder="All projects"
              value={projNum}
              onChange={e => setProjNum(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="label-text font-medium">Status <span className="text-base-content/40 font-normal">(optional)</span></label>
            <select
              className="select select-bordered w-full"
              value={status}
              onChange={e => setStatus(e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="unpaid">Unpaid</option>
              <option value="partial">Partial</option>
              <option value="paid">Paid</option>
            </select>
          </div>

        </div>

        <div className="flex justify-end">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading
              ? <span className="loading loading-spinner loading-sm"></span>
              : <span className="icon-[tabler--chart-bar] size-4"></span>
            }
            Generate Report
          </button>
        </div>
      </form>

      {/* Error */}
      {error && (
        <div className="no-print alert alert-error mb-6">
          <span className="icon-[tabler--alert-circle] size-5"></span>
          <span>{error}</span>
        </div>
      )}

      {/* Report output — this is what prints */}
      <div id="print-area">
        {rows !== null && (
          <>
            {/* Report header */}
            <div className="mb-6 pb-4 border-b border-base-300">
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                  <h2 className="text-xl font-bold">Service Report Summary</h2>
                  <p className="text-sm text-base-content/60 mt-0.5">
                    {formatDate(appliedFilters?.startDate)} &mdash; {formatDate(appliedFilters?.endDate)}
                    {appliedFilters?.projNum ? ` · Project #${appliedFilters.projNum}` : ''}
                    {appliedFilters?.status ? ` · Status: ${appliedFilters.status}` : ''}
                  </p>
                  <p className="text-xs text-base-content/40 mt-1">
                    Generated: {generatedAt?.toLocaleString('en-PH')}
                  </p>
                </div>

                {/* Print button — hidden in print */}
                {rows.length > 0 && (
                  <button
                    type="button"
                    className="no-print btn btn-soft btn-primary btn-sm"
                    onClick={() => window.print()}
                  >
                    <span className="icon-[tabler--printer] size-4"></span>
                    Print / Save as PDF
                  </button>
                )}
              </div>
            </div>

            {/* Empty state */}
            {rows.length === 0 ? (
              <div className="text-center py-20 text-base-content/40">
                <span className="icon-[tabler--file-off] size-12 mx-auto mb-3 block"></span>
                <p>No data found for the selected filters.</p>
              </div>
            ) : (
              <>
                <p className="no-print text-sm text-base-content/50 mb-3">
                  {rows.length} record{rows.length !== 1 ? 's' : ''}
                </p>

                <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
                  <table className="table table-zebra table-sm w-full">
                    <thead>
                      <tr>
                        <th>SR #</th>
                        <th>Project</th>
                        <th>Complaint</th>
                        <th>Work Done</th>
                        <th>Engineer</th>
                        <th>Location</th>
                        <th>Sched. Date</th>
                        <th>Status</th>
                        <th>Added On</th>
                        <th className="text-right">Total Billed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(r => (
                        <tr key={r.srNumber}>
                          <td className="font-mono font-semibold">{r.srNumber}</td>
                          <td className="max-w-32">
                            <span className="line-clamp-2 text-sm" title={r.projectName}>{r.projectName}</span>
                          </td>
                          <td className="max-w-40">
                            <span className="line-clamp-2 text-sm" title={r.complaint}>{r.complaint}</span>
                          </td>
                          <td className="max-w-40">
                            <span className="line-clamp-2 text-sm" title={r.workDone}>{r.workDone}</span>
                          </td>
                          <td className="text-sm whitespace-nowrap">{r.engineerName ?? '—'}</td>
                          <td className="text-sm">{r.location}</td>
                          <td className="text-sm whitespace-nowrap">{formatDate(r.scheduleDate)}</td>
                          <td>
                            <span className={`badge badge-soft ${statusBadgeClass(r.status)} text-xs`}>
                              {r.status}
                            </span>
                          </td>
                          <td className="text-sm whitespace-nowrap">{formatDateTime(r.addedOn)}</td>
                          <td className="text-right text-sm font-medium">{formatCurrency(r.totalBilled)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={9} className="text-right text-sm font-semibold">Grand Total</td>
                        <td className="text-right text-sm font-bold text-primary">
                          {formatCurrency(grandTotal)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}
