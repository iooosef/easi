import { useState, useEffect, useCallback } from 'react'
import { useAuth } from './auth'

/**
 * Two-step picker modal: first select a Project, then select a Service Report from it.
 * SRs are listed sorted by most recent (scheduleDate desc).
 *
 * Props:
 *   isOpen   - boolean
 *   onClose  - function
 *   onSelect - function(sr) — called with the chosen SR object
 */
export default function ServiceReportPickerModal({ isOpen, onClose, onSelect, backdropZ = 'z-[65]', modalZ = 'z-[70]', asLayer = false }) {
  const { apiFetch } = useAuth()

  const [step, setStep]                     = useState('project') // 'project' | 'sr'
  const [selectedProject, setSelectedProject] = useState(null)

  const [inputValue, setInputValue] = useState('')
  const [search, setSearch]         = useState('')
  const [items, setItems]           = useState([])
  const [loading, setLoading]       = useState(false)
  const [page, setPage]             = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  // Reset to step 1 each time the modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('project')
      setSelectedProject(null)
      setPage(0)
      setInputValue('')
      setSearch('')
      setItems([])
    }
  }, [isOpen])

  const fetchUrl = useCallback((pg) => {
    if (step === 'project') {
      return `/api/projects?${new URLSearchParams({ page: String(pg), size: '12', sort: 'name,asc' })}`
    }
    return `/api/service-reports?${new URLSearchParams({
      projNum: String(selectedProject.projNum),
      page: String(pg),
      size: '12',
      sort: 'srNumber,desc',
    })}`
  }, [step, selectedProject])

  useEffect(() => {
    if (!isOpen) return
    if (step === 'sr' && !selectedProject) return
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
  }, [isOpen, page, fetchUrl, apiFetch, step, selectedProject])

  function commitSearch() {
    setPage(0)
    setSearch(inputValue)
  }

  function pickProject(p) {
    setSelectedProject(p)
    setStep('sr')
    setPage(0)
    setInputValue('')
    setSearch('')
    setItems([])
  }

  function goBack() {
    setStep('project')
    setSelectedProject(null)
    setPage(0)
    setInputValue('')
    setSearch('')
  }

  const filtered = items.filter(item => {
    if (search === '') return true
    const q = search.toLowerCase()
    if (step === 'project') {
      return item.name.toLowerCase().includes(q) || String(item.projNum).includes(q)
    }
    return String(item.srNumber).includes(q) ||
      (item.complaint ?? '').toLowerCase().includes(q) ||
      (item.workDone ?? '').toLowerCase().includes(q)
  })

  if (!asLayer && !isOpen) return null

  const box = (
    <div className="modal-content w-full max-w-xl">

          <div className="modal-header">
            <div className="flex items-center gap-2">
              {step === 'sr' && (
                <button
                  type="button"
                  className="btn btn-text btn-circle btn-sm"
                  aria-label="Back to project selection"
                  onClick={goBack}
                >
                  <span className="icon-[tabler--arrow-left] size-4"></span>
                </button>
              )}
              <div>
                <h3 className="modal-title">
                  {step === 'project' ? 'Step 1 — Select Project' : 'Step 2 — Select Service Report'}
                </h3>
                {step === 'sr' && selectedProject && (
                  <p className="text-xs text-base-content/50 mt-0.5 line-clamp-1">
                    Project: {selectedProject.name} (#{selectedProject.projNum})
                  </p>
                )}
              </div>
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

          <div className="modal-body flex flex-col gap-4">

            {/* Search */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="icon-[tabler--search] size-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none"></span>
                <input
                  type="text"
                  className="input input-bordered w-full pl-9"
                  placeholder={step === 'project' ? 'Search by name or project #...' : 'Search by SR # or complaint...'}
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
              <p className="text-center py-8 text-base-content/40">
                {step === 'project' ? 'No projects found.' : 'No service reports found for this project.'}
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
                {step === 'project'
                  ? filtered.map(p => (
                    <div key={p.projNum} className="card bg-base-100 border border-base-300">
                      <div className="card-body py-3 px-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm line-clamp-1">{p.name}</p>
                            <p className="text-xs text-base-content/50">#{p.projNum} · {p.type}</p>
                            <p className="text-xs text-base-content/60 line-clamp-1 mt-0.5">{p.address}</p>
                          </div>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm shrink-0"
                            onClick={() => pickProject(p)}
                          >
                            Select
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                  : filtered.map(sr => (
                    <div key={sr.srNumber} className="card bg-base-100 border border-base-300">
                      <div className="card-body py-3 px-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm line-clamp-1">{sr.complaint ?? '(No complaint)'}</p>
                            <p className="text-xs text-base-content/50">SR #{sr.srNumber}</p>
                            <p className="text-xs text-base-content/60 mt-0.5">
                              {sr.scheduleDate ? String(sr.scheduleDate).slice(0, 10) : '—'} · {sr.status}
                            </p>
                          </div>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm shrink-0"
                            onClick={() => onSelect(sr)}
                          >
                            Select
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                }
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
      <div className={`fixed inset-0 bg-base-300/70 ${backdropZ}`} onClick={onClose} />
      <div className={`fixed inset-0 ${modalZ} flex items-center justify-center p-4`}>
        {box}
      </div>
    </>
  )
}
