import { Notyf } from 'notyf'

// Lazy singleton — created on first use so DOM is guaranteed to be ready
let _instance = null

function getInstance() {
  if (!_instance) {
    _instance = new Notyf({
      duration: 3000,
      position: { x: 'right', y: 'top' },
      types: [
        {
          type: 'primary',
          background: 'var(--color-primary)',
          icon: { className: 'icon-[tabler--circle-check] !text-primary', tagName: 'i' },
          text: '',
          color: 'white',
        },
        
        {
          type: 'success',
          background: 'var(--color-success)',
          icon: { className: 'icon-[tabler--circle-check] !text-primary', tagName: 'i' },
          text: '',
          color: 'white',
        },
        {
          type: 'danger',
          background: 'var(--color-error)',
          icon: { className: 'icon-[tabler--alert-circle]', tagName: 'i' },
          text: '',
          color: 'white',
        },
      ],
    })
  }
  return _instance
}

/** Show a success toast */
export function notyfSuccess(message) {
  getInstance().open({ type: 'success', message, duration: 3000, ripple: true, dismissible: true,
      position: {
        x: 'right',
        y: 'bottom'
      }, })
}

/** Show an error toast */
export function notyfError(message) {
  getInstance().open({ type: 'danger', message, duration: 4000, ripple: true, dismissible: true,
      position: {
        x: 'right',
        y: 'bottom'
      }, })
}
