import PickerModal from '../components/PickerModal'

// Stable module-level references required by PickerModal's useEffect
const fetchUrl = page =>
  `/api/projects?${new URLSearchParams({ page: String(page), size: '12', sort: 'name,asc' })}`

const searchFilter = (p, q) =>
  q === '' ||
  p.name.toLowerCase().includes(q.toLowerCase()) ||
  String(p.projNum).includes(q)

const renderCard = (p, onSelect) => (
  <div key={p.projNum} className="card bg-base-100 border border-base-300">
    <div className="card-body py-3 px-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm line-clamp-1">{p.name}</p>
          <p className="text-xs text-base-content/50">#{p.projNum} · {p.type}</p>
          <p className="text-xs text-base-content/60 line-clamp-1 mt-0.5">{p.address}</p>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm shrink-0"
          onClick={() => onSelect(p)}
        >
          Select
        </button>
      </div>
    </div>
  </div>
)

/** Picker modal for selecting a Project. Wraps PickerModal with project-specific config. */
export default function ProjectPickerModal({ isOpen, onClose, onSelect }) {
  return (
    <PickerModal
      isOpen={isOpen}
      onClose={onClose}
      onSelect={onSelect}
      title="Select Project"
      fetchUrl={fetchUrl}
      searchFilter={searchFilter}
      renderCard={renderCard}
      searchPlaceholder="Search by name or project #..."
    />
  )
}
