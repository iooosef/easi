import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth'
import { useModal } from '../modals/index.js'
import Layout from '../components/Layout'
import { NewVehicleModal, UpdateVehicleModal } from './vehicles/VehicleModals'
import { VehiclePickerModal } from './vehicles/AddVehicleLogFlow'

/** Formats a LocalDateTime string to a readable date */
function formatDate(dt) {
  if (!dt) return '—'
  return new Date(dt).toISOString().slice(0, 10)
}

const PAGE_SIZE = 12

export default function Vehicles() {
  const { apiFetch, hasRole } = useAuth()
  const { pushModal } = useModal()
  const navigate = useNavigate()
  const location = useLocation()

  const [vehicles, setVehicles]           = useState([])
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState(null)
  const [search, setSearch]               = useState('')
  const [page, setPage]                   = useState(0)
  const [totalPages, setTotalPages]       = useState(0)
  const [totalElements, setTotalElements] = useState(0)

  const canEdit   = hasRole('ADMIN', 'STAFF')
  const canAddLog = hasRole('ADMIN', 'STAFF', 'CREW')

  /** Auto-open Add Vehicle Log flow when navigated from Home with ?addLog=1 */
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('addLog') === '1') {
      navigate(location.pathname, { replace: true })
      pushModal(<VehiclePickerModal onSuccess={fetchVehicles} />)
    }
  }, [])

  async function fetchVehicles() {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        page: String(page),
        size: String(PAGE_SIZE),
        sort: 'addedOn,desc',
      })
      const res = await apiFetch(`/api/vehicles?${params}`)
      if (!res.ok) throw new Error(`Failed to load vehicles (${res.status})`)
      const data = await res.json()
      setVehicles(data.content ?? [])
      setTotalPages(data.totalPages ?? 0)
      setTotalElements(data.totalElements ?? 0)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchVehicles() }, [apiFetch, page])

  const filtered = vehicles.filter(v =>
    search === '' ||
    v.vehicleModel.toLowerCase().includes(search.toLowerCase()) ||
    v.vehiclePlateNum.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Layout activePage="vehicles">
      {/* Header row */}
      <div className="flex items-stretch justify-between h-16 mb-6">
        <div>
          <h1 className="text-3xl font-semibold">Vehicles</h1>
          <p className="text-base-content/60 mt-1">Manage company vehicles and trip records</p>
        </div>
        <div className="flex gap-2 items-center h-full">
          {canAddLog && (
            <button
              type="button"
              className="btn btn-secondary h-full min-h-0"
              onClick={() => pushModal(<VehiclePickerModal onSuccess={fetchVehicles} />)}
            >
              <span className="icon-[tabler--truck] size-4"></span>
              Add Vehicle Log
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              className="btn btn-primary h-full min-h-0"
              onClick={() => pushModal(<NewVehicleModal onSuccess={() => { setPage(0); fetchVehicles() }} />)}
            >
              <span className="icon-[tabler--plus] size-4"></span>
              New Vehicle
            </button>
          )}
        </div>
      </div>

      {/* Search row */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <span className="icon-[tabler--search] size-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none"></span>
          <input
            type="text"
            className="input input-bordered w-full pl-9"
            placeholder="Search by model or plate number..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
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

      {/* Vehicle grid */}
      {!loading && !error && (
        <>
          <p className="text-sm text-base-content/50 mb-3">
            {totalElements} vehicle{totalElements !== 1 ? 's' : ''} total
            {search && ` · ${filtered.length} shown`}
          </p>

          {filtered.length === 0 ? (
            <div className="text-center py-20 text-base-content/40">
              <span className="icon-[tabler--truck-off] size-12 mx-auto mb-3 block"></span>
              <p>No vehicles found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(vehicle => (
                <div key={vehicle.vehiclesId} className="group">
                  <div className="card bg-base-100 border border-base-300 transition-transform duration-300 group-hover:-translate-y-2 h-full">
                    <div className="card-body gap-2">
                      <div className="flex items-start justify-between gap-2">
                        <h2 className="card-title text-base">{vehicle.vehicleModel}</h2>
                        <span className="badge badge-soft badge-neutral shrink-0 text-xs font-mono">
                          {vehicle.vehiclePlateNum}
                        </span>
                      </div>
                      <p className="text-sm text-base-content/50">Added {formatDate(vehicle.addedOn)}</p>
                      <p className="text-sm text-base-content/60">
                        <span className="icon-[tabler--road] size-3.5 inline-block mr-1 align-middle"></span>
                        {vehicle.latestOdometer != null
                          ? <>{vehicle.latestOdometer.toLocaleString()} km</>
                          : <span className="italic text-base-content/40">No odometer recorded</span>
                        }
                      </p>
                      <div className="card-actions mt-2 flex-col gap-2">
                        <button
                          className="btn btn-soft btn-primary btn-sm w-full"
                          onClick={() => navigate(`/vehicles/${vehicle.vehiclesId}/logs`, { state: { vehicleModel: vehicle.vehicleModel } })}
                        >
                          <span className="icon-[tabler--road] size-4"></span>
                          Manage Vehicle Logs
                        </button>
                        {canEdit && (
                          <button
                            className="btn btn-soft btn-secondary btn-sm w-full"
                            onClick={() => pushModal(<UpdateVehicleModal vehicle={vehicle} onSuccess={fetchVehicles} />)}
                          >
                            <span className="icon-[tabler--pencil] size-4"></span>
                            Update Vehicle Info
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
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
