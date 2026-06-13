import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import Layout from '../components/Layout'
import PickerInput from '../components/PickerInput'
import ProjectPickerModal from '../pickers/ProjectPickerModal'
import SchedulePickerModal from '../pickers/SchedulePickerModal'
import EmployeePickerModal from '../pickers/EmployeePickerModal'
import { notyfSuccess, notyfError } from '../notyf'

const PAYMENT_OPTIONS = ['unset', 'cash', 'check', 'gcash', 'bank']
const STATUS_OPTIONS = ['unpaid', 'paid', 'partial']
const FINDING_TYPE_OPTIONS = ['GOOD', 'DEFECT', 'WORN', 'DIRTY', 'LEAK', 'FAIL']

const STEPS = [
  { number: 1, label: 'Service Report Details' },
  { number: 2, label: 'Findings (Optional)' },
  { number: 3, label: 'Purchase Orders (Optional)' },
  { number: 4, label: 'Billing (Optional)' },
  { number: 5, label: 'Document (Optional)' },
]

const ACCEPTED_DOC_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
const ACCEPTED_DOC_EXTENSIONS = '.jpg,.jpeg,.png,.gif,.webp,.pdf'

const EMPTY_REPORT_FORM = {
  projNum: '',
  _projectDisplay: '',
  _projectAddress: '',
  schedId: '',
  _scheduleDisplay: '',
  engineerEmployeeId: '',
  _engineerDisplay: '',
  complaint: '',
  workDone: '',
  location: '',
}

const EMPTY_FINDING_FORM = {
  findingType: 'GOOD',
  partModel: '',
  acNum: '',
  remarks: '',
}

const EMPTY_PO_FORM = {
  purpose: '',
  terms: '',
  paymentMethod: '',
  ewalletType: '',
  paymentDetails: '',
  deliveryAddress: '',
  remarks: '',
}

const EMPTY_CONTACT_FORM = { contactName: '', contactNumber: '' }

const EMPTY_BILLING_FORM = { description: '', quantity: '', unitPrice: '' }

const EMPTY_PART_FORM = {
  name: '',
  quantity: '',
  quantityType: '',
  unitPrice: '',
  supplierId: '',
  _supplierName: '',
  orderDate: '',
}

/** Parses a failed API response into field-level or general error object */
async function parseApiError(res) {
  const data = await res.json().catch(() => ({}))
  if (data.errors) return data.errors
  return { _general: data.message ?? data.error ?? `Error ${res.status}` }
}

/** Returns badge class for finding type */
function findingTypeBadgeClass(type) {
  if (type === 'GOOD') return 'badge-success'
  if (type === 'DEFECT' || type === 'FAIL') return 'badge-error'
  if (type === 'LEAK') return 'badge-warning'
  return 'badge-neutral'
}

/** Multi-step wizard for creating a new service report with optional findings and purchase orders */
export default function NewServiceReport() {
  const { apiFetch, officeAddress } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState(1)

  // Step 1: service report form state
  const [reportForm, setReportForm] = useState(EMPTY_REPORT_FORM)
  const [reportFormError, setReportFormError] = useState({})
  const [docFile, setDocFile] = useState(null)
  const [docFileError, setDocFileError] = useState('')
  const fileInputRef = useRef(null)

  // Step 2: local findings list (not yet persisted)
  const [findings, setFindings] = useState([])
  const [acUnits, setAcUnits] = useState([])
  const [addFindingOpen, setAddFindingOpen] = useState(false)
  const [findingForm, setFindingForm] = useState(EMPTY_FINDING_FORM)
  const [findingFormError, setFindingFormError] = useState({})

  // Step 3: local purchase orders list (not yet persisted)
  const [purchaseOrders, setPurchaseOrders] = useState([])
  const [addPoOpen, setAddPoOpen] = useState(false)
  const [poForm, setPoForm] = useState(EMPTY_PO_FORM)
  const [poFormError, setPoFormError] = useState({})

  // Delivery contacts for the PO currently being composed
  const [poContacts, setPoContacts] = useState([])
  const [contactModalOpen, setContactModalOpen] = useState(false)
  const [contactForm, setContactForm] = useState(EMPTY_CONTACT_FORM)
  const [contactFormError, setContactFormError] = useState({})

  // Parts for the PO currently being composed
  const [poParts, setPoParts] = useState([])
  const [partModalOpen, setPartModalOpen] = useState(false)
  const [partForm, setPartForm] = useState(EMPTY_PART_FORM)
  const [partFormError, setPartFormError] = useState({})
  const [suppliers, setSuppliers] = useState([])

  // Step 4: billing items
  const [billingItems, setBillingItems] = useState([])
  const [addBillingOpen, setAddBillingOpen] = useState(false)
  const [billingForm, setBillingForm] = useState(EMPTY_BILLING_FORM)
  const [billingFormError, setBillingFormError] = useState({})

  // Final submit state
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState({})

  /** Loads AC units for the selected project when the projNum changes */
  useEffect(() => {
    if (!reportForm.projNum) { setAcUnits([]); return }
    apiFetch(`/api/ac-units?projNum=${reportForm.projNum}&size=100&sort=acNum,asc`)
      .then(res => res.json())
      .then(data => setAcUnits(data.content ?? []))
      .catch(() => {})
  }, [apiFetch, reportForm.projNum])

  /** Loads all suppliers once for the part form supplier select */
  useEffect(() => {
    apiFetch('/api/suppliers?size=200&sort=name,asc')
      .then(res => res.json())
      .then(data => setSuppliers(data.content ?? []))
      .catch(() => {})
  }, [apiFetch])

  function handleReportFormChange(e) {
    const { name, value } = e.target
    setReportForm(prev => ({ ...prev, [name]: value }))
  }

  /** Validates step 1 fields and advances to the next step */
  function handleNext() {
    setReportFormError({})
    if (step === 1) {
      const errors = {}
      if (!reportForm.projNum) errors.projNum = 'Please select a project.'
      if (!reportForm.schedId) errors.schedId = 'Please select a schedule.'
      if (!reportForm.location.trim()) errors.location = 'Location is required.'
      if (!reportForm.complaint.trim()) errors.complaint = 'Complaint is required.'
      if (!reportForm.workDone.trim()) errors.workDone = 'Work done is required.'
      if (Object.keys(errors).length > 0) { setReportFormError(errors); return }
    }
    if (step === 2 && addFindingOpen) {
      notyfError('Please add or cancel the finding form before proceeding.')
      return
    }
    if (step === 3 && addPoOpen) {
      notyfError('Please add or cancel the purchase order form before proceeding.')
      return
    }
    setStep(s => s + 1)
  }

  // --- Findings helpers ---

  function handleFindingFormChange(e) {
    const { name, value } = e.target
    setFindingForm(prev => ({ ...prev, [name]: value }))
  }

  /** Validates and appends a finding to the local list */
  function handleAddFinding(e) {
    e.preventDefault()
    const errors = {}
    if (!findingForm.acNum) errors.acNum = 'Please select an AC unit.'
    if (Object.keys(errors).length > 0) { setFindingFormError(errors); return }
    setFindings(list => [...list, { ...findingForm, _tempId: Date.now() }])
    setFindingForm(EMPTY_FINDING_FORM)
    setFindingFormError({})
    setAddFindingOpen(false)
  }

  /** Removes a finding from the local list by its temporary ID */
  function removeFinding(tempId) {
    setFindings(list => list.filter(f => f._tempId !== tempId))
  }

  // --- Purchase order helpers ---

  function handlePoFormChange(e) {
    const { name, value } = e.target
    setPoForm(prev => ({ ...prev, [name]: value }))
  }

  /** Validates and appends a purchase order (with its delivery contacts and parts) to the local list */
  function handleAddPo(e) {
    e.preventDefault()
    const errors = {}
    if (!poForm.purpose.trim()) errors.purpose = 'Purpose is required.'
    if (!poForm.terms.trim()) errors.terms = 'Terms are required.'
    if (Object.keys(errors).length > 0) { setPoFormError(errors); return }
    setPurchaseOrders(list => [...list, { ...poForm, contacts: poContacts, parts: poParts, _tempId: Date.now() }])
    setPoForm(EMPTY_PO_FORM)
    setPoFormError({})
    setPoContacts([])
    setPoParts([])
    setAddPoOpen(false)
  }

  // --- Delivery contact helpers (per-PO, pre-submit) ---

  function handleContactFormChange(e) {
    const { name, value } = e.target
    setContactForm(prev => ({ ...prev, [name]: value }))
  }

  /** Validates and appends a delivery contact to the current PO's contact list */
  function handleAddContact(e) {
    e.preventDefault()
    const errors = {}
    if (!contactForm.contactName.trim()) errors.contactName = 'Contact name is required.'
    if (!contactForm.contactNumber.trim()) errors.contactNumber = 'Contact number is required.'
    if (Object.keys(errors).length > 0) { setContactFormError(errors); return }
    setPoContacts(list => [...list, { ...contactForm, _tempId: Date.now() }])
    setContactForm(EMPTY_CONTACT_FORM)
    setContactFormError({})
  }

  /** Removes a delivery contact from the current PO's local contact list */
  function removeContact(tempId) {
    setPoContacts(list => list.filter(c => c._tempId !== tempId))
  }

  // --- Part helpers (per-PO, pre-submit) ---

  function handlePartFormChange(e) {
    const { name, value } = e.target
    setPartForm(prev => ({ ...prev, [name]: value }))
  }

  /** Validates and appends a part to the current PO's parts list */
  function handleAddPart(e) {
    e.preventDefault()
    const errors = {}
    if (!partForm.name.trim()) errors.name = 'Name is required.'
    if (partForm.quantity === '' || Number(partForm.quantity) < 0) errors.quantity = 'Quantity must be 0 or greater.'
    if (!partForm.quantityType.trim()) errors.quantityType = 'Quantity type is required.'
    if (partForm.unitPrice === '' || Number(partForm.unitPrice) < 0) errors.unitPrice = 'Unit price must be 0 or greater.'
    if (!partForm.supplierId) errors.supplierId = 'Please select a supplier.'
    if (Object.keys(errors).length > 0) { setPartFormError(errors); return }
    setPoParts(list => [...list, { ...partForm, _tempId: Date.now() }])
    setPartForm(EMPTY_PART_FORM)
    setPartFormError({})
  }

  /** Removes a part from the current PO's local parts list */
  function removePart(tempId) {
    setPoParts(list => list.filter(p => p._tempId !== tempId))
  }

  // --- Billing item helpers ---

  function handleBillingFormChange(e) {
    const { name, value } = e.target
    setBillingForm(prev => ({ ...prev, [name]: value }))
  }

  /** Validates and appends a billing item to the local list */
  function handleAddBillingItem(e) {
    e.preventDefault()
    const errors = {}
    if (!billingForm.description.trim()) errors.description = 'Description is required.'
    if (!billingForm.quantity || Number(billingForm.quantity) < 1) errors.quantity = 'Quantity must be at least 1.'
    if (billingForm.unitPrice === '' || Number(billingForm.unitPrice) < 0) errors.unitPrice = 'Unit price must be 0 or greater.'
    if (Object.keys(errors).length > 0) { setBillingFormError(errors); return }
    setBillingItems(list => [...list, { ...billingForm, _tempId: Date.now() }])
    setBillingForm(EMPTY_BILLING_FORM)
    setBillingFormError({})
    setAddBillingOpen(false)
  }

  /** Removes a billing item from the local list by its temporary ID */
  function removeBillingItem(tempId) {
    setBillingItems(list => list.filter(b => b._tempId !== tempId))
  }

  /** Removes a purchase order from the local list by its temporary ID */
  function removePo(tempId) {
    setPurchaseOrders(list => list.filter(p => p._tempId !== tempId))
  }

  /**
   * Final submit: creates the service report, then sequentially posts
   * each finding and purchase order using the returned srNumber.
   */
  async function handleFinalSubmit() {
    if (addBillingOpen) {
      notyfError('Please add or cancel the billing item form before submitting.')
      return
    }
    setSubmitError({})
    setSubmitting(true)
    try {
      // 1. Create the service report
      const srRes = await apiFetch('/api/service-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projNum: Number(reportForm.projNum),
          complaint: reportForm.complaint,
          workDone: reportForm.workDone,
          engineerEmployeeId: reportForm.engineerEmployeeId ? Number(reportForm.engineerEmployeeId) : null,
          location: reportForm.location || null,
          schedId: reportForm.schedId ? Number(reportForm.schedId) : null,
        }),
      })
      if (!srRes.ok) {
        setSubmitError(await parseApiError(srRes))
        notyfError('Failed to create service report.')
        return
      }
      const sr = await srRes.json()
      const srNumber = sr.srNumber

      // 2. Upload document and link it to the service report
      if (docFile) {
        const formData = new FormData()
        formData.append('file', docFile)
        const docRes = await apiFetch('/api/documents', { method: 'POST', body: formData })
        if (docRes.ok) {
          const doc = await docRes.json()
          await apiFetch(`/api/service-reports/${srNumber}/document`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ docuId: doc.docuId }),
          })
        } else {
          notyfError('Document could not be uploaded. SR was still created.')
        }
      }

      // 4. Create each finding
      for (const f of findings) {
        const fRes = await apiFetch('/api/service-report-findings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            srNumber,
            findingType: f.findingType || null,
            partModel: f.partModel || null,
            acNum: f.acNum ? Number(f.acNum) : null,
            remarks: f.remarks || null,
          }),
        })
        if (!fRes.ok) {
          console.error('[NewServiceReport] Finding save failed:', fRes.status, await fRes.text().catch(() => ''))
          notyfError('A finding could not be saved and was skipped.')
        }
      }

      // 5. Create each purchase order and its delivery contacts
      for (const po of purchaseOrders) {
        const poRes = await apiFetch('/api/purchase-orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            purpose: po.purpose,
            terms: po.terms,
            paymentMethod: po.paymentMethod === 'ewallet' ? `ewallet:${po.ewalletType}` : po.paymentMethod || null,
            paymentDetails: po.paymentDetails || null,
            deliveryAddress: po.deliveryAddress || null,
            remarks: po.remarks || null,
            srNum: srNumber,
            projNum: Number(reportForm.projNum),
          }),
        })
        if (!poRes.ok) {
          console.error('[NewServiceReport] PO save failed:', poRes.status, await poRes.text().catch(() => ''))
          notyfError('A purchase order could not be saved and was skipped.')
          continue
        }
        const createdPo = await poRes.json()
        for (const contact of po.contacts ?? []) {
          const cRes = await apiFetch('/api/purchase-order-delivery-contacts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              poNum: createdPo.poNum,
              contactName: contact.contactName,
              contactNumber: contact.contactNumber,
            }),
          })
          if (!cRes.ok) {
            console.error('[NewServiceReport] Contact save failed:', cRes.status, await cRes.text().catch(() => ''))
            notyfError('A delivery contact could not be saved and was skipped.')
          }
        }
        for (const part of po.parts ?? []) {
          const pRes = await apiFetch('/api/parts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              poNum: createdPo.poNum,
              name: part.name,
              quantityOrdered: Number(part.quantity),
              quantityType: part.quantityType,
              unitPrice: Number(part.unitPrice),
              supplierId: Number(part.supplierId),
              orderDate: part.orderDate || null,
            }),
          })
          if (!pRes.ok) {
            console.error('[NewServiceReport] Part save failed:', pRes.status, await pRes.text().catch(() => ''))
            notyfError('A part could not be saved and was skipped.')
          }
        }
      }

      // 6. Create each billing item
      for (const b of billingItems) {
        const bRes = await apiFetch('/api/service-report-billing-items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            srNumber,
            description: b.description,
            quantity: Number(b.quantity),
            unitPrice: Number(b.unitPrice),
          }),
        })
        if (!bRes.ok) {
          console.error('[NewServiceReport] Billing item save failed:', bRes.status, await bRes.text().catch(() => ''))
          notyfError('A billing item could not be saved and was skipped.')
        }
      }

      notyfSuccess(`Service Report #${srNumber} created successfully.`)
      navigate('/service-report')
    } catch (err) {
      console.error('[NewServiceReport] handleFinalSubmit error:', err)
      setSubmitError({ _general: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Layout activePage="service-report">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-semibold">New Service Report</h1>
        <p className="text-base-content/60 mt-1">Create a new Project Service Report with optional findings and purchase orders.</p>
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

            {/* ── Step 1: Service Report Details ─────────────────────── */}
            {step === 1 && (
              <div className="flex flex-col gap-4">
                <p className="text-xs font-semibold text-base-content/40 uppercase tracking-wide">
                  Step 1 — Service Report Details
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                  <PickerInput
                    label="Project"
                    displayValue={reportForm._projectDisplay}
                    placeholder="None selected"
                    buttonLabel="Select Project"
                    required
                    error={reportFormError.projNum}
                    Picker={ProjectPickerModal}
                    onSelect={p => {
                      setReportForm(prev => ({ ...prev, projNum: p.projNum, _projectDisplay: `${p.name} (#${p.projNum})`, _projectAddress: p.address ?? '', schedId: '', _scheduleDisplay: '' }))
                      setReportFormError(e => ({ ...e, projNum: undefined, schedId: undefined }))
                    }}
                    className="sm:col-span-2"
                  />

                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <label className="label-text font-medium">Location <span className="text-error">*</span></label>
                      {reportForm._projectAddress && (
                        <button
                          type="button"
                          className="btn btn-xs btn-soft btn-secondary"
                          onClick={() => {
                            setReportForm(prev => ({ ...prev, location: prev._projectAddress }))
                            setReportFormError(e => ({ ...e, location: undefined }))
                          }}
                        >
                          <span className="icon-[tabler--building] size-3"></span>Use Project Address
                        </button>
                      )}
                    </div>
                    <input type="text" name="location" maxLength={255}
                      className={`input input-bordered w-full${reportFormError.location ? ' is-invalid' : ''}`}
                      placeholder="e.g. 3rd Floor East Wing, ABC Corp" required
                      value={reportForm.location} onChange={handleReportFormChange} />
                    {reportFormError.location && <span className="helper-text">{reportFormError.location}</span>}
                  </div>

                  <PickerInput
                    label="Schedule"
                    displayValue={reportForm._scheduleDisplay}
                    placeholder={reportForm.projNum ? 'None selected' : 'Select a project first'}
                    buttonLabel="Select Schedule"
                    required
                    disabled={!reportForm.projNum}
                    error={reportFormError.schedId}
                    Picker={SchedulePickerModal}
                    pickerProps={{ projNum: reportForm.projNum }}
                    onSelect={s => {
                      setReportForm(prev => ({ ...prev, schedId: s.schedId, _scheduleDisplay: `Sched #${s.schedId} — ${s.purpose ?? ''}` }))
                      setReportFormError(e => ({ ...e, schedId: undefined }))
                    }}
                  />

                  <div className="sm:col-span-2 flex flex-col gap-1">
                    <label className="label-text font-medium">Complaint <span className="text-error">*</span></label>
                    <textarea name="complaint" rows={3} maxLength={900}
                      className={`textarea textarea-bordered w-full${reportFormError.complaint ? ' is-invalid' : ''}`}
                      placeholder="Describe the complaint..." required
                      value={reportForm.complaint} onChange={handleReportFormChange} />
                    {reportFormError.complaint && <span className="helper-text">{reportFormError.complaint}</span>}
                  </div>

                  <div className="sm:col-span-2 flex flex-col gap-1">
                    <label className="label-text font-medium">Work Done <span className="text-error">*</span></label>
                    <textarea name="workDone" rows={3} maxLength={900}
                      className={`textarea textarea-bordered w-full${reportFormError.workDone ? ' is-invalid' : ''}`}
                      placeholder="Describe the work performed..." required
                      value={reportForm.workDone} onChange={handleReportFormChange} />
                    {reportFormError.workDone && <span className="helper-text">{reportFormError.workDone}</span>}
                  </div>

                  <PickerInput
                    label="Assigned Engineer"
                    displayValue={reportForm._engineerDisplay}
                    placeholder="None assigned"
                    buttonLabel="Select Engineer"
                    error={reportFormError.engineerEmployeeId}
                    Picker={EmployeePickerModal}
                    pickerProps={{ position: 'Engineer' }}
                    onSelect={e => setReportForm(prev => ({
                      ...prev,
                      engineerEmployeeId: e.employeeId,
                      _engineerDisplay: `${e.lastName}, ${e.firstName} (#${e.employeeId})`,
                    }))}
                    className="sm:col-span-2"
                  />

                  {reportFormError._general && (
                    <div className="sm:col-span-2 alert alert-error py-2">
                      <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                      <span className="text-sm">{reportFormError._general}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Step 2: Manage Findings ─────────────────────────────── */}
            {step === 2 && (
              <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-base-content/40 uppercase tracking-wide">
                      Step 2 — Manage Findings (Optional)
                    </p>
                    <p className="text-sm text-base-content/60 mt-1">
                      Add findings for this service report, or skip to continue.
                    </p>
                  </div>
                  {!addFindingOpen && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm shrink-0"
                      onClick={() => {
                        setFindingForm(EMPTY_FINDING_FORM)
                        setFindingFormError({})
                        setAddFindingOpen(true)
                      }}
                    >
                      <span className="icon-[tabler--plus] size-4"></span>
                      Add Finding
                    </button>
                  )}
                </div>

                {/* Inline add-finding form */}
                {addFindingOpen && (
                  <div className="border border-base-300 rounded-box p-4 bg-base-200/40">
                    <p className="text-sm font-semibold mb-3">New Finding</p>
                    <form onSubmit={handleAddFinding}>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">

                        <div className="flex flex-col gap-1">
                          <label className="label-text font-medium">AC Unit <span className="text-error">*</span></label>
                          <select name="acNum" required
                            className={`select select-bordered w-full${findingFormError.acNum ? ' is-invalid' : ''}`}
                            value={findingForm.acNum} onChange={handleFindingFormChange}>
                            <option value="">Select AC unit...</option>
                            {acUnits.map(u => (
                              <option key={u.acNum} value={u.acNum}>#{u.acNum} — {u.brand} {u.model}</option>
                            ))}
                          </select>
                          {findingFormError.acNum && <span className="helper-text">{findingFormError.acNum}</span>}
                          {acUnits.length === 0 && (
                            <span className="text-xs text-base-content/40">No AC units found for this project.</span>
                          )}
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="label-text font-medium">Finding Type</label>
                          <select name="findingType"
                            className={`select select-bordered w-full${findingFormError.findingType ? ' is-invalid' : ''}`}
                            value={findingForm.findingType} onChange={handleFindingFormChange}>
                            {FINDING_TYPE_OPTIONS.map(o => (
                              <option key={o} value={o}>{o}</option>
                            ))}
                          </select>
                          {findingFormError.findingType && <span className="helper-text">{findingFormError.findingType}</span>}
                        </div>

                        <div className="sm:col-span-2 flex flex-col gap-1">
                          <label className="label-text font-medium">Part / Model</label>
                          <input type="text" name="partModel" maxLength={60}
                            className={`input input-bordered w-full${findingFormError.partModel ? ' is-invalid' : ''}`}
                            placeholder="e.g. Capacitor 35/5 MFD"
                            value={findingForm.partModel} onChange={handleFindingFormChange} />
                          {findingFormError.partModel && <span className="helper-text">{findingFormError.partModel}</span>}
                        </div>

                        <div className="sm:col-span-2 flex flex-col gap-1">
                          <label className="label-text font-medium">Remarks</label>
                          <textarea name="remarks" rows={3} maxLength={1200}
                            className={`textarea textarea-bordered w-full${findingFormError.remarks ? ' is-invalid' : ''}`}
                            placeholder="Describe the finding in detail..."
                            value={findingForm.remarks} onChange={handleFindingFormChange} />
                          {findingFormError.remarks && <span className="helper-text">{findingFormError.remarks}</span>}
                        </div>

                        {findingFormError._general && (
                          <div className="sm:col-span-2 alert alert-error py-2">
                            <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                            <span className="text-sm">{findingFormError._general}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2 justify-end">
                        <button
                          type="button"
                          className="btn btn-soft btn-secondary btn-sm"
                          onClick={() => {
                            setAddFindingOpen(false)
                            setFindingForm(EMPTY_FINDING_FORM)
                            setFindingFormError({})
                          }}
                        >
                          Cancel
                        </button>
                        <button type="submit" className="btn btn-primary btn-sm">
                          <span className="icon-[tabler--plus] size-4"></span>
                          Add Finding
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Findings list */}
                {findings.length === 0 && !addFindingOpen ? (
                  <div className="text-center py-10 text-base-content/40">
                    <span className="icon-[tabler--checklist] size-10 mx-auto mb-2 block"></span>
                    <p className="text-sm">No findings added yet. You can skip this step.</p>
                  </div>
                ) : findings.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {findings.map((f, i) => (
                      <div
                        key={f._tempId}
                        className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-box border border-base-300 bg-base-100"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <span className="text-xs text-base-content/40 font-mono w-5 shrink-0">{i + 1}</span>
                          <span className={`badge badge-soft ${findingTypeBadgeClass(f.findingType)} text-xs shrink-0`}>
                            {f.findingType}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">
                              AC #{f.acNum}{f.partModel ? ` — ${f.partModel}` : ''}
                            </p>
                            {f.remarks && (
                              <p className="text-xs text-base-content/50 truncate">{f.remarks}</p>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-error btn-xs btn-square shrink-0"
                          title="Remove finding"
                          onClick={() => removeFinding(f._tempId)}
                        >
                          <span className="icon-[tabler--x] size-3.5"></span>
                        </button>
                      </div>
                    ))}
                    <p className="text-xs text-base-content/40 text-right">
                      {findings.length} finding{findings.length !== 1 ? 's' : ''} added
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── Step 3: Manage Purchase Orders ──────────────────────── */}
            {step === 3 && (
              <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-base-content/40 uppercase tracking-wide">
                      Step 3 — Manage Purchase Orders (Optional)
                    </p>
                    <p className="text-sm text-base-content/60 mt-1">
                      Add purchase orders for this service report, or skip to finish.
                    </p>
                  </div>
                  {!addPoOpen && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm shrink-0"
                      onClick={() => {
                        setPoForm(EMPTY_PO_FORM)
                        setPoFormError({})
                        setPoContacts([])
                        setPoParts([])
                        setAddPoOpen(true)
                      }}
                    >
                      <span className="icon-[tabler--plus] size-4"></span>
                      Add PO
                    </button>
                  )}
                </div>

                {/* Inline add-PO form */}
                {addPoOpen && (
                  <div className="border border-base-300 rounded-box p-4 bg-base-200/40">
                    <p className="text-sm font-semibold mb-3">New Purchase Order</p>
                    <form onSubmit={handleAddPo}>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">

                        <div className="flex flex-col gap-1">
                          <label className="label-text font-medium">Purpose <span className="text-error">*</span></label>
                          <input type="text" name="purpose"
                            className={`input input-bordered w-full${poFormError.purpose ? ' is-invalid' : ''}`}
                            placeholder="e.g. Repair Parts" maxLength={30} required
                            value={poForm.purpose} onChange={handlePoFormChange} />
                          {poFormError.purpose && <span className="helper-text">{poFormError.purpose}</span>}
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="label-text font-medium">Terms <span className="text-error">*</span></label>
                          <input type="text" name="terms"
                            className={`input input-bordered w-full${poFormError.terms ? ' is-invalid' : ''}`}
                            placeholder="e.g. net30" maxLength={16} required
                            value={poForm.terms} onChange={handlePoFormChange} />
                          {poFormError.terms && <span className="helper-text">{poFormError.terms}</span>}
                        </div>

                        <div className={`flex flex-col gap-1${poForm.paymentMethod === 'ewallet' ? ' sm:col-span-2' : ''}`}>
                          <label className="label-text font-medium">Payment Method</label>
                          <div className="flex gap-2">
                            <select name="paymentMethod"
                              className={`select select-bordered${poForm.paymentMethod === 'ewallet' ? '' : ' w-full'}${poFormError.paymentMethod ? ' is-invalid' : ''}`}
                              value={poForm.paymentMethod} onChange={handlePoFormChange}>
                              <option value="">— None —</option>
                              <option value="cash">Cash</option>
                              <option value="check">Check</option>
                              <option value="ewallet">E-Wallet</option>
                              <option value="bank">Bank Transfer</option>
                            </select>
                            {poForm.paymentMethod === 'ewallet' && (
                              <select name="ewalletType" required
                                className={`select select-bordered flex-1${poFormError.ewalletType ? ' is-invalid' : ''}`}
                                value={poForm.ewalletType} onChange={handlePoFormChange}>
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
                          <input type="text" name="paymentDetails"
                            className={`input input-bordered w-full${poFormError.paymentDetails ? ' is-invalid' : ''}`}
                            placeholder="e.g. BDO #1234567890" maxLength={60}
                            value={poForm.paymentDetails} onChange={handlePoFormChange} />
                          {poFormError.paymentDetails && <span className="helper-text">{poFormError.paymentDetails}</span>}
                        </div>

                        <div className="sm:col-span-2 flex flex-col gap-1">
                          <div className="flex items-center justify-between gap-2">
                            <label className="label-text font-medium">Delivery Address</label>
                            <div className="flex gap-1.5">
                              {reportForm._projectAddress && (
                                <button type="button" className="btn btn-xs btn-soft btn-secondary"
                                  onClick={() => setPoForm(p => ({ ...p, deliveryAddress: reportForm._projectAddress }))}>
                                  <span className="icon-[tabler--building] size-3"></span>Same as project
                                </button>
                              )}
                              {officeAddress && (
                                <button type="button" className="btn btn-xs btn-soft btn-secondary"
                                  onClick={() => setPoForm(p => ({ ...p, deliveryAddress: officeAddress }))}>
                                  <span className="icon-[tabler--building-factory-2] size-3"></span>Office address
                                </button>
                              )}
                            </div>
                          </div>
                          <textarea name="deliveryAddress"
                            className={`textarea textarea-bordered w-full${poFormError.deliveryAddress ? ' is-invalid' : ''}`}
                            placeholder="Full delivery address" maxLength={600} rows={2}
                            value={poForm.deliveryAddress} onChange={handlePoFormChange} />
                          {poFormError.deliveryAddress && <span className="helper-text">{poFormError.deliveryAddress}</span>}
                        </div>

                        <div className="sm:col-span-2 flex flex-col gap-1">
                          <label className="label-text font-medium">Remarks</label>
                          <textarea name="remarks"
                            className={`textarea textarea-bordered w-full${poFormError.remarks ? ' is-invalid' : ''}`}
                            placeholder="Optional notes" maxLength={255} rows={2}
                            value={poForm.remarks} onChange={handlePoFormChange} />
                          {poFormError.remarks && <span className="helper-text">{poFormError.remarks}</span>}
                        </div>

                        {poFormError._general && (
                          <div className="sm:col-span-2 alert alert-error py-2">
                            <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                            <span className="text-sm">{poFormError._general}</span>
                          </div>
                        )}
                      </div>

                      {/* Delivery contacts */}
                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">Delivery Contacts</span>
                          <button
                            type="button"
                            className="btn btn-soft btn-accent btn-sm"
                            onClick={() => { setContactForm(EMPTY_CONTACT_FORM); setContactFormError({}); setContactModalOpen(true) }}
                          >
                            <span className="icon-[tabler--address-book] size-4"></span>
                            Add Delivery Contact
                          </button>
                        </div>
                        {poContacts.length > 0 ? (
                          <div className="overflow-x-auto rounded-box border border-base-300">
                            <table className="table table-sm">
                              <thead>
                                <tr>
                                  <th>#</th>
                                  <th>Name</th>
                                  <th>Number</th>
                                  <th></th>
                                </tr>
                              </thead>
                              <tbody>
                                {poContacts.map((c, i) => (
                                  <tr key={c._tempId}>
                                    <td className="text-base-content/40 font-mono">{i + 1}</td>
                                    <td>{c.contactName}</td>
                                    <td>{c.contactNumber}</td>
                                    <td className="text-end">
                                      <button
                                        type="button"
                                        className="btn btn-error btn-xs btn-square"
                                        title="Remove contact"
                                        onClick={() => removeContact(c._tempId)}
                                      >
                                        <span className="icon-[tabler--x] size-3.5"></span>
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="text-sm text-base-content/40">No delivery contacts added yet.</p>
                        )}
                      </div>

                      {/* Parts */}
                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">Parts</span>
                          <button
                            type="button"
                            className="btn btn-soft btn-accent btn-sm"
                            onClick={() => { setPartForm(EMPTY_PART_FORM); setPartFormError({}); setPartModalOpen(true) }}
                          >
                            <span className="icon-[tabler--package] size-4"></span>
                            Add Part
                          </button>
                        </div>
                        {poParts.length > 0 ? (
                          <div className="overflow-x-auto rounded-box border border-base-300">
                            <table className="table table-sm">
                              <thead>
                                <tr>
                                  <th>#</th>
                                  <th>Name</th>
                                  <th>Qty</th>
                                  <th>Unit Price</th>
                                  <th>Supplier</th>
                                  <th></th>
                                </tr>
                              </thead>
                              <tbody>
                                {poParts.map((p, i) => (
                                  <tr key={p._tempId}>
                                    <td className="text-base-content/40 font-mono">{i + 1}</td>
                                    <td>{p.name}</td>
                                    <td>{p.quantity} {p.quantityType}</td>
                                    <td>₱{Number(p.unitPrice).toFixed(2)}</td>
                                    <td>{p._supplierName}</td>
                                    <td className="text-end">
                                      <button
                                        type="button"
                                        className="btn btn-error btn-xs btn-square"
                                        title="Remove part"
                                        onClick={() => removePart(p._tempId)}
                                      >
                                        <span className="icon-[tabler--x] size-3.5"></span>
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="text-sm text-base-content/40">No parts added yet.</p>
                        )}
                      </div>

                      <div className="flex gap-2 justify-end">
                        <button
                          type="button"
                          className="btn btn-soft btn-secondary btn-sm"
                          onClick={() => {
                            setAddPoOpen(false)
                            setPoForm(EMPTY_PO_FORM)
                            setPoFormError({})
                            setPoContacts([])
                            setPoParts([])
                          }}
                        >
                          Cancel
                        </button>
                        <button type="submit" className="btn btn-primary btn-sm">
                          <span className="icon-[tabler--plus] size-4"></span>
                          Add Purchase Order
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* PO list */}
                {purchaseOrders.length === 0 && !addPoOpen ? (
                  <div className="text-center py-10 text-base-content/40">
                    <span className="icon-[tabler--file-invoice-off] size-10 mx-auto mb-2 block"></span>
                    <p className="text-sm">No purchase orders added yet. You can skip this step.</p>
                  </div>
                ) : purchaseOrders.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {purchaseOrders.map((po, i) => (
                      <div
                        key={po._tempId}
                        className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-box border border-base-300 bg-base-100"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <span className="text-xs text-base-content/40 font-mono w-5 shrink-0">{i + 1}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{po.purpose}</p>
                            <p className="text-xs text-base-content/50">
                              Terms: {po.terms}{po.paymentMethod ? ` · ${po.paymentMethod}` : ''}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-error btn-xs btn-square shrink-0"
                          title="Remove purchase order"
                          onClick={() => removePo(po._tempId)}
                        >
                          <span className="icon-[tabler--x] size-3.5"></span>
                        </button>
                      </div>
                    ))}
                    <p className="text-xs text-base-content/40 text-right">
                      {purchaseOrders.length} purchase order{purchaseOrders.length !== 1 ? 's' : ''} added
                    </p>
                  </div>
                )}

              </div>
            )}

            {/* ── Step 4: Billing ──────────────────────────────────────── */}
            {step === 4 && (
              <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-base-content/40 uppercase tracking-wide">
                      Step 4 — Billing (Optional)
                    </p>
                    <p className="text-sm text-base-content/60 mt-1">
                      Add billing items for this service report, or skip to finish.
                    </p>
                  </div>
                  {!addBillingOpen && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm shrink-0"
                      onClick={() => {
                        setBillingForm(EMPTY_BILLING_FORM)
                        setBillingFormError({})
                        setAddBillingOpen(true)
                      }}
                    >
                      <span className="icon-[tabler--plus] size-4"></span>
                      Add Billing Item
                    </button>
                  )}
                </div>

                {/* Inline add-billing form */}
                {addBillingOpen && (
                  <div className="border border-base-300 rounded-box p-4 bg-base-200/40">
                    <p className="text-sm font-semibold mb-3">New Billing Item</p>
                    <form onSubmit={handleAddBillingItem}>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">

                        <div className="sm:col-span-2 flex flex-col gap-1">
                          <label className="label-text font-medium">Description <span className="text-error">*</span></label>
                          <input type="text" name="description" maxLength={255}
                            className={`input input-bordered w-full${billingFormError.description ? ' is-invalid' : ''}`}
                            placeholder="e.g. Labor fee, Parts replacement"
                            value={billingForm.description} onChange={handleBillingFormChange} />
                          {billingFormError.description && <span className="helper-text">{billingFormError.description}</span>}
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="label-text font-medium">Quantity <span className="text-error">*</span></label>
                          <input type="number" name="quantity" min={1}
                            className={`input input-bordered w-full${billingFormError.quantity ? ' is-invalid' : ''}`}
                            placeholder="e.g. 1"
                            value={billingForm.quantity} onChange={handleBillingFormChange} />
                          {billingFormError.quantity && <span className="helper-text">{billingFormError.quantity}</span>}
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="label-text font-medium">Unit Price <span className="text-error">*</span></label>
                          <input type="number" name="unitPrice" min={0} step="0.01"
                            className={`input input-bordered w-full${billingFormError.unitPrice ? ' is-invalid' : ''}`}
                            placeholder="0.00"
                            value={billingForm.unitPrice} onChange={handleBillingFormChange} />
                          {billingFormError.unitPrice && <span className="helper-text">{billingFormError.unitPrice}</span>}
                        </div>

                        {billingFormError._general && (
                          <div className="sm:col-span-2 alert alert-error py-2">
                            <span className="icon-[tabler--alert-circle] size-4 shrink-0"></span>
                            <span className="text-sm">{billingFormError._general}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2 justify-end">
                        <button
                          type="button"
                          className="btn btn-soft btn-secondary btn-sm"
                          onClick={() => {
                            setAddBillingOpen(false)
                            setBillingForm(EMPTY_BILLING_FORM)
                            setBillingFormError({})
                          }}
                        >
                          Cancel
                        </button>
                        <button type="submit" className="btn btn-primary btn-sm">
                          <span className="icon-[tabler--plus] size-4"></span>
                          Add Billing Item
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Billing items list */}
                {billingItems.length === 0 && !addBillingOpen ? (
                  <div className="text-center py-10 text-base-content/40">
                    <span className="icon-[tabler--receipt-off] size-10 mx-auto mb-2 block"></span>
                    <p className="text-sm">No billing items added yet. You can skip this step.</p>
                  </div>
                ) : billingItems.length > 0 && (
                  <div className="overflow-x-auto rounded-box border border-base-300">
                    <table className="table table-sm">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Description</th>
                          <th className="text-end">Qty</th>
                          <th className="text-end">Unit Price</th>
                          <th className="text-end">Subtotal</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {billingItems.map((b, i) => (
                          <tr key={b._tempId}>
                            <td className="text-base-content/40 font-mono">{i + 1}</td>
                            <td>{b.description}</td>
                            <td className="text-end">{b.quantity}</td>
                            <td className="text-end">₱{Number(b.unitPrice).toFixed(2)}</td>
                            <td className="text-end">₱{(Number(b.quantity) * Number(b.unitPrice)).toFixed(2)}</td>
                            <td className="text-end">
                              <button
                                type="button"
                                className="btn btn-error btn-xs btn-square"
                                title="Remove billing item"
                                onClick={() => removeBillingItem(b._tempId)}
                              >
                                <span className="icon-[tabler--x] size-3.5"></span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={4} className="text-end font-semibold text-sm">Total</td>
                          <td className="text-end font-semibold text-sm">
                            ₱{billingItems.reduce((sum, b) => sum + Number(b.quantity) * Number(b.unitPrice), 0).toFixed(2)}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ── Step 5: Document ────────────────────────────────────── */}
            {step === 5 && (
              <div className="flex flex-col gap-4">
                <p className="text-xs font-semibold text-base-content/40 uppercase tracking-wide">
                  Step 5 — Document (Optional)
                </p>
                <p className="text-sm text-base-content/60">
                  Attach a supporting document to this service report, or skip to finish.
                </p>

                <div className="flex flex-col gap-2">
                  <label className="label-text font-medium">
                    File <span className="text-base-content/40 font-normal">(optional)</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      className={`input input-bordered flex-1 bg-base-200 cursor-default${docFileError ? ' is-invalid' : ''}`}
                      value={docFile ? docFile.name : ''}
                      placeholder="No file chosen"
                    />
                    <button
                      type="button"
                      className="btn btn-soft btn-secondary shrink-0"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <span className="icon-[tabler--upload] size-4"></span>
                      Browse
                    </button>
                    {docFile && (
                      <button
                        type="button"
                        className="btn btn-soft btn-error btn-square shrink-0"
                        title="Remove file"
                        onClick={() => { setDocFile(null); setDocFileError(''); if (fileInputRef.current) fileInputRef.current.value = '' }}
                      >
                        <span className="icon-[tabler--x] size-4"></span>
                      </button>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept={ACCEPTED_DOC_EXTENSIONS}
                    onChange={e => {
                      const file = e.target.files?.[0] ?? null
                      if (file && !ACCEPTED_DOC_TYPES.includes(file.type)) {
                        setDocFileError('Only images (JPEG, PNG, GIF, WebP) and PDFs are accepted.')
                        setDocFile(null)
                        return
                      }
                      setDocFileError('')
                      setDocFile(file)
                    }}
                  />
                  {docFileError
                    ? <span className="helper-text">{docFileError}</span>
                    : <span className="text-xs text-base-content/40">Accepted: JPEG, PNG, GIF, WebP, PDF</span>
                  }

                  {docFile && (
                    <div className="flex items-center gap-3 px-3 py-2.5 rounded-box border border-base-300 bg-base-100 mt-1">
                      <span className="icon-[tabler--file] size-5 text-primary shrink-0"></span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{docFile.name}</p>
                        <p className="text-xs text-base-content/50">{(docFile.size / 1024).toFixed(1)} KB</p>
                      </div>
                    </div>
                  )}
                </div>

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
              {step > 1 ? (
                <button
                  type="button"
                  className="btn btn-soft btn-secondary"
                  disabled={submitting}
                  onClick={() => setStep(s => s - 1)}
                >
                  <span className="icon-[tabler--arrow-left] size-4"></span> Back
                </button>
              ) : (
                <div />
              )}

              {step < STEPS.length ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleNext}
                >
                  Next <span className="icon-[tabler--arrow-right] size-4"></span>
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={submitting}
                  onClick={handleFinalSubmit}
                >
                  {submitting
                    ? <span className="loading loading-spinner loading-sm"></span>
                    : <span className="icon-[tabler--plus] size-4"></span>
                  }
                  Create Service Report
                </button>
              )}
            </div>

          </div>
        </div>
      </div>
      {/* ── Part Sub-Modal ─────────────────────────────────────────── */}
      {partModalOpen && (
        <>
          <div className="fixed inset-0 bg-base-300/70 z-[80]" onClick={() => setPartModalOpen(false)} />
          <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            <div className="modal-content w-full max-w-lg">

              <div className="modal-header">
                <h3 className="modal-title">Add Part</h3>
                <button
                  type="button"
                  className="btn btn-text btn-circle btn-sm absolute end-3 top-3"
                  aria-label="Close"
                  onClick={() => setPartModalOpen(false)}
                >
                  <span className="icon-[tabler--x] size-4"></span>
                </button>
              </div>

              <div className="modal-body">
                <form onSubmit={handleAddPart}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">

                    <div className="sm:col-span-2 flex flex-col gap-1">
                      <label className="label-text font-medium">Name <span className="text-error">*</span></label>
                      <input type="text" name="name" maxLength={255}
                        className={`input input-bordered w-full${partFormError.name ? ' is-invalid' : ''}`}
                        placeholder="e.g. Capacitor 35/5 MFD"
                        value={partForm.name} onChange={handlePartFormChange} />
                      {partFormError.name && <span className="helper-text">{partFormError.name}</span>}
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="label-text font-medium">Quantity <span className="text-error">*</span></label>
                      <input type="number" name="quantity" min={0}
                        className={`input input-bordered w-full${partFormError.quantity ? ' is-invalid' : ''}`}
                        placeholder="e.g. 2"
                        value={partForm.quantity} onChange={handlePartFormChange} />
                      {partFormError.quantity && <span className="helper-text">{partFormError.quantity}</span>}
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="label-text font-medium">Quantity Type <span className="text-error">*</span></label>
                      <input type="text" name="quantityType" maxLength={30}
                        className={`input input-bordered w-full${partFormError.quantityType ? ' is-invalid' : ''}`}
                        placeholder="e.g. pcs, box, set"
                        value={partForm.quantityType} onChange={handlePartFormChange} />
                      {partFormError.quantityType && <span className="helper-text">{partFormError.quantityType}</span>}
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="label-text font-medium">Unit Price <span className="text-error">*</span></label>
                      <input type="number" name="unitPrice" min={0} step="0.01"
                        className={`input input-bordered w-full${partFormError.unitPrice ? ' is-invalid' : ''}`}
                        placeholder="0.00"
                        value={partForm.unitPrice} onChange={handlePartFormChange} />
                      {partFormError.unitPrice && <span className="helper-text">{partFormError.unitPrice}</span>}
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="label-text font-medium">Supplier <span className="text-error">*</span></label>
                      <select name="supplierId"
                        className={`select select-bordered w-full${partFormError.supplierId ? ' is-invalid' : ''}`}
                        value={partForm.supplierId}
                        onChange={e => {
                          const selected = suppliers.find(s => String(s.supplierId) === e.target.value)
                          setPartForm(prev => ({ ...prev, supplierId: e.target.value, _supplierName: selected?.name ?? '' }))
                        }}
                      >
                        <option value="">Select supplier...</option>
                        {suppliers.map(s => (
                          <option key={s.supplierId} value={s.supplierId}>{s.name}</option>
                        ))}
                      </select>
                      {partFormError.supplierId && <span className="helper-text">{partFormError.supplierId}</span>}
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="label-text font-medium">Order Date <span className="text-base-content/40 font-normal">(optional)</span></label>
                      <input type="date" name="orderDate"
                        className="input input-bordered w-full"
                        value={partForm.orderDate} onChange={handlePartFormChange} />
                    </div>

                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      className="btn btn-soft btn-secondary btn-sm"
                      onClick={() => setPartModalOpen(false)}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary btn-sm">
                      <span className="icon-[tabler--plus] size-4"></span>
                      Add Part
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Delivery Contact Sub-Modal ─────────────────────────────── */}
      {contactModalOpen && (
        <>
          <div className="fixed inset-0 bg-base-300/70 z-[80]" onClick={() => setContactModalOpen(false)} />
          <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            <div className="modal-content w-full max-w-lg">

              <div className="modal-header">
                <h3 className="modal-title">Delivery Contacts</h3>
                <button
                  type="button"
                  className="btn btn-text btn-circle btn-sm absolute end-3 top-3"
                  aria-label="Close"
                  onClick={() => setContactModalOpen(false)}
                >
                  <span className="icon-[tabler--x] size-4"></span>
                </button>
              </div>

              <div className="modal-body">
                <form onSubmit={handleAddContact}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    <div className="flex flex-col gap-1">
                      <label className="label-text font-medium">Contact Name <span className="text-error">*</span></label>
                      <input
                        type="text"
                        name="contactName"
                        maxLength={300}
                        className={`input input-bordered w-full${contactFormError.contactName ? ' is-invalid' : ''}`}
                        placeholder="e.g. Juan Dela Cruz"
                        value={contactForm.contactName}
                        onChange={handleContactFormChange}
                      />
                      {contactFormError.contactName && <span className="helper-text">{contactFormError.contactName}</span>}
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="label-text font-medium">Contact Number <span className="text-error">*</span></label>
                      <input
                        type="text"
                        name="contactNumber"
                        maxLength={16}
                        className={`input input-bordered w-full${contactFormError.contactNumber ? ' is-invalid' : ''}`}
                        placeholder="e.g. 09171234567"
                        value={contactForm.contactNumber}
                        onChange={handleContactFormChange}
                      />
                      {contactFormError.contactNumber && <span className="helper-text">{contactFormError.contactNumber}</span>}
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      className="btn btn-soft btn-secondary btn-sm"
                      onClick={() => setContactModalOpen(false)}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary btn-sm">
                      <span className="icon-[tabler--plus] size-4"></span>
                      Add Contact
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </>
      )}
    </Layout>
  )
}
