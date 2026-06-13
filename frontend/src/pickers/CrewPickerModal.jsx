import PickerModal from '../components/PickerModal'

// Stable module-level references required by PickerModal's useEffect
const fetchUrl = page =>
  `/api/crew-employees?${new URLSearchParams({ page: String(page), size: '12', sort: 'lastName,asc' })}`

const fullName = e =>
  [e.lastName, e.firstName, e.middleName].filter(Boolean).join(', ')

const renderCard = (e, onSelect) => (
  <div key={e.employeeId} className="card bg-base-100 border border-base-300">
    <div className="card-body py-3 px-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm line-clamp-1">{fullName(e)}</p>
          <p className="text-xs text-base-content/50">Emp #{e.employeeId} · {e.position ?? '—'}</p>
          <p className="text-xs text-base-content/60 mt-0.5">{e.status}</p>
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

/** Picker modal for selecting a CREW employee. Excludes already-assigned employees. */
export default function CrewPickerModal({ isOpen, onClose, onSelect, excludeIds = new Set() }) {
  const searchFilter = (e, q) =>
    !excludeIds.has(e.employeeId) &&
    (q === '' ||
      String(e.employeeId).includes(q) ||
      fullName(e).toLowerCase().includes(q.toLowerCase()))

  return (
    <PickerModal
      isOpen={isOpen}
      onClose={onClose}
      onSelect={onSelect}
      title="Select Crew"
      fetchUrl={fetchUrl}
      searchFilter={searchFilter}
      renderCard={renderCard}
      searchPlaceholder="Search by name or employee #..."
    />
  )
}
