import PickerModal from './PickerModal'

// Stable module-level references required by PickerModal's useEffect
const fetchUrl = page =>
  `/api/service-schedules?${new URLSearchParams({ page: String(page), size: '12', sort: 'date,desc' })}`

const searchFilter = (s, q) =>
  q === '' ||
  String(s.schedId).includes(q) ||
  String(s.projNum).includes(q) ||
  (s.purpose ?? '').toLowerCase().includes(q.toLowerCase())

const renderCard = (s, onSelect) => (
  <div key={s.schedId} className="card bg-base-100 border border-base-300">
    <div className="card-body py-3 px-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm line-clamp-1">{s.purpose ?? '(No purpose)'}</p>
          <p className="text-xs text-base-content/50">Sched #{s.schedId} · Project #{s.projNum}</p>
          <p className="text-xs text-base-content/60 mt-0.5">{s.date ?? '—'} · {s.status}</p>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm shrink-0"
          onClick={() => onSelect(s)}
        >
          Select
        </button>
      </div>
    </div>
  </div>
)

/** Picker modal for selecting any Service Schedule (no report filter). */
export default function AnySchedulePickerModal({ isOpen, onClose, onSelect }) {
  return (
    <PickerModal
      isOpen={isOpen}
      onClose={onClose}
      onSelect={onSelect}
      title="Select Schedule"
      fetchUrl={fetchUrl}
      searchFilter={searchFilter}
      renderCard={renderCard}
      searchPlaceholder="Search by sched #, project #, or purpose..."
    />
  )
}
