import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from './auth'
import { useModal } from './modals/index.js'
import Layout from './Layout'
import ModalNav from './modals/ModalNav.jsx'
import AnySchedulePickerModal from './AnySchedulePickerModal'
import PickerInput from './PickerInput'
import ProjectPickerModal from './ProjectPickerModal'
import { notyfSuccess, notyfError } from './notyf'


async function parseApiError(res) {
  const data = await res.json().catch(() => ({}))
  if (data.errors) return data.errors
  return { _general: data.message ?? data.error ?? `Error ${res.status}` }
}

function formatDate(dt) {
  if (!dt) return '—'
  return String(dt).slice(0, 10)
}

function formatCurrency(value) {
  if (value == null) return '—'
  return Number(value).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })
}

function statusBadge(status) {
  if (status === 'active')            return 'badge-success'
  if (status === 'under_maintenance') return 'badge-warning'
  if (status === 'retired')           return 'badge-neutral'
  if (status === 'depleted')          return 'badge-error'
  return 'badge-neutral'
}

function typeBadge(type) {
  return type === 'durable' ? 'badge-info' : 'badge-warning'
}

const PAGE_SIZE = 10

const EQUIPMENT_MENU_ITEMS = [
  { key: 'update',     label: 'Update Details', icon: 'icon-[tabler--pencil]',          roles: ['ADMIN', 'STAFF'] },
  { key: 'log-deploy', label: 'Log Deployment', icon: 'icon-[tabler--calendar-plus]',   roles: ['ADMIN', 'STAFF'] },
]

const ACCEPTED_TYPES      = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
const ACCEPTED_EXTENSIONS = '.jpg,.jpeg,.png,.gif,.webp,.pdf'

const EMPTY_FORM = {
  name: '', type: 'durable', model: '', serialNumber: '', description: '',
  status: 'active', stock: '1', acquisitionCost: '', poNum: '',
}
const EMPTY_DEPLOY_FORM = { schedId: '', notes: '' }
const EMPTY_PO_FORM = {
  purpose: '', terms: '', deliveryAddress: '', remarks: '',
  paymentMethod: '', ewalletType: '', paymentDetails: '',
}
const EMPTY_EQUIP_ITEM = {
  name: '', type: 'durable', model: '', serialNumber: '', description: '',
  stock: '1', acquisitionCost: '',
}
const EMPTY_DOC_FORM = { invoiceId: '', file: null }

const ADD_STEPS = [
  { number: 1, label: 'Purchase Order' },
  { number: 2, label: 'Add Equipment' },
  { number: 3, label: 'PO Documents' },
]

// ---------------------------------------------------------------------------
// Picker layer component
// ---------------------------------------------------------------------------

/** Picker layer: Schedule — used as a modal stack layer */
function SchedPickerLayer({ onSelect }) {
  const { popModal } = useModal()
  return (
    <AnySchedulePickerModal
      asLayer={true}
      isOpen={true}
      onClose={popModal}
      onSelect={s => { onSelect(s); popModal() }}
    />
  )
}

// ---------------------------------------------------------------------------
// Shared form fields
// ---------------------------------------------------------------------------

/** Equipment form fields reused in Add wizard and Update modal */
function EquipmentFormFields({ form, onChange, errors, showStatus = true }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

      <div className="sm:col-span-2 flex flex-col gap-1">
        <label className="label-text font-medium">Name <span className="text-error">*</span></label>
        <input type="text" name="name" maxLength={150} required
          className={`input input-bordered w-full${errors.name ? ' is-invalid' : ''}`}
          placeholder="e.g. Industrial Vacuum Pump"
          value={form.name} onChange={onChange} />
        {errors.name && <span className="helper-text">{errors.name}</span>}
      </div>

      <div className="flex flex-col gap-1">
        <label className="label-text font-medium">Type <span className="text-error">*</span></label>
        <select name="type"
          className={`select select-bordered w-full${errors.type ? ' is-invalid' : ''}`}
          value={form.type} onChange={onChange}>
          <option value="durable">durable</option>
          <option value="consumable">consumable</option>
        </select>
        {errors.type && <span className="helper-text">{errors.type}</span>}
      </div>

      {showStatus && (
        <div className="flex flex-col gap-1">
          <label className="label-text font-medium">Status <span className="text-error">*</span></label>
          <select name="status"
            className={`select select-bordered w-full${errors.status ? ' is-invalid' : ''}`}
            value={form.status} onChange={onChange}>
            <option value="active">active</option>
            <option value="under_maintenance">under_maintenance</option>
            <option value="retired">retired</option>
            <option value="depleted">depleted</option>
          </select>
          {errors.status && <span className="helper-text">{errors.status}</span>}
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label className="label-text font-medium">Model</label>
        <input type="text" name="model" maxLength={100}
          className={`input input-bordered w-full${errors.model ? ' is-invalid' : ''}`}
          placeholder="e.g. VP-300X"
          value={form.model} onChange={onChange} />
        {errors.model && <span className="helper-text">{errors.model}</span>}
      </div>

      <div className="flex flex-col gap-1">
        <label className="label-text font-medium">Serial Number</label>
        <input type="text" name="serialNumber" maxLength={100}
          className={`input input-bordered w-full${errors.serialNumber ? ' is-invalid' : ''}`}
          placeholder="e.g. SN-20240501-001"
          value={form.serialNumber} onChange={onChange} />
        {errors.serialNumber && <span className="helper-text">{errors.serialNumber}</span>}
      </div>

      <div className="flex flex-col gap-1">
        <label className="label-text font-medium">Stock <span className="text-error">*</span></label>
        <input type="number" name="stock" min={0} required
          className={`input input-bordered w-full${errors.stock ? ' is-invalid' : ''}`}
          placeholder="1"
          value={form.stock} onChange={onChange} />
        {errors.stock && <span className="helper-text">{errors.stock}</span>}
      </div>

      <div className="flex flex-col gap-1">
        <label className="label-text font-medium">Acquisition Cost</label>
        <input type="number" name="acquisitionCost" min={0} step="0.01"
          className={`input input-bordered w-full${errors.acquisitionCost ? ' is-invalid' : ''}`}
          placeholder="e.g. 12500.00"
          value={form.acquisitionCost} onChange={onChange} />
        {errors.acquisitionCost && <span className="helper-text">{errors.acquisitionCost}</span>}
      </div>

      <div className="sm:col-span-2 flex flex-col gap-1">
        <label className="label-text font-medium">Description</label>
        <textarea name="description" maxLength={500} rows={2}
          className={`textarea textarea-bordered w-full${errors.description ? ' is-invalid' : ''}`}
          placeholder="Brief description of the equipment"
          value={form.description} onChange={onChange} />
        {errors.description && <span className="helper-text">{errors.description}</span>}
      </div>

      <div className="flex flex-col gap-1">
        <label className="label-text font-medium">PO Number <span className="text-base-content/40 font-normal">(optional)</span></label>
        <input type="text" name="poNum" maxLength={30}
          className={`input input-bordered w-full${errors.poNum ? ' is-invalid' : ''}`}
          placeholder="e.g. PO-2024-001"
          value={form.poNum} onChange={onChange} />
        {errors.poNum && <span className="helper-text">{errors.poNum}</span>}
      </div>

      {errors._general && (
        <div className="sm:col-span-2 alert alert-error py-2">
          <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
          <span className="text-sm">{errors._general}</span>
        </div>
      )}
    </div>
  )
}

/** Single labeled cell in the details grid */
function DetailItem({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-base-content/50 uppercase tracking-wide">{label}</span>
      <span className="text-sm font-medium text-base-content">{value ?? '—'}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Modal components
// ---------------------------------------------------------------------------

/** Layer 3 — edit an existing deployment record */
function EditDeploymentModal({ deployment, onSuccess }) {
  const { popModal, pushModal } = useModal()
  const { apiFetch } = useAuth()
  const [form, setForm] = useState({ schedId: deployment.schedId, notes: deployment.notes ?? '' })
  const [formError, setFormError] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [schedDisplay, setSchedDisplay] = useState(`Sched #${deployment.schedId} — ${deployment.schedDate ?? ''}`)

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError({})
    setSubmitting(true)
    try {
      const res = await apiFetch(`/api/equipment-usages/${deployment.usageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schedId: Number(form.schedId),
          notes:   form.notes || null,
        }),
      })
      if (!res.ok) { setFormError(await parseApiError(res)); notyfError('Update failed'); return }
      notyfSuccess(`Deployment #${deployment.usageId} updated.`)
      popModal()
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
        <div>
          <h3 className="modal-title">Edit Deployment #{deployment.usageId}</h3>
          <span className="text-sm text-base-content/50">{deployment.equipmentName}</span>
        </div>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body">
        <form id="equip-edit-deploy-form" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4">

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Service Schedule <span className="text-error">*</span></label>
              <div className="flex gap-2">
                <input type="text" readOnly
                  className={`input input-bordered flex-1${formError.schedId ? ' is-invalid' : ''}`}
                  placeholder="No schedule selected"
                  value={schedDisplay} />
                <button type="button" className="btn btn-soft btn-secondary shrink-0"
                  onClick={() => pushModal(<SchedPickerLayer onSelect={s => {
                    setForm(prev => ({ ...prev, schedId: s.schedId }))
                    setSchedDisplay(`Sched #${s.schedId} — ${s.date ?? ''} · ${s.purpose ?? ''}`)
                  }} />)}>
                  Pick
                </button>
              </div>
              {formError.schedId && <span className="helper-text">{formError.schedId}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Notes <span className="text-base-content/40 font-normal">(optional)</span></label>
              <input type="text" maxLength={255}
                className={`input input-bordered w-full${formError.notes ? ' is-invalid' : ''}`}
                placeholder="e.g. Brought to site for leak test"
                value={form.notes}
                onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))} />
              {formError.notes && <span className="helper-text">{formError.notes}</span>}
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
        <button type="submit" form="equip-edit-deploy-form" className="btn btn-primary" disabled={submitting}>
          {submitting ? <span className="loading loading-spinner loading-sm"></span> : <span className="icon-[tabler--device-floppy] size-4"></span>}
          Save Changes
        </button>
      </div>
    </div>
  )
}

/** Layer 2 — log a new deployment for an equipment item */
function LogDeploymentModal({ equipment, onSuccess }) {
  const { popModal, pushModal } = useModal()
  const { apiFetch } = useAuth()
  const [form, setForm] = useState(EMPTY_DEPLOY_FORM)
  const [formError, setFormError] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [schedDisplay, setSchedDisplay] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError({})
    setSubmitting(true)
    try {
      const res = await apiFetch('/api/equipment-usages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equipmentId: equipment.equipmentId,
          schedId:     Number(form.schedId),
          notes:       form.notes || null,
        }),
      })
      if (!res.ok) { setFormError(await parseApiError(res)); notyfError('Log deployment failed'); return }
      notyfSuccess('Deployment logged.')
      popModal()
      onSuccess?.()
    } catch (err) {
      setFormError({ _general: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-content w-full max-w-lg my-auto">
      <div className="modal-header">
        <h3 className="modal-title">Log Deployment — {equipment.name}</h3>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body">
        <form id="equip-deploy-form" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4">

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Service Schedule <span className="text-error">*</span></label>
              <div className="flex gap-2">
                <input type="text" readOnly
                  className={`input input-bordered flex-1${formError.schedId ? ' is-invalid' : ''}`}
                  placeholder="No schedule selected"
                  value={schedDisplay} />
                <button type="button" className="btn btn-soft btn-secondary shrink-0"
                  onClick={() => pushModal(<SchedPickerLayer onSelect={s => {
                    setForm(prev => ({ ...prev, schedId: s.schedId }))
                    setSchedDisplay(`Sched #${s.schedId} — ${s.date ?? ''} · ${s.purpose ?? ''}`)
                  }} />)}>
                  Pick
                </button>
                {form.schedId && (
                  <button type="button" className="btn btn-soft btn-error shrink-0"
                    onClick={() => { setForm(prev => ({ ...prev, schedId: '' })); setSchedDisplay('') }}>
                    <span className="icon-[tabler--x] size-4"></span>
                  </button>
                )}
              </div>
              {formError.schedId && <span className="helper-text">{formError.schedId}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="label-text font-medium">Notes <span className="text-base-content/40 font-normal">(optional)</span></label>
              <input type="text" name="notes" maxLength={255}
                className={`input input-bordered w-full${formError.notes ? ' is-invalid' : ''}`}
                placeholder="e.g. Brought to site for leak test"
                value={form.notes}
                onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))} />
              {formError.notes && <span className="helper-text">{formError.notes}</span>}
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
        <button type="submit" form="equip-deploy-form" className="btn btn-warning" disabled={submitting}>
          {submitting ? <span className="loading loading-spinner loading-sm"></span> : <span className="icon-[tabler--calendar-plus] size-4"></span>}
          Log Deployment
        </button>
      </div>
    </div>
  )
}

/** Layer 2 — update equipment details; sits on top of ManageEquipmentModal */
function UpdateEquipmentModal({ equipment, onRefresh }) {
  const { popModal } = useModal()
  const { apiFetch } = useAuth()
  const [form, setForm] = useState({
    name:            equipment.name,
    type:            equipment.type,
    model:           equipment.model ?? '',
    serialNumber:    equipment.serialNumber ?? '',
    description:     equipment.description ?? '',
    status:          equipment.status,
    stock:           String(equipment.stock),
    acquisitionCost: equipment.acquisitionCost ?? '',
    poNum:           equipment.poNum ?? '',
  })
  const [formError, setFormError] = useState({})
  const [submitting, setSubmitting] = useState(false)

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError({})
    setSubmitting(true)
    try {
      const res = await apiFetch(`/api/equipment/${equipment.equipmentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          stock:           Number(form.stock),
          acquisitionCost: form.acquisitionCost ? Number(form.acquisitionCost) : null,
          poNum:           form.poNum || null,
          model:           form.model || null,
          serialNumber:    form.serialNumber || null,
          description:     form.description || null,
        }),
      })
      if (!res.ok) { setFormError(await parseApiError(res)); notyfError('Update failed'); return }
      notyfSuccess(`Equipment #${equipment.equipmentId} updated.`)
      popModal()
      onRefresh?.()
    } catch (err) {
      setFormError({ _general: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-content w-full max-w-2xl my-auto">
      <div className="modal-header">
        <h3 className="modal-title">Update Equipment #{equipment.equipmentId}</h3>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body">
        <form id="equip-update-form" onSubmit={handleSubmit}>
          <EquipmentFormFields form={form} onChange={handleChange} errors={formError} />
        </form>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-soft btn-secondary" onClick={popModal}>Cancel</button>
        <button type="submit" form="equip-update-form" className="btn btn-primary" disabled={submitting}>
          {submitting ? <span className="loading loading-spinner loading-sm"></span> : <span className="icon-[tabler--device-floppy] size-4"></span>}
          Save Changes
        </button>
      </div>
    </div>
  )
}

/** Layer 1 — manage equipment: details, deployment history, and action menu */
function ManageEquipmentModal({ equipment, onRefresh }) {
  const { pushModal, popModal } = useModal()
  const { hasRole, apiFetch } = useAuth()
  const canEdit = hasRole('ADMIN', 'STAFF')
  const [deployHistory, setDeployHistory]   = useState([])
  const [deployLoading, setDeployLoading]   = useState(false)
  const [deployRefreshKey, setDeployRefreshKey] = useState(0)

  useEffect(() => {
    let active = true
    setDeployLoading(true)
    apiFetch(`/api/equipment-usages?equipmentId=${equipment.equipmentId}&size=50&sort=loggedOn,desc`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => { if (active) setDeployHistory(data.content ?? []) })
      .catch(() => { if (active) setDeployHistory([]) })
      .finally(() => { if (active) setDeployLoading(false) })
    return () => { active = false }
  }, [apiFetch, equipment.equipmentId, deployRefreshKey])

  // Log Deployment is only available when equipment is active.
  const navItems = equipment.status !== 'active'
    ? EQUIPMENT_MENU_ITEMS.filter(item => item.key !== 'log-deploy')
    : EQUIPMENT_MENU_ITEMS

  function handleAction(key) {
    if (key === 'update')     pushModal(<UpdateEquipmentModal equipment={equipment} onRefresh={onRefresh} />)
    if (key === 'log-deploy') pushModal(<LogDeploymentModal equipment={equipment} onSuccess={() => { setDeployRefreshKey(k => k + 1); onRefresh?.() }} />)
  }

  function handleEditDeploy(u) {
    pushModal(<EditDeploymentModal deployment={u} onSuccess={() => setDeployRefreshKey(k => k + 1)} />)
  }

  return (
    <div className="modal-content w-full max-w-2xl my-auto">
      <div className="modal-header">
        <div>
          <h3 className="modal-title">Equipment #{equipment.equipmentId}</h3>
          <span className="text-sm text-base-content/50 line-clamp-1">{equipment.name}</span>
        </div>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body flex flex-col gap-5">

        {/* Details grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <DetailItem label="Equipment ID"  value={equipment.equipmentId} />
          <DetailItem label="Type"          value={<span className={`badge badge-soft ${typeBadge(equipment.type)} text-xs`}>{equipment.type}</span>} />
          <DetailItem label="Status"        value={<span className={`badge badge-soft ${statusBadge(equipment.status)} text-xs`}>{equipment.status}</span>} />
          <DetailItem label="Model"         value={equipment.model ?? '—'} />
          <DetailItem label="Serial Number" value={equipment.serialNumber ?? '—'} />
          <DetailItem label="Stock"         value={equipment.stock} />
          <DetailItem label="Acq. Cost"     value={formatCurrency(equipment.acquisitionCost)} />
          <DetailItem label="PO Number"     value={equipment.poNum ?? '—'} />
          <DetailItem label="Added On"      value={formatDate(equipment.addedOn)} />
          <div className="col-span-2 sm:col-span-3 flex flex-col gap-0.5">
            <span className="text-xs text-base-content/50 uppercase tracking-wide">Name</span>
            <span className="text-sm font-medium">{equipment.name}</span>
          </div>
          {equipment.description && (
            <div className="col-span-2 sm:col-span-3 flex flex-col gap-0.5">
              <span className="text-xs text-base-content/50 uppercase tracking-wide">Description</span>
              <span className="text-sm font-medium">{equipment.description}</span>
            </div>
          )}
        </div>

        {/* Deployment history */}
        <div>
          <p className="text-xs text-base-content/50 uppercase tracking-wide mb-2">Deployment History</p>
          {deployLoading ? (
            <div className="flex justify-center py-4">
              <span className="loading loading-spinner loading-sm text-primary"></span>
            </div>
          ) : deployHistory.length === 0 ? (
            <p className="text-xs text-base-content/40 py-2">No deployments recorded yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-box border border-base-300">
              <table className="table table-xs w-full">
                <thead>
                  <tr>
                    <th>Sched #</th>
                    <th>Date</th>
                    <th>Notes</th>
                    <th>Logged</th>
                    {canEdit && <th>Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {deployHistory.map(u => (
                    <tr key={u.usageId}>
                      <td className="font-mono">{u.schedId}</td>
                      <td>{formatDate(u.schedDate)}</td>
                      <td className="max-w-40">
                        <span className="line-clamp-1 text-base-content/70" title={u.notes}>{u.notes || '—'}</span>
                      </td>
                      <td>{formatDate(u.loggedOn)}</td>
                      {canEdit && (
                        <td>
                          <button type="button" className="btn btn-soft btn-secondary btn-xs" onClick={() => handleEditDeploy(u)}>
                            <span className="icon-[tabler--pencil] size-3"></span>Edit
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Action menu */}
        {equipment.status !== 'active' && canEdit && (
          <p className="text-xs text-warning">Log Deployment is unavailable — equipment is not active.</p>
        )}
        <ModalNav items={navItems} hasRole={hasRole} onSelect={handleAction} cols={2} />
      </div>
    </div>
  )
}

/** Layer 1 — 3-step wizard to add equipment via a new purchase order */
function AddEquipmentModal({ onSuccess }) {
  const { popModal } = useModal()
  const { apiFetch, officeAddress } = useAuth()

  const [addStep, setAddStep]                             = useState(1)
  const [addProjectAddress, setAddProjectAddress]         = useState('')
  const [addProjectDisplay, setAddProjectDisplay]         = useState('')
  const [addPoForm, setAddPoForm]                         = useState(EMPTY_PO_FORM)
  const [addPoFormError, setAddPoFormError]               = useState({})
  const [addEquipList, setAddEquipList]                   = useState([])
  const [addEquipForm, setAddEquipForm]                   = useState(EMPTY_EQUIP_ITEM)
  const [addEquipFormError, setAddEquipFormError]         = useState({})
  const [addingEquipItem, setAddingEquipItem]             = useState(false)
  const [addDocList, setAddDocList]                       = useState([])
  const [addDocForm, setAddDocForm]                       = useState(EMPTY_DOC_FORM)
  const [addDocFormError, setAddDocFormError]             = useState({})
  const [addingDocItem, setAddingDocItem]                 = useState(false)
  const [addSubmitError, setAddSubmitError]               = useState({})
  const [addSubmitting, setAddSubmitting]                 = useState(false)
  const addDocFileRef = useRef(null)

  function handleAddPoChange(e) {
    const { name, value } = e.target
    setAddPoForm(prev => ({ ...prev, [name]: value }))
  }

  function handleAddEquipChange(e) {
    const { name, value } = e.target
    setAddEquipForm(prev => ({ ...prev, [name]: value }))
  }

  /** Validates step 1 and advances to step 2 */
  function handleNextFromAddStep1() {
    const errors = {}
    if (!addPoForm.purpose.trim()) errors.purpose = 'Purpose is required.'
    if (!addPoForm.terms.trim())   errors.terms   = 'Terms is required.'
    if (Object.keys(errors).length > 0) { setAddPoFormError(errors); return }
    setAddPoFormError({})
    setAddStep(2)
  }

  /** Validates step 2 and advances to step 3 */
  function handleNextFromAddStep2() {
    if (addEquipList.length === 0) {
      setAddSubmitError({ _general: 'Add at least one equipment item before continuing.' })
      return
    }
    setAddSubmitError({})
    setAddStep(3)
  }

  /** Validates and adds an equipment item to the local list */
  function handleAddEquipToList(e) {
    e.preventDefault()
    const errors = {}
    if (!addEquipForm.name.trim())               errors.name  = 'Name is required.'
    if (!addEquipForm.stock || Number(addEquipForm.stock) < 0) errors.stock = 'Stock must be 0 or more.'
    if (Object.keys(errors).length > 0) { setAddEquipFormError(errors); return }
    setAddEquipFormError({})
    setAddEquipList(prev => [...prev, { ...addEquipForm, _key: Date.now() }])
    setAddEquipForm(EMPTY_EQUIP_ITEM)
    setAddingEquipItem(false)
  }

  function removeAddEquip(key) {
    setAddEquipList(prev => prev.filter(e => e._key !== key))
  }

  /** Handles file selection for the doc add form */
  function handleAddDocFileChange(e) {
    const file = e.target.files?.[0] ?? null
    if (file && !ACCEPTED_TYPES.includes(file.type)) {
      setAddDocFormError(prev => ({ ...prev, file: 'Only images and PDFs are accepted.' }))
      e.target.value = ''
      return
    }
    setAddDocFormError(prev => { const n = { ...prev }; delete n.file; return n })
    setAddDocForm(prev => ({ ...prev, file }))
  }

  /** Validates and adds a document record to the local list */
  function handleAddDocToList(e) {
    e.preventDefault()
    const errors = {}
    if (!addDocForm.invoiceId.trim()) errors.invoiceId = 'Invoice ID is required.'
    if (Object.keys(errors).length > 0) { setAddDocFormError(errors); return }
    setAddDocFormError({})
    setAddDocList(prev => [...prev, { ...addDocForm, _key: Date.now() }])
    setAddDocForm(EMPTY_DOC_FORM)
    if (addDocFileRef.current) addDocFileRef.current.value = ''
    setAddingDocItem(false)
  }

  function removeAddDoc(key) {
    setAddDocList(prev => prev.filter(d => d._key !== key))
  }

  /** Creates PO, then equipment items, then documents */
  async function handleAddSubmit() {
    setAddSubmitError({})
    setAddSubmitting(true)
    try {
      const poRes = await apiFetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purpose:         addPoForm.purpose,
          terms:           addPoForm.terms,
          deliveryAddress: addPoForm.deliveryAddress || null,
          remarks:         addPoForm.remarks || null,
          paymentMethod:   addPoForm.paymentMethod === 'ewallet' ? `ewallet:${addPoForm.ewalletType}` : addPoForm.paymentMethod || null,
          paymentDetails:  addPoForm.paymentDetails || null,
          srNum:           null,
        }),
      })
      if (!poRes.ok) {
        setAddSubmitError(await parseApiError(poRes))
        notyfError('Failed to create purchase order.')
        return
      }
      const createdPo = await poRes.json()
      const poNum = createdPo.poNum

      const equipFailures = []
      for (const item of addEquipList) {
        const equipRes = await apiFetch('/api/equipment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name:            item.name,
            type:            item.type,
            status:          'active',
            model:           item.model || null,
            serialNumber:    item.serialNumber || null,
            description:     item.description || null,
            stock:           Number(item.stock),
            acquisitionCost: item.acquisitionCost ? Number(item.acquisitionCost) : null,
            poNum,
          }),
        })
        if (!equipRes.ok) {
          const err = await parseApiError(equipRes)
          equipFailures.push(`"${item.name}": ${err._general ?? JSON.stringify(err)}`)
        }
      }

      const docFailures = []
      for (const doc of addDocList) {
        let docuId = null
        if (doc.file) {
          const formData = new FormData()
          formData.append('file', doc.file)
          const uploadRes = await apiFetch('/api/documents', { method: 'POST', body: formData })
          if (!uploadRes.ok) { docFailures.push(`Invoice "${doc.invoiceId}": file upload failed`); continue }
          const uploaded = await uploadRes.json()
          docuId = uploaded.docuId
        }
        const docRes = await apiFetch('/api/purchase-order-documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ poNum, invoiceId: doc.invoiceId, docuId }),
        })
        if (!docRes.ok) {
          const err = await parseApiError(docRes)
          docFailures.push(`Invoice "${doc.invoiceId}": ${err._general ?? JSON.stringify(err)}`)
        }
      }

      popModal()
      notyfSuccess(`Purchase Order ${poNum} created with ${addEquipList.length - equipFailures.length} equipment item(s).`)
      equipFailures.forEach(msg => notyfError(msg))
      docFailures.forEach(msg => notyfError(msg))
      onSuccess?.()
    } catch (err) {
      setAddSubmitError({ _general: err.message })
    } finally {
      setAddSubmitting(false)
    }
  }

  return (
    <div className="modal-content w-full max-w-2xl my-auto">
      <div className="modal-header">
        <div>
          <h3 className="modal-title">Add Equipment via Purchase Order</h3>
          <span className="text-sm text-base-content/50">Create a purchase order and add equipment linked to it.</span>
        </div>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>

      <div className="modal-body flex flex-col gap-4">

        {/* Progress steps */}
        <div className="flex items-center gap-x-1">
          {ADD_STEPS.map(s => (
            <div
              key={s.number}
              className={`progress-step transition-colors ${addStep >= s.number ? 'bg-primary' : 'bg-primary/10'}`}
              role="progressbar"
              aria-label={s.label}
              aria-valuenow={addStep >= s.number ? 100 : 0}
              aria-valuemin="0"
              aria-valuemax="100"
            />
          ))}
          <p className="text-xs text-primary ms-1 font-medium">{addStep}/{ADD_STEPS.length}</p>
        </div>

        {/* ── Step 1: Purchase Order Details ── */}
        {addStep === 1 && (
          <div className="flex flex-col gap-4">
            <p className="text-xs font-semibold text-base-content/40 uppercase tracking-wide">
              Step 1 — Purchase Order Details
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              <PickerInput
                label="Project (optional)"
                displayValue={addProjectDisplay}
                placeholder="None selected"
                buttonLabel="Select Project"
                Picker={ProjectPickerModal}
                onSelect={p => { setAddProjectAddress(p.address ?? ''); setAddProjectDisplay(`${p.name} (#${p.projNum})`) }}
                className="sm:col-span-2"
              />

              <div className="flex flex-col gap-1">
                <label className="label-text font-medium">Purpose <span className="text-error">*</span></label>
                <input type="text" name="purpose" maxLength={30} required
                  className={`input input-bordered w-full${addPoFormError.purpose ? ' is-invalid' : ''}`}
                  placeholder="e.g. Equipment procurement"
                  value={addPoForm.purpose} onChange={handleAddPoChange} />
                {addPoFormError.purpose
                  ? <span className="helper-text">{addPoFormError.purpose}</span>
                  : <span className="text-xs text-base-content/40">{addPoForm.purpose.length}/30</span>}
              </div>

              <div className="flex flex-col gap-1">
                <label className="label-text font-medium">Terms <span className="text-error">*</span></label>
                <input type="text" name="terms" maxLength={16} required
                  className={`input input-bordered w-full${addPoFormError.terms ? ' is-invalid' : ''}`}
                  placeholder="e.g. Net 30"
                  value={addPoForm.terms} onChange={handleAddPoChange} />
                {addPoFormError.terms
                  ? <span className="helper-text">{addPoFormError.terms}</span>
                  : <span className="text-xs text-base-content/40">{addPoForm.terms.length}/16</span>}
              </div>

              <div className={`flex flex-col gap-1${addPoForm.paymentMethod === 'ewallet' ? ' sm:col-span-2' : ''}`}>
                <label className="label-text font-medium">Payment Method</label>
                <div className="flex gap-2">
                  <select name="paymentMethod"
                    className={`select select-bordered${addPoForm.paymentMethod === 'ewallet' ? '' : ' w-full'}${addPoFormError.paymentMethod ? ' is-invalid' : ''}`}
                    value={addPoForm.paymentMethod} onChange={handleAddPoChange}>
                    <option value="">— None —</option>
                    <option value="cash">Cash</option>
                    <option value="check">Check</option>
                    <option value="ewallet">E-Wallet</option>
                    <option value="bank">Bank Transfer</option>
                  </select>
                  {addPoForm.paymentMethod === 'ewallet' && (
                    <select name="ewalletType" required
                      className={`select select-bordered flex-1${addPoFormError.ewalletType ? ' is-invalid' : ''}`}
                      value={addPoForm.ewalletType} onChange={handleAddPoChange}>
                      <option value="">— Select —</option>
                      <option value="GCash">GCash</option>
                      <option value="Maya">Maya</option>
                      <option value="ShopeePay">ShopeePay</option>
                      <option value="GrabPay">GrabPay</option>
                    </select>
                  )}
                </div>
                {addPoFormError.paymentMethod && <span className="helper-text">{addPoFormError.paymentMethod}</span>}
                {addPoForm.paymentMethod === 'ewallet' && addPoFormError.ewalletType && <span className="helper-text">{addPoFormError.ewalletType}</span>}
              </div>

              <div className="flex flex-col gap-1">
                <label className="label-text font-medium">Payment Details</label>
                <input type="text" name="paymentDetails" maxLength={60}
                  className={`input input-bordered w-full${addPoFormError.paymentDetails ? ' is-invalid' : ''}`}
                  placeholder="e.g. Account #1234-5678"
                  value={addPoForm.paymentDetails} onChange={handleAddPoChange} />
                {addPoFormError.paymentDetails && <span className="helper-text">{addPoFormError.paymentDetails}</span>}
              </div>

              <div className="sm:col-span-2 flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <label className="label-text font-medium">Delivery Address</label>
                  <div className="flex gap-1.5">
                    {addProjectAddress && (
                      <button type="button" className="btn btn-xs btn-soft btn-secondary"
                        onClick={() => handleAddPoChange({ target: { name: 'deliveryAddress', value: addProjectAddress } })}>
                        <span className="icon-[tabler--building] size-3"></span>Same as project
                      </button>
                    )}
                    {officeAddress && (
                      <button type="button" className="btn btn-xs btn-soft btn-secondary"
                        onClick={() => handleAddPoChange({ target: { name: 'deliveryAddress', value: officeAddress } })}>
                        <span className="icon-[tabler--building-factory-2] size-3"></span>Office address
                      </button>
                    )}
                  </div>
                </div>
                <textarea name="deliveryAddress" maxLength={600} rows={2}
                  className={`textarea textarea-bordered w-full${addPoFormError.deliveryAddress ? ' is-invalid' : ''}`}
                  placeholder="Full delivery address"
                  value={addPoForm.deliveryAddress} onChange={handleAddPoChange} />
                {addPoFormError.deliveryAddress && <span className="helper-text">{addPoFormError.deliveryAddress}</span>}
              </div>

              <div className="sm:col-span-2 flex flex-col gap-1">
                <label className="label-text font-medium">Remarks</label>
                <textarea name="remarks" maxLength={255} rows={2}
                  className={`textarea textarea-bordered w-full${addPoFormError.remarks ? ' is-invalid' : ''}`}
                  placeholder="Additional notes or instructions"
                  value={addPoForm.remarks} onChange={handleAddPoChange} />
                {addPoFormError.remarks && <span className="helper-text">{addPoFormError.remarks}</span>}
              </div>

              {addPoFormError._general && (
                <div className="sm:col-span-2 alert alert-error py-2">
                  <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                  <span className="text-sm">{addPoFormError._general}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Step 2: Equipment Items ── */}
        {addStep === 2 && (
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs font-semibold text-base-content/40 uppercase tracking-wide mb-3">
                Step 2 — Add Equipment Items
              </p>
              <div className="flex items-center gap-2 text-sm text-base-content/60 bg-base-200 rounded-lg px-3 py-2">
                <span className="icon-[tabler--file-invoice] size-4 shrink-0"></span>
                <span>PO: <span className="font-medium">{addPoForm.purpose}</span></span>
              </div>
            </div>

            {addEquipList.length === 0 ? (
              <p className="text-sm text-base-content/40">No equipment added yet. Add at least one item.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {addEquipList.map((item, idx) => (
                  <div key={item._key} className="card border border-base-300 bg-base-100">
                    <div className="card-body py-2 px-3 gap-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{item.name}</p>
                          <p className="text-xs text-base-content/50">
                            {item.type} · stock: {item.stock}
                            {item.model && ` · ${item.model}`}
                            {item.acquisitionCost && ` · ₱${Number(item.acquisitionCost).toLocaleString()}`}
                          </p>
                        </div>
                        <button type="button" className="btn btn-error btn-xs btn-square shrink-0"
                          title={`Remove item ${idx + 1}`} onClick={() => removeAddEquip(item._key)}>
                          <span className="icon-[tabler--x] size-3.5"></span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {addingEquipItem ? (
              <div className="card border border-base-300 bg-base-200/40">
                <div className="card-body gap-3">
                  <p className="text-xs font-semibold text-base-content/50 uppercase tracking-wide">New Equipment Item</p>
                  <form id="add-equip-item-form" onSubmit={handleAddEquipToList}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                      <div className="sm:col-span-2 flex flex-col gap-1">
                        <label className="label-text font-medium">Name <span className="text-error">*</span></label>
                        <input type="text" name="name" maxLength={150} required
                          className={`input input-bordered w-full${addEquipFormError.name ? ' is-invalid' : ''}`}
                          placeholder="e.g. Industrial Vacuum Pump"
                          value={addEquipForm.name} onChange={handleAddEquipChange} />
                        {addEquipFormError.name && <span className="helper-text">{addEquipFormError.name}</span>}
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="label-text font-medium">Type <span className="text-error">*</span></label>
                        <select name="type" className="select select-bordered w-full"
                          value={addEquipForm.type} onChange={handleAddEquipChange}>
                          <option value="durable">durable</option>
                          <option value="consumable">consumable</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="label-text font-medium">Model</label>
                        <input type="text" name="model" maxLength={100}
                          className="input input-bordered w-full"
                          placeholder="e.g. VP-300X"
                          value={addEquipForm.model} onChange={handleAddEquipChange} />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="label-text font-medium">Serial Number</label>
                        <input type="text" name="serialNumber" maxLength={100}
                          className="input input-bordered w-full"
                          placeholder="e.g. SN-001"
                          value={addEquipForm.serialNumber} onChange={handleAddEquipChange} />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="label-text font-medium">Stock <span className="text-error">*</span></label>
                        <input type="number" name="stock" min={0} required
                          className={`input input-bordered w-full${addEquipFormError.stock ? ' is-invalid' : ''}`}
                          placeholder="1"
                          value={addEquipForm.stock} onChange={handleAddEquipChange} />
                        {addEquipFormError.stock && <span className="helper-text">{addEquipFormError.stock}</span>}
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="label-text font-medium">Acquisition Cost</label>
                        <input type="number" name="acquisitionCost" min={0} step="0.01"
                          className="input input-bordered w-full"
                          placeholder="e.g. 12500.00"
                          value={addEquipForm.acquisitionCost} onChange={handleAddEquipChange} />
                      </div>

                      <div className="sm:col-span-2 flex flex-col gap-1">
                        <label className="label-text font-medium">Description</label>
                        <textarea name="description" maxLength={500} rows={2}
                          className="textarea textarea-bordered w-full"
                          placeholder="Brief description of the equipment"
                          value={addEquipForm.description} onChange={handleAddEquipChange} />
                      </div>

                      {addEquipFormError._general && (
                        <div className="sm:col-span-2 alert alert-error py-2">
                          <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                          <span className="text-sm">{addEquipFormError._general}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 justify-end mt-3">
                      <button type="button" className="btn btn-soft btn-secondary btn-sm"
                        onClick={() => { setAddingEquipItem(false); setAddEquipForm(EMPTY_EQUIP_ITEM); setAddEquipFormError({}) }}>
                        Cancel
                      </button>
                      <button type="submit" className="btn btn-primary btn-sm">
                        <span className="icon-[tabler--plus] size-4"></span>
                        Add to List
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            ) : (
              <button type="button" className="btn btn-soft btn-primary btn-sm w-full"
                onClick={() => { setAddingEquipItem(true); setAddEquipForm(EMPTY_EQUIP_ITEM); setAddEquipFormError({}) }}>
                <span className="icon-[tabler--plus] size-4"></span>
                Add Equipment Item
              </button>
            )}

            {addSubmitError._general && (
              <div className="alert alert-error py-2">
                <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                <span className="text-sm">{addSubmitError._general}</span>
              </div>
            )}
          </div>
        )}

        {/* ── Step 3: PO Documents ── */}
        {addStep === 3 && (
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs font-semibold text-base-content/40 uppercase tracking-wide mb-3">
                Step 3 — PO Documents <span className="text-base-content/30 font-normal normal-case">(optional)</span>
              </p>
              <div className="flex flex-col gap-1 text-sm text-base-content/60 bg-base-200 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="icon-[tabler--file-invoice] size-4 shrink-0"></span>
                  <span>PO: <span className="font-medium">{addPoForm.purpose}</span></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="icon-[tabler--tool] size-4 shrink-0"></span>
                  <span>{addEquipList.length} equipment item{addEquipList.length !== 1 ? 's' : ''}</span>
                </div>
              </div>
            </div>

            {addDocList.length === 0 ? (
              <p className="text-sm text-base-content/40">No documents added. You can skip this step.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {addDocList.map((doc, idx) => (
                  <div key={doc._key} className="card border border-base-300 bg-base-100">
                    <div className="card-body py-2 px-3 gap-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm font-mono">{doc.invoiceId}</p>
                          <p className="text-xs text-base-content/50">
                            {doc.file
                              ? <><span className="icon-[tabler--paperclip] size-3 inline-block mr-0.5"></span>{doc.file.name}</>
                              : 'No file attached'
                            }
                          </p>
                        </div>
                        <button type="button" className="btn btn-error btn-xs btn-square shrink-0"
                          title={`Remove document ${idx + 1}`} onClick={() => removeAddDoc(doc._key)}>
                          <span className="icon-[tabler--x] size-3.5"></span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {addingDocItem ? (
              <div className="card border border-base-300 bg-base-200/40">
                <div className="card-body gap-3">
                  <p className="text-xs font-semibold text-base-content/50 uppercase tracking-wide">New Document Record</p>
                  <form id="add-doc-item-form" onSubmit={handleAddDocToList}>
                    <div className="flex flex-col gap-3">

                      <div className="flex flex-col gap-1">
                        <label className="label-text font-medium">Invoice ID <span className="text-error">*</span></label>
                        <input type="text" maxLength={16} required
                          className={`input input-bordered w-full${addDocFormError.invoiceId ? ' is-invalid' : ''}`}
                          placeholder="e.g. INV-001"
                          value={addDocForm.invoiceId}
                          onChange={e => setAddDocForm(prev => ({ ...prev, invoiceId: e.target.value }))} />
                        {addDocFormError.invoiceId && <span className="helper-text">{addDocFormError.invoiceId}</span>}
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="label-text font-medium">
                          File <span className="text-base-content/40 font-normal">(optional — images or PDF)</span>
                        </label>
                        <input ref={addDocFileRef} type="file" accept={ACCEPTED_EXTENSIONS} className="hidden" onChange={handleAddDocFileChange} />
                        <button type="button"
                          className={`btn btn-outline w-full justify-start font-normal${addDocFormError.file ? ' btn-error' : ''}`}
                          onClick={() => addDocFileRef.current?.click()}>
                          <span className="icon-[tabler--paperclip] size-4"></span>
                          {addDocForm.file ? addDocForm.file.name : 'Choose file…'}
                        </button>
                        {addDocFormError.file && <span className="helper-text">{addDocFormError.file}</span>}
                        {addDocForm.file && <span className="text-xs text-base-content/50">{(addDocForm.file.size / 1024).toFixed(1)} KB</span>}
                      </div>

                      {addDocFormError._general && (
                        <div className="alert alert-error py-2">
                          <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                          <span className="text-sm">{addDocFormError._general}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 justify-end mt-3">
                      <button type="button" className="btn btn-soft btn-secondary btn-sm"
                        onClick={() => { setAddingDocItem(false); setAddDocForm(EMPTY_DOC_FORM); setAddDocFormError({}); if (addDocFileRef.current) addDocFileRef.current.value = '' }}>
                        Cancel
                      </button>
                      <button type="submit" className="btn btn-primary btn-sm">
                        <span className="icon-[tabler--plus] size-4"></span>
                        Add to List
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            ) : (
              <button type="button" className="btn btn-soft btn-primary btn-sm w-full"
                onClick={() => { setAddingDocItem(true); setAddDocForm(EMPTY_DOC_FORM); setAddDocFormError({}) }}>
                <span className="icon-[tabler--plus] size-4"></span>
                Add Document Record
              </button>
            )}

            {addSubmitError._general && (
              <div className="alert alert-error py-2">
                <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                <span className="text-sm">{addSubmitError._general}</span>
              </div>
            )}
          </div>
        )}

      </div>

      <div className="modal-footer">
        <button type="button" className="btn btn-soft btn-secondary" onClick={popModal}>Cancel</button>
        <div className="flex gap-2 ms-auto">
          {addStep > 1 && (
            <button type="button" className="btn btn-soft btn-secondary"
              onClick={() => { setAddStep(s => s - 1); setAddSubmitError({}) }}>
              <span className="icon-[tabler--arrow-left] size-4"></span> Back
            </button>
          )}
          {addStep === 1 && (
            <button type="button" className="btn btn-primary" onClick={handleNextFromAddStep1}>
              Next <span className="icon-[tabler--arrow-right] size-4"></span>
            </button>
          )}
          {addStep === 2 && (
            <button type="button" className="btn btn-primary" disabled={addingEquipItem} onClick={handleNextFromAddStep2}>
              Next <span className="icon-[tabler--arrow-right] size-4"></span>
            </button>
          )}
          {addStep === 3 && (
            <button type="button" className="btn btn-primary" disabled={addSubmitting || addingDocItem} onClick={handleAddSubmit}>
              {addSubmitting
                ? <span className="loading loading-spinner loading-sm"></span>
                : <span className="icon-[tabler--plus] size-4"></span>
              }
              Add Purchase Order &amp; Equipment
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function InventoryEquipment() {
  const { apiFetch, hasRole } = useAuth()
  const { pushModal } = useModal()
  const canEdit = hasRole('ADMIN', 'STAFF', 'ACCOUNTING')
  const [searchParams] = useSearchParams()

  const [equipment, setEquipment]         = useState([])
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState(null)
  const [inputValue, setInputValue]       = useState('')
  const [search, setSearch]               = useState('')
  const [typeFilter, setTypeFilter]       = useState('')
  const [statusFilter, setStatusFilter]   = useState('')
  const [page, setPage]                   = useState(0)
  const [totalPages, setTotalPages]       = useState(0)
  const [totalElements, setTotalElements] = useState(0)
  const [refreshKey, setRefreshKey]       = useState(0)

  /** Fetch paginated equipment list. */
  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ page: String(page), size: String(PAGE_SIZE), sort: 'addedOn,desc' })
    if (search)       params.set('search', search)
    if (typeFilter)   params.set('type', typeFilter)
    if (statusFilter) params.set('status', statusFilter)
    apiFetch(`/api/equipment?${params}`)
      .then(res => { if (!res.ok) throw new Error(`Failed to load equipment (${res.status})`); return res.json() })
      .then(data => {
        if (!active) return
        setEquipment(data.content ?? [])
        setTotalPages(data.totalPages ?? 0)
        setTotalElements(data.totalElements ?? 0)
      })
      .catch(err => { if (active) setError(err.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [apiFetch, page, refreshKey, search, typeFilter, statusFilter])

  // Auto-open Add Equipment modal when ?addEquipment=1 is in the URL
  useEffect(() => {
    if (canEdit && searchParams.get('addEquipment') === '1') {
      pushModal(<AddEquipmentModal onSuccess={() => setRefreshKey(k => k + 1)} />)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function commitSearch() { setPage(0); setSearch(inputValue) }

  return (
    <Layout activePage="inventory">
      {/* Header */}
      <div className="flex items-stretch justify-between h-16 mb-6">
        <div>
          <h1 className="text-3xl font-semibold">Equipment</h1>
          <p className="text-base-content/60 mt-1">Manage durable and consumable equipment</p>
        </div>
        {canEdit && (
          <button type="button" className="btn btn-primary h-full min-h-0"
            onClick={() => pushModal(<AddEquipmentModal onSuccess={() => setRefreshKey(k => k + 1)} />)}>
            <span className="icon-[tabler--plus] size-4"></span>
            Add Equipment
          </button>
        )}
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <div className="relative flex-1 min-w-48">
          <span className="icon-[tabler--search] size-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none"></span>
          <input
            type="text"
            className="input input-bordered w-full pl-9"
            placeholder="Search by name or model..."
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commitSearch() }}
          />
        </div>
        <button type="button" className="btn btn-secondary shrink-0" onClick={commitSearch}>
          <span className="icon-[tabler--search] size-4"></span>
          Search
        </button>

        {/* Type filter */}
        <div className="dropdown relative inline-flex shrink-0">
          <button type="button" className="dropdown-toggle btn btn-secondary" aria-haspopup="menu" aria-expanded="false">
            <span className="icon-[tabler--filter] size-4"></span>
            {typeFilter || 'All Types'}
            <span className="icon-[tabler--chevron-down] dropdown-open:rotate-180 size-4"></span>
          </button>
          <ul className="dropdown-menu dropdown-open:opacity-100 hidden min-w-36" role="menu">
            {['', 'durable', 'consumable'].map(v => (
              <li key={v}><a className={`dropdown-item${typeFilter === v ? ' dropdown-active' : ''}`} href="#" onClick={e => { e.preventDefault(); setPage(0); setTypeFilter(v) }}>{v || 'All Types'}</a></li>
            ))}
          </ul>
        </div>

        {/* Status filter */}
        <div className="dropdown relative inline-flex shrink-0">
          <button type="button" className="dropdown-toggle btn btn-secondary" aria-haspopup="menu" aria-expanded="false">
            <span className="icon-[tabler--filter] size-4"></span>
            {statusFilter || 'All Status'}
            <span className="icon-[tabler--chevron-down] dropdown-open:rotate-180 size-4"></span>
          </button>
          <ul className="dropdown-menu dropdown-open:opacity-100 hidden min-w-44" role="menu">
            {['', 'active', 'under_maintenance', 'retired', 'depleted'].map(v => (
              <li key={v}><a className={`dropdown-item${statusFilter === v ? ' dropdown-active' : ''}`} href="#" onClick={e => { e.preventDefault(); setPage(0); setStatusFilter(v) }}>{v || 'All Status'}</a></li>
            ))}
          </ul>
        </div>
      </div>

      {/* Loading */}
      {loading && <div className="flex justify-center py-20"><span className="loading loading-spinner loading-lg text-primary"></span></div>}

      {/* Error */}
      {error && <div className="alert alert-error"><span className="icon-[tabler--alert-circle] size-5"></span><span>{error}</span></div>}

      {/* Table */}
      {!loading && !error && (
        <>
          <p className="text-sm text-base-content/50 mb-3">
            {totalElements} item{totalElements !== 1 ? 's' : ''} total
            {search && ` · "${search}"`}
            {typeFilter && ` · ${typeFilter}`}
            {statusFilter && ` · ${statusFilter}`}
          </p>

          {equipment.length === 0 ? (
            <div className="text-center py-20 text-base-content/40">
              <span className="icon-[tabler--tool-off] size-12 mx-auto mb-3 block"></span>
              <p>No equipment found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
              <table className="table table-zebra w-full">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Model</th>
                    <th>Stock</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {equipment.map(e => (
                    <tr key={e.equipmentId}>
                      <td className="font-mono font-semibold">{e.equipmentId}</td>
                      <td className="max-w-48">
                        <span className="line-clamp-1 font-medium text-sm" title={e.name}>{e.name}</span>
                        {e.serialNumber && <p className="text-xs text-base-content/50 font-mono">{e.serialNumber}</p>}
                      </td>
                      <td>
                        <span className={`badge badge-soft ${typeBadge(e.type)} text-xs`}>{e.type}</span>
                      </td>
                      <td className="text-sm text-base-content/70">{e.model ?? '—'}</td>
                      <td className="text-sm font-medium">{e.stock}</td>
                      <td>
                        <span className={`badge badge-soft ${statusBadge(e.status)} text-xs`}>{e.status}</span>
                      </td>
                      <td>
                        <button className="btn btn-soft btn-primary btn-sm"
                          onClick={() => pushModal(<ManageEquipmentModal equipment={e} onRefresh={() => setRefreshKey(k => k + 1)} />)}>
                          <span className="icon-[tabler--settings] size-4"></span>
                          Manage
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button className="btn btn-sm btn-secondary" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                <span className="icon-[tabler--chevron-left] size-4"></span>Prev
              </button>
              <span className="text-sm text-base-content/60">Page {page + 1} of {totalPages}</span>
              <button className="btn btn-sm btn-secondary" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                Next<span className="icon-[tabler--chevron-right] size-4"></span>
              </button>
            </div>
          )}
        </>
      )}
    </Layout>
  )
}
