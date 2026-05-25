/**
 * Reusable modal shell — backdrop + centered frame + header + scrollable body + footer.
 * Controlled via isOpen / onClose props; no FlyonUI JS dependency.
 *
 * Props:
 *   isOpen  {boolean}        - Whether the modal is visible
 *   onClose {function}       - Called when backdrop or X button is clicked
 *   title   {string}         - Modal header title
 *   size    {string}         - Max width class (default: 'max-w-2xl')
 *   footer  {React.ReactNode}- Action buttons rendered in the modal footer
 *   children{React.ReactNode}- Form fields or body content
 */
export default function Modal({ isOpen, onClose, title, size = 'max-w-2xl', footer, hideClose = false, children }) {
  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-base-300/60 z-40 transition duration-300"
        onClick={onClose}
      />

      {/* Centered container */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
        <div className={`modal-content w-full ${size} my-auto shadow-xl`}>

          {/* Header */}
          <div className="modal-header">
            <h3 className="modal-title">{title}</h3>
            {!hideClose && (
              <button
                type="button"
                className="btn btn-text btn-circle btn-sm absolute end-3 top-3"
                aria-label="Close"
                onClick={onClose}
              >
                <span className="icon-[tabler--x] size-4"></span>
              </button>
            )}
          </div>

          {/* Body */}
          <div className="modal-body overflow-y-auto max-h-[60vh]">
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div className="modal-footer">
              {footer}
            </div>
          )}

        </div>
      </div>
    </>
  )
}
