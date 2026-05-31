import { useState, useEffect, useMemo } from 'react'
import { useAuth } from './auth'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** Returns Tailwind bg color for a calendar dot based on schedule status */
export function statusDotColor(status) {
  const map = { pending: 'bg-warning', confirmed: 'bg-info', completed: 'bg-success', cancelled: 'bg-error' }
  return map[status?.toLowerCase()] ?? 'bg-neutral'
}

/** Default cell content: a small colored dot per schedule, dots only */
function DefaultCellSchedules({ dayScheds }) {
  return (
    <div className="flex flex-col gap-0.5">
      {dayScheds.slice(0, 3).map(s => (
        <div key={s.schedId} className="flex items-center gap-1 px-0.5">
          <span className={`size-1.5 rounded-full shrink-0 ${statusDotColor(s.status)}`}></span>
        </div>
      ))}
      {dayScheds.length > 3 && (
        <p className="text-xs text-base-content/40 px-0.5">+{dayScheds.length - 3}</p>
      )}
    </div>
  )
}

/**
 * Reusable monthly calendar panel that fetches and displays schedule dots.
 *
 * Props:
 * - selectedDate: string|null — highlighted date (yyyy-MM-dd)
 * - onDateSelect: (dateStr) => void — called when a day cell is clicked
 * - projNum: number|null — optional project scope for the calendar fetch
 * - fillHeight: boolean — stretches the card and grid to fill the parent container
 * - renderCellSchedules: (dayScheds, dateStr) => ReactNode — custom cell content renderer
 * - showSelectedIndicator: boolean — show a selected-date label below the legend
 * - conflict: boolean — show a conflict badge inside the selected-date indicator
 * - disabledDates: Set<string>|null — dates that cannot be selected (fully booked)
 * - onMonthChange: (year, month) => void — called when the visible month changes
 */
export default function CalendarPanel({
  selectedDate = null,
  onDateSelect,
  projNum = null,
  fillHeight = false,
  renderCellSchedules = null,
  showSelectedIndicator = false,
  conflict = false,
  disabledDates = null,
  onMonthChange = null,
}) {
  const { apiFetch } = useAuth()
  const today = new Date()
  const [calYear, setCalYear] = useState(today.getFullYear())
  const [calMonth, setCalMonth] = useState(today.getMonth())
  const [calSchedules, setCalSchedules] = useState([])
  const [calLoading, setCalLoading] = useState(false)

  /** Fetches schedules for the currently viewed month */
  useEffect(() => {
    let cancelled = false
    async function fetchCal() {
      setCalLoading(true)
      try {
        const dateFrom = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-01`
        const lastDay = new Date(calYear, calMonth + 1, 0).getDate()
        const dateTo = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
        const params = new URLSearchParams({ dateFrom, dateTo })
        if (projNum) params.set('projNum', String(projNum))
        const res = await apiFetch(`/api/service-schedules/calendar?${params}`)
        if (!res.ok || cancelled) return
        const data = await res.json()
        if (!cancelled) setCalSchedules(data)
      } catch (_) {
      } finally {
        if (!cancelled) setCalLoading(false)
      }
    }
    fetchCal()
    return () => { cancelled = true }
  }, [apiFetch, calYear, calMonth, projNum])

  /** Syncs the visible month to match the selected date when it changes externally */
  useEffect(() => {
    if (!selectedDate) return
    const [y, m] = selectedDate.split('-')
    setCalYear(Number(y))
    setCalMonth(Number(m) - 1)
  }, [selectedDate])

  const calDays = useMemo(() => {
    const firstDay = new Date(calYear, calMonth, 1).getDay()
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
    const cells = []
    for (let i = 0; i < firstDay; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)
    return cells
  }, [calYear, calMonth])

  const schedByDate = useMemo(() => {
    const map = {}
    for (const s of calSchedules) {
      if (!map[s.date]) map[s.date] = []
      map[s.date].push(s)
    }
    return map
  }, [calSchedules])

  function prevMonth() {
    const newMonth = calMonth === 0 ? 11 : calMonth - 1
    const newYear = calMonth === 0 ? calYear - 1 : calYear
    setCalMonth(newMonth)
    setCalYear(newYear)
    onMonthChange?.(newYear, newMonth)
  }
  function nextMonth() {
    const newMonth = calMonth === 11 ? 0 : calMonth + 1
    const newYear = calMonth === 11 ? calYear + 1 : calYear
    setCalMonth(newMonth)
    setCalYear(newYear)
    onMonthChange?.(newYear, newMonth)
  }
  function dateStr(day) {
    return `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  return (
    <div className={`card bg-base-100 border border-base-300${fillHeight ? ' h-full overflow-hidden' : ''}`}>
      <div className={`card-body p-4 flex flex-col${fillHeight ? ' h-full overflow-hidden' : ''}`}>

        {/* Month navigation */}
        <div className="flex items-center justify-between mb-3">
          <button className="btn btn-secondary btn-sm btn-square" onClick={prevMonth}>
            <span className="icon-[tabler--chevron-left] size-4"></span>
          </button>
          <h2 className="font-semibold text-base">{MONTH_NAMES[calMonth]} {calYear}</h2>
          <button className="btn btn-secondary btn-sm btn-square" onClick={nextMonth}>
            <span className="icon-[tabler--chevron-right] size-4"></span>
          </button>
        </div>

        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAYS.map(d => (
            <div key={d} className="text-center text-xs font-medium text-base-content/50 py-1">{d}</div>
          ))}
        </div>

        {/* Day cells */}
        <div className={`grid grid-cols-7 gap-px bg-base-300 border border-base-300 rounded-box overflow-hidden transition-opacity${fillHeight ? ' flex-1 auto-rows-fr' : ''}${calLoading ? ' opacity-50' : ''}`}>
          {calDays.map((day, idx) => {
            const ds = day ? dateStr(day) : null
            const dayScheds = ds ? (schedByDate[ds] ?? []) : []
            const isToday = day && calYear === today.getFullYear() && calMonth === today.getMonth() && day === today.getDate()
            const isSelected = ds && ds === selectedDate
            const isDisabled = disabledDates != null && ds != null && disabledDates.has(ds)

            return (
              <div
                key={idx}
                className={`bg-base-100 p-1.5 transition-colors${fillHeight ? '' : ' min-h-16'}
                  ${day && !isDisabled ? ' cursor-pointer hover:bg-base-200' : ''}
                  ${day && isDisabled ? ' cursor-not-allowed bg-error/5 opacity-60' : ''}
                  ${isSelected ? ' ring-2 ring-primary ring-inset' : ''}`}
                title={isDisabled ? 'No crew available — all crew are assigned on this day' : undefined}
                onClick={() => day && !isDisabled && onDateSelect?.(ds)}
              >
                {day && (
                  <>
                    <div className={`text-xs font-medium mb-1 w-5 h-5 flex items-center justify-center rounded-full
                      ${isToday ? 'bg-primary text-primary-content' : 'text-base-content/70'}`}>
                      {day}
                    </div>
                    {renderCellSchedules
                      ? renderCellSchedules(dayScheds, ds)
                      : <DefaultCellSchedules dayScheds={dayScheds} />
                    }
                  </>
                )}
              </div>
            )
          })}
        </div>

        {/* Status legend */}
        <div className="flex items-center gap-4 mt-3 flex-wrap">
          {['pending', 'confirmed', 'completed', 'cancelled'].map(s => (
            <div key={s} className="flex items-center gap-1.5">
              <span className={`size-2 rounded-full ${statusDotColor(s)}`}></span>
              <span className="text-xs text-base-content/60 capitalize">{s}</span>
            </div>
          ))}
          {disabledDates != null && (
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-error/50"></span>
              <span className="text-xs text-base-content/60">No crew available</span>
            </div>
          )}
        </div>

        {/* Optional selected date indicator */}
        {showSelectedIndicator && selectedDate && (
          <div className="mt-3 px-3 py-2 rounded-lg bg-base-200 text-sm flex items-center gap-2">
            <span className="icon-[tabler--calendar-check] size-4 text-primary shrink-0"></span>
            <span>Selected: <span className="font-medium">{selectedDate}</span></span>
            {conflict && (
              <span className="badge badge-soft badge-error badge-xs ml-auto">Conflict</span>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
