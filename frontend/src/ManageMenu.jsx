/**
 * Reusable manage modal for any entity (Projects, Service Reports, etc.).
 * Shows item details and a grid of management action buttons.
 * Controlled via isOpen / onClose props — no FlyonUI JS dependency.
 *
 * detail shape: { label, value, fullWidth?, component? }
 *   - fullWidth: spans all columns in the grid
 *   - component: renders custom JSX instead of a plain value (fullWidth only)
 */

/** Detail row for the info grid */
function DetailRow({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-base-content/50 uppercase tracking-wide">{label}</span>
      <span className="text-sm font-medium text-base-content">{value ?? '—'}</span>
    </div>
  )
}

/** Props: title, subtitle, details, item, isOpen, onClose, onMenuSelect(key, item), hasRole, menuItems */
export default function ManageMenu({ title, subtitle, details = [], item, isOpen, onClose, onMenuSelect, hasRole, menuItems = [] }) {
  if (!isOpen || !item) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-base-300/60 z-40 transition duration-300"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
        <div className="modal-content w-full max-w-2xl my-auto">

          {/* Header */}
          <div className="modal-header">
            <div>
              <h3 className="modal-title">{title}</h3>
              {subtitle && <span className="text-sm text-base-content/50">{subtitle}</span>}
            </div>
            <button
              type="button"
              className="btn btn-text btn-circle btn-sm absolute end-3 top-3"
              aria-label="Close"
              onClick={onClose}
            >
              <span className="icon-[tabler--x] size-4"></span>
            </button>
          </div>

          {/* Body */}
          <div className="modal-body flex flex-col gap-6">

            {/* Details grid */}
            {details.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
                {details.map((detail, i) =>
                  detail.fullWidth ? (
                    <div key={i} className="col-span-2 sm:col-span-3">
                      {detail.component ?? (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs text-base-content/50 uppercase tracking-wide">{detail.label}</span>
                          <span className="text-sm font-medium text-base-content">{detail.value ?? '—'}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <DetailRow key={i} label={detail.label} value={detail.value} />
                  )
                )}
              </div>
            )}

            <div className="divider my-0"></div>

            {/* Manage menu grid */}
            <div>
              <p className="text-xs text-base-content/50 uppercase tracking-wide mb-3">Manage</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {menuItems.filter(({ roles }) => roles === null || hasRole?.(...roles)).map(({ key, label, icon }) => (
                  <button
                    key={key}
                    type="button"
                    className="group w-full"
                    onClick={() => onMenuSelect?.(key, item)}
                  >
                    <div className="card bg-base-100 border border-base-300 transition-transform duration-300 group-hover:-translate-y-2 h-full">
                      <div className="card-body items-center justify-center text-center gap-2 py-5 px-3">
                        <span className={`${icon} size-8 text-primary`}></span>
                        <p className="text-xs font-medium text-base-content leading-tight">{label}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
