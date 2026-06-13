import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../auth'
import Layout from '../components/Layout'
import ServiceReportPickerModal from '../pickers/ServiceReportPickerModal'

/** Navigation items shown as icon cards on the Reports page. */
const REPORT_NAV_ITEMS = [
  { key: 'individual-sr',       label: 'Individual Service Report',               icon: 'icon-[tabler--file-description]' },
  { key: 'individual-po',       label: 'Individual Purchase Order for Parts',     icon: 'icon-[tabler--file-invoice]' },
  { key: 'individual-equip-po', label: 'Individual Purchase Order for Equipment', icon: 'icon-[tabler--tool]' },
  { key: 'po-summary',          label: 'Purchase Orders',                         icon: 'icon-[tabler--shopping-cart]' },
  { key: 'parts-summary',       label: 'Parts',                                   icon: 'icon-[tabler--packages]' },
  { key: 'sr-billing',          label: 'Service Report Billing',                  icon: 'icon-[tabler--report-money]' },
  { key: 'vehicle-logs',        label: 'Vehicle Logs',                            icon: 'icon-[tabler--truck]',        roles: ['ADMIN', 'STAFF'] },
  { key: 'vehicle-gas-logs',    label: 'Vehicle Gas Logs',                        icon: 'icon-[tabler--gas-station]',  roles: null },
]

/** Preset options for the date range bar. */
const DATE_PRESETS = [
  { label: 'Last 7 Days',   getDates: () => { const t = new Date(); const s = new Date(); s.setDate(t.getDate() - 6);  return [s, t] } },
  { label: 'Last 30 Days',  getDates: () => { const t = new Date(); const s = new Date(); s.setDate(t.getDate() - 29); return [s, t] } },
  { label: 'Last 3 Months', getDates: () => { const t = new Date(); const s = new Date(); s.setDate(t.getDate() - 89); return [s, t] } },
  { label: 'Year to Date',  getDates: () => { const t = new Date(); const s = new Date(t.getFullYear(), 0, 1);          return [s, t] } },
  { label: 'Custom Range',  custom: true },
]

function toIso(d) { return d.toISOString().slice(0, 10) }

/** Date range picker bar with quick-select presets. */
function DateRangeBar({ startDate, endDate, onRange }) {
  const [activePreset, setActivePreset] = useState('Last 7 Days')
  const [showCustom, setShowCustom]     = useState(false)
  const [customStart, setCustomStart]   = useState(startDate)
  const [customEnd, setCustomEnd]       = useState(endDate)

  function applyPreset(preset) {
    const [s, e] = preset.getDates()
    setActivePreset(preset.label)
    setShowCustom(false)
    onRange(toIso(s), toIso(e))
  }

  function handleCustom() { setActivePreset('Custom Range'); setShowCustom(true) }

  function applyCustom() { if (customStart && customEnd) onRange(customStart, customEnd) }

  function fmtShort(iso) {
    if (!iso) return ''
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const displayRange = !showCustom && startDate && endDate
    ? `${fmtShort(startDate)} \u2014 ${fmtShort(endDate)}`
    : ''

  return (
    <div className="flex items-center gap-3 flex-wrap bg-base-100 border border-base-300 rounded-xl px-4 py-3 mb-6 no-print">
      <span className="text-sm font-medium text-base-content/70 shrink-0">Date Range:</span>
      <div className="flex items-center gap-1 flex-wrap">
        {DATE_PRESETS.map(p => (
          p.custom
            ? <button key={p.label} type="button"
                className={`btn btn-sm rounded-full ${activePreset === 'Custom Range' ? 'btn-primary' : 'btn-ghost border border-base-300'}`}
                onClick={handleCustom}>{p.label}</button>
            : <button key={p.label} type="button"
                className={`btn btn-sm rounded-full ${activePreset === p.label ? 'btn-primary' : 'btn-ghost border border-base-300'}`}
                onClick={() => applyPreset(p)}>{p.label}</button>
        ))}
      </div>
      {displayRange && <span className="text-sm text-base-content/50">{displayRange}</span>}
      {showCustom && (
        <div className="flex items-center gap-2">
          <input type="date" className="input input-sm input-bordered" value={customStart}
            onChange={e => setCustomStart(e.target.value)} />
          <span className="text-base-content/40">—</span>
          <input type="date" className="input input-sm input-bordered" value={customEnd}
            onChange={e => setCustomEnd(e.target.value)} />
          <button type="button" className="btn btn-sm btn-primary" onClick={applyCustom}>Apply</button>
        </div>
      )}
    </div>
  )
}

// ─── Utility helpers ─────────────────────────────────────────────────────────

function fmtDateLong(dt) {
  if (!dt) return '—'
  const d = new Date(dt)
  if (isNaN(d)) return '—'
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
}

function fmtDateTime(dt) {
  if (!dt) return '—'
  return new Date(dt).toLocaleString('en-PH')
}

function fmtCurrency(val) {
  if (val == null) return '—'
  return Number(val).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })
}

function toSentenceCase(str) {
  if (!str) return '—'
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

function formatPaymentMethod(m) {
  if (!m) return '—'
  const lower = m.toLowerCase()
  if (lower === 'gcash') return 'GCash'
  if (lower.startsWith('ewallet:')) return `E-Wallet (${m.slice(8)})`
  const map = { cash: 'Cash', check: 'Check', ewallet: 'E-Wallet', bank: 'Bank Transfer' }
  return map[lower] ?? toSentenceCase(m)
}

function computeStatus(billedTotal, paidTotal) {
  if (billedTotal <= 0) return 'UNPAID'
  if (paidTotal >= billedTotal) return 'PAID'
  if (paidTotal > 0) return 'PARTIAL'
  return 'UNPAID'
}

async function fetchAll(apiFetch, url) {
  const sep = url.includes('?') ? '&' : '?'
  const res = await apiFetch(`${url}${sep}page=0&size=500`)
  if (!res.ok) return []
  const data = await res.json()
  return data.content ?? (Array.isArray(data) ? data : [])
}

async function fetchOne(apiFetch, url) {
  const res = await apiFetch(url)
  if (!res.ok) return null
  return res.json()
}

// ─── Shared display sub-components ───────────────────────────────────────────

function SectionTitle({ children }) {
  return (
    <div className="mt-6 mb-2 pb-1 border-b-2 border-gray-800 font-bold text-sm uppercase tracking-wider text-gray-800 print:mt-4 print:mb-1">
      {children}
    </div>
  )
}

function KVRow({ label, value }) {
  return (
    <div className="flex gap-1 text-sm">
      <span className="font-semibold text-gray-700 shrink-0">{label}:</span>
      <span className="text-gray-900">{value || '—'}</span>
    </div>
  )
}

function ReportTable({ head, children, foot }) {
  return (
    <table className="w-full border-collapse text-sm mb-3">
      <thead>
        <tr className="bg-gray-100">
          {head.map((h, i) => (
            <th
              key={i}
              className="border border-gray-300 px-3 py-1.5 text-left font-semibold text-gray-700 whitespace-nowrap"
              style={h.width ? { width: h.width } : {}}
            >
              {typeof h === 'string' ? h : h.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
      {foot && <tfoot>{foot}</tfoot>}
    </table>
  )
}

function Td({ children, right, bold }) {
  return (
    <td className={`border border-gray-300 px-3 py-1 text-gray-900${right ? ' text-right' : ''}${bold ? ' font-semibold' : ''}`}>
      {children ?? '—'}
    </td>
  )
}

/** Simple SVG pie chart with a legend. data: [{ label, value, color }] */
function PieChart({ data, size = 160 }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) return <p className="text-sm text-gray-400 text-center">No data</p>

  const cx = size / 2, cy = size / 2, r = size / 2 - 8
  let angle = -Math.PI / 2

  const slices = data.map(d => {
    const sweep = (d.value / total) * 2 * Math.PI
    const x1 = cx + r * Math.cos(angle)
    const y1 = cy + r * Math.sin(angle)
    angle += sweep
    const x2 = cx + r * Math.cos(angle)
    const y2 = cy + r * Math.sin(angle)
    const large = sweep > Math.PI ? 1 : 0
    return { ...d, path: `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z` }
  })

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices.map((s, i) => (
          <path key={i} d={s.path} fill={s.color} stroke="white" strokeWidth="1.5" />
        ))}
      </svg>
      <div className="flex flex-col gap-1 w-full text-xs">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: s.color }} />
            <span className="text-gray-700 truncate">{s.label}</span>
            <span className="ml-auto font-semibold text-gray-900 shrink-0">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Generates a short plain-English interpretation of a pie chart's data. */
function PieInterpretation({ data }) {
  if (!data || data.length === 0) return null
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) return null
  const sorted = [...data].sort((a, b) => b.value - a.value)
  const top = sorted[0]
  const pct = Math.round((top.value / total) * 100)
  if (data.length === 1) {
    return <p className="text-xs text-gray-500 mt-3 text-center">{top.label} accounts for all {total} {total === 1 ? 'entry' : 'entries'}.</p>
  }
  const second = sorted[1]
  return (
    <p className="text-xs text-gray-500 mt-3 text-center">
      <span className="font-medium text-gray-700">{top.label}</span> is the largest group at {pct}% ({top.value} of {total}).
      {' '}<span className="font-medium text-gray-700">{second.label}</span> follows with {second.value}.
    </p>
  )
}

// ─── Vehicle picker modal ─────────────────────────────────────────────────────

/** Step-1 modal: pick "All Vehicles" or a specific vehicle before generating the report. */
function VehiclePickerModal({ isOpen, onClose, onSelect }) {
  const { apiFetch } = useAuth()
  const [vehicles, setVehicles] = useState([])
  const [loading, setLoading]   = useState(false)

  useEffect(() => {
    if (!isOpen) return
    let active = true
    setLoading(true)
    apiFetch('/api/vehicles?page=0&size=200&sort=vehicleModel,asc')
      .then(r => r.json())
      .then(data => { if (active) setVehicles(data.content ?? (Array.isArray(data) ? data : [])) })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [isOpen, apiFetch])

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 bg-base-300/70 z-[65]" onClick={onClose} />
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <div className="modal-content w-full max-w-lg">
          <div className="modal-header">
            <h3 className="modal-title">Select Vehicle</h3>
            <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={onClose}>
              <span className="icon-[tabler--x] size-4"></span>
            </button>
          </div>

          <div className="modal-body flex flex-col gap-3">
            {/* All vehicles option */}
            <button
              type="button"
              className="flex items-center gap-3 w-full rounded-xl border-2 border-primary bg-primary/5 px-4 py-3 text-left hover:bg-primary/10 transition-colors"
              onClick={() => onSelect(null)}
            >
              <span className="icon-[tabler--truck] size-6 text-primary shrink-0"></span>
              <div>
                <p className="font-semibold text-primary">All Vehicles</p>
                <p className="text-xs text-base-content/50">Include logs from every vehicle</p>
              </div>
            </button>

            {loading ? (
              <div className="flex justify-center py-6">
                <span className="loading loading-spinner loading-md text-primary"></span>
              </div>
            ) : vehicles.length === 0 ? (
              <p className="text-center py-6 text-base-content/40 text-sm">No vehicles found.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                {vehicles.map(v => (
                  <div key={v.vehiclesId} className="card bg-base-100 border border-base-300">
                    <div className="card-body py-3 px-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm line-clamp-1">{v.vehicleModel}</p>
                          <p className="text-xs text-base-content/50 font-mono">{v.vehiclePlateNum}</p>
                        </div>
                        <button type="button" className="btn btn-primary btn-sm shrink-0"
                          onClick={() => onSelect(v)}>Select</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ─── 3-step Purchase Order picker modal ──────────────────────────────────────

function POPickerModal({ isOpen, onClose, onSelect }) {
  const { apiFetch } = useAuth()

  const [step, setStep] = useState('project')         // 'project' | 'sr' | 'po'
  const [selProject, setSelProject] = useState(null)
  const [selSr, setSelSr] = useState(null)

  const [input, setInput] = useState('')
  const [search, setSearch] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  useEffect(() => {
    if (isOpen) { setStep('project'); setSelProject(null); setSelSr(null); setPage(0); setInput(''); setSearch(''); setItems([]) }
  }, [isOpen])

  const fetchUrl = useCallback((pg) => {
    if (step === 'project')
      return `/api/projects?${new URLSearchParams({ page: String(pg), size: '12', sort: 'name,asc' })}`
    if (step === 'sr')
      return `/api/service-reports?${new URLSearchParams({ projNum: String(selProject.projNum), page: String(pg), size: '12', sort: 'srNumber,desc' })}`
    return `/api/purchase-orders?${new URLSearchParams({ srNum: String(selSr.srNumber), page: String(pg), size: '12', sort: 'addedOn,desc' })}`
  }, [step, selProject, selSr])

  useEffect(() => {
    if (!isOpen) return
    if (step === 'sr' && !selProject) return
    if (step === 'po' && !selSr) return
    let active = true
    setLoading(true)
    apiFetch(fetchUrl(page))
      .then(r => r.json())
      .then(data => { if (active) { setItems(data.content ?? []); setTotalPages(data.totalPages ?? 0) } })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [isOpen, page, fetchUrl, apiFetch])

  function commitSearch() { setPage(0); setSearch(input) }

  const filtered = items.filter(item => {
    if (search === '') return true
    const q = search.toLowerCase()
    if (step === 'project') return item.name.toLowerCase().includes(q) || String(item.projNum).includes(q)
    if (step === 'sr') return String(item.srNumber).includes(q) || (item.complaint ?? '').toLowerCase().includes(q)
    return String(item.poNum ?? '').toLowerCase().includes(q) || (item.purpose ?? '').toLowerCase().includes(q)
  })

  function goBack() {
    if (step === 'sr') { setStep('project'); setSelProject(null) }
    if (step === 'po') { setStep('sr'); setSelSr(null) }
    setPage(0); setInput(''); setSearch(''); setItems([])
  }

  function pickProject(p) { setSelProject(p); setStep('sr'); setPage(0); setInput(''); setSearch(''); setItems([]) }
  function pickSr(sr) { setSelSr(sr); setStep('po'); setPage(0); setInput(''); setSearch(''); setItems([]) }

  const STEP_LABELS = { project: 'Step 1 — Select Project', sr: 'Step 2 — Select Service Report', po: 'Step 3 — Select Purchase Order' }
  const PLACEHOLDERS = { project: 'Search by name or project #...', sr: 'Search by SR # or complaint...', po: 'Search by PO # or purpose...' }

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 bg-base-300/70 z-[65]" onClick={onClose} />
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <div className="modal-content w-full max-w-xl">
          <div className="modal-header">
            <div className="flex items-center gap-2">
              {step !== 'project' && (
                <button type="button" className="btn btn-text btn-circle btn-sm" onClick={goBack}>
                  <span className="icon-[tabler--arrow-left] size-4"></span>
                </button>
              )}
              <div>
                <h3 className="modal-title">{STEP_LABELS[step]}</h3>
                {step === 'sr' && <p className="text-xs text-base-content/50 mt-0.5">{selProject?.name} (#{selProject?.projNum})</p>}
                {step === 'po' && <p className="text-xs text-base-content/50 mt-0.5">SR #{selSr?.srNumber} — {selProject?.name}</p>}
              </div>
            </div>
            <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={onClose}>
              <span className="icon-[tabler--x] size-4"></span>
            </button>
          </div>

          <div className="modal-body flex flex-col gap-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="icon-[tabler--search] size-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none"></span>
                <input
                  type="text"
                  className="input input-bordered w-full pl-9"
                  placeholder={PLACEHOLDERS[step]}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') commitSearch() }}
                />
              </div>
              <button type="button" className="btn btn-soft btn-secondary shrink-0" onClick={commitSearch}>
                <span className="icon-[tabler--search] size-4"></span>
                Search
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <span className="loading loading-spinner loading-md text-primary"></span>
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-center py-8 text-base-content/40">
                {step === 'project' ? 'No projects found.' : step === 'sr' ? 'No service reports found.' : 'No purchase orders found for this SR.'}
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
                {step === 'project' && filtered.map(p => (
                  <div key={p.projNum} className="card bg-base-100 border border-base-300">
                    <div className="card-body py-3 px-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm line-clamp-1">{p.name}</p>
                          <p className="text-xs text-base-content/50">#{p.projNum} · {p.type}</p>
                          <p className="text-xs text-base-content/60 line-clamp-1 mt-0.5">{p.address}</p>
                        </div>
                        <button type="button" className="btn btn-primary btn-sm shrink-0" onClick={() => pickProject(p)}>Select</button>
                      </div>
                    </div>
                  </div>
                ))}
                {step === 'sr' && filtered.map(sr => (
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
                        <button type="button" className="btn btn-primary btn-sm shrink-0" onClick={() => pickSr(sr)}>Select</button>
                      </div>
                    </div>
                  </div>
                ))}
                {step === 'po' && filtered.map(po => (
                  <div key={po.poNum} className="card bg-base-100 border border-base-300">
                    <div className="card-body py-3 px-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm line-clamp-1 font-mono">{po.poNum}</p>
                          <p className="text-xs text-base-content/60 line-clamp-1 mt-0.5">{po.purpose ?? '—'}</p>
                          <p className="text-xs text-base-content/50">{fmtCurrency(po.totalCost)}</p>
                        </div>
                        <button type="button" className="btn btn-primary btn-sm shrink-0" onClick={() => onSelect({ po, sr: selSr, project: selProject })}>Select</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <button type="button" className="btn btn-sm btn-secondary" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                  <span className="icon-[tabler--chevron-left] size-4"></span> Prev
                </button>
                <span className="text-sm text-base-content/60">Page {page + 1} of {totalPages}</span>
                <button type="button" className="btn btn-sm btn-secondary" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                  Next <span className="icon-[tabler--chevron-right] size-4"></span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Single-step Equipment PO picker ─────────────────────────────────────────

function EquipPOPickerModal({ isOpen, onClose, onSelect }) {
  const { apiFetch } = useAuth()

  const [input, setInput]           = useState('')
  const [search, setSearch]         = useState('')
  const [items, setItems]           = useState([])
  const [loading, setLoading]       = useState(false)
  const [page, setPage]             = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  useEffect(() => {
    if (isOpen) { setPage(0); setInput(''); setSearch(''); setItems([]) }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    let active = true
    setLoading(true)
    apiFetch(`/api/purchase-orders?${new URLSearchParams({ filterBy: 'equipment', page: String(page), size: '12', sort: 'addedOn,desc' })}`)
      .then(r => r.json())
      .then(data => { if (active) { setItems(data.content ?? []); setTotalPages(data.totalPages ?? 0) } })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [isOpen, page, apiFetch])

  function commitSearch() { setPage(0); setSearch(input) }

  const filtered = items.filter(item => {
    if (search === '') return true
    const q = search.toLowerCase()
    return String(item.poNum ?? '').toLowerCase().includes(q) || (item.purpose ?? '').toLowerCase().includes(q)
  })

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 bg-base-300/70 z-[65]" onClick={onClose} />
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <div className="modal-content w-full max-w-xl">
          <div className="modal-header">
            <h3 className="modal-title">Select Equipment Purchase Order</h3>
            <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={onClose}>
              <span className="icon-[tabler--x] size-4"></span>
            </button>
          </div>

          <div className="modal-body flex flex-col gap-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="icon-[tabler--search] size-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none"></span>
                <input
                  type="text"
                  className="input input-bordered w-full pl-9"
                  placeholder="Search by PO # or purpose..."
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') commitSearch() }}
                />
              </div>
              <button type="button" className="btn btn-soft btn-secondary shrink-0" onClick={commitSearch}>
                <span className="icon-[tabler--search] size-4"></span>
                Search
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <span className="loading loading-spinner loading-md text-primary"></span>
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-center py-8 text-base-content/40">No equipment purchase orders found.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
                {filtered.map(po => (
                  <div key={po.poNum} className="card bg-base-100 border border-base-300">
                    <div className="card-body py-3 px-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm font-mono line-clamp-1">{po.poNum}</p>
                          <p className="text-xs text-base-content/60 line-clamp-1 mt-0.5">{po.purpose ?? '—'}</p>
                          <p className="text-xs text-base-content/50">{fmtCurrency(po.totalCost)}</p>
                        </div>
                        <button type="button" className="btn btn-primary btn-sm shrink-0" onClick={() => onSelect(po)}>
                          Select
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <button type="button" className="btn btn-sm btn-secondary" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                  <span className="icon-[tabler--chevron-left] size-4"></span> Prev
                </button>
                <span className="text-sm text-base-content/60">Page {page + 1} of {totalPages}</span>
                <button type="button" className="btn btn-sm btn-secondary" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                  Next <span className="icon-[tabler--chevron-right] size-4"></span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ─── SR Report: PDF HTML builder ──────────────────────────────────────────────

const SHARED_PDF_STYLE = `
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; color: #111; margin: 24px; }
  h1 { font-size: 14pt; text-transform: uppercase; letter-spacing: 1px; text-align: center; margin: 0 0 4px; }
  h2 { font-size: 12pt; text-align: center; margin: 0 0 2px; font-weight: 600; }
  .sub { text-align: center; color: #555; font-size: 10pt; margin: 0 0 2px; }
  .gen { text-align: center; color: #888; font-size: 9pt; margin: 0 0 16px; }
  .header-rule { border-bottom: 2px solid #111; margin-bottom: 4px; }
  .section { font-size: 9pt; font-weight: bold; text-transform: uppercase; letter-spacing: .5px; color: #333;
             border-bottom: 1.5px solid #555; padding-bottom: 2px; margin: 14px 0 4px; }
  .kv-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 24px; margin-bottom: 8px; }
  .kv { display: flex; gap: 4px; font-size: 10pt; line-height: 1.5; }
  .kv-l { font-weight: bold; white-space: nowrap; color: #444; }
  .full { grid-column: span 2; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 8px; }
  th { background: #f0f0f0; font-weight: bold; font-size: 9.5pt; text-align: left; padding: 3px 6px; border: 1px solid #bbb; }
  td { font-size: 9.5pt; padding: 3px 6px; border: 1px solid #bbb; }
  tfoot td { background: #f8f8f8; font-weight: bold; }
  .text-right { text-align: right; }
  .sub-section { font-weight: 600; font-size: 10pt; margin: 8px 0 3px; }
  .cost-table { max-width: 320px; margin-left: auto; }
  .cost-table td { border: none; padding: 2px 6px; }
  .cost-table .label { text-align: right; font-weight: bold; }
  .balance-red { color: #c00; font-weight: bold; }
  .balance-green { color: #080; font-weight: bold; }
  .footer { text-align: center; font-size: 8pt; color: #999; margin-top: 24px; border-top: 1px solid #ddd; padding-top: 4px; }
  .po-header { font-weight: 600; font-size: 10pt; margin: 6px 0 2px; }
  .no-data { font-size: 10pt; color: #888; margin-bottom: 8px; font-style: italic; }
`

function buildSrPdfHtml(d, billedTotal, paidTotal, balance, computedStatus, poGrandTotal, generatedAt) {
  const pad = n => String(n).padStart(2, '0')
  const srNum = pad(d.sr?.srNumber)

  const findingsRows = d.findings.map((f, i) =>
    `<tr>
      <td>${i + 1}</td><td>${toSentenceCase(f.findingType)}</td>
      <td>${f.partModel ?? '—'}</td>
      <td>${f.acNum != null ? (d.acMap[f.acNum] ?? `AC #${f.acNum}`) : '—'}</td>
      <td>${f.remarks ?? '—'}</td>
    </tr>`
  ).join('')

  const posHtml = d.purchaseOrders.length === 0
    ? '<p class="no-data">No purchase orders linked.</p>'
    : d.purchaseOrders.map((po, pi) => {
        const partsRows = po.parts.length === 0
          ? '<tr><td colspan="8" style="color:#888;font-style:italic">No parts in this PO.</td></tr>'
          : po.parts.map(p =>
              `<tr>
                <td>${p.partId}</td><td>${p.name}</td><td>${p.quantityOrdered}</td>
                <td>${p.quantityType}</td><td class="text-right">${fmtCurrency(p.unitPrice)}</td>
                <td>${toSentenceCase(p.status)}</td><td>${p.supplierName ?? '—'}</td>
                <td class="text-right">${fmtCurrency(Number(p.quantityOrdered) * Number(p.unitPrice ?? 0))}</td>
              </tr>`
            ).join('')
        return `
          <div class="po-header">PO ${pi + 1}: ${po.poNum} — ${po.purpose ?? '—'} | Terms: ${po.terms ?? '—'} | Payment: ${toSentenceCase(po.paymentMethod)}</div>
          <table>
            <thead><tr><th>Part ID</th><th>Name</th><th>Qty</th><th>Unit</th><th>Unit Price</th><th>Status</th><th>Supplier</th><th>Subtotal</th></tr></thead>
            <tbody>${partsRows}</tbody>
            <tfoot><tr><td colspan="7" class="text-right">PO Total</td><td class="text-right">${fmtCurrency(po.totalCost)}</td></tr></tfoot>
          </table>`
      }).join('')

  const billingRows = d.billingItems.map((b, i) =>
    `<tr><td>${i + 1}</td><td>${b.description}</td><td>${b.quantity}</td>
     <td class="text-right">${fmtCurrency(b.unitPrice)}</td>
     <td class="text-right">${fmtCurrency(Number(b.quantity) * Number(b.unitPrice ?? 0))}</td></tr>`
  ).join('')

  const paymentRows = d.payments.map(p =>
    `<tr><td>${p.logId}</td><td>${p.paidBy ?? '—'}</td><td>${formatPaymentMethod(p.paymentMethod)}</td>
     <td>${p.receiptNumber ?? '—'}</td><td>${fmtDateLong(p.receiptDate)}</td>
     <td class="text-right">${fmtCurrency(p.amount)}</td></tr>`
  ).join('')

  const equipRows = d.equipment.map((e, i) =>
    `<tr><td>${i + 1}</td><td>${e.equipmentId}</td><td>${e.equipmentName}</td>
     <td>${toSentenceCase(e.equipmentType)}</td><td>${e.notes ?? '—'}</td></tr>`
  ).join('')

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Service Report No. ${srNum} — ${d.project?.name ?? ''}</title>
    <style>${SHARED_PDF_STYLE}</style>
  </head><body>
    <div class="header-rule"></div>
    <h1>EASI — Project Service Report</h1>
    <h2>Service Report No. ${srNum}</h2>
    <p class="sub">${d.project?.name ?? '—'}</p>
    <p class="gen">Generated: ${generatedAt?.toLocaleString('en-PH')}</p>

    <div class="section">1. Project Information</div>
    <div class="kv-grid">
      <div class="kv"><span class="kv-l">Name:</span><span>${d.project?.name ?? '—'}</span></div>
      <div class="kv"><span class="kv-l">Type:</span><span>${d.project?.type ?? '—'}</span></div>
      <div class="kv full"><span class="kv-l">Address:</span><span>${d.project?.address ?? '—'}</span></div>
      <div class="kv"><span class="kv-l">Contact Person:</span><span>${d.project?.contactName ?? '—'}</span></div>
      <div class="kv"><span class="kv-l">Contact Number:</span><span>${d.project?.contactNumber ?? '—'}</span></div>
      <div class="kv"><span class="kv-l">Warranty Date:</span><span>${fmtDateLong(d.project?.warrantyDate)}</span></div>
    </div>

    <div class="section">2. Schedule Information</div>
    ${d.schedule ? `
    <div class="kv-grid">
      <div class="kv"><span class="kv-l">Date:</span><span>${fmtDateLong(d.schedule.date)}</span></div>
      <div class="kv"><span class="kv-l">Purpose:</span><span>${d.schedule.purpose ?? '—'}</span></div>
    </div>` : '<p class="no-data">No schedule linked.</p>'}

    <div class="section">3. Service Report</div>
    <div class="kv-grid">
      <div class="kv"><span class="kv-l">Location:</span><span>${d.sr?.location || d.project?.address || '—'}</span></div>
      <div class="kv"><span class="kv-l">Engineer:</span><span>${d.engineer ? `Engr. ${d.engineer.firstName} ${d.engineer.lastName}` : '—'}</span></div>
    </div>
    <div class="kv" style="margin-bottom:3px"><span class="kv-l">Complaint:</span><span>${d.sr?.complaint ?? '—'}</span></div>
    <div class="kv" style="margin-bottom:8px"><span class="kv-l">Work Done:</span><span>${d.sr?.workDone ?? '—'}</span></div>

    <div class="section">4. Crew Members</div>
    ${d.crew.length === 0 ? '<p class="no-data">No crew assigned.</p>' : `
    <table><thead><tr><th style="width:60px">ID</th><th>Employee Name</th></tr></thead>
    <tbody>${d.crew.map(c => `<tr><td>${c.employeeId}</td><td>${c.lastName}, ${c.firstName}</td></tr>`).join('')}</tbody></table>`}

    <div class="section">5. Findings</div>
    ${d.findings.length === 0 ? '<p class="no-data">No findings recorded.</p>' : `
    <table><thead><tr><th style="width:32px">No.</th><th>Type</th><th>Part / Model</th><th>AC Unit</th><th>Remarks</th></tr></thead>
    <tbody>${findingsRows}</tbody></table>`}

    <div class="section">6. Purchase Orders &amp; Parts</div>
    ${posHtml}
    ${d.purchaseOrders.length > 0 ? `<p style="text-align:right;font-weight:bold;font-size:10pt;margin-bottom:8px">Grand Total (All POs): ${fmtCurrency(poGrandTotal)}</p>` : ''}

    <div class="section">7. Billing &amp; Cost Computation</div>
    ${d.billingItems.length === 0 ? '<p class="no-data">No billing items.</p>' : `
    <table><thead><tr><th style="width:32px">No.</th><th>Description</th><th>Qty</th><th>Unit Price</th><th>Amount</th></tr></thead>
    <tbody>${billingRows}</tbody>
    <tfoot><tr><td colspan="4" class="text-right">Total Billed</td><td class="text-right">${fmtCurrency(billedTotal)}</td></tr></tfoot></table>`}

    <div class="sub-section">Payments Received</div>
    ${d.payments.length === 0 ? '<p class="no-data">No payments recorded.</p>' : `
    <table><thead><tr><th>Payment #</th><th>Paid By</th><th>Method</th><th>Receipt #</th><th>Receipt Date</th><th>Amount</th></tr></thead>
    <tbody>${paymentRows}</tbody></table>`}

    <table class="cost-table">
      <tr><td class="label">Total Billed:</td><td>${fmtCurrency(billedTotal)}</td></tr>
      <tr><td class="label">Total Paid:</td><td>${fmtCurrency(paidTotal)}</td></tr>
      <tr><td class="label">Balance:</td><td class="${balance > 0 ? 'balance-red' : 'balance-green'}">${fmtCurrency(balance)}</td></tr>
      <tr><td class="label">Payment Status:</td><td><strong>${computedStatus}</strong></td></tr>
    </table>

    <div class="section">8. Equipment Used</div>
    ${d.equipment.length === 0 ? '<p class="no-data">No equipment deployed.</p>' : `
    <table><thead><tr><th style="width:32px">No.</th><th>Equipment ID</th><th>Name</th><th>Type</th><th>Notes</th></tr></thead>
    <tbody>${equipRows}</tbody></table>`}

    <div class="footer">EASI System — Printed ${generatedAt?.toLocaleString('en-PH')} — Service Report No. ${srNum}</div>
  </body></html>`
}

// ─── PO Report: PDF HTML builder ─────────────────────────────────────────────

function buildPoPdfHtml(d, generatedAt) {
  const partsRows = d.parts.length === 0
    ? '<tr><td colspan="8" style="color:#888;font-style:italic">No parts in this PO.</td></tr>'
    : d.parts.map(p =>
        `<tr>
          <td>${p.partId}</td><td>${p.name}</td><td>${p.quantityOrdered}</td>
          <td>${p.quantityType}</td><td class="text-right">${fmtCurrency(p.unitPrice)}</td>
          <td>${toSentenceCase(p.status)}</td><td>${p.supplierName ?? '—'}</td>
          <td class="text-right">${fmtCurrency(Number(p.quantityOrdered) * Number(p.unitPrice ?? 0))}</td>
        </tr>`
      ).join('')

  const contactRows = d.contacts.length === 0
    ? '<tr><td colspan="2" style="color:#888;font-style:italic">No delivery contacts listed.</td></tr>'
    : d.contacts.map(c => `<tr><td>${c.contactName}</td><td>${c.contactNumber ?? '—'}</td></tr>`).join('')

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Purchase Order ${d.po?.poNum ?? ''} — ${d.project?.name ?? ''}</title>
    <style>${SHARED_PDF_STYLE}</style>
  </head><body>
    <div class="header-rule"></div>
    <h1>EASI — Purchase Order</h1>
    <h2>${d.po?.poNum ?? '—'}</h2>
    <p class="sub">${d.project?.name ?? '—'}</p>
    <p class="gen">Generated: ${generatedAt?.toLocaleString('en-PH')}</p>

    <div class="section">1. Project Information</div>
    <div class="kv-grid">
      <div class="kv"><span class="kv-l">Name:</span><span>${d.project?.name ?? '—'}</span></div>
      <div class="kv"><span class="kv-l">Type:</span><span>${d.project?.type ?? '—'}</span></div>
      <div class="kv full"><span class="kv-l">Address:</span><span>${d.project?.address ?? '—'}</span></div>
      <div class="kv"><span class="kv-l">Contact Person:</span><span>${d.project?.contactName ?? '—'}</span></div>
      <div class="kv"><span class="kv-l">Contact Number:</span><span>${d.project?.contactNumber ?? '—'}</span></div>
    </div>

    <div class="section">2. Service Report Reference</div>
    <div class="kv-grid">
      <div class="kv"><span class="kv-l">SR No.:</span><span>${d.sr?.srNumber != null ? String(d.sr.srNumber).padStart(2, '0') : '—'}</span></div>
      <div class="kv"><span class="kv-l">Location:</span><span>${d.sr?.location || d.project?.address || '—'}</span></div>
      <div class="kv full"><span class="kv-l">Complaint:</span><span>${d.sr?.complaint ?? '—'}</span></div>
    </div>

    <div class="section">3. Purchase Order Details</div>
    <div class="kv-grid">
      <div class="kv"><span class="kv-l">PO Number:</span><span>${d.po?.poNum ?? '—'}</span></div>
      <div class="kv"><span class="kv-l">Date:</span><span>${fmtDateLong(d.po?.addedOn)}</span></div>
      <div class="kv full"><span class="kv-l">Purpose:</span><span>${d.po?.purpose ?? '—'}</span></div>
      <div class="kv"><span class="kv-l">Terms:</span><span>${d.po?.terms ?? '—'}</span></div>
      <div class="kv"><span class="kv-l">Payment Method:</span><span>${toSentenceCase(d.po?.paymentMethod)}</span></div>
      <div class="kv full"><span class="kv-l">Payment Details:</span><span>${d.po?.paymentDetails ?? '—'}</span></div>
      <div class="kv full"><span class="kv-l">Delivery Address:</span><span>${d.po?.deliveryAddress ?? '—'}</span></div>
      <div class="kv full"><span class="kv-l">Remarks:</span><span>${d.po?.remarks ?? '—'}</span></div>
    </div>

    <div class="section">4. Delivery Contacts</div>
    <table><thead><tr><th>Contact Name</th><th>Contact Number</th></tr></thead>
    <tbody>${contactRows}</tbody></table>

    <div class="section">5. Parts / Items</div>
    <table>
      <thead><tr><th>Part ID</th><th>Name</th><th>Qty</th><th>Unit</th><th>Unit Price</th><th>Status</th><th>Supplier</th><th>Subtotal</th></tr></thead>
      <tbody>${partsRows}</tbody>
      <tfoot><tr><td colspan="7" class="text-right">Total</td><td class="text-right">${fmtCurrency(d.po?.totalCost)}</td></tr></tfoot>
    </table>

    <div class="footer">EASI System — Printed ${generatedAt?.toLocaleString('en-PH')} — PO ${d.po?.poNum ?? ''}</div>
  </body></html>`
}

// ─── Equipment PO Report: PDF HTML builder ────────────────────────────────────

function buildEquipPoPdfHtml(d, generatedAt) {
  const equipRows = d.equipment.length === 0
    ? '<tr><td colspan="8" style="color:#888;font-style:italic">No equipment in this PO.</td></tr>'
    : d.equipment.map((e, i) =>
        `<tr>
          <td>${i + 1}</td><td>${e.equipmentId}</td><td>${e.name}</td>
          <td>${toSentenceCase(e.type)}</td><td>${e.model ?? '—'}</td>
          <td>${e.serialNumber ?? '—'}</td><td>${e.stock ?? '—'}</td>
          <td class="text-right">${fmtCurrency(e.acquisitionCost)}</td>
        </tr>`
      ).join('')

  const totalAcq = d.equipment.reduce((s, e) => s + Number(e.acquisitionCost ?? 0), 0)

  const contactRows = d.contacts.length === 0
    ? '<tr><td colspan="2" style="color:#888;font-style:italic">No delivery contacts listed.</td></tr>'
    : d.contacts.map(c => `<tr><td>${c.contactName}</td><td>${c.contactNumber ?? '—'}</td></tr>`).join('')

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Equipment PO ${d.po?.poNum ?? ''}</title>
    <style>${SHARED_PDF_STYLE}</style>
  </head><body>
    <div class="header-rule"></div>
    <h1>EASI — Purchase Order (Equipment)</h1>
    <h2>${d.po?.poNum ?? '—'}</h2>
    <p class="gen">Generated: ${generatedAt?.toLocaleString('en-PH')}</p>

    <div class="section">1. Purchase Order Details</div>
    <div class="kv-grid">
      <div class="kv"><span class="kv-l">PO Number:</span><span>${d.po?.poNum ?? '—'}</span></div>
      <div class="kv"><span class="kv-l">Date:</span><span>${fmtDateLong(d.po?.addedOn)}</span></div>
      <div class="kv full"><span class="kv-l">Purpose:</span><span>${d.po?.purpose ?? '—'}</span></div>
      <div class="kv"><span class="kv-l">Terms:</span><span>${d.po?.terms ?? '—'}</span></div>
      <div class="kv"><span class="kv-l">Payment Method:</span><span>${toSentenceCase(d.po?.paymentMethod)}</span></div>
      <div class="kv full"><span class="kv-l">Payment Details:</span><span>${d.po?.paymentDetails ?? '—'}</span></div>
      <div class="kv full"><span class="kv-l">Delivery Address:</span><span>${d.po?.deliveryAddress ?? '—'}</span></div>
      <div class="kv full"><span class="kv-l">Remarks:</span><span>${d.po?.remarks ?? '—'}</span></div>
    </div>

    <div class="section">2. Delivery Contacts</div>
    <table><thead><tr><th>Contact Name</th><th>Contact Number</th></tr></thead>
    <tbody>${contactRows}</tbody></table>

    <div class="section">3. Equipment Items</div>
    <table>
      <thead><tr><th>No.</th><th>ID</th><th>Name</th><th>Type</th><th>Model</th><th>Serial #</th><th>Stock</th><th>Acquisition Cost</th></tr></thead>
      <tbody>${equipRows}</tbody>
      <tfoot><tr><td colspan="7" class="text-right">Total Acquisition Cost</td><td class="text-right">${fmtCurrency(totalAcq)}</td></tr></tfoot>
    </table>

    <div class="footer">EASI System — Printed ${generatedAt?.toLocaleString('en-PH')} — PO ${d.po?.poNum ?? ''}</div>
  </body></html>`
}

// ─── Parts Report: PDF HTML builder ──────────────────────────────────────────

function buildPartsSummaryPdfHtml(rows, startDate, endDate, generatedAt) {
  const fmtShortDate = iso => iso
    ? new Date(iso + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—'

  const totalParts = rows.length
  const totalQty   = rows.reduce((s, r) => s + (r.quantityOrdered ?? 0), 0)
  const totalUsed  = rows.reduce((s, r) => s + (r.quantityUsed ?? 0), 0)
  const totalCost  = rows.reduce((s, r) => s + Number(r.total ?? 0), 0)

  const tableRows = rows.map(r =>
    `<tr>
      <td style="font-family:monospace">${r.partId}</td>
      <td>${r.name ?? '—'}</td>
      <td>${r.supplierName ?? '—'}</td>
      <td>${r.quantityOrdered != null ? `${r.quantityOrdered} ${r.quantityType ?? ''}`.trim() : '—'}</td>
      <td class="text-right">${r.quantityUsed ?? 0}</td>
      <td class="text-right">${fmtCurrency(r.unitPrice)}</td>
      <td class="text-right">${fmtCurrency(r.total)}</td>
    </tr>`
  ).join('')

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Parts Report</title>
    <style>${SHARED_PDF_STYLE}</style>
  </head><body>
    <div class="header-rule"></div>
    <h1>EASI — Parts Report</h1>
    <p class="sub">Date Range: ${fmtShortDate(startDate)} — ${fmtShortDate(endDate)}</p>
    <p class="gen">Generated: ${generatedAt?.toLocaleString('en-PH')}</p>

    <div class="section">Summary</div>
    <div class="kv-grid" style="max-width:420px;margin-bottom:12px">
      <div class="kv"><span class="kv-l">Total Parts:</span><span>${totalParts}</span></div>
      <div class="kv"><span class="kv-l">Used / Total Units:</span><span>${totalUsed} / ${totalQty}</span></div>
      <div class="kv"><span class="kv-l">Total Cost:</span><span>${fmtCurrency(totalCost)}</span></div>
    </div>

    <div class="section">Parts</div>
    <table>
      <thead><tr><th>ID</th><th>Name</th><th>Supplier</th><th>Quantity</th><th>Qty Used</th><th>Unit Price</th><th>Total</th></tr></thead>
      <tbody>${tableRows}</tbody>
      <tfoot><tr>
        <td colspan="6" class="text-right">Grand Total</td>
        <td class="text-right">${fmtCurrency(totalCost)}</td>
      </tr></tfoot>
    </table>

    <div class="footer">EASI System — Printed ${generatedAt?.toLocaleString('en-PH')} — Parts Report</div>
  </body></html>`
}

// ─── PO Summary Report: PDF HTML builder ─────────────────────────────────────

function buildPoSummaryPdfHtml(rows, startDate, endDate, generatedAt) {
  const fmtShortDate = iso => iso
    ? new Date(iso + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—'

  const totalCost = rows.reduce((s, r) => s + Number(r.total ?? 0), 0)

  const tableRows = rows.map(r =>
    `<tr>
      <td style="font-family:monospace">${r.poNum}</td>
      <td>${r.srNumber != null ? String(r.srNumber).padStart(2, '0') : '—'}</td>
      <td>${r.projectName ?? '—'}</td>
      <td>${r.terms ?? '—'}</td>
      <td>${r.type === 'parts' ? 'Parts' : 'Equipment'}</td>
      <td class="text-right">${fmtCurrency(r.total)}</td>
      <td>${r.addedOn ? new Date(r.addedOn).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}</td>
    </tr>`
  ).join('')

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Purchase Orders Report</title>
    <style>${SHARED_PDF_STYLE}</style>
  </head><body>
    <div class="header-rule"></div>
    <h1>EASI — Purchase Orders Report</h1>
    <p class="sub">Date Range: ${fmtShortDate(startDate)} — ${fmtShortDate(endDate)}</p>
    <p class="gen">Generated: ${generatedAt?.toLocaleString('en-PH')}</p>

    <div class="section">Summary</div>
    <div class="kv-grid" style="max-width:360px;margin-bottom:12px">
      <div class="kv"><span class="kv-l">Total Purchase Orders:</span><span>${rows.length}</span></div>
      <div class="kv"><span class="kv-l">Total Cost:</span><span>${fmtCurrency(totalCost)}</span></div>
    </div>

    <div class="section">Purchase Orders</div>
    <table>
      <thead><tr><th>PO No.</th><th>SR No.</th><th>Project Name</th><th>Terms</th><th>Type</th><th>Total</th><th>Added On</th></tr></thead>
      <tbody>${tableRows}</tbody>
      <tfoot><tr>
        <td colspan="5" class="text-right">Grand Total</td>
        <td class="text-right">${fmtCurrency(totalCost)}</td>
        <td></td>
      </tr></tfoot>
    </table>

    <div class="footer">EASI System — Printed ${generatedAt?.toLocaleString('en-PH')} — Purchase Orders Report</div>
  </body></html>`
}

// ─── SR Billing Report: PDF HTML builder ─────────────────────────────────────

function buildSrBillingPdfHtml(rows, startDate, endDate, generatedAt) {
  const fmtShortDate = iso => iso
    ? new Date(iso + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—'

  const grandBilled   = rows.reduce((s, r) => s + Number(r.subtotalBilledCost ?? 0), 0)
  const grandPayments = rows.reduce((s, r) => s + Number(r.totalPayments ?? 0), 0)
  const grandBalance  = rows.reduce((s, r) => s + Number(r.balance ?? 0), 0)

  const fmtDate = iso => iso
    ? new Date(iso + 'T00:00:00').toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
    : '—'

  const tableRows = rows.map(r =>
    `<tr>
      <td>${String(r.srNumber).padStart(2, '0')}</td>
      <td>${fmtDate(r.serviceDate)}</td>
      <td class="text-right">${fmtCurrency(r.servicesAndLaborCost)}</td>
      <td class="text-right">${fmtCurrency(r.partsTotalCost)}</td>
      <td class="text-right">${fmtCurrency(r.subtotalBilledCost)}</td>
      <td class="text-right">${fmtCurrency(r.totalPayments)}</td>
      <td class="text-right">${fmtCurrency(r.balance)}</td>
    </tr>`
  ).join('')

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Service Report Billing Report</title>
    <style>${SHARED_PDF_STYLE}</style>
  </head><body>
    <div class="header-rule"></div>
    <h1>EASI — Service Report Billing Report</h1>
    <p class="sub">Date Range: ${fmtShortDate(startDate)} — ${fmtShortDate(endDate)}</p>
    <p class="gen">Generated: ${generatedAt?.toLocaleString('en-PH')}</p>

    <div class="section">Summary</div>
    <div class="kv-grid" style="max-width:480px;margin-bottom:12px">
      <div class="kv"><span class="kv-l">Total Billed Amount:</span><span>${fmtCurrency(grandBilled)}</span></div>
      <div class="kv"><span class="kv-l">Total Payments:</span><span>${fmtCurrency(grandPayments)}</span></div>
      <div class="kv"><span class="kv-l">Total Balance:</span><span>${fmtCurrency(grandBalance)}</span></div>
    </div>

    <div class="section">Billing Details</div>
    <table>
      <thead><tr>
        <th>SR No.</th><th>Date</th><th>Services &amp; Labor</th><th>Parts Cost</th>
        <th>Subtotal Billed</th><th>Total Payments</th><th>Balance</th>
      </tr></thead>
      <tbody>${tableRows}</tbody>
      <tfoot><tr>
        <td class="text-right"><strong>Totals</strong></td>
        <td></td><td></td><td></td>
        <td class="text-right">${fmtCurrency(grandBilled)}</td>
        <td class="text-right">${fmtCurrency(grandPayments)}</td>
        <td class="text-right">${fmtCurrency(grandBalance)}</td>
      </tr></tfoot>
    </table>

    <div class="footer">EASI System — Printed ${generatedAt?.toLocaleString('en-PH')} — Service Report Billing Report</div>
  </body></html>`
}

// ─── Vehicle Logs Report: PDF HTML builder ───────────────────────────────────

function buildVehicleLogsPdfHtml(rows, startDate, endDate, vehicleLabel, generatedAt) {
  const fmtShortDate = iso => iso
    ? new Date(iso + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—'

  const uniqueVehicles = new Set(rows.map(r => r.plateNumber)).size
  const totalMileage   = rows.reduce((s, r) => s + (r.distance ?? 0), 0)

  const tableRows = rows.map(r => {
    const odomReading = r.odometerEnd != null
      ? `${r.odometerStart}km — ${r.odometerEnd}km`
      : `${r.odometerStart}km — (in progress)`
    const dist = r.distance != null ? `${r.distance} km` : '—'
    const dateStr = r.addedOn
      ? new Date(r.addedOn).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
      : '—'
    return `<tr>
      <td>${r.vehicleModel ?? '—'}</td>
      <td>${r.plateNumber ?? '—'}</td>
      <td>${odomReading}</td>
      <td class="text-right">${dist}</td>
      <td>${dateStr}</td>
    </tr>`
  }).join('')

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Vehicle Logs Report</title>
    <style>${SHARED_PDF_STYLE}</style>
  </head><body>
    <div class="header-rule"></div>
    <h1>EASI — Vehicle Logs Report</h1>
    <p class="sub">Vehicle: ${vehicleLabel} &nbsp;|&nbsp; Date Range: ${fmtShortDate(startDate)} — ${fmtShortDate(endDate)}</p>
    <p class="gen">Generated: ${generatedAt?.toLocaleString('en-PH')}</p>

    <div class="section">Summary</div>
    <div class="kv-grid" style="max-width:480px;margin-bottom:12px">
      <div class="kv"><span class="kv-l">Total Vehicles:</span><span>${uniqueVehicles}</span></div>
      <div class="kv"><span class="kv-l">Total Logs:</span><span>${rows.length}</span></div>
      <div class="kv"><span class="kv-l">Total Mileage:</span><span>${totalMileage} km</span></div>
    </div>

    <div class="section">Vehicle Logs</div>
    <table>
      <thead><tr><th>Vehicle</th><th>Plate Number</th><th>Odometer Reading</th><th>Distance</th><th>Date</th></tr></thead>
      <tbody>${tableRows}</tbody>
      <tfoot><tr>
        <td colspan="3" class="text-right">Total Mileage</td>
        <td class="text-right">${totalMileage} km</td>
        <td></td>
      </tr></tfoot>
    </table>

    <div class="footer">EASI System — Printed ${generatedAt?.toLocaleString('en-PH')} — Vehicle Logs Report</div>
  </body></html>`
}

// ─── Vehicle Gas Logs Report: PDF HTML builder ───────────────────────────────

function buildVehicleGasLogsPdfHtml(rows, startDate, endDate, vehicleLabel, generatedAt) {
  const fmtShortDate = iso => iso
    ? new Date(iso + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—'

  const uniqueVehicles = new Set(rows.map(r => r.plateNumber)).size
  const totalCost      = rows.reduce((s, r) => s + Number(r.amount ?? 0), 0)

  const tableRows = rows.map(r => {
    const dateStr = r.addedOn
      ? new Date(r.addedOn).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
      : '—'
    return `<tr>
      <td>${r.vehicleModel ?? '—'}</td>
      <td>${r.plateNumber ?? '—'}</td>
      <td style="font-family:monospace">${r.invoiceId ?? '—'}</td>
      <td class="text-right">${fmtCurrency(r.amount)}</td>
      <td>${dateStr}</td>
    </tr>`
  }).join('')

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Vehicle Gas Logs Report</title>
    <style>${SHARED_PDF_STYLE}</style>
  </head><body>
    <div class="header-rule"></div>
    <h1>EASI — Vehicle Gas Logs Report</h1>
    <p class="sub">Vehicle: ${vehicleLabel} &nbsp;|&nbsp; Date Range: ${fmtShortDate(startDate)} — ${fmtShortDate(endDate)}</p>
    <p class="gen">Generated: ${generatedAt?.toLocaleString('en-PH')}</p>

    <div class="section">Summary</div>
    <div class="kv-grid" style="max-width:480px;margin-bottom:12px">
      <div class="kv"><span class="kv-l">Total Vehicles:</span><span>${uniqueVehicles}</span></div>
      <div class="kv"><span class="kv-l">Total Logs:</span><span>${rows.length}</span></div>
      <div class="kv"><span class="kv-l">Total Cost:</span><span>${fmtCurrency(totalCost)}</span></div>
    </div>

    <div class="section">Gas Logs</div>
    <table>
      <thead><tr><th>Vehicle</th><th>Plate Number</th><th>Invoice ID</th><th>Amount</th><th>Date</th></tr></thead>
      <tbody>${tableRows}</tbody>
      <tfoot><tr>
        <td colspan="3" class="text-right">Total Cost</td>
        <td class="text-right">${fmtCurrency(totalCost)}</td>
        <td></td>
      </tr></tfoot>
    </table>

    <div class="footer">EASI System — Printed ${generatedAt?.toLocaleString('en-PH')} — Vehicle Gas Logs Report</div>
  </body></html>`
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Reports() {
  const { apiFetch, hasRole } = useAuth()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // SR report
  const [srPickerOpen, setSrPickerOpen] = useState(false)
  const [srData, setSrData] = useState(null)
  const [srGeneratedAt, setSrGeneratedAt] = useState(null)

  // Parts PO report
  const [poPickerOpen, setPoPickerOpen] = useState(false)
  const [poData, setPoData] = useState(null)
  const [poGeneratedAt, setPoGeneratedAt] = useState(null)

  // Equipment PO report
  const [equipPoPickerOpen, setEquipPoPickerOpen] = useState(false)
  const [equipPoData, setEquipPoData] = useState(null)
  const [equipPoGeneratedAt, setEquipPoGeneratedAt] = useState(null)

  // Purchase Orders summary report
  const [poSummaryActive, setPoSummaryActive]           = useState(false)
  const [poSummaryStart, setPoSummaryStart]             = useState('')
  const [poSummaryEnd, setPoSummaryEnd]                 = useState('')
  const [poSummaryRows, setPoSummaryRows]               = useState(null)
  const [poSummaryLoading, setPoSummaryLoading]         = useState(false)
  const [poSummaryError, setPoSummaryError]             = useState(null)
  const [poSummaryGeneratedAt, setPoSummaryGeneratedAt] = useState(null)

  // Parts summary report
  const [partsActive, setPartsActive]               = useState(false)
  const [partsStart, setPartsStart]                 = useState('')
  const [partsEnd, setPartsEnd]                     = useState('')
  const [partsRows, setPartsRows]                   = useState(null)
  const [partsLoading, setPartsLoading]             = useState(false)
  const [partsError, setPartsError]                 = useState(null)
  const [partsGeneratedAt, setPartsGeneratedAt]     = useState(null)

  // Auto-fetch whenever the PO summary date range changes
  useEffect(() => {
    if (!poSummaryActive || !poSummaryStart || !poSummaryEnd) return
    let active = true
    setPoSummaryLoading(true)
    setPoSummaryError(null)
    apiFetch(`/api/reports/purchase-orders?startDate=${poSummaryStart}&endDate=${poSummaryEnd}`)
      .then(r => { if (!r.ok) throw new Error(`Error ${r.status}`); return r.json() })
      .then(data => { if (active) { setPoSummaryRows(data); setPoSummaryGeneratedAt(new Date()) } })
      .catch(err => { if (active) setPoSummaryError(err.message ?? 'Failed to load report.') })
      .finally(() => { if (active) setPoSummaryLoading(false) })
    return () => { active = false }
  }, [poSummaryActive, poSummaryStart, poSummaryEnd, apiFetch])

  // Auto-fetch whenever the Parts date range changes
  useEffect(() => {
    if (!partsActive || !partsStart || !partsEnd) return
    let active = true
    setPartsLoading(true)
    setPartsError(null)
    apiFetch(`/api/reports/parts?startDate=${partsStart}&endDate=${partsEnd}`)
      .then(r => { if (!r.ok) throw new Error(`Error ${r.status}`); return r.json() })
      .then(data => { if (active) { setPartsRows(data); setPartsGeneratedAt(new Date()) } })
      .catch(err => { if (active) setPartsError(err.message ?? 'Failed to load report.') })
      .finally(() => { if (active) setPartsLoading(false) })
    return () => { active = false }
  }, [partsActive, partsStart, partsEnd, apiFetch])

  // SR Billing report
  const [srBillingActive, setSrBillingActive]           = useState(false)
  const [srBillingStart, setSrBillingStart]             = useState('')
  const [srBillingEnd, setSrBillingEnd]                 = useState('')
  const [srBillingRows, setSrBillingRows]               = useState(null)
  const [srBillingLoading, setSrBillingLoading]         = useState(false)
  const [srBillingError, setSrBillingError]             = useState(null)
  const [srBillingGeneratedAt, setSrBillingGeneratedAt] = useState(null)

  useEffect(() => {
    if (!srBillingActive || !srBillingStart || !srBillingEnd) return
    let active = true
    setSrBillingLoading(true)
    setSrBillingError(null)
    apiFetch(`/api/reports/service-report-billing?startDate=${srBillingStart}&endDate=${srBillingEnd}`)
      .then(r => { if (!r.ok) throw new Error(`Error ${r.status}`); return r.json() })
      .then(data => { if (active) { setSrBillingRows(data); setSrBillingGeneratedAt(new Date()) } })
      .catch(err => { if (active) setSrBillingError(err.message ?? 'Failed to load report.') })
      .finally(() => { if (active) setSrBillingLoading(false) })
    return () => { active = false }
  }, [srBillingActive, srBillingStart, srBillingEnd, apiFetch])

  // Vehicle Logs report
  const [vehiclePickerOpen, setVehiclePickerOpen]       = useState(false)
  const [vehicleLogsActive, setVehicleLogsActive]       = useState(false)
  const [vehicleLogsVehicle, setVehicleLogsVehicle]     = useState(null)  // null = all
  const [vehicleLogsStart, setVehicleLogsStart]         = useState('')
  const [vehicleLogsEnd, setVehicleLogsEnd]             = useState('')
  const [vehicleLogsRows, setVehicleLogsRows]           = useState(null)
  const [vehicleLogsLoading, setVehicleLogsLoading]     = useState(false)
  const [vehicleLogsError, setVehicleLogsError]         = useState(null)
  const [vehicleLogsGeneratedAt, setVehicleLogsGeneratedAt] = useState(null)

  // Vehicle Gas Logs report
  const [vehicleGasPickerOpen, setVehicleGasPickerOpen]         = useState(false)
  const [vehicleGasLogsActive, setVehicleGasLogsActive]         = useState(false)
  const [vehicleGasLogsVehicle, setVehicleGasLogsVehicle]       = useState(null)  // null = all
  const [vehicleGasLogsStart, setVehicleGasLogsStart]           = useState('')
  const [vehicleGasLogsEnd, setVehicleGasLogsEnd]               = useState('')
  const [vehicleGasLogsRows, setVehicleGasLogsRows]             = useState(null)
  const [vehicleGasLogsLoading, setVehicleGasLogsLoading]       = useState(false)
  const [vehicleGasLogsError, setVehicleGasLogsError]           = useState(null)
  const [vehicleGasLogsGeneratedAt, setVehicleGasLogsGeneratedAt] = useState(null)

  useEffect(() => {
    if (!vehicleLogsActive || !vehicleLogsStart || !vehicleLogsEnd) return
    let active = true
    setVehicleLogsLoading(true)
    setVehicleLogsError(null)
    const vid = vehicleLogsVehicle?.vehiclesId
    const url = `/api/reports/vehicle-logs?startDate=${vehicleLogsStart}&endDate=${vehicleLogsEnd}${vid ? `&vehicleId=${vid}` : ''}`
    apiFetch(url)
      .then(r => { if (!r.ok) throw new Error(`Error ${r.status}`); return r.json() })
      .then(data => { if (active) { setVehicleLogsRows(data); setVehicleLogsGeneratedAt(new Date()) } })
      .catch(err => { if (active) setVehicleLogsError(err.message ?? 'Failed to load report.') })
      .finally(() => { if (active) setVehicleLogsLoading(false) })
    return () => { active = false }
  }, [vehicleLogsActive, vehicleLogsStart, vehicleLogsEnd, vehicleLogsVehicle, apiFetch])

  useEffect(() => {
    if (!vehicleGasLogsActive || !vehicleGasLogsStart || !vehicleGasLogsEnd) return
    let active = true
    setVehicleGasLogsLoading(true)
    setVehicleGasLogsError(null)
    const vid = vehicleGasLogsVehicle?.vehiclesId
    const url = `/api/reports/vehicle-gas-logs?startDate=${vehicleGasLogsStart}&endDate=${vehicleGasLogsEnd}${vid ? `&vehicleId=${vid}` : ''}`
    apiFetch(url)
      .then(r => { if (!r.ok) throw new Error(`Error ${r.status}`); return r.json() })
      .then(data => { if (active) { setVehicleGasLogsRows(data); setVehicleGasLogsGeneratedAt(new Date()) } })
      .catch(err => { if (active) setVehicleGasLogsError(err.message ?? 'Failed to load report.') })
      .finally(() => { if (active) setVehicleGasLogsLoading(false) })
    return () => { active = false }
  }, [vehicleGasLogsActive, vehicleGasLogsStart, vehicleGasLogsEnd, vehicleGasLogsVehicle, apiFetch])

  const activeReport = srData ? 'sr' : poData ? 'po' : equipPoData ? 'equip-po' : poSummaryActive ? 'po-summary' : partsActive ? 'parts-summary' : srBillingActive ? 'sr-billing' : vehicleLogsActive ? 'vehicle-logs' : vehicleGasLogsActive ? 'vehicle-gas-logs' : null

  function clearAllReports() { setSrData(null); setPoData(null); setEquipPoData(null); setPoSummaryActive(false); setPartsActive(false); setSrBillingActive(false); setVehicleLogsActive(false); setVehicleGasLogsActive(false) }

  function handleCardClick(key) {
    setError(null)
    if (key === 'individual-sr')       { clearAllReports(); setSrPickerOpen(true) }
    if (key === 'individual-po')       { clearAllReports(); setPoPickerOpen(true) }
    if (key === 'individual-equip-po') { clearAllReports(); setEquipPoPickerOpen(true) }
    if (key === 'po-summary') {
      clearAllReports()
      const today = new Date()
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(today.getDate() - 6)
      setPoSummaryStart(toIso(sevenDaysAgo))
      setPoSummaryEnd(toIso(today))
      setPoSummaryRows(null)
      setPoSummaryError(null)
      setPoSummaryActive(true)
    }
    if (key === 'parts-summary') {
      clearAllReports()
      const today = new Date()
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(today.getDate() - 6)
      setPartsStart(toIso(sevenDaysAgo))
      setPartsEnd(toIso(today))
      setPartsRows(null)
      setPartsError(null)
      setPartsActive(true)
    }
    if (key === 'sr-billing') {
      clearAllReports()
      const today = new Date()
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(today.getDate() - 6)
      setSrBillingStart(toIso(sevenDaysAgo))
      setSrBillingEnd(toIso(today))
      setSrBillingRows(null)
      setSrBillingError(null)
      setSrBillingActive(true)
    }
    if (key === 'vehicle-logs') {
      clearAllReports()
      setVehiclePickerOpen(true)
    }
    if (key === 'vehicle-gas-logs') {
      clearAllReports()
      setVehicleGasPickerOpen(true)
    }
  }

  function handleVehicleGasSelect(vehicle) {
    setVehicleGasPickerOpen(false)
    const today = new Date()
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(today.getDate() - 6)
    setVehicleGasLogsVehicle(vehicle)
    setVehicleGasLogsStart(toIso(sevenDaysAgo))
    setVehicleGasLogsEnd(toIso(today))
    setVehicleGasLogsRows(null)
    setVehicleGasLogsError(null)
    setVehicleGasLogsActive(true)
  }

  function handleVehicleSelect(vehicle) {
    setVehiclePickerOpen(false)
    const today = new Date()
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(today.getDate() - 6)
    setVehicleLogsVehicle(vehicle)
    setVehicleLogsStart(toIso(sevenDaysAgo))
    setVehicleLogsEnd(toIso(today))
    setVehicleLogsRows(null)
    setVehicleLogsError(null)
    setVehicleLogsActive(true)
  }

  function handleBack() { clearAllReports(); setError(null) }

  // ── SR fetch ────────────────────────────────────────────────────────────────
  async function handleSrSelect(sr) {
    setSrPickerOpen(false)
    setLoading(true); setError(null); setSrData(null)
    try {
      const srDetail = await fetchOne(apiFetch, `/api/service-reports/${sr.srNumber}`)
      const projNum = srDetail?.projNum ?? sr.projNum
      const schedId = srDetail?.schedId ?? null

      const [project, schedule, crew, equipment, findings, billingItems, payments, posPage] =
        await Promise.all([
          projNum ? fetchOne(apiFetch, `/api/projects/${projNum}`) : null,
          schedId ? fetchOne(apiFetch, `/api/service-schedules/${schedId}`) : null,
          schedId
            ? apiFetch(`/api/service-assignments/schedule/${schedId}`)
                .then(r => r.ok ? r.json() : []).then(d => Array.isArray(d) ? d : (d.content ?? []))
            : [],
          schedId ? fetchAll(apiFetch, `/api/equipment-usages?schedId=${schedId}`) : [],
          fetchAll(apiFetch, `/api/service-report-findings?srNumber=${sr.srNumber}`),
          fetchAll(apiFetch, `/api/service-report-billing-items?srNumber=${sr.srNumber}&sort=srBillingNum,asc`),
          apiFetch(`/api/payment-logs?srNumber=${sr.srNumber}`)
            .then(r => r.ok ? r.json() : []).then(d => Array.isArray(d) ? d : (d.content ?? [])),
          fetchAll(apiFetch, `/api/purchase-orders?srNum=${sr.srNumber}`),
        ])

      const [engineer, acUnits, posWithParts] = await Promise.all([
        srDetail?.engineerEmployeeId ? fetchOne(apiFetch, `/api/employees/${srDetail.engineerEmployeeId}`) : null,
        projNum ? fetchAll(apiFetch, `/api/ac-units?projNum=${projNum}`) : [],
        Promise.all(posPage.map(async po => {
          const parts = await fetchAll(apiFetch, `/api/parts?poNum=${encodeURIComponent(po.poNum)}`)
          return { ...po, parts }
        })),
      ])

      const acMap = {}
      for (const ac of acUnits) {
        const label = [ac.brand, ac.model].filter(Boolean).join(' ')
        acMap[ac.acNum] = ac.serialNum ? `${label} (${ac.serialNum})` : label || `AC #${ac.acNum}`
      }

      setSrGeneratedAt(new Date())
      setSrData({ sr: srDetail, project, schedule, engineer, crew, findings, acMap, purchaseOrders: posWithParts, billingItems, payments, equipment })
    } catch (err) {
      setError(err.message ?? 'Failed to load report data.')
    } finally {
      setLoading(false)
    }
  }

  // ── PO fetch ────────────────────────────────────────────────────────────────
  async function handlePoSelect({ po, sr, project: selProject }) {
    setPoPickerOpen(false)
    setLoading(true); setError(null); setPoData(null)
    try {
      const [poDetail, srDetail, project, parts, contacts] = await Promise.all([
        fetchOne(apiFetch, `/api/purchase-orders/${encodeURIComponent(po.poNum)}`),
        fetchOne(apiFetch, `/api/service-reports/${sr.srNumber}`),
        fetchOne(apiFetch, `/api/projects/${selProject.projNum}`),
        fetchAll(apiFetch, `/api/parts?poNum=${encodeURIComponent(po.poNum)}`),
        fetchAll(apiFetch, `/api/purchase-order-delivery-contacts?poNum=${encodeURIComponent(po.poNum)}`),
      ])

      setPoGeneratedAt(new Date())
      setPoData({ po: poDetail, sr: srDetail, project, parts, contacts })
    } catch (err) {
      setError(err.message ?? 'Failed to load PO report data.')
    } finally {
      setLoading(false)
    }
  }

  // ── Equipment PO fetch ──────────────────────────────────────────────────────
  async function handleEquipPoSelect(po) {
    setEquipPoPickerOpen(false)
    setLoading(true); setError(null); setEquipPoData(null)
    try {
      const [poDetail, equipment, contacts] = await Promise.all([
        fetchOne(apiFetch, `/api/purchase-orders/${encodeURIComponent(po.poNum)}`),
        fetchAll(apiFetch, `/api/equipment?poNum=${encodeURIComponent(po.poNum)}`),
        fetchAll(apiFetch, `/api/purchase-order-delivery-contacts?poNum=${encodeURIComponent(po.poNum)}`),
      ])
      setEquipPoGeneratedAt(new Date())
      setEquipPoData({ po: poDetail, equipment, contacts })
    } catch (err) {
      setError(err.message ?? 'Failed to load equipment PO report data.')
    } finally {
      setLoading(false)
    }
  }

  // ── Print / Save as PDF ──────────────────────────────────────────────────────
  function handlePrint() { window.print() }

  function openPdfWindow(html, title) {
    const win = window.open('', '_blank')
    win.document.open()
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 600)
  }

  function handleSrSaveAsPdf() {
    if (!srData) return
    const billedTotal = srData.billingItems.reduce((s, i) => s + Number(i.quantity ?? 0) * Number(i.unitPrice ?? 0), 0)
    const paidTotal = srData.payments.reduce((s, p) => s + Number(p.amount ?? 0), 0)
    const balance = billedTotal - paidTotal
    const status = computeStatus(billedTotal, paidTotal)
    const poTotal = srData.purchaseOrders.reduce((s, po) => s + Number(po.totalCost ?? 0), 0)
    openPdfWindow(buildSrPdfHtml(srData, billedTotal, paidTotal, balance, status, poTotal, srGeneratedAt),
      `Service Report No. ${String(srData.sr?.srNumber).padStart(2, '0')} — ${srData.project?.name ?? ''}`)
  }

  function handlePoSaveAsPdf() {
    if (!poData) return
    openPdfWindow(buildPoPdfHtml(poData, poGeneratedAt),
      `Purchase Order ${poData.po?.poNum ?? ''} — ${poData.project?.name ?? ''}`)
  }

  function handleEquipPoSaveAsPdf() {
    if (!equipPoData) return
    openPdfWindow(buildEquipPoPdfHtml(equipPoData, equipPoGeneratedAt),
      `Equipment PO ${equipPoData.po?.poNum ?? ''}`)
  }

  // ── SR computed values ───────────────────────────────────────────────────────
  const srBilledTotal = srData ? srData.billingItems.reduce((s, i) => s + Number(i.quantity ?? 0) * Number(i.unitPrice ?? 0), 0) : 0
  const srPaidTotal = srData ? srData.payments.reduce((s, p) => s + Number(p.amount ?? 0), 0) : 0
  const srBalance = srBilledTotal - srPaidTotal
  const srStatus = srData ? computeStatus(srBilledTotal, srPaidTotal) : '—'
  const srPoTotal = srData ? srData.purchaseOrders.reduce((s, po) => s + Number(po.totalCost ?? 0), 0) : 0

  // ── PO computed values ───────────────────────────────────────────────────────
  const poPartsTotal = poData ? poData.parts.reduce((s, p) => s + Number(p.quantityOrdered ?? 0) * Number(p.unitPrice ?? 0), 0) : 0

  return (
    <Layout activePage="reports">
      <style>{`
        @media print {
          nav, aside, header, .no-print { display: none !important; }
          main { margin: 0 !important; padding: 0 !important; }
          body { background: white !important; }
          #print-area { box-shadow: none !important; border: none !important; }
        }
      `}</style>

      {/* Page controls */}
      <div className="no-print">
        <h1 className="text-3xl font-semibold mb-1">Reports</h1>
        <p className="text-base-content/60 mb-8">Select a report to generate.</p>

        {!activeReport && !loading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {REPORT_NAV_ITEMS.filter(({ roles }) => !roles || hasRole(...roles)).map(({ key, label, icon }) => (
              <button key={key} onClick={() => handleCardClick(key)} className="group text-left">
                <div className="card bg-base-100 border border-base-300 transition-transform duration-300 group-hover:-translate-y-2 h-full">
                  <div className="card-body items-center justify-center text-center gap-3 py-8">
                    <span className={`${icon} size-10 text-primary`}></span>
                    <p className="font-medium text-base-content">{label}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-20">
            <span className="loading loading-spinner loading-lg text-primary"></span>
          </div>
        )}

        {error && (
          <div className="alert alert-error mt-4">
            <span className="icon-[tabler--alert-circle] size-5 shrink-0"></span>
            <span>{error}</span>
          </div>
        )}

        {activeReport === 'po-summary' && (
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <button className="btn btn-soft btn-secondary" onClick={handleBack}>
              <span className="icon-[tabler--arrow-left] size-4"></span>
              Back
            </button>
            {poSummaryRows && poSummaryRows.length > 0 && (
              <>
                <button className="btn btn-primary" onClick={handlePrint}>
                  <span className="icon-[tabler--printer] size-4"></span>
                  Print
                </button>
                <button className="btn btn-soft btn-primary" onClick={() => {
                  if (!poSummaryRows || poSummaryRows.length === 0) return
                  const win = window.open('', '_blank')
                  win.document.open()
                  win.document.write(buildPoSummaryPdfHtml(poSummaryRows, poSummaryStart, poSummaryEnd, poSummaryGeneratedAt))
                  win.document.close()
                  win.focus()
                  setTimeout(() => win.print(), 600)
                }}>
                  <span className="icon-[tabler--file-type-pdf] size-4"></span>
                  Save as PDF
                </button>
              </>
            )}
            <h2 className="text-lg font-semibold ml-1">Purchase Orders Report</h2>
          </div>
        )}

        {activeReport === 'parts-summary' && (
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <button className="btn btn-soft btn-secondary" onClick={handleBack}>
              <span className="icon-[tabler--arrow-left] size-4"></span>
              Back
            </button>
            {partsRows && partsRows.length > 0 && (
              <>
                <button className="btn btn-primary" onClick={handlePrint}>
                  <span className="icon-[tabler--printer] size-4"></span>
                  Print
                </button>
                <button className="btn btn-soft btn-primary" onClick={() => {
                  if (!partsRows || partsRows.length === 0) return
                  const win = window.open('', '_blank')
                  win.document.open()
                  win.document.write(buildPartsSummaryPdfHtml(partsRows, partsStart, partsEnd, partsGeneratedAt))
                  win.document.close()
                  win.focus()
                  setTimeout(() => win.print(), 600)
                }}>
                  <span className="icon-[tabler--file-type-pdf] size-4"></span>
                  Save as PDF
                </button>
              </>
            )}
            <h2 className="text-lg font-semibold ml-1">Parts Report</h2>
          </div>
        )}

        {activeReport === 'sr-billing' && (
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <button className="btn btn-soft btn-secondary" onClick={handleBack}>
              <span className="icon-[tabler--arrow-left] size-4"></span>
              Back
            </button>
            {srBillingRows && srBillingRows.length > 0 && (
              <>
                <button className="btn btn-primary" onClick={handlePrint}>
                  <span className="icon-[tabler--printer] size-4"></span>
                  Print
                </button>
                <button className="btn btn-soft btn-primary" onClick={() => {
                  if (!srBillingRows || srBillingRows.length === 0) return
                  const win = window.open('', '_blank')
                  win.document.open()
                  win.document.write(buildSrBillingPdfHtml(srBillingRows, srBillingStart, srBillingEnd, srBillingGeneratedAt))
                  win.document.close()
                  win.focus()
                  setTimeout(() => win.print(), 600)
                }}>
                  <span className="icon-[tabler--file-type-pdf] size-4"></span>
                  Save as PDF
                </button>
              </>
            )}
            <h2 className="text-lg font-semibold ml-1">Service Report Billing Report</h2>
          </div>
        )}

        {activeReport === 'vehicle-logs' && (
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <button className="btn btn-soft btn-secondary" onClick={handleBack}>
              <span className="icon-[tabler--arrow-left] size-4"></span>
              Back
            </button>
            <button className="btn btn-soft btn-neutral" onClick={() => setVehiclePickerOpen(true)}>
              <span className="icon-[tabler--truck] size-4"></span>
              Change Vehicle
            </button>
            {vehicleLogsRows && vehicleLogsRows.length > 0 && (
              <>
                <button className="btn btn-primary" onClick={handlePrint}>
                  <span className="icon-[tabler--printer] size-4"></span>
                  Print
                </button>
                <button className="btn btn-soft btn-primary" onClick={() => {
                  if (!vehicleLogsRows || vehicleLogsRows.length === 0) return
                  const label = vehicleLogsVehicle
                    ? `${vehicleLogsVehicle.vehicleModel} (${vehicleLogsVehicle.vehiclePlateNum})`
                    : 'All Vehicles'
                  const win = window.open('', '_blank')
                  win.document.open()
                  win.document.write(buildVehicleLogsPdfHtml(vehicleLogsRows, vehicleLogsStart, vehicleLogsEnd, label, vehicleLogsGeneratedAt))
                  win.document.close()
                  win.focus()
                  setTimeout(() => win.print(), 600)
                }}>
                  <span className="icon-[tabler--file-type-pdf] size-4"></span>
                  Save as PDF
                </button>
              </>
            )}
            <h2 className="text-lg font-semibold ml-1">
              Vehicle Logs Report
              {vehicleLogsVehicle && <span className="text-base font-normal text-base-content/50 ml-2">— {vehicleLogsVehicle.vehicleModel} ({vehicleLogsVehicle.vehiclePlateNum})</span>}
            </h2>
          </div>
        )}

        {activeReport === 'vehicle-gas-logs' && (
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <button className="btn btn-soft btn-secondary" onClick={handleBack}>
              <span className="icon-[tabler--arrow-left] size-4"></span>
              Back
            </button>
            {vehicleGasLogsRows && vehicleGasLogsRows.length > 0 && (
              <>
                <button className="btn btn-primary" onClick={handlePrint}>
                  <span className="icon-[tabler--printer] size-4"></span>
                  Print
                </button>
                <button className="btn btn-soft btn-primary" onClick={() => {
                  if (!vehicleGasLogsRows || vehicleGasLogsRows.length === 0) return
                  const label = vehicleGasLogsVehicle
                    ? `${vehicleGasLogsVehicle.vehicleModel} (${vehicleGasLogsVehicle.vehiclePlateNum})`
                    : 'All Vehicles'
                  const win = window.open('', '_blank')
                  win.document.open()
                  win.document.write(buildVehicleGasLogsPdfHtml(vehicleGasLogsRows, vehicleGasLogsStart, vehicleGasLogsEnd, label, vehicleGasLogsGeneratedAt))
                  win.document.close()
                  win.focus()
                  setTimeout(() => win.print(), 600)
                }}>
                  <span className="icon-[tabler--file-type-pdf] size-4"></span>
                  Save as PDF
                </button>
              </>
            )}
            <h2 className="text-lg font-semibold ml-1">
              Vehicle Gas Logs Report
              {vehicleGasLogsVehicle && <span className="text-base font-normal text-base-content/50 ml-2">— {vehicleGasLogsVehicle.vehicleModel} ({vehicleGasLogsVehicle.vehiclePlateNum})</span>}
            </h2>
          </div>
        )}

        {activeReport && activeReport !== 'po-summary' && activeReport !== 'parts-summary' && activeReport !== 'sr-billing' && activeReport !== 'vehicle-logs' && activeReport !== 'vehicle-gas-logs' && (
          <div className="flex items-center gap-3 mb-6 flex-wrap">
            <button className="btn btn-soft btn-secondary" onClick={handleBack}>
              <span className="icon-[tabler--arrow-left] size-4"></span>
              Back
            </button>
            <button className="btn btn-primary" onClick={handlePrint}>
              <span className="icon-[tabler--printer] size-4"></span>
              Print
            </button>
            <button className="btn btn-soft btn-primary" onClick={
              activeReport === 'sr' ? handleSrSaveAsPdf :
              activeReport === 'po' ? handlePoSaveAsPdf :
              handleEquipPoSaveAsPdf
            }>
              <span className="icon-[tabler--file-type-pdf] size-4"></span>
              Save as PDF
            </button>
            <span className="text-sm text-base-content/50 ml-1">
              {activeReport === 'sr'
                ? `Service Report No. ${String(srData.sr?.srNumber).padStart(2, '0')} — ${srData.project?.name}`
                : activeReport === 'po'
                ? `PO ${poData.po?.poNum} — ${poData.project?.name}`
                : `Equipment PO ${equipPoData.po?.poNum}`}
            </span>
          </div>
        )}
      </div>

      {/* ─── SR Report ─── */}
      {srData && (
        <div id="print-area" className="bg-white text-gray-900 rounded-xl border border-gray-200 shadow-md p-10 max-w-4xl mx-auto font-sans">
          <div className="text-center border-b-2 border-gray-800 pb-4 mb-2">
            <h1 className="text-xl font-bold uppercase tracking-widest text-gray-900">EASI — Project Service Report</h1>
            <h2 className="text-base font-semibold mt-1 text-gray-800">Service Report No. {String(srData.sr?.srNumber).padStart(2, '0')}</h2>
            <p className="text-sm text-gray-600 mt-0.5">{srData.project?.name ?? '—'}</p>
            <p className="text-xs text-gray-400 mt-1">Generated: {fmtDateTime(srGeneratedAt)}</p>
          </div>

          <SectionTitle>1. Project Information</SectionTitle>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 mb-2">
            <KVRow label="Name" value={srData.project?.name} />
            <KVRow label="Type" value={srData.project?.type} />
            <KVRow label="Address" value={srData.project?.address} />
            <KVRow label="Warranty Date" value={fmtDateLong(srData.project?.warrantyDate)} />
            <KVRow label="Contact Person" value={srData.project?.contactName} />
            <KVRow label="Contact Number" value={srData.project?.contactNumber} />
          </div>

          <SectionTitle>2. Schedule Information</SectionTitle>
          {srData.schedule ? (
            <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 mb-2">
              <KVRow label="Date" value={fmtDateLong(srData.schedule.date)} />
              <KVRow label="Purpose" value={srData.schedule.purpose} />
            </div>
          ) : <p className="text-sm text-gray-400 italic mb-2">No schedule linked.</p>}

          <SectionTitle>3. Service Report</SectionTitle>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 mb-2">
            <KVRow label="Location" value={srData.sr?.location || srData.project?.address} />
            <KVRow label="Engineer" value={srData.engineer ? `Engr. ${srData.engineer.firstName} ${srData.engineer.lastName}` : null} />
          </div>
          <div className="text-sm mb-1"><span className="font-semibold text-gray-700">Complaint: </span><span className="text-gray-900">{srData.sr?.complaint ?? '—'}</span></div>
          <div className="text-sm mb-2"><span className="font-semibold text-gray-700">Work Done: </span><span className="text-gray-900">{srData.sr?.workDone ?? '—'}</span></div>

          <SectionTitle>4. Crew Members</SectionTitle>
          {srData.crew.length === 0
            ? <p className="text-sm text-gray-400 italic mb-2">No crew assigned.</p>
            : <ReportTable head={[{ label: 'ID', width: '60px' }, { label: 'Employee Name' }]}>
                {srData.crew.map(c => (
                  <tr key={c.servAssgnId} className="even:bg-gray-50">
                    <Td>{c.employeeId}</Td>
                    <Td>{c.lastName}, {c.firstName}</Td>
                  </tr>
                ))}
              </ReportTable>}

          <SectionTitle>5. Findings</SectionTitle>
          {srData.findings.length === 0
            ? <p className="text-sm text-gray-400 italic mb-2">No findings recorded.</p>
            : <ReportTable head={[{ label: 'No.', width: '40px' }, { label: 'Type', width: '90px' }, 'Part / Model', 'AC Unit', 'Remarks']}>
                {srData.findings.map((f, i) => (
                  <tr key={f.srFindingsNumber} className="even:bg-gray-50">
                    <Td>{i + 1}</Td>
                    <Td>{toSentenceCase(f.findingType)}</Td>
                    <Td>{f.partModel}</Td>
                    <Td>{f.acNum != null ? (srData.acMap[f.acNum] ?? `AC #${f.acNum}`) : null}</Td>
                    <Td>{f.remarks}</Td>
                  </tr>
                ))}
              </ReportTable>}

          <SectionTitle>6. Purchase Orders &amp; Parts</SectionTitle>
          {srData.purchaseOrders.length === 0
            ? <p className="text-sm text-gray-400 italic mb-2">No purchase orders linked.</p>
            : <>
                {srData.purchaseOrders.map((po, pi) => (
                  <div key={po.poNum} className="mb-4">
                    <p className="text-sm font-semibold text-gray-800 mb-1">
                      PO {pi + 1}: {po.poNum} — {po.purpose ?? '—'}
                      <span className="font-normal text-gray-500 ml-2">Terms: {po.terms ?? '—'} | Payment: {toSentenceCase(po.paymentMethod)}</span>
                    </p>
                    {po.parts.length === 0
                      ? <p className="text-xs text-gray-400 italic ml-2 mb-2">No parts in this PO.</p>
                      : <ReportTable
                          head={['Part ID', 'Name', 'Qty', 'Unit', 'Unit Price', 'Status', 'Supplier', 'Subtotal']}
                          foot={<tr className="bg-gray-100"><td colSpan={7} className="border border-gray-300 px-3 py-1 text-right font-semibold text-gray-700">PO Total</td><td className="border border-gray-300 px-3 py-1 text-right font-semibold">{fmtCurrency(po.totalCost)}</td></tr>}
                        >
                          {po.parts.map(p => (
                            <tr key={p.partId} className="even:bg-gray-50">
                              <Td>{p.partId}</Td><Td>{p.name}</Td><Td>{p.quantityOrdered}</Td>
                              <Td>{p.quantityType}</Td><Td right>{fmtCurrency(p.unitPrice)}</Td>
                              <Td>{toSentenceCase(p.status)}</Td><Td>{p.supplierName}</Td>
                              <Td right>{fmtCurrency(Number(p.quantityOrdered) * Number(p.unitPrice ?? 0))}</Td>
                            </tr>
                          ))}
                        </ReportTable>}
                  </div>
                ))}
                <p className="text-sm font-bold text-right text-gray-900 mb-2">Grand Total (All POs): {fmtCurrency(srPoTotal)}</p>
              </>}

          <SectionTitle>7. Billing &amp; Cost Computation</SectionTitle>
          {srData.billingItems.length === 0
            ? <p className="text-sm text-gray-400 italic mb-2">No billing items.</p>
            : <ReportTable
                head={[{ label: 'No.', width: '40px' }, 'Description', 'Qty', 'Unit Price', 'Amount']}
                foot={<tr className="bg-gray-100"><td colSpan={4} className="border border-gray-300 px-3 py-1 text-right font-semibold text-gray-700">Total Billed</td><td className="border border-gray-300 px-3 py-1 text-right font-semibold">{fmtCurrency(srBilledTotal)}</td></tr>}
              >
                {srData.billingItems.map((b, i) => (
                  <tr key={b.srBillingNum} className="even:bg-gray-50">
                    <Td>{i + 1}</Td><Td>{b.description}</Td><Td>{b.quantity}</Td>
                    <Td right>{fmtCurrency(b.unitPrice)}</Td>
                    <Td right>{fmtCurrency(Number(b.quantity) * Number(b.unitPrice ?? 0))}</Td>
                  </tr>
                ))}
              </ReportTable>}

          <p className="text-sm font-semibold text-gray-700 mt-3 mb-1">Payments Received</p>
          {srData.payments.length === 0
            ? <p className="text-sm text-gray-400 italic mb-2">No payments recorded.</p>
            : <ReportTable head={['Payment #', 'Paid By', 'Method', 'Receipt #', 'Receipt Date', 'Amount']}>
                {srData.payments.map(p => (
                  <tr key={p.logId} className="even:bg-gray-50">
                    <Td>{p.logId}</Td><Td>{p.paidBy}</Td><Td>{formatPaymentMethod(p.paymentMethod)}</Td>
                    <Td>{p.receiptNumber}</Td><Td>{fmtDateLong(p.receiptDate)}</Td><Td right>{fmtCurrency(p.amount)}</Td>
                  </tr>
                ))}
              </ReportTable>}

          <table className="border-collapse text-sm ml-auto mt-2 mb-2" style={{ minWidth: 280 }}>
            <tbody>
              <tr><td className="py-0.5 pr-6 text-right font-semibold text-gray-700">Total Billed:</td><td className="py-0.5 text-gray-900">{fmtCurrency(srBilledTotal)}</td></tr>
              <tr><td className="py-0.5 pr-6 text-right font-semibold text-gray-700">Total Paid:</td><td className="py-0.5 text-gray-900">{fmtCurrency(srPaidTotal)}</td></tr>
              <tr className="border-t border-gray-300">
                <td className="pt-1 pr-6 text-right font-semibold text-gray-700">Balance:</td>
                <td className={`pt-1 font-bold ${srBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>{fmtCurrency(srBalance)}</td>
              </tr>
              <tr><td className="py-0.5 pr-6 text-right font-semibold text-gray-700">Payment Status:</td><td className="py-0.5 font-bold text-gray-900">{srStatus}</td></tr>
            </tbody>
          </table>

          <SectionTitle>8. Equipment Used</SectionTitle>
          {srData.equipment.length === 0
            ? <p className="text-sm text-gray-400 italic mb-2">No equipment deployed.</p>
            : <ReportTable head={[{ label: 'No.', width: '40px' }, 'Equipment ID', 'Name', 'Type', 'Notes']}>
                {srData.equipment.map((e, i) => (
                  <tr key={e.usageId} className="even:bg-gray-50">
                    <Td>{i + 1}</Td><Td>{e.equipmentId}</Td><Td>{e.equipmentName}</Td>
                    <Td>{toSentenceCase(e.equipmentType)}</Td><Td>{e.notes}</Td>
                  </tr>
                ))}
              </ReportTable>}

          <div className="text-center text-xs text-gray-400 mt-8 border-t border-gray-200 pt-3">
            EASI System &nbsp;—&nbsp; Printed {fmtDateTime(srGeneratedAt)} &nbsp;—&nbsp; Service Report No. {String(srData.sr?.srNumber).padStart(2, '0')}
          </div>
        </div>
      )}

      {/* ─── PO Report ─── */}
      {poData && (
        <div id="print-area" className="bg-white text-gray-900 rounded-xl border border-gray-200 shadow-md p-10 max-w-4xl mx-auto font-sans">
          <div className="text-center border-b-2 border-gray-800 pb-4 mb-2">
            <h1 className="text-xl font-bold uppercase tracking-widest text-gray-900">EASI — Purchase Order</h1>
            <h2 className="text-base font-semibold mt-1 text-gray-800 font-mono">{poData.po?.poNum ?? '—'}</h2>
            <p className="text-sm text-gray-600 mt-0.5">{poData.project?.name ?? '—'}</p>
            <p className="text-xs text-gray-400 mt-1">Generated: {fmtDateTime(poGeneratedAt)}</p>
          </div>

          <SectionTitle>1. Project Information</SectionTitle>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 mb-2">
            <KVRow label="Name" value={poData.project?.name} />
            <KVRow label="Type" value={poData.project?.type} />
            <KVRow label="Address" value={poData.project?.address} />
            <KVRow label="Contact Person" value={poData.project?.contactName} />
            <KVRow label="Contact Number" value={poData.project?.contactNumber} />
          </div>

          <SectionTitle>2. Service Report Reference</SectionTitle>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 mb-2">
            <KVRow label="SR No." value={poData.sr?.srNumber != null ? String(poData.sr.srNumber).padStart(2, '0') : null} />
            <KVRow label="Location" value={poData.sr?.location || poData.project?.address} />
          </div>
          <div className="text-sm mb-2">
            <span className="font-semibold text-gray-700">Complaint: </span>
            <span className="text-gray-900">{poData.sr?.complaint ?? '—'}</span>
          </div>

          <SectionTitle>3. Purchase Order Details</SectionTitle>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 mb-2">
            <KVRow label="PO Number" value={poData.po?.poNum} />
            <KVRow label="Date" value={fmtDateLong(poData.po?.addedOn)} />
            <KVRow label="Purpose" value={poData.po?.purpose} />
            <KVRow label="Terms" value={poData.po?.terms} />
            <KVRow label="Payment Method" value={toSentenceCase(poData.po?.paymentMethod)} />
            <KVRow label="Payment Details" value={poData.po?.paymentDetails} />
          </div>
          <div className="text-sm mb-1"><span className="font-semibold text-gray-700">Delivery Address: </span><span className="text-gray-900">{poData.po?.deliveryAddress ?? '—'}</span></div>
          <div className="text-sm mb-2"><span className="font-semibold text-gray-700">Remarks: </span><span className="text-gray-900">{poData.po?.remarks ?? '—'}</span></div>

          <SectionTitle>4. Delivery Contacts</SectionTitle>
          {poData.contacts.length === 0
            ? <p className="text-sm text-gray-400 italic mb-2">No delivery contacts listed.</p>
            : <ReportTable head={['Contact Name', 'Contact Number']}>
                {poData.contacts.map(c => (
                  <tr key={c.poContactNum} className="even:bg-gray-50">
                    <Td>{c.contactName}</Td>
                    <Td>{c.contactNumber}</Td>
                  </tr>
                ))}
              </ReportTable>}

          <SectionTitle>5. Parts / Items</SectionTitle>
          {poData.parts.length === 0
            ? <p className="text-sm text-gray-400 italic mb-2">No parts in this purchase order.</p>
            : <ReportTable
                head={['Part ID', 'Name', 'Qty', 'Unit', 'Unit Price', 'Status', 'Supplier', 'Subtotal']}
                foot={
                  <tr className="bg-gray-100">
                    <td colSpan={7} className="border border-gray-300 px-3 py-1 text-right font-semibold text-gray-700">Total</td>
                    <td className="border border-gray-300 px-3 py-1 text-right font-semibold text-gray-900">{fmtCurrency(poData.po?.totalCost ?? poPartsTotal)}</td>
                  </tr>
                }
              >
                {poData.parts.map(p => (
                  <tr key={p.partId} className="even:bg-gray-50">
                    <Td>{p.partId}</Td><Td>{p.name}</Td><Td>{p.quantityOrdered}</Td>
                    <Td>{p.quantityType}</Td><Td right>{fmtCurrency(p.unitPrice)}</Td>
                    <Td>{toSentenceCase(p.status)}</Td><Td>{p.supplierName}</Td>
                    <Td right>{fmtCurrency(Number(p.quantityOrdered) * Number(p.unitPrice ?? 0))}</Td>
                  </tr>
                ))}
              </ReportTable>}

          <div className="text-center text-xs text-gray-400 mt-8 border-t border-gray-200 pt-3">
            EASI System &nbsp;—&nbsp; Printed {fmtDateTime(poGeneratedAt)} &nbsp;—&nbsp; PO {poData.po?.poNum}
          </div>
        </div>
      )}

      {/* ─── Equipment PO Report ─── */}
      {equipPoData && (
        <div id="print-area" className="bg-white text-gray-900 rounded-xl border border-gray-200 shadow-md p-10 max-w-4xl mx-auto font-sans">
          <div className="text-center border-b-2 border-gray-800 pb-4 mb-2">
            <h1 className="text-xl font-bold uppercase tracking-widest text-gray-900">EASI — Purchase Order (Equipment)</h1>
            <h2 className="text-base font-semibold mt-1 text-gray-800 font-mono">{equipPoData.po?.poNum ?? '—'}</h2>
            <p className="text-xs text-gray-400 mt-1">Generated: {fmtDateTime(equipPoGeneratedAt)}</p>
          </div>

          <SectionTitle>1. Purchase Order Details</SectionTitle>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 mb-2">
            <KVRow label="PO Number"       value={equipPoData.po?.poNum} />
            <KVRow label="Date"            value={fmtDateLong(equipPoData.po?.addedOn)} />
            <KVRow label="Purpose"         value={equipPoData.po?.purpose} />
            <KVRow label="Terms"           value={equipPoData.po?.terms} />
            <KVRow label="Payment Method"  value={toSentenceCase(equipPoData.po?.paymentMethod)} />
            <KVRow label="Payment Details" value={equipPoData.po?.paymentDetails} />
          </div>
          <div className="text-sm mb-1"><span className="font-semibold text-gray-700">Delivery Address: </span><span className="text-gray-900">{equipPoData.po?.deliveryAddress ?? '—'}</span></div>
          <div className="text-sm mb-2"><span className="font-semibold text-gray-700">Remarks: </span><span className="text-gray-900">{equipPoData.po?.remarks ?? '—'}</span></div>

          <SectionTitle>2. Delivery Contacts</SectionTitle>
          {equipPoData.contacts.length === 0
            ? <p className="text-sm text-gray-400 italic mb-2">No delivery contacts listed.</p>
            : <ReportTable head={['Contact Name', 'Contact Number']}>
                {equipPoData.contacts.map(c => (
                  <tr key={c.poContactNum} className="even:bg-gray-50">
                    <Td>{c.contactName}</Td>
                    <Td>{c.contactNumber}</Td>
                  </tr>
                ))}
              </ReportTable>}

          <SectionTitle>3. Equipment Items</SectionTitle>
          {equipPoData.equipment.length === 0
            ? <p className="text-sm text-gray-400 italic mb-2">No equipment in this purchase order.</p>
            : (() => {
                const totalAcq = equipPoData.equipment.reduce((s, e) => s + Number(e.acquisitionCost ?? 0), 0)
                return (
                  <ReportTable
                    head={[
                      { label: 'No.', width: '40px' }, { label: 'ID', width: '50px' },
                      'Name', 'Type', 'Model', 'Serial #', 'Stock', 'Acquisition Cost',
                    ]}
                    foot={
                      <tr className="bg-gray-100">
                        <td colSpan={7} className="border border-gray-300 px-3 py-1 text-right font-semibold text-gray-700">Total Acquisition Cost</td>
                        <td className="border border-gray-300 px-3 py-1 text-right font-semibold text-gray-900">{fmtCurrency(totalAcq)}</td>
                      </tr>
                    }
                  >
                    {equipPoData.equipment.map((e, i) => (
                      <tr key={e.equipmentId} className="even:bg-gray-50">
                        <Td>{i + 1}</Td>
                        <Td>{e.equipmentId}</Td>
                        <Td>{e.name}</Td>
                        <Td>{toSentenceCase(e.type)}</Td>
                        <Td>{e.model}</Td>
                        <Td>{e.serialNumber}</Td>
                        <Td>{e.stock}</Td>
                        <Td right>{fmtCurrency(e.acquisitionCost)}</Td>
                      </tr>
                    ))}
                  </ReportTable>
                )
              })()}

          <div className="text-center text-xs text-gray-400 mt-8 border-t border-gray-200 pt-3">
            EASI System &nbsp;—&nbsp; Printed {fmtDateTime(equipPoGeneratedAt)} &nbsp;—&nbsp; PO {equipPoData.po?.poNum}
          </div>
        </div>
      )}

      {/* ─── Purchase Orders Summary Report ─── */}
      {poSummaryActive && (
        <>
          <DateRangeBar
            startDate={poSummaryStart}
            endDate={poSummaryEnd}
            onRange={(s, e) => { setPoSummaryStart(s); setPoSummaryEnd(e) }}
          />

          {poSummaryLoading && (
            <div className="flex justify-center py-16">
              <span className="loading loading-spinner loading-lg text-primary"></span>
            </div>
          )}

          {!poSummaryLoading && poSummaryError && (
            <div className="alert alert-error mt-2 no-print">
              <span className="icon-[tabler--alert-circle] size-5 shrink-0"></span>
              <span>{poSummaryError}</span>
            </div>
          )}

          {!poSummaryLoading && poSummaryRows && poSummaryRows.length === 0 && (
            <p className="text-center text-base-content/50 py-16 no-print">
              No data found for the selected filters.
            </p>
          )}

          {!poSummaryLoading && poSummaryRows && poSummaryRows.length > 0 && (() => {
            const totalCost = poSummaryRows.reduce((s, r) => s + Number(r.total ?? 0), 0)
            const fmtShort  = iso => iso
              ? new Date(iso + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
              : '—'

            return (
              <div id="print-area" className="bg-white text-gray-900 rounded-xl border border-gray-200 shadow-md p-10 max-w-5xl mx-auto font-sans">
                {/* Report header */}
                <div className="text-center border-b-2 border-gray-800 pb-4 mb-4">
                  <h1 className="text-xl font-bold uppercase tracking-widest text-gray-900">EASI — Purchase Orders Report</h1>
                  <p className="text-sm text-gray-600 mt-1">
                    Date Range: {fmtShort(poSummaryStart)} &mdash; {fmtShort(poSummaryEnd)}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Generated: {fmtDateTime(poSummaryGeneratedAt)}</p>
                </div>

                {/* Summary dashboard */}
                <div className="grid grid-cols-2 gap-4 mb-8 no-print">
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-center">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Total Purchase Orders</p>
                    <p className="text-3xl font-bold text-gray-900">{poSummaryRows.length}</p>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-center">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Total Cost</p>
                    <p className="text-3xl font-bold text-gray-900">{fmtCurrency(totalCost)}</p>
                  </div>
                </div>
                {/* Print-only compact summary */}
                <div className="hidden print:flex gap-8 mb-4 text-sm">
                  <div><span className="font-semibold text-gray-700">Total Purchase Orders:</span> {poSummaryRows.length}</div>
                  <div><span className="font-semibold text-gray-700">Total Cost:</span> {fmtCurrency(totalCost)}</div>
                </div>

                <SectionTitle>Purchase Orders</SectionTitle>
                <ReportTable
                  head={['PO No.', 'SR No.', 'Project Name', 'Terms', 'Type', 'Total', 'Added On']}
                  foot={
                    <tr className="bg-gray-100">
                      <td colSpan={5} className="border border-gray-300 px-3 py-1 text-right font-semibold text-gray-700">Grand Total</td>
                      <td className="border border-gray-300 px-3 py-1 text-right font-semibold text-gray-900">{fmtCurrency(totalCost)}</td>
                      <td className="border border-gray-300 px-3 py-1" />
                    </tr>
                  }
                >
                  {poSummaryRows.map(r => (
                    <tr key={r.poNum} className="even:bg-gray-50">
                      <Td><span className="font-mono">{r.poNum}</span></Td>
                      <Td>{r.srNumber != null ? String(r.srNumber).padStart(2, '0') : null}</Td>
                      <Td>{r.projectName}</Td>
                      <Td>{r.terms}</Td>
                      <Td>{r.type === 'parts' ? 'Parts' : 'Equipment'}</Td>
                      <Td right>{fmtCurrency(r.total)}</Td>
                      <Td>{fmtDateLong(r.addedOn)}</Td>
                    </tr>
                  ))}
                </ReportTable>

                <div className="text-center text-xs text-gray-400 mt-8 border-t border-gray-200 pt-3">
                  EASI System &nbsp;—&nbsp; Printed {fmtDateTime(poSummaryGeneratedAt)} &nbsp;—&nbsp; Purchase Orders Report
                </div>
              </div>
            )
          })()}
        </>
      )}

      {/* ─── Parts Report ─── */}
      {partsActive && (
        <>
          <DateRangeBar
            startDate={partsStart}
            endDate={partsEnd}
            onRange={(s, e) => { setPartsStart(s); setPartsEnd(e) }}
          />

          {partsLoading && (
            <div className="flex justify-center py-16">
              <span className="loading loading-spinner loading-lg text-primary"></span>
            </div>
          )}

          {!partsLoading && partsError && (
            <div className="alert alert-error mt-2 no-print">
              <span className="icon-[tabler--alert-circle] size-5 shrink-0"></span>
              <span>{partsError}</span>
            </div>
          )}

          {!partsLoading && partsRows && partsRows.length === 0 && (
            <p className="text-center text-base-content/50 py-16 no-print">
              No data found for the selected filters.
            </p>
          )}

          {!partsLoading && partsRows && partsRows.length > 0 && (() => {
            const totalParts    = partsRows.length
            const totalQty      = partsRows.reduce((s, r) => s + (r.quantityOrdered ?? 0), 0)
            const totalUsed     = partsRows.reduce((s, r) => s + (r.quantityUsed ?? 0), 0)
            const totalCost     = partsRows.reduce((s, r) => s + Number(r.total ?? 0), 0)

            const fmtShort = iso => iso
              ? new Date(iso + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
              : '—'

            // Status pie data
            const STATUS_COLORS = { ordered: '#6366f1', delivered: '#22c55e', used: '#94a3b8' }
            const statusCounts = partsRows.reduce((m, r) => {
              const k = r.status ?? 'unknown'
              m[k] = (m[k] ?? 0) + 1
              return m
            }, {})
            const PALETTE = ['#6366f1','#22c55e','#f59e0b','#ef4444','#06b6d4','#a855f7','#ec4899','#84cc16']
            const statusData = Object.entries(statusCounts).map(([label, value]) => ({
              label: label.charAt(0).toUpperCase() + label.slice(1),
              value,
              color: STATUS_COLORS[label] ?? '#94a3b8',
            }))

            // Supplier pie data
            const supplierCounts = partsRows.reduce((m, r) => {
              const k = r.supplierName ?? 'Unknown'
              m[k] = (m[k] ?? 0) + 1
              return m
            }, {})
            const supplierData = Object.entries(supplierCounts).map(([label, value], i) => ({
              label, value, color: PALETTE[i % PALETTE.length],
            }))

            return (
              <div id="print-area" className="bg-white text-gray-900 rounded-xl border border-gray-200 shadow-md p-10 max-w-5xl mx-auto font-sans">
                {/* Report header */}
                <div className="text-center border-b-2 border-gray-800 pb-4 mb-4">
                  <h1 className="text-xl font-bold uppercase tracking-widest text-gray-900">EASI — Parts Report</h1>
                  <p className="text-sm text-gray-600 mt-1">
                    Date Range: {fmtShort(partsStart)} &mdash; {fmtShort(partsEnd)}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Generated: {fmtDateTime(partsGeneratedAt)}</p>
                </div>

                {/* Summary dashboard (screen only) */}
                <div className="grid grid-cols-3 gap-4 mb-6 no-print">
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-center">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Total Parts</p>
                    <p className="text-3xl font-bold text-gray-900">{totalParts}</p>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-center">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Used / Total (Units)</p>
                    <p className="text-2xl font-bold text-gray-900">{totalUsed} <span className="text-gray-400 font-normal text-lg">/ {totalQty}</span></p>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-center">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Total Cost</p>
                    <p className="text-2xl font-bold text-gray-900">{fmtCurrency(totalCost)}</p>
                  </div>
                </div>

                {/* Pie charts (screen only) */}
                <div className="grid grid-cols-2 gap-6 mb-8 no-print">
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3 text-center">By Status</p>
                    <PieChart data={statusData} size={160} />
                    <PieInterpretation data={statusData} />
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3 text-center">By Supplier</p>
                    <PieChart data={supplierData} size={160} />
                    <PieInterpretation data={supplierData} />
                  </div>
                </div>

                {/* Print-only compact summary */}
                <div className="hidden print:flex gap-8 mb-4 text-sm">
                  <div><span className="font-semibold text-gray-700">Total Parts:</span> {totalParts}</div>
                  <div><span className="font-semibold text-gray-700">Used / Total Units:</span> {totalUsed} / {totalQty}</div>
                  <div><span className="font-semibold text-gray-700">Total Cost:</span> {fmtCurrency(totalCost)}</div>
                </div>

                <SectionTitle>Parts</SectionTitle>
                <ReportTable
                  head={['ID', 'Name', 'Supplier', 'Quantity', 'Qty Used', 'Unit Price', 'Total']}
                  foot={
                    <tr className="bg-gray-100">
                      <td colSpan={6} className="border border-gray-300 px-3 py-1 text-right font-semibold text-gray-700">Grand Total</td>
                      <td className="border border-gray-300 px-3 py-1 text-right font-semibold text-gray-900">{fmtCurrency(totalCost)}</td>
                    </tr>
                  }
                >
                  {partsRows.map(r => (
                    <tr key={r.partId} className="even:bg-gray-50">
                      <Td><span className="font-mono">{r.partId}</span></Td>
                      <Td>{r.name}</Td>
                      <Td>{r.supplierName}</Td>
                      <Td>{r.quantityOrdered != null ? `${r.quantityOrdered} ${r.quantityType ?? ''}`.trim() : '—'}</Td>
                      <Td right>{r.quantityUsed ?? 0}</Td>
                      <Td right>{fmtCurrency(r.unitPrice)}</Td>
                      <Td right>{fmtCurrency(r.total)}</Td>
                    </tr>
                  ))}
                </ReportTable>

                <div className="text-center text-xs text-gray-400 mt-8 border-t border-gray-200 pt-3">
                  EASI System &nbsp;—&nbsp; Printed {fmtDateTime(partsGeneratedAt)} &nbsp;—&nbsp; Parts Report
                </div>
              </div>
            )
          })()}
        </>
      )}

      {/* ─── SR Billing Report ─── */}
      {srBillingActive && (
        <>
          <DateRangeBar
            startDate={srBillingStart}
            endDate={srBillingEnd}
            onRange={(s, e) => { setSrBillingStart(s); setSrBillingEnd(e) }}
          />

          {srBillingLoading && (
            <div className="flex justify-center py-16">
              <span className="loading loading-spinner loading-lg text-primary"></span>
            </div>
          )}

          {!srBillingLoading && srBillingError && (
            <div className="alert alert-error mt-2 no-print">
              <span className="icon-[tabler--alert-circle] size-5 shrink-0"></span>
              <span>{srBillingError}</span>
            </div>
          )}

          {!srBillingLoading && srBillingRows && srBillingRows.length === 0 && (
            <p className="text-center text-base-content/50 py-16 no-print">
              No data found for the selected filters.
            </p>
          )}

          {!srBillingLoading && srBillingRows && srBillingRows.length > 0 && (() => {
            const grandBilled   = srBillingRows.reduce((s, r) => s + Number(r.subtotalBilledCost ?? 0), 0)
            const grandPayments = srBillingRows.reduce((s, r) => s + Number(r.totalPayments ?? 0), 0)
            const grandBalance  = srBillingRows.reduce((s, r) => s + Number(r.balance ?? 0), 0)
            const fmtShort = iso => iso
              ? new Date(iso + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
              : '—'

            // Payment status pie chart data
            let paid = 0, partial = 0, unpaid = 0
            srBillingRows.forEach(r => {
              const bal    = Number(r.balance ?? 0)
              const billed = Number(r.subtotalBilledCost ?? 0)
              if (bal === 0)                    paid++
              else if (bal > 0 && bal < billed) partial++
              else                               unpaid++
            })
            const statusData = [
              { label: 'Paid',           value: paid,    color: '#22c55e' },
              { label: 'Partially Paid', value: partial, color: '#f59e0b' },
              { label: 'Unpaid',         value: unpaid,  color: '#ef4444' },
            ].filter(d => d.value > 0)

            return (
              <div id="print-area" className="bg-white text-gray-900 rounded-xl border border-gray-200 shadow-md p-10 max-w-5xl mx-auto font-sans">
                {/* Report header */}
                <div className="text-center border-b-2 border-gray-800 pb-4 mb-4">
                  <h1 className="text-xl font-bold uppercase tracking-widest text-gray-900">EASI — Service Report Billing Report</h1>
                  <p className="text-sm text-gray-600 mt-1">
                    Date Range: {fmtShort(srBillingStart)} &mdash; {fmtShort(srBillingEnd)}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Generated: {fmtDateTime(srBillingGeneratedAt)}</p>
                </div>

                {/* Summary dashboard (screen only) */}
                <div className="grid grid-cols-4 gap-4 mb-6 no-print">
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-center">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Total Billed Amount</p>
                    <p className="text-2xl font-bold text-gray-900">{fmtCurrency(grandBilled)}</p>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-center">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Total Payments</p>
                    <p className="text-2xl font-bold text-green-700">{fmtCurrency(grandPayments)}</p>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-center">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Total Balance</p>
                    <p className={`text-2xl font-bold ${grandBalance > 0 ? 'text-red-600' : 'text-green-700'}`}>{fmtCurrency(grandBalance)}</p>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-center">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Service Reports</p>
                    <p className="text-3xl font-bold text-gray-900">{srBillingRows.length}</p>
                  </div>
                </div>

                {/* Payment status pie chart (screen only) */}
                <div className="mb-8 no-print">
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 max-w-xs">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3 text-center">Payment Status</p>
                    <PieChart data={statusData} size={160} />
                    <PieInterpretation data={statusData} />
                  </div>
                </div>

                {/* Print-only compact summary */}
                <div className="hidden print:flex gap-8 mb-4 text-sm">
                  <div><span className="font-semibold text-gray-700">Total Billed:</span> {fmtCurrency(grandBilled)}</div>
                  <div><span className="font-semibold text-gray-700">Total Payments:</span> {fmtCurrency(grandPayments)}</div>
                  <div><span className="font-semibold text-gray-700">Total Balance:</span> {fmtCurrency(grandBalance)}</div>
                </div>

                <SectionTitle>Billing Details</SectionTitle>
                <ReportTable
                  head={['SR No.', 'Date', 'Services & Labor', 'Parts Cost', 'Subtotal Billed', 'Total Payments', 'Balance']}
                  foot={
                    <tr className="bg-gray-100">
                      <td className="border border-gray-300 px-3 py-1 font-semibold text-gray-700 text-right">Totals</td>
                      <td className="border border-gray-300 px-3 py-1" />
                      <td className="border border-gray-300 px-3 py-1" />
                      <td className="border border-gray-300 px-3 py-1" />
                      <td className="border border-gray-300 px-3 py-1 text-right font-semibold text-gray-900">{fmtCurrency(grandBilled)}</td>
                      <td className="border border-gray-300 px-3 py-1 text-right font-semibold text-gray-900">{fmtCurrency(grandPayments)}</td>
                      <td className="border border-gray-300 px-3 py-1 text-right font-semibold text-gray-900">{fmtCurrency(grandBalance)}</td>
                    </tr>
                  }
                >
                  {srBillingRows.map(r => (
                    <tr key={r.srNumber} className="even:bg-gray-50">
                      <Td>{String(r.srNumber).padStart(2, '0')}</Td>
                      <Td>{fmtDateLong(r.serviceDate)}</Td>
                      <Td right>{fmtCurrency(r.servicesAndLaborCost)}</Td>
                      <Td right>{fmtCurrency(r.partsTotalCost)}</Td>
                      <Td right bold>{fmtCurrency(r.subtotalBilledCost)}</Td>
                      <Td right>{fmtCurrency(r.totalPayments)}</Td>
                      <Td right>
                        <span className={Number(r.balance) > 0 ? 'text-red-600 font-semibold' : 'text-green-700 font-semibold'}>
                          {fmtCurrency(r.balance)}
                        </span>
                      </Td>
                    </tr>
                  ))}
                </ReportTable>

                <div className="text-center text-xs text-gray-400 mt-8 border-t border-gray-200 pt-3">
                  EASI System &nbsp;—&nbsp; Printed {fmtDateTime(srBillingGeneratedAt)} &nbsp;—&nbsp; Service Report Billing Report
                </div>
              </div>
            )
          })()}
        </>
      )}

      {/* ─── Vehicle Logs Report ─── */}
      {vehicleLogsActive && (
        <>
          <DateRangeBar
            startDate={vehicleLogsStart}
            endDate={vehicleLogsEnd}
            onRange={(s, e) => { setVehicleLogsStart(s); setVehicleLogsEnd(e) }}
          />

          {vehicleLogsLoading && (
            <div className="flex justify-center py-16">
              <span className="loading loading-spinner loading-lg text-primary"></span>
            </div>
          )}

          {!vehicleLogsLoading && vehicleLogsError && (
            <div className="alert alert-error mt-2 no-print">
              <span className="icon-[tabler--alert-circle] size-5 shrink-0"></span>
              <span>{vehicleLogsError}</span>
            </div>
          )}

          {!vehicleLogsLoading && vehicleLogsRows && vehicleLogsRows.length === 0 && (
            <p className="text-center text-base-content/50 py-16 no-print">
              No data found for the selected filters.
            </p>
          )}

          {!vehicleLogsLoading && vehicleLogsRows && vehicleLogsRows.length > 0 && (() => {
            const uniqueVehicles = new Set(vehicleLogsRows.map(r => r.plateNumber)).size
            const totalMileage   = vehicleLogsRows.reduce((s, r) => s + (r.distance ?? 0), 0)
            const vehicleLabel   = vehicleLogsVehicle
              ? `${vehicleLogsVehicle.vehicleModel} (${vehicleLogsVehicle.vehiclePlateNum})`
              : 'All Vehicles'
            const fmtShort = iso => iso
              ? new Date(iso + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
              : '—'

            return (
              <div id="print-area" className="bg-white text-gray-900 rounded-xl border border-gray-200 shadow-md p-10 max-w-5xl mx-auto font-sans">
                {/* Report header */}
                <div className="text-center border-b-2 border-gray-800 pb-4 mb-4">
                  <h1 className="text-xl font-bold uppercase tracking-widest text-gray-900">EASI — Vehicle Logs Report</h1>
                  <p className="text-sm text-gray-600 mt-1">
                    {vehicleLabel} &nbsp;|&nbsp; Date Range: {fmtShort(vehicleLogsStart)} &mdash; {fmtShort(vehicleLogsEnd)}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Generated: {fmtDateTime(vehicleLogsGeneratedAt)}</p>
                </div>

                {/* Summary dashboard */}
                <div className="grid grid-cols-3 gap-4 mb-8 no-print">
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-center">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Total Vehicles</p>
                    <p className="text-3xl font-bold text-gray-900">{uniqueVehicles}</p>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-center">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Total Logs</p>
                    <p className="text-3xl font-bold text-gray-900">{vehicleLogsRows.length}</p>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-center">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Total Mileage</p>
                    <p className="text-3xl font-bold text-gray-900">{totalMileage} <span className="text-lg font-normal text-gray-500">km</span></p>
                  </div>
                </div>
                {/* Print-only compact summary */}
                <div className="hidden print:flex gap-8 mb-4 text-sm">
                  <div><span className="font-semibold text-gray-700">Total Vehicles:</span> {uniqueVehicles}</div>
                  <div><span className="font-semibold text-gray-700">Total Logs:</span> {vehicleLogsRows.length}</div>
                  <div><span className="font-semibold text-gray-700">Total Mileage:</span> {totalMileage} km</div>
                </div>

                <SectionTitle>Vehicle Logs</SectionTitle>
                <ReportTable
                  head={['Vehicle', 'Plate Number', 'Odometer Reading', 'Distance', 'Date']}
                  foot={
                    <tr className="bg-gray-100">
                      <td colSpan={3} className="border border-gray-300 px-3 py-1 text-right font-semibold text-gray-700">Total Mileage</td>
                      <td className="border border-gray-300 px-3 py-1 text-right font-semibold text-gray-900">{totalMileage} km</td>
                      <td className="border border-gray-300 px-3 py-1" />
                    </tr>
                  }
                >
                  {vehicleLogsRows.map(r => (
                    <tr key={r.vehicleLogId} className="even:bg-gray-50">
                      <Td>{r.vehicleModel}</Td>
                      <Td><span className="font-mono">{r.plateNumber}</span></Td>
                      <Td>
                        {r.odometerEnd != null
                          ? `${r.odometerStart}km — ${r.odometerEnd}km`
                          : <span>{r.odometerStart}km — <span className="text-gray-400 italic">in progress</span></span>}
                      </Td>
                      <Td right>{r.distance != null ? `${r.distance} km` : null}</Td>
                      <Td>{fmtDateLong(r.addedOn)}</Td>
                    </tr>
                  ))}
                </ReportTable>

                <div className="text-center text-xs text-gray-400 mt-8 border-t border-gray-200 pt-3">
                  EASI System &nbsp;—&nbsp; Printed {fmtDateTime(vehicleLogsGeneratedAt)} &nbsp;—&nbsp; Vehicle Logs Report
                </div>
              </div>
            )
          })()}
        </>
      )}

      {/* ─── Vehicle Gas Logs Report ─── */}
      {vehicleGasLogsActive && (
        <>
          <DateRangeBar
            startDate={vehicleGasLogsStart}
            endDate={vehicleGasLogsEnd}
            onRange={(s, e) => { setVehicleGasLogsStart(s); setVehicleGasLogsEnd(e) }}
          />

          {vehicleGasLogsLoading && (
            <div className="flex justify-center py-16">
              <span className="loading loading-spinner loading-lg text-primary"></span>
            </div>
          )}

          {!vehicleGasLogsLoading && vehicleGasLogsError && (
            <div className="alert alert-error mt-2 no-print">
              <span className="icon-[tabler--alert-circle] size-5 shrink-0"></span>
              <span>{vehicleGasLogsError}</span>
            </div>
          )}

          {!vehicleGasLogsLoading && vehicleGasLogsRows && vehicleGasLogsRows.length === 0 && (
            <p className="text-center text-base-content/50 py-16 no-print">
              No data found for the selected filters.
            </p>
          )}

          {!vehicleGasLogsLoading && vehicleGasLogsRows && vehicleGasLogsRows.length > 0 && (() => {
            const uniqueVehicles = new Set(vehicleGasLogsRows.map(r => r.plateNumber)).size
            const totalCost      = vehicleGasLogsRows.reduce((s, r) => s + Number(r.amount ?? 0), 0)
            const vehicleLabel   = vehicleGasLogsVehicle
              ? `${vehicleGasLogsVehicle.vehicleModel} (${vehicleGasLogsVehicle.vehiclePlateNum})`
              : 'All Vehicles'
            const fmtShort = iso => iso
              ? new Date(iso + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
              : '—'

            return (
              <div id="print-area" className="bg-white text-gray-900 rounded-xl border border-gray-200 shadow-md p-10 max-w-5xl mx-auto font-sans">
                {/* Report header */}
                <div className="text-center border-b-2 border-gray-800 pb-4 mb-4">
                  <h1 className="text-xl font-bold uppercase tracking-widest text-gray-900">EASI — Vehicle Gas Logs Report</h1>
                  <p className="text-sm text-gray-600 mt-1">
                    {vehicleLabel} &nbsp;|&nbsp; Date Range: {fmtShort(vehicleGasLogsStart)} &mdash; {fmtShort(vehicleGasLogsEnd)}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Generated: {fmtDateTime(vehicleGasLogsGeneratedAt)}</p>
                </div>

                {/* Summary dashboard */}
                <div className="grid grid-cols-3 gap-4 mb-8 no-print">
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-center">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Total Vehicles</p>
                    <p className="text-3xl font-bold text-gray-900">{uniqueVehicles}</p>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-center">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Total Logs</p>
                    <p className="text-3xl font-bold text-gray-900">{vehicleGasLogsRows.length}</p>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-center">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Total Cost</p>
                    <p className="text-2xl font-bold text-gray-900">{fmtCurrency(totalCost)}</p>
                  </div>
                </div>
                {/* Print-only compact summary */}
                <div className="hidden print:flex gap-8 mb-4 text-sm">
                  <div><span className="font-semibold text-gray-700">Total Vehicles:</span> {uniqueVehicles}</div>
                  <div><span className="font-semibold text-gray-700">Total Logs:</span> {vehicleGasLogsRows.length}</div>
                  <div><span className="font-semibold text-gray-700">Total Cost:</span> {fmtCurrency(totalCost)}</div>
                </div>

                <SectionTitle>Gas Logs</SectionTitle>
                <ReportTable
                  head={['Vehicle', 'Plate Number', 'Invoice ID', 'Amount', 'Date']}
                  foot={
                    <tr className="bg-gray-100">
                      <td colSpan={3} className="border border-gray-300 px-3 py-1 text-right font-semibold text-gray-700">Total Cost</td>
                      <td className="border border-gray-300 px-3 py-1 text-right font-semibold text-gray-900">{fmtCurrency(totalCost)}</td>
                      <td className="border border-gray-300 px-3 py-1" />
                    </tr>
                  }
                >
                  {vehicleGasLogsRows.map(r => (
                    <tr key={r.gasLogId} className="even:bg-gray-50">
                      <Td>{r.vehicleModel}</Td>
                      <Td><span className="font-mono">{r.plateNumber}</span></Td>
                      <Td><span className="font-mono">{r.invoiceId}</span></Td>
                      <Td right>{fmtCurrency(r.amount)}</Td>
                      <Td>{fmtDateLong(r.addedOn)}</Td>
                    </tr>
                  ))}
                </ReportTable>

                <div className="text-center text-xs text-gray-400 mt-8 border-t border-gray-200 pt-3">
                  EASI System &nbsp;—&nbsp; Printed {fmtDateTime(vehicleGasLogsGeneratedAt)} &nbsp;—&nbsp; Vehicle Gas Logs Report
                </div>
              </div>
            )
          })()}
        </>
      )}

      {/* Pickers */}
      <ServiceReportPickerModal isOpen={srPickerOpen} onClose={() => setSrPickerOpen(false)} onSelect={handleSrSelect} />
      <POPickerModal isOpen={poPickerOpen} onClose={() => setPoPickerOpen(false)} onSelect={handlePoSelect} />
      <EquipPOPickerModal isOpen={equipPoPickerOpen} onClose={() => setEquipPoPickerOpen(false)} onSelect={handleEquipPoSelect} />
      <VehiclePickerModal isOpen={vehiclePickerOpen} onClose={() => setVehiclePickerOpen(false)} onSelect={handleVehicleSelect} />
      <VehiclePickerModal isOpen={vehicleGasPickerOpen} onClose={() => setVehicleGasPickerOpen(false)} onSelect={handleVehicleGasSelect} />
    </Layout>
  )
}
