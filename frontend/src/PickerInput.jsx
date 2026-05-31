import { useState } from 'react'

/**
 * Readonly input paired with a picker modal.
 * Manages picker open/close state internally — no extra state needed at the call site.
 *
 * Props:
 *   label        - field label text
 *   displayValue - value shown in the readonly input; falls back to placeholder when falsy
 *   placeholder  - shown when displayValue is empty (default: 'None selected')
 *   buttonLabel  - text on the trigger button
 *   onSelect     - function(item) called when the user picks an item
 *   Picker       - picker modal component (e.g. ProjectPickerModal)
 *   pickerProps  - extra props forwarded to the Picker component (e.g. { position: 'Engineer' })
 *   error        - validation error string
 *   required     - shows a red asterisk on the label when true
 *   className    - extra class on the wrapper div (e.g. 'sm:col-span-2')
 */
export default function PickerInput({
  label, displayValue, placeholder = 'None selected',
  buttonLabel, onSelect, Picker, pickerProps,
  error, required, className = '',
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label className="label-text font-medium">
        {label}{required && <span className="text-error"> *</span>}
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          className={`input input-bordered flex-1 bg-base-200 cursor-not-allowed${error ? ' is-invalid' : ''}`}
          value={displayValue || placeholder}
          readOnly
        />
        <button
          type="button"
          className="btn btn-soft btn-secondary shrink-0"
          onClick={() => setOpen(true)}
        >
          {buttonLabel}
        </button>
      </div>
      {error && <span className="helper-text">{error}</span>}
      {Picker && (
        <Picker
          isOpen={open}
          onClose={() => setOpen(false)}
          onSelect={item => { onSelect(item); setOpen(false) }}
          {...(pickerProps ?? {})}
        />
      )}
    </div>
  )
}
