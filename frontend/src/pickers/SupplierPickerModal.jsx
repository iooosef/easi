import PickerModal from './PickerModal'

const fetchUrl = page =>
  `/api/suppliers?${new URLSearchParams({ page: String(page), size: '12', sort: 'name,asc' })}`

const searchFilter = (s, q) =>
  q === '' ||
  String(s.supplierId).includes(q) ||
  s.name.toLowerCase().includes(q.toLowerCase())

const renderCard = (s, onSelect) => (
  <div key={s.supplierId} className="card bg-base-100 border border-base-300">
    <div className="card-body py-3 px-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm line-clamp-1">{s.name}</p>
          <p className="text-xs text-base-content/50">Supplier #{s.supplierId}</p>
          <p className="text-xs text-base-content/60 mt-0.5 line-clamp-1">{s.address ?? '—'}</p>
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

/** Picker modal for selecting a Supplier. Wraps PickerModal with supplier-specific config. */
export default function SupplierPickerModal({ isOpen, onClose, onSelect, asLayer = false }) {
  return (
    <PickerModal
      asLayer={asLayer}
      isOpen={asLayer ? true : isOpen}
      onClose={onClose}
      onSelect={onSelect}
      title="Select Supplier"
      fetchUrl={fetchUrl}
      searchFilter={searchFilter}
      renderCard={renderCard}
      searchPlaceholder="Search by name or supplier #..."
      emptyText="No suppliers found."
    />
  )
}
