/**
 * Grid of icon-card buttons for navigating actions inside a modal.
 * Items with a `roles` array are hidden when the user lacks all listed roles.
 */
export default function ModalNav({ title, items, hasRole, onSelect }) {
  const visible = items.filter(item => !item.roles || hasRole(...item.roles))
  if (visible.length === 0) return null
  return (
    <div>
      {title && (
        <p className="text-xs text-base-content/50 uppercase tracking-widest mb-3">{title}</p>
      )}
      <div className="grid grid-cols-5 gap-3">
        {visible.map(item => (
          <button
            key={item.key}
            type="button"
            className="flex flex-col items-center justify-center gap-2 aspect-square w-full rounded-box border border-base-300 bg-base-100 hover:bg-base-200 transition-colors text-center px-2"
            onClick={() => onSelect(item.key)}
          >
            <span className={`${item.icon} size-7 text-primary shrink-0`}></span>
            <span className="text-xs font-medium leading-tight">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
