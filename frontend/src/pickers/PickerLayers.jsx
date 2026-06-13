import { useModal } from '../modals/index.js'
import AnySchedulePickerModal from './AnySchedulePickerModal'
import EmployeePickerModal from './EmployeePickerModal'

/** Layer component that pushes a schedule picker onto the modal stack. */
export function SchedulePickerLayer({ onSelect }) {
  const { popModal } = useModal()
  return (
    <AnySchedulePickerModal
      asLayer
      isOpen
      onClose={popModal}
      onSelect={s => { popModal(); onSelect(s) }}
    />
  )
}

/** Layer component that pushes a Crew employee picker onto the modal stack. */
export function DriverPickerLayer({ onSelect }) {
  const { popModal } = useModal()
  return (
    <EmployeePickerModal
      asLayer
      isOpen
      position="Crew"
      onClose={popModal}
      onSelect={e => { popModal(); onSelect(e) }}
    />
  )
}
