import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth'
import { useModal } from '../modals/index.js'
import Layout from '../components/Layout'
import { VehiclePickerModal } from './vehicles/AddVehicleLogFlow'
import { ManageLogModal } from './VehicleLogs'

/** Formats a LocalDateTime string to a readable date */
function formatDate(dt) {
  if (!dt) return '—'
  return new Date(dt).toISOString().slice(0, 10)
}

/** Returns badge class for log status */
function statusBadgeClass(status) {
  if (status === 'completed') return 'badge-success'
  if (status === 'driving')   return 'badge-info'
  return 'badge-neutral'
}

const PAGE_SIZE = 10

export default function Vehicles() {
  const { apiFetch, hasRole } = useAuth()
  const { pushModal } = useModal()
  const navigate = useNavigate()
  const location = useLocation()

  const [logs, setLogs]                   = useState([])
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState(null)
  const [search, setSearch]               = useState('')
  const [page, setPage]                   = useState(0)
  const [totalPages, setTotalPages]       = useState(0)
  const [totalElements, setTotalElements] = useState(0)
  const [refreshKey, setRefreshKey]       = useState(0)
  const [vehicles, setVehicles]           = useState([])
  const [vehicleFilter, setVehicleFilter] = useState('')
  const [statusFilter, setStatusFilter]   = useState('')

  const canAddLog = hasRole('ADMIN', 'STAFF', 'CREW')

  /** Auto-open Add Vehicle Log flow when navigated from Home with ?addLog=1 */
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('addLog') === '1') {
      navigate(location.pathname, { replace: true })
      pushModal(<VehiclePickerModal onSuccess={refresh} />)
    }
  }, [])

  /** Fetches vehicle list for the filter dropdown. */
  useEffect(() => {
    apiFetch('/api/vehicles?size=100&sort=addedOn,desc')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setVehicles(data.content ?? []))
      .catch(() => {})
  }, [apiFetch])

  /** Fetches paginated vehicle logs, optionally filtered by vehiclesId. */
  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({
      page: String(page),
      size: String(PAGE_SIZE),
      sort: 'addedOn,desc',
    })
    if (vehicleFilter) params.set('vehiclesId', vehicleFilter)
    apiFetch(`/api/vehicle-logs?${params}`)
      .then(res => {
        if (!res.ok) throw new Error(`Failed to load vehicle logs (${res.status})`)
        return res.json()
      })
      .then(data => {
        if (!active) return
        setLogs(data.content ?? [])
        setTotalPages(data.totalPages ?? 0)
        setTotalElements(data.totalElements ?? 0)
      })
      .catch(err => { if (active) setError(err.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [apiFetch, page, vehicleFilter, refreshKey])

  function refresh() {
    setPage(0)
    setRefreshKey(k => k + 1)
  }

  const filtered = logs.filter(l => {
    if (statusFilter && l.status !== statusFilter) return false
    if (search === '') return true
    const q = search.toLowerCase()
    return (
      String(l.vehicleLogId).includes(q) ||
      l.vehicleModel.toLowerCase().includes(q) ||
      l.vehiclePlateNum.toLowerCase().includes(q) ||
      l.purpose.toLowerCase().includes(q) ||
      (l.schedId != null && String(l.schedId).includes(q)) ||
      l.destination.toLowerCase().includes(q)
    )
  })

  return (
    <Layout activePage="vehicles">
      {/* Header row */}
      <div className="flex items-stretch justify-between h-16 mb-6">
        <div>
          <h1 className="text-3xl font-semibold">Vehicles</h1>
          <p className="text-base-content/60 mt-1">All vehicle trip logs</p>
        </div>
        <div className="flex gap-2 items-center h-full">
          {canAddLog && (
            <button
              type="button"
              className="btn btn-secondary h-full min-h-0"
              onClick={() => pushModal(<VehiclePickerModal onSuccess={refresh} />)}
            >
              <span className="icon-[tabler--truck] size-4"></span>
              Add Vehicle Log
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary h-full min-h-0"
            onClick={() => navigate('/vehicles/manage')}
          >
            <span className="icon-[tabler--truck] size-4"></span>
            Manage Vehicles
          </button>
        </div>
      </div>

      {/* Search + vehicle filter row */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <span className="icon-[tabler--search] size-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none"></span>
          <input
            type="text"
            className="input input-bordered w-full pl-9"
            placeholder="Search by vehicle, plate, log #, purpose, schedule #, or destination..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="select select-bordered w-56 shrink-0"
          value={vehicleFilter}
          onChange={e => { setVehicleFilter(e.target.value); setPage(0) }}
        >
          <option value="">All Vehicles</option>
          {vehicles.map(v => (
            <option key={v.vehiclesId} value={String(v.vehiclesId)}>
              {v.vehicleModel} · {v.vehiclePlateNum}
            </option>
          ))}
        </select>
        <select
          className="select select-bordered w-40 shrink-0"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="driving">Driving</option>
          <option value="completed">Completed</option>
        </select>
      </div>

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
            {totalElements} log{totalElements !== 1 ? 's' : ''} total
            {search && ` · ${filtered.length} shown`}
          </p>

          {filtered.length === 0 ? (
            <div className="text-center py-20 text-base-content/40">
              <span className="icon-[tabler--road-off] size-12 mx-auto mb-3 block"></span>
              <p>No vehicle logs found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
              <table className="table table-zebra w-full">
                <thead>
                  <tr>
                    <th>Log #</th>
                    <th>Vehicle</th>
                    <th>Date</th>
                    <th>Purpose</th>
                    <th>Sched #</th>
                    <th>Destination</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(l => (
                    <tr key={l.vehicleLogId}>
                      <td className="font-mono font-semibold">{l.vehicleLogId}</td>
                      <td>
                        <span className="font-medium">{l.vehicleModel}</span>
                        <span className="text-base-content/40"> · </span>
                        <span className="font-mono text-xs">{l.vehiclePlateNum}</span>
                      </td>
                      <td className="text-sm text-base-content/70">{formatDate(l.addedOn)}</td>
                      <td className="text-sm">{l.purpose}</td>
                      <td className="font-mono text-sm">{l.schedId != null ? l.schedId : '—'}</td>
                      <td className="max-w-[200px] truncate text-sm">{l.destination}</td>
                      <td>
                        <span className={`badge badge-soft ${statusBadgeClass(l.status)} text-xs`}>
                          {l.status.charAt(0).toUpperCase() + l.status.slice(1)}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn-soft btn-primary btn-sm"
                          onClick={() => pushModal(<ManageLogModal log={l} onRefresh={refresh} />)}
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
    </Layout>
  )
}
