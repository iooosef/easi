/**
 * Reusable project manage modal.
 * Shows full project details and a grid of management actions.
 * Controlled via isOpen / onClose props — no FlyonUI JS dependency.
 */

const MENU_ITEMS = [
  { key: 'update',    label: 'Update Details',          icon: 'icon-[tabler--pencil]',    roles: ['ADMIN', 'STAFF'] },
  { key: 'schedule',  label: 'Manage Schedule',         icon: 'icon-[tabler--calendar]',  roles: null },
  { key: 'documents', label: 'Manage Documents',        icon: 'icon-[tabler--files]',     roles: null },
  { key: 'ac',        label: 'Manage Air Conditioners', icon: 'icon-[tabler--snowflake]', roles: null },
]

/** Detail row for the info grid */
function DetailRow({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-base-content/50 uppercase tracking-wide">{label}</span>
      <span className="text-sm font-medium text-base-content">{value ?? '—'}</span>
    </div>
  )
}

/** Formats a LocalDateTime string to a readable date */
function formatDate(dt) {
  if (!dt) return '—'
  return new Date(dt).toISOString().slice(0, 10)
}

/** Props: project, isOpen, onClose, onMenuSelect(key, project), hasRole */
export default function ManageMenu({ project, isOpen, onClose, onMenuSelect, hasRole }) {
  if (!isOpen || !project) return null

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
              <h3 className="modal-title">{project.name}</h3>
              <span className="text-sm text-base-content/50">Project #{project.projNum}</span>
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

            {/* Project details grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
              <DetailRow label="Type"    value={project.type?.charAt(0) + project.type?.slice(1).toLowerCase()} />
              <DetailRow label="Status"  value={project.status?.charAt(0).toUpperCase() + project.status?.slice(1)} />
              <DetailRow label="Started" value={formatDate(project.addedOn)} />

              <div className="col-span-2 sm:col-span-3 flex flex-col gap-0.5">
                <span className="text-xs text-base-content/50 uppercase tracking-wide">Address</span>
                <span className="text-sm font-medium text-base-content">{project.address}</span>
              </div>

              <DetailRow label="Contact Name"   value={project.contactName} />
              <DetailRow label="Contact Number" value={project.contactNumber} />
              <DetailRow label="Contact Email"  value={project.contactEmail} />

              <DetailRow label="Warranty Status" value={project.warrantyStatus === 1 ? 'Active' : 'Expired'} />
              <DetailRow label="Warranty Date"   value={formatDate(project.warrantyDate)} />

              {/* Installation Progress */}
              <div className="col-span-2 sm:col-span-3 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-base-content/50 uppercase tracking-wide">Installation Progress</span>
                  <span className="text-xs font-semibold text-primary">{project.installationProgress}%</span>
                </div>
                <div className="w-full bg-base-300 rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-500"
                    style={{ width: `${project.installationProgress}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="divider my-0"></div>

            {/* Manage menu grid */}
            <div>
              <p className="text-xs text-base-content/50 uppercase tracking-wide mb-3">Manage</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {MENU_ITEMS.filter(({ roles }) => roles === null || hasRole?.(...roles)).map(({ key, label, icon }) => (
                  <button
                    key={key}
                    type="button"
                    className="group w-full"
                    onClick={() => onMenuSelect?.(key, project)}
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
