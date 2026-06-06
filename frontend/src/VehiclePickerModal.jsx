import PickerModal from './PickerModal'

// Stable module-level references required by PickerModal's useEffect
const fetchUrl = page =>
  `/api/vehicles?${new URLSearchParams({ page: String(page), size: '12', sort: 'vehicleModel,asc' })}`

const renderCard = (v, onSelect) => (
  <div key={v.vehiclesId} className="card bg-base-100 border border-base-300">
    <div className="card-body py-3 px-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm line-clamp-1">{v.vehicleModel}</p>
          <p className="text-xs text-base-content/50">{v.vehiclePlateNum}</p>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm shrink-0"
          onClick={() => onSelect(v)}
        >
          Select
        </button>
      </div>
    </div>
  </div>
)

/** Picker modal for selecting a vehicle. Excludes already-assigned vehicles. */
export default function VehiclePickerModal({ isOpen, onClose, onSelect, excludeIds = new Set() }) {
  const searchFilter = (v, q) =>
    !excludeIds.has(v.vehiclesId) &&
    (q === '' ||
      v.vehicleModel.toLowerCase().includes(q.toLowerCase()) ||
      v.vehiclePlateNum.toLowerCase().includes(q.toLowerCase()))

  return (
    <PickerModal
      isOpen={isOpen}
      onClose={onClose}
      onSelect={onSelect}
      title="Select Vehicle"
      fetchUrl={fetchUrl}
      searchFilter={searchFilter}
      renderCard={renderCard}
      searchPlaceholder="Search by model or plate number..."
    />
  )
}
