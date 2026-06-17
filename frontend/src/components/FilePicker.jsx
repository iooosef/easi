import { useRef } from 'react'
import { ACCEPTED_EXTENSIONS } from '../utils/documents'

/**
 * Styled file picker: hidden input triggered by a visible button.
 * Calls onChange(file | null) when the user selects a file.
 */
export default function FilePicker({ file, onChange, error, accept = ACCEPTED_EXTENSIONS }) {
  const ref = useRef(null)
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={e => onChange(e.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        className={`btn btn-outline w-full justify-start font-normal${error ? ' btn-error' : ''}`}
        onClick={() => ref.current?.click()}
      >
        <span className="icon-[tabler--paperclip] size-4"></span>
        {file ? file.name : 'Choose file…'}
      </button>
      {error && <span className="helper-text">{error}</span>}
      {file && <span className="text-xs text-base-content/50">{(file.size / 1024).toFixed(1)} KB</span>}
    </>
  )
}
