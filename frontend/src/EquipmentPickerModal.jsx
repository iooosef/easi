import PickerModal from './PickerModal'

// Stable module-level references required by PickerModal's useEffect
const fetchUrl = page =>
  `/api/equipment?${new URLSearchParams({ page: String(page), size: '12', status: 'active', sort: 'name,asc' })}`

const renderCard = (e, onSelect) => (
  <div key={e.equipmentId} className="card bg-base-100 border border-base-300">
    <div className="card-body py-3 px-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm line-clamp-1">{e.name}</p>
          <p className="text-xs text-base-content/50">
            #{e.equipmentId} · {e.type} {e.model ? `· ${e.model}` : ''}
          </p>
          {e.serialNumber && (
            <p className="text-xs text-base-content/40">SN: {e.serialNumber}</p>
          )}
          <p className="text-xs text-base-content/60 mt-0.5">
            Stock: {e.stock} · {e.status}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm shrink-0"
          onClick={() => onSelect(e)}
        >
          Select
        </button>
      </div>
    </div>
  </div>
)

/** Picker modal for selecting active equipment to bring to a schedule. Excludes already-added equipment. */
export default function EquipmentPickerModal({ isOpen, onClose, onSelect, excludeIds = new Set() }) {
  const searchFilter = (e, q) =>
    !excludeIds.has(e.equipmentId) &&
    (q === '' ||
      String(e.equipmentId).includes(q) ||
      e.name.toLowerCase().includes(q.toLowerCase()) ||
      (e.model ?? '').toLowerCase().includes(q.toLowerCase()) ||
      (e.serialNumber ?? '').toLowerCase().includes(q.toLowerCase()))

  return (
    <PickerModal
      isOpen={isOpen}
      onClose={onClose}
      onSelect={onSelect}
      title="Select Equipment"
      fetchUrl={fetchUrl}
      searchFilter={searchFilter}
      renderCard={renderCard}
      searchPlaceholder="Search by name, model, or serial #..."
    />
  )
}
