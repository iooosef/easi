import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './auth'
import Layout from './Layout'
import PickerInput from './PickerInput'
import ProjectPickerModal from './ProjectPickerModal'
import SchedulePickerModal from './SchedulePickerModal'
import EmployeePickerModal from './EmployeePickerModal'
import { notyfSuccess, notyfError } from './notyf'

const PAYMENT_OPTIONS = ['unset', 'cash', 'check', 'gcash', 'bank']
const STATUS_OPTIONS = ['unpaid', 'paid', 'partial']
const FINDING_TYPE_OPTIONS = ['GOOD', 'DEFECT', 'WORN', 'DIRTY', 'LEAK', 'FAIL']

const STEPS = [
  { number: 1, label: 'Service Report Details' },
  { number: 2, label: 'Findings (Optional)' },
  { number: 3, label: 'Purchase Orders (Optional)' },
]

const EMPTY_REPORT_FORM = {
  projNum: '',
  _projectDisplay: '',
  schedId: '',
  _scheduleDisplay: '',
  engineerEmployeeId: '',
  _engineerDisplay: '',
  complaint: '',
  workDone: '',
  location: '',
  paymentMethod: 'unset',
  receiptReceiveDate: '',
  docuId: '',
  status: 'unpaid',
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
  paymentDetails: '',
  deliveryAddress: '',
  remarks: '',
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
  const { apiFetch } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState(1)

  // Step 1: service report form state
  const [reportForm, setReportForm] = useState(EMPTY_REPORT_FORM)
  const [reportFormError, setReportFormError] = useState({})

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

  /** Validates and appends a purchase order to the local list */
  function handleAddPo(e) {
    e.preventDefault()
    const errors = {}
    if (!poForm.purpose.trim()) errors.purpose = 'Purpose is required.'
    if (!poForm.terms.trim()) errors.terms = 'Terms are required.'
    if (Object.keys(errors).length > 0) { setPoFormError(errors); return }
    setPurchaseOrders(list => [...list, { ...poForm, _tempId: Date.now() }])
    setPoForm(EMPTY_PO_FORM)
    setPoFormError({})
    setAddPoOpen(false)
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
          paymentMethod: reportForm.paymentMethod || 'unset',
          receiptReceiveDate: reportForm.receiptReceiveDate || null,
          docuId: reportForm.docuId ? Number(reportForm.docuId) : null,
          status: reportForm.status || 'unpaid',
        }),
      })
      if (!srRes.ok) {
        setSubmitError(await parseApiError(srRes))
        notyfError('Failed to create service report.')
        return
      }
      const sr = await srRes.json()
      const srNumber = sr.srNumber

      // 2. Create each finding
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
          notyfError('A finding could not be saved and was skipped.')
        }
      }

      // 3. Create each purchase order
      for (const po of purchaseOrders) {
        const poRes = await apiFetch('/api/purchase-orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            purpose: po.purpose,
            terms: po.terms,
            paymentMethod: po.paymentMethod || null,
            paymentDetails: po.paymentDetails || null,
            deliveryAddress: po.deliveryAddress || null,
            remarks: po.remarks || null,
            srNum: srNumber,
            projNum: Number(reportForm.projNum),
          }),
        })
        if (!poRes.ok) {
          notyfError('A purchase order could not be saved and was skipped.')
        }
      }

      notyfSuccess(`Service Report #${srNumber} created successfully.`)
      navigate('/service-report')
    } catch (err) {
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
                      setReportForm(prev => ({ ...prev, projNum: p.projNum, _projectDisplay: `${p.name} (#${p.projNum})` }))
                      setReportFormError(e => ({ ...e, projNum: undefined }))
                    }}
                    className="sm:col-span-2"
                  />

                  <div className="flex flex-col gap-1">
                    <label className="label-text font-medium">Location <span className="text-error">*</span></label>
                    <input type="text" name="location" maxLength={255}
                      className={`input input-bordered w-full${reportFormError.location ? ' is-invalid' : ''}`}
                      placeholder="e.g. 3rd Floor East Wing, ABC Corp" required
                      value={reportForm.location} onChange={handleReportFormChange} />
                    {reportFormError.location && <span className="helper-text">{reportFormError.location}</span>}
                  </div>

                  <PickerInput
                    label="Schedule"
                    displayValue={reportForm._scheduleDisplay}
                    placeholder="None selected"
                    buttonLabel="Select Schedule"
                    required
                    error={reportFormError.schedId}
                    Picker={SchedulePickerModal}
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

                  <div className="flex flex-col gap-1">
                    <label className="label-text font-medium">Payment Method</label>
                    <select name="paymentMethod"
                      className={`select select-bordered w-full${reportFormError.paymentMethod ? ' is-invalid' : ''}`}
                      value={reportForm.paymentMethod} onChange={handleReportFormChange}>
                      {PAYMENT_OPTIONS.map(o => (
                        <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>
                      ))}
                    </select>
                    {reportFormError.paymentMethod && <span className="helper-text">{reportFormError.paymentMethod}</span>}
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="label-text font-medium">Status</label>
                    <select name="status"
                      className={`select select-bordered w-full${reportFormError.status ? ' is-invalid' : ''}`}
                      value={reportForm.status} onChange={handleReportFormChange}>
                      {STATUS_OPTIONS.map(o => (
                        <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>
                      ))}
                    </select>
                    {reportFormError.status && <span className="helper-text">{reportFormError.status}</span>}
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="label-text font-medium">Receipt Receive Date</label>
                    <input type="date" name="receiptReceiveDate"
                      className={`input input-bordered w-full${reportFormError.receiptReceiveDate ? ' is-invalid' : ''}`}
                      value={reportForm.receiptReceiveDate} onChange={handleReportFormChange} />
                    {reportFormError.receiptReceiveDate && <span className="helper-text">{reportFormError.receiptReceiveDate}</span>}
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="label-text font-medium">Document ID</label>
                    <input type="number" name="docuId" min={1}
                      className={`input input-bordered w-full${reportFormError.docuId ? ' is-invalid' : ''}`}
                      placeholder="Optional"
                      value={reportForm.docuId} onChange={handleReportFormChange} />
                    {reportFormError.docuId && <span className="helper-text">{reportFormError.docuId}</span>}
                  </div>

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

                        <div className="flex flex-col gap-1">
                          <label className="label-text font-medium">Payment Method</label>
                          <input type="text" name="paymentMethod"
                            className={`input input-bordered w-full${poFormError.paymentMethod ? ' is-invalid' : ''}`}
                            placeholder="e.g. cash" maxLength={16}
                            value={poForm.paymentMethod} onChange={handlePoFormChange} />
                          {poFormError.paymentMethod && <span className="helper-text">{poFormError.paymentMethod}</span>}
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
                          <label className="label-text font-medium">Delivery Address</label>
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

                      <div className="flex gap-2 justify-end">
                        <button
                          type="button"
                          className="btn btn-soft btn-secondary btn-sm"
                          onClick={() => {
                            setAddPoOpen(false)
                            setPoForm(EMPTY_PO_FORM)
                            setPoFormError({})
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
    </Layout>
  )
}
