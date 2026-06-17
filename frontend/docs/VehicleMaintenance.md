# Vehicle Maintenance — Frontend Documentation

This document explains everything added to the frontend for tracking vehicle maintenance logs and their documents. It is written for developers who may not be deeply familiar with React.

---

## Table of Contents

1. [Overview](#overview)
2. [Files Changed or Created](#files-changed-or-created)
3. [How the Modal System Works](#how-the-modal-system-works)
4. [VehicleLogs.jsx — What Changed](#vehiclelogsjsx--what-changed)
5. [VehicleMaintenanceLogs.jsx — The Maintenance Page](#vehiclemaintenancelogsjsx--the-maintenance-page)
   - [Page Layout](#page-layout)
   - [Component: AddMaintenanceStep1Modal](#component-addmaintenancestep1modal)
   - [Component: AddMaintenanceStep2Modal](#component-addmaintenancestep2modal)
   - [Component: ManageMaintenanceModal](#component-managemaintenancemodal)
   - [Component: UpdateMaintenanceModal](#component-updatemaintenancemodal)
6. [VehicleMaintenanceDocuments.jsx — The Documents Page](#vehiclemaintenancedocumentsjsx--the-documents-page)
   - [Component: UploadDocumentModal](#component-uploaddocumentmodal)
   - [Component: UpdateDescriptionModal](#component-updatedescriptionmodal)
   - [Component: ReplaceFileModal](#component-replacefilemodal)
7. [App.jsx — New Routes](#appjsx--new-routes)
8. [API Endpoints Used](#api-endpoints-used)
9. [Data Flow Diagrams](#data-flow-diagrams)

---

## Overview

The feature lets users track maintenance done during a vehicle trip. Each **vehicle log** (a trip record) can have many **maintenance logs**, and each maintenance log can have many **documents** (invoices, receipts, photos, etc.) attached.

The user flow looks like this:

```
Vehicles page
  └─ click "Manage" on a trip row
       └─ ManageLogModal appears
            └─ click "Maintenance"
                 └─ navigates to /vehicle-logs/:id/maintenance
                      ├─ table of maintenance logs
                      ├─ "Record New Maintenance" → 2-step form
                      └─ "Manage" on a row
                           ├─ "Update Details" → edit form
                           └─ "Documents" → navigates to documents page
                                └─ /vehicle-logs/:id/maintenance/:mntId/documents
                                     ├─ card grid of attached documents
                                     ├─ "Upload Document"
                                     ├─ "Update Description"
                                     └─ "Replace File"
```

---

## Files Changed or Created

| File | Status | What it does |
|------|--------|--------------|
| `src/pages/VehicleLogs.jsx` | **Modified** | Added "Maintenance" option to the manage menu |
| `src/pages/VehicleMaintenanceLogs.jsx` | **New** | Full page for listing and managing maintenance logs |
| `src/pages/VehicleMaintenanceDocuments.jsx` | **New** | Full page for listing and managing documents on a maintenance log |
| `src/App.jsx` | **Modified** | Registered the two new pages as routes |

---

## How the Modal System Works

Before reading the component details, it helps to understand how modals work in this app.

The app uses a **modal stack**. Think of it like a stack of cards — you push a new card on top, and pop it off when you're done. The functions you use are:

| Function | What it does |
|----------|--------------|
| `pushModal(<Component />)` | Opens a new modal on top of the current one |
| `popModal()` | Closes the top-most modal (goes back to the one underneath) |
| `replaceModal(<Component />)` | Swaps the current modal with a new one (used for multi-step forms) |

You get these functions by calling `useModal()` at the top of a component:

```jsx
const { pushModal, popModal, replaceModal } = useModal()
```

**Important rules:**
- When a modal needs to navigate to a page (not open another modal), call `popModal()` first to close the modal, then call `navigate(...)`.
- Every modal component is its own React function — never pass inline JSX with logic to `pushModal`.

---

## VehicleLogs.jsx — What Changed

Two small changes were made to this existing file:

### 1. Added `useNavigate` import

```jsx
// Before
import { useParams, useLocation } from "react-router-dom"

// After
import { useParams, useLocation, useNavigate } from "react-router-dom"
```

`useNavigate` gives us the `navigate()` function to redirect the user to another page.

### 2. Added "Maintenance" to the manage menu

In the `LOG_MENU_ITEMS` array (the list of actions shown in the manage panel), a new item was added:

```jsx
{
  key: "maintenance",
  label: "Maintenance",
  icon: "icon-[tabler--tool]",
  roles: ["ADMIN", "STAFF", "CREW"],
}
```

### 3. Handled the "maintenance" action in ManageLogModal

Inside `ManageLogModal`, the `handleAction` function was updated. When the user clicks "Maintenance", the modal closes and the user is sent to the maintenance page for that specific vehicle log:

```jsx
if (key === "maintenance") {
  popModal()  // close the modal first
  navigate(`/vehicle-logs/${log.vehicleLogId}/maintenance`)  // then navigate
}
```

---

## VehicleMaintenanceLogs.jsx — The Maintenance Page

**Route:** `/vehicle-logs/:vehicleLogId/maintenance`

This is a full-page layout using `<Layout>`. It shows a table of all maintenance logs for a specific vehicle log, and lets users record new maintenance or manage existing entries.

### Page Layout

The page has three main sections:

1. **Header** — a back button, the page title ("Maintenance Logs"), a subtitle showing the vehicle log number and vehicle info, and a "Record New Maintenance" button (only shown to ADMIN, STAFF, CREW).

2. **Table** — lists all maintenance logs for this vehicle log. Columns are:
   - `Mnt Log #` — the ID of the maintenance entry
   - `Type` — what kind of maintenance (e.g. "Oil Change")
   - `Invoice ID` — reference number
   - `Amount` — cost in PHP
   - `Action` — a "Manage" button per row

3. **Pagination** — shown at the bottom when there are more than 10 records.

The page fetches data from:
```
GET /api/vehicle-maintenance-logs?vehicleLogId=X&page=0&size=10&sort=mntLogId,desc
```

It also fetches the vehicle log's info (model, plate number) for the subtitle:
```
GET /api/vehicle-logs/:vehicleLogId
```

---

### Component: AddMaintenanceStep1Modal

This is **Step 1** of the 2-step "Record New Maintenance" form.

**What it does:** Collects the maintenance details from the user. Nothing is saved to the database yet.

**Fields (all required):**
- `mntType` — Maintenance type (e.g. "Oil Change", max 30 characters)
- `invoiceId` — Invoice reference number (max 16 characters)
- `amount` — Cost amount (number, min 0)

**How forms work here:** This component uses `react-hook-form`. Instead of managing state manually for each input, you register each field with `register("fieldName", { rules })`. Validation errors are automatically tracked in the `errors` object.

```jsx
const { register, handleSubmit, formState: { errors } } = useForm()

// In JSX:
<input {...register("mntType", { required: "Maintenance type is required." })} />
{errors.mntType && <span className="helper-text">{errors.mntType.message}</span>}
```

**What happens on "Next":** The form data is passed to Step 2 using `replaceModal`:

```jsx
function onNext(data) {
  replaceModal(
    <AddMaintenanceStep2Modal
      vehicleLogId={vehicleLogId}
      step1Data={data}      // <-- the form values from step 1
      onSuccess={onSuccess}
    />
  )
}
```

`replaceModal` swaps the current modal with Step 2. The user sees a smooth transition and the Step 1 data is preserved as a prop.

---

### Component: AddMaintenanceStep2Modal

This is **Step 2** of the form — attaching documents.

**What it does:** Lets the user queue up zero or more files to attach. **This is the step where all data is actually saved to the database.**

**How file attachment works:**

The user picks a file using the `FilePicker` component (a styled file input). Clicking "Add to List" pushes that file into a local array (`files` state). Each file in the list can be removed before saving. The picker resets after each addition so the user can pick another file.

```
[ FilePicker ] → "Add to List" → [file1.pdf] [x]  [file2.jpg] [x]
```

**What "Back" does:** Goes back to Step 1 with the step 1 data pre-filled, using `replaceModal` again:

```jsx
replaceModal(
  <AddMaintenanceStep1Modal
    vehicleLogId={vehicleLogId}
    defaultValues={step1Data}  // <-- restores the form values
    onSuccess={onSuccess}
  />
)
```

**What "Save" does (the full save sequence):**

All database writes happen here in order:

```
1. POST /api/vehicle-maintenance-logs
      body: { vehicleLogId, amount, invoiceId, mntType }
      response: { mntLogId, ... }

2. For each file in the list:
   a. POST /api/documents   (FormData with the file)
         response: { docuId, ... }
   b. POST /api/vehicle-maintenance-log-documents
         body: { mntLogId, docuId }
```

If step 1 fails (maintenance log creation), it stops and shows an error. If a file upload fails midway, the maintenance log has already been created but some documents may not be linked (this is acceptable — the user can add them later via the Documents page).

On success, the modal closes with `popModal()` and the maintenance log list refreshes.

---

### Component: ManageMaintenanceModal

This is the manage panel that opens when the user clicks "Manage" on a row in the table.

**What it shows:**
- A mini summary at the top (mntType, invoiceId, amount)
- A `ModalNav` action grid with two options:
  - **Update Details** — opens `UpdateMaintenanceModal` on top (using `pushModal`)
  - **Documents** — closes this modal and navigates to the documents page (using `popModal` + `navigate`)

```jsx
function handleAction(key) {
  if (key === "update")
    pushModal(<UpdateMaintenanceModal log={log} vehicleLogId={vehicleLogId} onRefresh={onRefresh} />)

  if (key === "documents") {
    popModal()  // close this modal first
    navigate(`/vehicle-logs/${vehicleLogId}/maintenance/${log.mntLogId}/documents`)
  }
}
```

---

### Component: UpdateMaintenanceModal

Opens on top of `ManageMaintenanceModal` when the user selects "Update Details".

**What it does:** Pre-fills the current values of `mntType`, `invoiceId`, and `amount` and lets the user edit them.

Uses `react-hook-form` with `defaultValues` set from the existing log:

```jsx
useForm({
  defaultValues: {
    mntType: log.mntType,
    invoiceId: log.invoiceId,
    amount: String(log.amount),
  }
})
```

On submit, sends a `PUT` request:
```
PUT /api/vehicle-maintenance-logs/:mntLogId
body: { vehicleLogId, amount, invoiceId, mntType }
```

On success, closes with `popModal()` (returning the user to `ManageMaintenanceModal`) and calls `onRefresh()` to update the table.

---

## VehicleMaintenanceDocuments.jsx — The Documents Page

**Route:** `/vehicle-logs/:vehicleLogId/maintenance/:mntLogId/documents`

This page is similar to how `ProjectDocuments.jsx` works. It shows all files linked to a maintenance log in a **card grid** layout, with actions to view, edit the description, or replace the file.

### Page Layout

- **Header** — back button, title ("Documents — Maintenance #X"), subtitle (maintenance type and invoice ID)
- **Upload Document button** — visible to ADMIN and STAFF only
- **Card grid** — `3 columns on large screens, 2 on medium, 1 on small`
- Each card shows:
  - File icon (photo icon for images, PDF icon for PDFs)
  - File name and type label
  - Document ID badge (`#docuId`)
  - Description (or "No description." in italics if empty)
  - Upload timestamp
  - Action buttons: **View Document**, **Update Description**, **Replace File**

Data is fetched from:
```
GET /api/vehicle-maintenance-log-documents?mntLogId=X&size=100&sort=mntLogDocId,asc
```

---

### Component: UploadDocumentModal

Opens when the user clicks "Upload Document".

**Fields:**
- **File** (required) — uses the `FilePicker` component; accepts images (JPEG, PNG, GIF, WebP) and PDF
- **Description** (optional) — a plain text area, max 600 characters

**Save sequence:**
```
1. POST /api/documents   (FormData: file + optional description)
      response: { docuId, ... }

2. POST /api/vehicle-maintenance-log-documents
      body: { mntLogId, docuId }
```

The description is stored on the `Document` entity itself (not on the link), so it is shared across wherever that document is linked.

---

### Component: UpdateDescriptionModal

Opens when the user clicks "Update Description" on a card.

**What it does:** Shows a textarea pre-filled with the current description. On save, sends:
```
PUT /api/documents/:docuId
body: { description: "..." }
```

This updates the `Document` entity directly, so the description change appears everywhere the document is used.

---

### Component: ReplaceFileModal

Opens when the user clicks "Replace File" on a card.

**What it does:** Lets the user pick a new file to swap in. Shows a warning that the current file will be permanently overwritten. The description is kept.

On submit, sends:
```
PUT /api/documents/:docuId/file   (FormData: new file)
```

---

## App.jsx — New Routes

Two routes were added to `src/App.jsx`:

```jsx
<Route
  path="/vehicle-logs/:vehicleLogId/maintenance"
  element={<Private element={<VehicleMaintenanceLogs />} />}
/>
<Route
  path="/vehicle-logs/:vehicleLogId/maintenance/:mntLogId/documents"
  element={<Private element={<VehicleMaintenanceDocuments />} />}
/>
```

- `:vehicleLogId` — the ID of the vehicle trip log (from the Vehicles page)
- `:mntLogId` — the ID of the specific maintenance entry

Both routes are wrapped in `<Private>`, meaning the user must be logged in to access them.

The components are imported at the top of `App.jsx`:
```jsx
import VehicleMaintenanceLogs from './pages/VehicleMaintenanceLogs'
import VehicleMaintenanceDocuments from './pages/VehicleMaintenanceDocuments'
```

---

## API Endpoints Used

### Maintenance Logs

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/vehicle-logs/:id` | Get vehicle log info for the page header |
| `GET` | `/api/vehicle-maintenance-logs?vehicleLogId=X` | List maintenance logs for a vehicle log |
| `POST` | `/api/vehicle-maintenance-logs` | Create a new maintenance log |
| `PUT` | `/api/vehicle-maintenance-logs/:mntLogId` | Update an existing maintenance log |

### Documents

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/vehicle-maintenance-log-documents?mntLogId=X` | List documents for a maintenance log |
| `POST` | `/api/vehicle-maintenance-log-documents` | Link a document to a maintenance log |
| `POST` | `/api/documents` | Upload a new file (returns `docuId`) |
| `PUT` | `/api/documents/:docuId` | Update a document's description |
| `PUT` | `/api/documents/:docuId/file` | Replace a document's file |
| `GET` | `/api/documents/:docuId/file` | Fetch a document's file blob (for viewing) |
| `DELETE` | `/api/vehicle-maintenance-log-documents/:mntLogDocId` | Remove a document link |

---

## Data Flow Diagrams

### Recording a New Maintenance Log (2-step flow)

```
User clicks "Record New Maintenance"
        │
        ▼
Step 1 Modal — user fills in mntType, invoiceId, amount
        │
        │ clicks "Next"
        ▼
Step 2 Modal — user adds files to a list (nothing saved yet)
        │
        │ clicks "Save"
        ▼
POST /api/vehicle-maintenance-logs  ──► gets mntLogId back
        │
        │ for each queued file:
        ▼
POST /api/documents  ──► gets docuId back
        │
        ▼
POST /api/vehicle-maintenance-log-documents  (links docuId to mntLogId)
        │
        ▼
Modal closes, table refreshes
```

### Viewing and Managing a Document

```
User is on the Documents page
        │
        ├─ clicks "View Document"
        │       └─ GET /api/documents/:docuId/file  ──► blob URL ──► DocumentViewer overlay
        │
        ├─ clicks "Update Description"
        │       └─ UpdateDescriptionModal opens
        │               └─ PUT /api/documents/:docuId  ──► page refreshes
        │
        └─ clicks "Replace File"
                └─ ReplaceFileModal opens
                        └─ PUT /api/documents/:docuId/file  ──► page refreshes
```
