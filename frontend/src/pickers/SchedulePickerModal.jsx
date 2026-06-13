import { useCallback } from 'react'
import PickerModal from '../components/PickerModal'

const searchFilter = (s, q) =>
  q === '' ||
  String(s.schedId).includes(q) ||
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

/**
 * Picker modal for selecting a Service Schedule filtered to a specific project.
 * Only shows schedules without an existing service report.
 */
export default function SchedulePickerModal({ isOpen, onClose, onSelect, projNum }) {
  const fetchUrl = useCallback(
    page => `/api/service-schedules?${new URLSearchParams({ page: String(page), size: '12', sort: 'date,desc', withoutReport: 'true', projNum: String(projNum) })}`,
    [projNum]
  )

  return (
    <PickerModal
      isOpen={isOpen}
      onClose={onClose}
      onSelect={onSelect}
      title="Select Schedule"
      fetchUrl={fetchUrl}
      searchFilter={searchFilter}
      renderCard={renderCard}
      searchPlaceholder="Search by sched # or purpose..."
    />
  )
}
