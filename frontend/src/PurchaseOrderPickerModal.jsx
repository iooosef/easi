import PickerModal from './PickerModal'

const fetchUrl = page =>
  `/api/purchase-orders?${new URLSearchParams({ page: String(page), size: '12', sort: 'poNum,asc' })}`

const searchFilter = (o, q) =>
  q === '' ||
  (o.poNum ?? '').toLowerCase().includes(q.toLowerCase()) ||
  (o.purpose ?? '').toLowerCase().includes(q.toLowerCase())

const renderCard = (o, onSelect) => (
  <div key={o.poNum} className="card bg-base-100 border border-base-300">
    <div className="card-body py-3 px-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm font-mono line-clamp-1">{o.poNum}</p>
          <p className="text-xs text-base-content/50">SR #{o.srNum ?? '—'}</p>
          <p className="text-xs text-base-content/60 mt-0.5 line-clamp-1">{o.purpose ?? '—'}</p>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm shrink-0"
          onClick={() => onSelect(o)}
        >
          Select
        </button>
      </div>
    </div>
  </div>
)

/** Picker modal for selecting a Purchase Order. Wraps PickerModal with PO-specific config. */
export default function PurchaseOrderPickerModal({ isOpen, onClose, onSelect, asLayer = false }) {
  return (
    <PickerModal
      asLayer={asLayer}
      isOpen={asLayer ? true : isOpen}
      onClose={onClose}
      onSelect={onSelect}
      title="Select Purchase Order"
      fetchUrl={fetchUrl}
      searchFilter={searchFilter}
      renderCard={renderCard}
      searchPlaceholder="Search by PO number or purpose..."
      emptyText="No purchase orders found."
    />
  )
}
