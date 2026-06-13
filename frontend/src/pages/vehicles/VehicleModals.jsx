import { useState } from 'react'
import { useAuth } from '../../auth'
import { useModal } from '../../modals/index.js'
import { notyfSuccess, notyfError } from '../../notyf'

async function parseApiError(res) {
  const data = await res.json().catch(() => ({}))
  if (data.errors) return data.errors
  return { _general: data.message ?? data.error ?? `Error ${res.status}` }
}

/**
 * Modal for adding a new vehicle.
 * Pushed from the Vehicles page header button.
 */
export function NewVehicleModal({ onSuccess }) {
  const { popModal } = useModal()
  const { apiFetch } = useAuth()
  const [form, setForm] = useState({ vehicleModel: '', vehiclePlateNum: '' })
  const [formError, setFormError] = useState({})
  const [submitting, setSubmitting] = useState(false)

  function handleChange(e) {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  }

  /** Submits the new vehicle and closes on success. */
  async function handleSubmit(e) {
    e.preventDefault()
    setFormError({})
    setSubmitting(true)
    try {
      const res = await apiFetch('/api/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        setFormError(await parseApiError(res))
        notyfError('Add failed')
        return
      }
      const data = await res.json().catch(() => ({}))
      popModal()
      setTimeout(() => notyfSuccess(`Vehicle "${data.vehicleModel}" added successfully.`), 150)
      onSuccess?.()
    } catch (err) {
      setFormError({ _general: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-content w-full max-w-md my-auto">
      <div className="modal-header">
        <h3 className="modal-title">New Vehicle</h3>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body">
        <form id="new-vehicle-form" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Vehicle Model <span className="text-error">*</span></label>
              <input type="text" name="vehicleModel" maxLength={30} required
                className={`input input-bordered w-full${formError.vehicleModel ? ' is-invalid' : ''}`}
                placeholder="e.g. Toyota HiAce"
                value={form.vehicleModel} onChange={handleChange} />
              {formError.vehicleModel && <span className="helper-text">{formError.vehicleModel}</span>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Plate Number <span className="text-error">*</span></label>
              <input type="text" name="vehiclePlateNum" maxLength={12} required
                className={`input input-bordered w-full${formError.vehiclePlateNum ? ' is-invalid' : ''}`}
                placeholder="e.g. AAA 1234"
                value={form.vehiclePlateNum} onChange={handleChange} />
              {formError.vehiclePlateNum && <span className="helper-text">{formError.vehiclePlateNum}</span>}
            </div>
            {formError._general && (
              <div className="alert alert-error py-2">
                <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                <span className="text-sm">{formError._general}</span>
              </div>
            )}
          </div>
        </form>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-soft btn-secondary" onClick={popModal}>Cancel</button>
        <button type="submit" form="new-vehicle-form" className="btn btn-primary" disabled={submitting}>
          {submitting
            ? <span className="loading loading-spinner loading-sm"></span>
            : <span className="icon-[tabler--plus] size-4"></span>
          }
          Add Vehicle
        </button>
      </div>
    </div>
  )
}

/**
 * Modal for updating an existing vehicle's model and plate number.
 * Pushed from the vehicle card's "Update Vehicle Info" button.
 */
export function UpdateVehicleModal({ vehicle, onSuccess }) {
  const { popModal } = useModal()
  const { apiFetch } = useAuth()
  const [form, setForm] = useState({
    vehicleModel:    vehicle.vehicleModel,
    vehiclePlateNum: vehicle.vehiclePlateNum,
  })
  const [formError, setFormError] = useState({})
  const [submitting, setSubmitting] = useState(false)

  function handleChange(e) {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  }

  /** Submits the vehicle update and closes on success. */
  async function handleSubmit(e) {
    e.preventDefault()
    setFormError({})
    setSubmitting(true)
    try {
      const res = await apiFetch(`/api/vehicles/${vehicle.vehiclesId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        setFormError(await parseApiError(res))
        notyfError('Update failed')
        return
      }
      const data = await res.json().catch(() => ({}))
      popModal()
      setTimeout(() => notyfSuccess(`Vehicle "${data.vehicleModel}" updated successfully.`), 150)
      onSuccess?.()
    } catch (err) {
      setFormError({ _general: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-content w-full max-w-md my-auto">
      <div className="modal-header">
        <h3 className="modal-title">Update Vehicle</h3>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body">
        <form id="update-vehicle-form" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Vehicle Model <span className="text-error">*</span></label>
              <input type="text" name="vehicleModel" maxLength={30} required
                className={`input input-bordered w-full${formError.vehicleModel ? ' is-invalid' : ''}`}
                placeholder="e.g. Toyota HiAce"
                value={form.vehicleModel} onChange={handleChange} />
              {formError.vehicleModel && <span className="helper-text">{formError.vehicleModel}</span>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Plate Number <span className="text-error">*</span></label>
              <input type="text" name="vehiclePlateNum" maxLength={12} required
                className={`input input-bordered w-full${formError.vehiclePlateNum ? ' is-invalid' : ''}`}
                placeholder="e.g. AAA 1234"
                value={form.vehiclePlateNum} onChange={handleChange} />
              {formError.vehiclePlateNum && <span className="helper-text">{formError.vehiclePlateNum}</span>}
            </div>
            {formError._general && (
              <div className="alert alert-error py-2">
                <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                <span className="text-sm">{formError._general}</span>
              </div>
            )}
          </div>
        </form>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-soft btn-secondary" onClick={popModal}>Cancel</button>
        <button type="submit" form="update-vehicle-form" className="btn btn-primary" disabled={submitting}>
          {submitting
            ? <span className="loading loading-spinner loading-sm"></span>
            : <span className="icon-[tabler--device-floppy] size-4"></span>
          }
          Save Changes
        </button>
      </div>
    </div>
  )
}
