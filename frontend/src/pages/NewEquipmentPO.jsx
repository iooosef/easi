import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import Layout from '../components/Layout'
import PickerInput from '../components/PickerInput'
import ProjectPickerModal from '../pickers/ProjectPickerModal'
import { notyfSuccess, notyfError } from '../notyf'

const STEPS = [
  { number: 1, label: 'Purchase Order' },
  { number: 2, label: 'Add Equipment' },
  { number: 3, label: 'PO Documents' },
]

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
const ACCEPTED_EXTENSIONS = '.jpg,.jpeg,.png,.gif,.webp,.pdf'

const EMPTY_PO_FORM = {
  purpose: '', terms: '', deliveryAddress: '', remarks: '',
  paymentMethod: '', ewalletType: '', paymentDetails: '',
}

const EMPTY_EQUIP = {
  name: '', type: 'durable', model: '', serialNumber: '', description: '',
  stock: '1', acquisitionCost: '',
}

const EMPTY_DOC_FORM = { invoiceId: '', file: null }

/** Parses a failed API response into field-level or general error object */
async function parseApiError(res) {
  const data = await res.json().catch(() => ({}))
  if (data.errors) return data.errors
  return { _general: data.message ?? data.error ?? `Error ${res.status}` }
}

/** Page for creating a new Purchase Order with equipment items and optional documents */
export default function NewEquipmentPO() {
  const { apiFetch, officeAddress } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)

  // Step 1: PO form
  const [projectAddress, setProjectAddress] = useState('')
  const [projectDisplay, setProjectDisplay] = useState('')
  const [poForm, setPoForm] = useState(EMPTY_PO_FORM)
  const [poFormError, setPoFormError] = useState({})

  // Step 2: Equipment list
  const [equipList, setEquipList] = useState([])
  const [equipForm, setEquipForm] = useState(EMPTY_EQUIP)
  const [equipFormError, setEquipFormError] = useState({})
  const [addingEquip, setAddingEquip] = useState(false)

  // Step 3: PO Documents list
  const [docList, setDocList] = useState([])
  const [docForm, setDocForm] = useState(EMPTY_DOC_FORM)
  const [docFormError, setDocFormError] = useState({})
  const [addingDoc, setAddingDoc] = useState(false)
  const docFileRef = useRef(null)

  const [submitError, setSubmitError] = useState({})

  function handlePoChange(e) {
    const { name, value } = e.target
    setPoForm(prev => ({ ...prev, [name]: value }))
  }

  function handleEquipChange(e) {
    const { name, value } = e.target
    setEquipForm(prev => ({ ...prev, [name]: value }))
  }

  /** Validates step 1 and advances to step 2 */
  function handleNextFromStep1() {
    const errors = {}
    if (!poForm.purpose.trim()) errors.purpose = 'Purpose is required.'
    if (!poForm.terms.trim()) errors.terms = 'Terms is required.'
    if (Object.keys(errors).length > 0) { setPoFormError(errors); return }
    setPoFormError({})
    setStep(2)
  }

  /** Validates step 2 and advances to step 3 */
  function handleNextFromStep2() {
    if (equipList.length === 0) {
      setSubmitError({ _general: 'Add at least one equipment item before continuing.' })
      return
    }
    setSubmitError({})
    setStep(3)
  }

  /** Validates and adds equipment item to the local list */
  function handleAddEquipToList(e) {
    e.preventDefault()
    const errors = {}
    if (!equipForm.name.trim()) errors.name = 'Name is required.'
    if (!equipForm.stock || Number(equipForm.stock) < 0) errors.stock = 'Stock must be 0 or more.'
    if (Object.keys(errors).length > 0) { setEquipFormError(errors); return }
    setEquipFormError({})
    setEquipList(prev => [...prev, { ...equipForm, _key: Date.now() }])
    setEquipForm(EMPTY_EQUIP)
    setAddingEquip(false)
  }

  function removeEquip(key) {
    setEquipList(prev => prev.filter(e => e._key !== key))
  }

  /** Handles file selection for the doc add form */
  function handleDocFileChange(e) {
    const file = e.target.files?.[0] ?? null
    if (file && !ACCEPTED_TYPES.includes(file.type)) {
      setDocFormError(prev => ({ ...prev, file: 'Only images and PDFs are accepted.' }))
      e.target.value = ''
      return
    }
    setDocFormError(prev => { const n = { ...prev }; delete n.file; return n })
    setDocForm(prev => ({ ...prev, file }))
  }

  /** Validates and adds a document record to the local list */
  function handleAddDocToList(e) {
    e.preventDefault()
    const errors = {}
    if (!docForm.invoiceId.trim()) errors.invoiceId = 'Invoice ID is required.'
    if (Object.keys(errors).length > 0) { setDocFormError(errors); return }
    setDocFormError({})
    setDocList(prev => [...prev, { ...docForm, _key: Date.now() }])
    setDocForm(EMPTY_DOC_FORM)
    if (docFileRef.current) docFileRef.current.value = ''
    setAddingDoc(false)
  }

  function removeDoc(key) {
    setDocList(prev => prev.filter(d => d._key !== key))
  }

  /** Creates PO, then equipment items, then document records */
  async function handleSubmit() {
    setSubmitError({})
    setSubmitting(true)
    try {
      // Create PO
      const poRes = await apiFetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purpose: poForm.purpose,
          terms: poForm.terms,
          deliveryAddress: poForm.deliveryAddress || null,
          remarks: poForm.remarks || null,
          paymentMethod: poForm.paymentMethod === 'ewallet' ? `ewallet:${poForm.ewalletType}` : poForm.paymentMethod || null,
          paymentDetails: poForm.paymentDetails || null,
          srNum: null,
        }),
      })
      if (!poRes.ok) {
        const err = await parseApiError(poRes)
        setSubmitError(err)
        notyfError('Failed to create purchase order.')
        return
      }
      const createdPo = await poRes.json()
      const poNum = createdPo.poNum

      // Create equipment items
      const equipFailures = []
      for (const item of equipList) {
        const equipRes = await apiFetch('/api/equipment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: item.name,
            type: item.type,
            status: 'active',
            model: item.model || null,
            serialNumber: item.serialNumber || null,
            description: item.description || null,
            stock: Number(item.stock),
            acquisitionCost: item.acquisitionCost ? Number(item.acquisitionCost) : null,
            poNum,
          }),
        })
        if (!equipRes.ok) {
          const err = await parseApiError(equipRes)
          equipFailures.push(`"${item.name}": ${err._general ?? JSON.stringify(err)}`)
        }
      }

      // Create document records (upload file first if attached)
      const docFailures = []
      for (const doc of docList) {
        let docuId = null
        if (doc.file) {
          const formData = new FormData()
          formData.append('file', doc.file)
          const uploadRes = await apiFetch('/api/documents', { method: 'POST', body: formData })
          if (!uploadRes.ok) {
            docFailures.push(`Invoice "${doc.invoiceId}": file upload failed`)
            continue
          }
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

      notyfSuccess(`Purchase Order ${poNum} created with ${equipList.length - equipFailures.length} equipment item(s) and ${docList.length - docFailures.length} document(s).`)
      equipFailures.forEach(msg => notyfError(msg))
      docFailures.forEach(msg => notyfError(msg))
      navigate('/inventory/equipment')
    } catch (err) {
      setSubmitError({ _general: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Layout activePage="inventory">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-semibold">Add Equipment via Purchase Order</h1>
        <p className="text-base-content/60 mt-1">Create a purchase order and add equipment items linked to it.</p>
      </div>

      <div className="max-w-2xl">
        {/* Step progress */}
        <div className="flex items-center gap-x-1 mb-6">
          {STEPS.map(s => (
            <div
              key={s.number}
              className={`progress-step transition-colors ${step >= s.number ? 'bg-primary' : 'bg-primary/10'}`}
              role="progressbar"
              aria-label={s.label}
              aria-valuenow={step >= s.number ? 100 : 0}
              aria-valuemin="0"
              aria-valuemax="100"
            />
          ))}
          <p className="text-xs text-primary ms-1 font-medium">{step}/{STEPS.length}</p>
        </div>

        <div className="card bg-base-100 border border-base-300">
          <div className="card-body gap-4">

            {/* ── Step 1: Purchase Order ── */}
            {step === 1 && (
              <div className="flex flex-col gap-4">
                <p className="text-xs font-semibold text-base-content/40 uppercase tracking-wide">
                  Step 1 — Purchase Order Details
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                  <PickerInput
                    label="Project (optional)"
                    displayValue={projectDisplay}
                    placeholder="None selected"
                    buttonLabel="Select Project"
                    Picker={ProjectPickerModal}
                    onSelect={p => { setProjectAddress(p.address ?? ''); setProjectDisplay(`${p.name} (#${p.projNum})`) }}
                    className="sm:col-span-2"
                  />

                  <div className="flex flex-col gap-1">
                    <label className="label-text font-medium">Purpose <span className="text-error">*</span></label>
                    <input type="text" name="purpose" maxLength={30} required
                      className={`input input-bordered w-full${poFormError.purpose ? ' is-invalid' : ''}`}
                      placeholder="e.g. Equipment procurement"
                      value={poForm.purpose} onChange={handlePoChange} />
                    {poFormError.purpose
                      ? <span className="helper-text">{poFormError.purpose}</span>
                      : <span className="text-xs text-base-content/40">{poForm.purpose.length}/30</span>}
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="label-text font-medium">Terms <span className="text-error">*</span></label>
                    <input type="text" name="terms" maxLength={16} required
                      className={`input input-bordered w-full${poFormError.terms ? ' is-invalid' : ''}`}
                      placeholder="e.g. Net 30"
                      value={poForm.terms} onChange={handlePoChange} />
                    {poFormError.terms
                      ? <span className="helper-text">{poFormError.terms}</span>
                      : <span className="text-xs text-base-content/40">{poForm.terms.length}/16</span>}
                  </div>

                  <div className={`flex flex-col gap-1${poForm.paymentMethod === 'ewallet' ? ' sm:col-span-2' : ''}`}>
                    <label className="label-text font-medium">Payment Method</label>
                    <div className="flex gap-2">
                      <select name="paymentMethod"
                        className={`select select-bordered${poForm.paymentMethod === 'ewallet' ? '' : ' w-full'}${poFormError.paymentMethod ? ' is-invalid' : ''}`}
                        value={poForm.paymentMethod} onChange={handlePoChange}>
                        <option value="">— None —</option>
                        <option value="cash">Cash</option>
                        <option value="check">Check</option>
                        <option value="ewallet">E-Wallet</option>
                        <option value="bank">Bank Transfer</option>
                      </select>
                      {poForm.paymentMethod === 'ewallet' && (
                        <select name="ewalletType" required
                          className={`select select-bordered flex-1${poFormError.ewalletType ? ' is-invalid' : ''}`}
                          value={poForm.ewalletType} onChange={handlePoChange}>
                          <option value="">— Select —</option>
                          <option value="GCash">GCash</option>
                          <option value="Maya">Maya</option>
                          <option value="ShopeePay">ShopeePay</option>
                          <option value="GrabPay">GrabPay</option>
                        </select>
                      )}
                    </div>
                    {poFormError.paymentMethod && <span className="helper-text">{poFormError.paymentMethod}</span>}
                    {poForm.paymentMethod === 'ewallet' && poFormError.ewalletType && <span className="helper-text">{poFormError.ewalletType}</span>}
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="label-text font-medium">Payment Details</label>
                    <input type="text" name="paymentDetails" maxLength={60}
                      className={`input input-bordered w-full${poFormError.paymentDetails ? ' is-invalid' : ''}`}
                      placeholder="e.g. Account #1234-5678"
                      value={poForm.paymentDetails} onChange={handlePoChange} />
                    {poFormError.paymentDetails && <span className="helper-text">{poFormError.paymentDetails}</span>}
                  </div>

                  <div className="sm:col-span-2 flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <label className="label-text font-medium">Delivery Address</label>
                      <div className="flex gap-1.5">
                        {projectAddress && (
                          <button type="button" className="btn btn-xs btn-soft btn-secondary"
                            onClick={() => handlePoChange({ target: { name: 'deliveryAddress', value: projectAddress } })}>
                            <span className="icon-[tabler--building] size-3"></span>Same as project
                          </button>
                        )}
                        {officeAddress && (
                          <button type="button" className="btn btn-xs btn-soft btn-secondary"
                            onClick={() => handlePoChange({ target: { name: 'deliveryAddress', value: officeAddress } })}>
                            <span className="icon-[tabler--building-factory-2] size-3"></span>Office address
                          </button>
                        )}
                      </div>
                    </div>
                    <textarea name="deliveryAddress" maxLength={600} rows={2}
                      className={`textarea textarea-bordered w-full${poFormError.deliveryAddress ? ' is-invalid' : ''}`}
                      placeholder="Full delivery address"
                      value={poForm.deliveryAddress} onChange={handlePoChange} />
                    {poFormError.deliveryAddress && <span className="helper-text">{poFormError.deliveryAddress}</span>}
                  </div>

                  <div className="sm:col-span-2 flex flex-col gap-1">
                    <label className="label-text font-medium">Remarks</label>
                    <textarea name="remarks" maxLength={255} rows={2}
                      className={`textarea textarea-bordered w-full${poFormError.remarks ? ' is-invalid' : ''}`}
                      placeholder="Additional notes or instructions"
                      value={poForm.remarks} onChange={handlePoChange} />
                    {poFormError.remarks && <span className="helper-text">{poFormError.remarks}</span>}
                  </div>

                  {poFormError._general && (
                    <div className="sm:col-span-2 alert alert-error py-2">
                      <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                      <span className="text-sm">{poFormError._general}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Step 2: Equipment Items ── */}
            {step === 2 && (
              <div className="flex flex-col gap-4">
                <div>
                  <p className="text-xs font-semibold text-base-content/40 uppercase tracking-wide mb-3">
                    Step 2 — Add Equipment Items
                  </p>
                  <div className="flex items-center gap-2 text-sm text-base-content/60 bg-base-200 rounded-lg px-3 py-2">
                    <span className="icon-[tabler--file-invoice] size-4 shrink-0"></span>
                    <span>PO: <span className="font-medium">{poForm.purpose}</span></span>
                  </div>
                </div>

                {/* Equipment list */}
                {equipList.length === 0 ? (
                  <p className="text-sm text-base-content/40">No equipment added yet. Add at least one item.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {equipList.map((item, idx) => (
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
                            <button
                              type="button"
                              className="btn btn-error btn-xs btn-square shrink-0"
                              title={`Remove item ${idx + 1}`}
                              onClick={() => removeEquip(item._key)}
                            >
                              <span className="icon-[tabler--x] size-3.5"></span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Inline add-equipment form */}
                {addingEquip ? (
                  <div className="card border border-base-300 bg-base-200/40">
                    <div className="card-body gap-3">
                      <p className="text-xs font-semibold text-base-content/50 uppercase tracking-wide">New Equipment Item</p>
                      <form id="new-equip-item-form" onSubmit={handleAddEquipToList}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                          <div className="sm:col-span-2 flex flex-col gap-1">
                            <label className="label-text font-medium">Name <span className="text-error">*</span></label>
                            <input type="text" name="name" maxLength={150} required
                              className={`input input-bordered w-full${equipFormError.name ? ' is-invalid' : ''}`}
                              placeholder="e.g. Industrial Vacuum Pump"
                              value={equipForm.name} onChange={handleEquipChange} />
                            {equipFormError.name && <span className="helper-text">{equipFormError.name}</span>}
                          </div>

                          <div className="flex flex-col gap-1">
                            <label className="label-text font-medium">Type <span className="text-error">*</span></label>
                            <select name="type"
                              className="select select-bordered w-full"
                              value={equipForm.type} onChange={handleEquipChange}>
                              <option value="durable">durable</option>
                              <option value="consumable">consumable</option>
                            </select>
                          </div>

                          <div className="flex flex-col gap-1">
                            <label className="label-text font-medium">Model</label>
                            <input type="text" name="model" maxLength={100}
                              className="input input-bordered w-full"
                              placeholder="e.g. VP-300X"
                              value={equipForm.model} onChange={handleEquipChange} />
                          </div>

                          <div className="flex flex-col gap-1">
                            <label className="label-text font-medium">Serial Number</label>
                            <input type="text" name="serialNumber" maxLength={100}
                              className="input input-bordered w-full"
                              placeholder="e.g. SN-001"
                              value={equipForm.serialNumber} onChange={handleEquipChange} />
                          </div>

                          <div className="flex flex-col gap-1">
                            <label className="label-text font-medium">Stock <span className="text-error">*</span></label>
                            <input type="number" name="stock" min={0} required
                              className={`input input-bordered w-full${equipFormError.stock ? ' is-invalid' : ''}`}
                              placeholder="1"
                              value={equipForm.stock} onChange={handleEquipChange} />
                            {equipFormError.stock && <span className="helper-text">{equipFormError.stock}</span>}
                          </div>

                          <div className="flex flex-col gap-1">
                            <label className="label-text font-medium">Acquisition Cost</label>
                            <input type="number" name="acquisitionCost" min={0} step="0.01"
                              className="input input-bordered w-full"
                              placeholder="e.g. 12500.00"
                              value={equipForm.acquisitionCost} onChange={handleEquipChange} />
                          </div>

                          <div className="sm:col-span-2 flex flex-col gap-1">
                            <label className="label-text font-medium">Description</label>
                            <textarea name="description" maxLength={500} rows={2}
                              className="textarea textarea-bordered w-full"
                              placeholder="Brief description of the equipment"
                              value={equipForm.description} onChange={handleEquipChange} />
                          </div>

                          {equipFormError._general && (
                            <div className="sm:col-span-2 alert alert-error py-2">
                              <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                              <span className="text-sm">{equipFormError._general}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2 justify-end mt-3">
                          <button type="button" className="btn btn-soft btn-secondary btn-sm"
                            onClick={() => { setAddingEquip(false); setEquipForm(EMPTY_EQUIP); setEquipFormError({}) }}>
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
                    onClick={() => { setAddingEquip(true); setEquipForm(EMPTY_EQUIP); setEquipFormError({}) }}>
                    <span className="icon-[tabler--plus] size-4"></span>
                    Add Equipment Item
                  </button>
                )}

                {submitError._general && (
                  <div className="alert alert-error py-2">
                    <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                    <span className="text-sm">{submitError._general}</span>
                  </div>
                )}
              </div>
            )}

            {/* ── Step 3: PO Documents ── */}
            {step === 3 && (
              <div className="flex flex-col gap-4">
                <div>
                  <p className="text-xs font-semibold text-base-content/40 uppercase tracking-wide mb-3">
                    Step 3 — PO Documents <span className="text-base-content/30 font-normal normal-case">(optional)</span>
                  </p>
                  <div className="flex flex-col gap-1 text-sm text-base-content/60 bg-base-200 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="icon-[tabler--file-invoice] size-4 shrink-0"></span>
                      <span>PO: <span className="font-medium">{poForm.purpose}</span></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="icon-[tabler--tool] size-4 shrink-0"></span>
                      <span>{equipList.length} equipment item{equipList.length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                </div>

                {/* Document list */}
                {docList.length === 0 ? (
                  <p className="text-sm text-base-content/40">No documents added. You can skip this step.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {docList.map((doc, idx) => (
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
                            <button
                              type="button"
                              className="btn btn-error btn-xs btn-square shrink-0"
                              title={`Remove document ${idx + 1}`}
                              onClick={() => removeDoc(doc._key)}
                            >
                              <span className="icon-[tabler--x] size-3.5"></span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Inline add-document form */}
                {addingDoc ? (
                  <div className="card border border-base-300 bg-base-200/40">
                    <div className="card-body gap-3">
                      <p className="text-xs font-semibold text-base-content/50 uppercase tracking-wide">New Document Record</p>
                      <form id="new-doc-item-form" onSubmit={handleAddDocToList}>
                        <div className="flex flex-col gap-3">

                          <div className="flex flex-col gap-1">
                            <label className="label-text font-medium">Invoice ID <span className="text-error">*</span></label>
                            <input type="text" maxLength={16} required
                              className={`input input-bordered w-full${docFormError.invoiceId ? ' is-invalid' : ''}`}
                              placeholder="e.g. INV-001"
                              value={docForm.invoiceId}
                              onChange={e => setDocForm(prev => ({ ...prev, invoiceId: e.target.value }))} />
                            {docFormError.invoiceId && <span className="helper-text">{docFormError.invoiceId}</span>}
                          </div>

                          <div className="flex flex-col gap-1">
                            <label className="label-text font-medium">
                              File <span className="text-base-content/40 font-normal">(optional — images or PDF)</span>
                            </label>
                            <input ref={docFileRef} type="file" accept={ACCEPTED_EXTENSIONS} className="hidden" onChange={handleDocFileChange} />
                            <button
                              type="button"
                              className={`btn btn-outline w-full justify-start font-normal${docFormError.file ? ' btn-error' : ''}`}
                              onClick={() => docFileRef.current?.click()}
                            >
                              <span className="icon-[tabler--paperclip] size-4"></span>
                              {docForm.file ? docForm.file.name : 'Choose file…'}
                            </button>
                            {docFormError.file && <span className="helper-text">{docFormError.file}</span>}
                            {docForm.file && <span className="text-xs text-base-content/50">{(docForm.file.size / 1024).toFixed(1)} KB</span>}
                          </div>

                          {docFormError._general && (
                            <div className="alert alert-error py-2">
                              <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                              <span className="text-sm">{docFormError._general}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2 justify-end mt-3">
                          <button type="button" className="btn btn-soft btn-secondary btn-sm"
                            onClick={() => { setAddingDoc(false); setDocForm(EMPTY_DOC_FORM); setDocFormError({}); if (docFileRef.current) docFileRef.current.value = '' }}>
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
                    onClick={() => { setAddingDoc(true); setDocForm(EMPTY_DOC_FORM); setDocFormError({}) }}>
                    <span className="icon-[tabler--plus] size-4"></span>
                    Add Document Record
                  </button>
                )}

                {submitError._general && (
                  <div className="alert alert-error py-2">
                    <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                    <span className="text-sm">{submitError._general}</span>
                  </div>
                )}
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex gap-2 justify-between mt-2">
              {step > 1 && (
                <button type="button" className="btn btn-soft btn-secondary"
                  onClick={() => { setStep(s => s - 1); setSubmitError({}) }}>
                  <span className="icon-[tabler--arrow-left] size-4"></span> Back
                </button>
              )}

              {step === 1 && (
                <button type="button" className="btn btn-primary" onClick={handleNextFromStep1}>
                  Next <span className="icon-[tabler--arrow-right] size-4"></span>
                </button>
              )}

              {step === 2 && (
                <button type="button" className="btn btn-primary"
                  disabled={addingEquip}
                  onClick={handleNextFromStep2}>
                  Next <span className="icon-[tabler--arrow-right] size-4"></span>
                </button>
              )}

              {step === 3 && (
                <button type="button" className="btn btn-primary"
                  disabled={submitting || addingDoc}
                  onClick={handleSubmit}>
                  {submitting
                    ? <span className="loading loading-spinner loading-sm"></span>
                    : <span className="icon-[tabler--plus] size-4"></span>
                  }
                  Add Purchase Order &amp; Equipment
                </button>
              )}
            </div>

          </div>
        </div>
      </div>
    </Layout>
  )
}
