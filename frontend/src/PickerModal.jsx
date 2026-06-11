import { useState, useEffect } from 'react'
import { useAuth } from './auth'

/**
 * Base reusable picker modal: search bar, paginated item grid, and selection callback.
 * Overlays any existing modal using z-[60]/z-[70].
 *
 * Props:
 *   isOpen            - boolean
 *   onClose           - function
 *   onSelect          - function(item) — called when the user confirms a selection
 *   title             - modal header string
 *   fetchUrl          - function(page: number) => string — builds the API URL for a page
 *                       Must be a stable reference (define at module level, not inline)
 *   searchFilter      - function(item, query: string) => boolean — client-side row filter
 *   renderCard        - function(item, onSelect) => JSX — renders one grid card;
 *                       the outermost element MUST have a unique key prop
 *   searchPlaceholder - optional input placeholder (default: 'Search...')
 *   emptyText         - optional empty-state message (default: 'No items found.')
 */
/**
 * When asLayer is true the component renders as a bare modal-content box
 * so the ModalProvider backdrop and z-index handling take over.
 * Pass isOpen={true} when using asLayer — the component is always visible
 * while it is mounted in the modal stack.
 */
export default function PickerModal({
  isOpen, onClose, onSelect,
  title, fetchUrl, searchFilter, renderCard,
  searchPlaceholder = 'Search...', emptyText = 'No items found.',
  asLayer = false,
}) {
  const { apiFetch } = useAuth()
  const [inputValue, setInputValue] = useState('')  // live text input
  const [search, setSearch]         = useState('')  // committed filter (applied on Search click / Enter)
  const [items, setItems]           = useState([])
  const [loading, setLoading]       = useState(false)
  const [page, setPage]             = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  // Reset state each time the modal opens
  useEffect(() => {
    if (isOpen) { setPage(0); setInputValue(''); setSearch('') }
  }, [isOpen])

  /** Commits the current input value as the active filter and resets to page 0. */
  function commitSearch() {
    setPage(0)
    setSearch(inputValue)
  }

  // Fetch items whenever the modal is open or the page changes
  useEffect(() => {
    if (!isOpen) return
    let active = true
    setLoading(true)
    apiFetch(fetchUrl(page))
      .then(res => res.json())
      .then(data => {
        if (!active) return
        setItems(data.content ?? [])
        setTotalPages(data.totalPages ?? 0)
      })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [isOpen, page, apiFetch, fetchUrl])

  const filtered = items.filter(item => searchFilter(item, search))

  if (!asLayer && !isOpen) return null

  const box = (
    <div className="modal-content w-full max-w-xl my-auto">

          <div className="modal-header">
            <h3 className="modal-title">{title}</h3>
            <button
              type="button"
              className="btn btn-text btn-circle btn-sm absolute end-3 top-3"
              aria-label="Close"
              onClick={onClose}
            >
              <span className="icon-[tabler--x] size-4"></span>
            </button>
          </div>

          <div className="modal-body flex flex-col gap-4">
            {/* Search */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="icon-[tabler--search] size-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none"></span>
                <input
                  type="text"
                  className="input input-bordered w-full pl-9"
                  placeholder={searchPlaceholder}
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') commitSearch() }}
                />
              </div>
              <button
                type="button"
                className="btn btn-soft btn-secondary shrink-0"
                onClick={commitSearch}
              >
                <span className="icon-[tabler--search] size-4"></span>
                Search
              </button>
            </div>

            {/* Item grid */}
            {loading ? (
              <div className="flex justify-center py-8">
                <span className="loading loading-spinner loading-md text-primary"></span>
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-center py-8 text-base-content/40">{emptyText}</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
                {filtered.map(item => renderCard(item, onSelect))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  disabled={page === 0}
                  onClick={() => setPage(p => p - 1)}
                >
                  <span className="icon-[tabler--chevron-left] size-4"></span> Prev
                </button>
                <span className="text-sm text-base-content/60">Page {page + 1} of {totalPages}</span>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next <span className="icon-[tabler--chevron-right] size-4"></span>
                </button>
              </div>
            )}
          </div>
        </div>
  )

  if (asLayer) return box

  return (
    <>
      {/* Backdrop — above edit modal (z-50) */}
      <div className="fixed inset-0 bg-base-300/70 z-[60]" onClick={onClose} />
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        {box}
      </div>
    </>
  )
}
