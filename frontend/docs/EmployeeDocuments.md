# Employee Documents — Frontend Guide

This document explains the **Employee Documents** feature end-to-end for someone
who is new to React or front-end development. Every concept is explained from
first principles before diving into the code.

---

## Table of Contents

1. [What the feature does](#1-what-the-feature-does)
2. [Files involved](#2-files-involved)
3. [How routing works](#3-how-routing-works)
4. [How the modal system works](#4-how-the-modal-system-works)
5. [How react-hook-form works](#5-how-react-hook-form-works)
6. [Page walkthrough — EmployeeDocuments.jsx](#6-page-walkthrough--employeedocumentsjsx)
7. [Modal components explained](#7-modal-components-explained)
8. [How the API calls work](#8-how-the-api-calls-work)
9. [The Documents button in Employees.jsx](#9-the-documents-button-in-employeesjsx)
10. [Data flow diagram](#10-data-flow-diagram)
11. [Glossary](#11-glossary)

---

## 1. What the feature does

An **employee document** is a file (image or PDF) that is uploaded and then
linked to a specific employee record. Examples: a scanned ID, a signed contract,
a certificate.

The feature lets you:

| Action | Who can do it |
|---|---|
| View the list of documents for an employee | Everyone (logged in) |
| View / open a document file | Everyone (logged in) |
| Upload a new document and link it to the employee | ADMIN, STAFF |
| Edit a document's description | ADMIN, STAFF |
| Replace the file stored for a document | ADMIN, STAFF |

---

## 2. Files involved

```
frontend/src/
├── pages/
│   ├── EmployeeDocuments.jsx   ← NEW — the documents page (this document's focus)
│   └── Employees.jsx           ← MODIFIED — added "Documents" button in the manage panel
└── App.jsx                     ← MODIFIED — registered the new URL route
```

### Third-party library added

```
react-hook-form
```

This library manages form state and validation. It was installed by running:

```bash
npm install react-hook-form
```

---

## 3. How routing works

### What is a route?

A **route** maps a URL path to a React component (page). When the user visits
that URL, React renders that component instead of another.

### Where routes are defined

All routes live in `App.jsx`. The new route added is:

```jsx
// App.jsx
<Route
  path="/employees/:employeeId/documents"
  element={<Private element={<EmployeeDocuments />} />}
/>
```

Breaking this down:

- `path="/employees/:employeeId/documents"` — the URL pattern.
  `:employeeId` is a **URL parameter** (a placeholder). When the URL is
  `/employees/7/documents`, the value `7` is captured as `employeeId`.
- `element={<EmployeeDocuments />}` — the component to render.
- `<Private>` — a wrapper that checks if the user is logged in. If not, it
  redirects to `/login` automatically.

### How EmployeeDocuments reads the URL parameter

Inside `EmployeeDocuments.jsx`:

```jsx
import { useParams } from "react-router-dom";

const { employeeId } = useParams();
// If the URL is /employees/7/documents, employeeId === "7"
```

`useParams()` is a React Router hook that gives you all the `:param` values
from the current URL as an object.

### How navigation state works

When the Employees page opens the documents page, it passes extra data
alongside the navigation:

```jsx
// Inside Employees.jsx — when the user clicks "Documents"
navigate(`/employees/${emp.employeeId}/documents`, {
  state: { employeeName: fullName(emp) },
});
```

This is called **navigation state**. It is NOT part of the URL — it travels
invisibly alongside the navigation event. The documents page picks it up with:

```jsx
import { useLocation } from "react-router-dom";

const location = useLocation();
const employeeName = location.state?.employeeName ?? `Employee #${employeeId}`;
//                                 ↑ the object we passed in `state: { ... }`
```

The `?.` is optional chaining — if `location.state` is `null` or `undefined`
(e.g. the user typed the URL directly), it safely returns `undefined` instead
of throwing an error. The `??` then falls back to `"Employee #7"`.

---

## 4. How the modal system works

### What is a modal?

A **modal** is a dialog box that appears on top of the current page. The user
must interact with it (submit or cancel) before returning to the page behind it.

### The layered modal system

This app uses a custom modal system that supports **stacking** — you can open a
modal on top of another modal. The system lives in `frontend/src/modals/`.

```jsx
import { useModal } from "../modals/index.js";

const { pushModal, popModal } = useModal();
```

| Function | What it does |
|---|---|
| `pushModal(<SomeModal />)` | Opens a new modal on top of the stack |
| `popModal()` | Closes the top-most modal, revealing the one below (if any) |

### Rules to remember

1. Each modal must be **its own component** — never write `pushModal(<div>...</div>)`
   with event handlers inline. Closures captured at the call site go stale.
2. Every modal component calls `useModal()` itself to get `popModal`. Never
   pass it as a prop.
3. Clicking the backdrop does **not** close modals (disabled globally to prevent
   accidental form loss).

### Example flow in this feature

```
User clicks "Documents" in Manage panel
  → popModal()          closes the manage panel
  → navigate(...)       goes to /employees/7/documents

On the documents page, user clicks "Upload Document"
  → pushModal(<UploadDocumentModal />)    opens the upload modal

User submits successfully
  → popModal()          closes the upload modal
  → refresh()           reloads the document list
```

---

## 5. How react-hook-form works

### The problem it solves

Without a form library, you need to:
1. Create a `useState` for every field (`firstName`, `lastName`, etc.)
2. Write an `onChange` handler for every field
3. Track whether the form is currently submitting
4. Store and display validation errors

For a form with 5 fields, that is ~25 lines of boilerplate. `react-hook-form`
replaces all of that.

### The core hook

```jsx
import { useForm } from "react-hook-form";

const {
  register,          // connects an input to the form
  handleSubmit,      // wraps your submit function with validation logic
  setError,          // lets you set an error on a field manually (e.g. from the API)
  formState: {
    errors,          // object containing all current validation errors
    isSubmitting,    // true while the async submit function is running
  },
} = useForm({ defaultValues: { description: "" } });
```

### Connecting an input

Instead of `value={...}` and `onChange={...}`, you spread `register(fieldName)`:

```jsx
// Old way (without react-hook-form)
<input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />

// New way (with react-hook-form)
<textarea {...register("description")} />
```

`register("description")` returns `{ name, ref, onChange, onBlur }` — all the
props React needs to track the input — and spreads them onto the element.

### Showing errors

```jsx
{errors.description && (
  <span className="helper-text">{errors.description.message}</span>
)}
```

`errors` is populated automatically when validation fails, or manually when you
call `setError`.

### Handling the submit

```jsx
<form onSubmit={handleSubmit(onSubmit)}>
```

`handleSubmit(onSubmit)` is a wrapper: it runs RHF's built-in validation first,
and only calls your `onSubmit` function if everything passes. Your `onSubmit`
receives the field values as a plain object:

```jsx
async function onSubmit(data) {
  // data = { description: "some text" }
  const res = await apiFetch("/api/documents/...", { body: JSON.stringify(data) });
  if (!res.ok) {
    setError("description", { message: "Server rejected this value." });
    return;
  }
  popModal();
}
```

### The file input exception

`react-hook-form` integrates with standard HTML inputs via `register`. The
`FilePicker` component in this app is a **custom component** that returns a
`File` object directly (not a DOM event), so it cannot be registered the
normal way. Instead, the file is stored in a plain `useState`:

```jsx
const [file, setFile] = useState(null);
const [fileError, setFileError] = useState("");

function handleFileChange(selectedFile) {
  // validate, then store
  setFile(selectedFile);
}

<FilePicker file={file} onChange={handleFileChange} error={fileError} />
```

### Root / server errors

For errors that don't belong to a specific field (e.g. a network failure or
an unexpected server error), RHF provides `errors.root`:

```jsx
setError("root.serverError", { message: "Something went wrong." });

// In JSX:
{errors.root?.serverError && (
  <div className="alert alert-error">{errors.root.serverError.message}</div>
)}
```

---

## 6. Page walkthrough — EmployeeDocuments.jsx

The file exports one **default export** — the page component — plus four
private modal components above it.

### State variables

```jsx
const [documents, setDocuments] = useState([]);   // list of linked documents
const [loading, setLoading]     = useState(true);  // true while fetching
const [error, setError]         = useState(null);  // fetch error message
const [refreshKey, setRefreshKey] = useState(0);   // bump to re-fetch

// Viewer overlay state
const [viewOpen, setViewOpen]       = useState(false);
const [viewDocMeta, setViewDocMeta] = useState(null);    // the doc being viewed
const [viewBlobUrl, setViewBlobUrl] = useState(null);    // browser object URL
const [viewLoading, setViewLoading] = useState(false);
```

### The fetch effect

```jsx
useEffect(() => {
  let active = true;   // guards against setting state after unmount

  setLoading(true);
  apiFetch(`/api/employee-documents?employee=${employeeId}&size=100&sort=empDocId,asc`)
    .then(res => { if (!res.ok) throw new Error(...); return res.json(); })
    .then(data => { if (active) setDocuments(data.content ?? []); })
    .catch(err => { if (active) setError(err.message); })
    .finally(() => { if (active) setLoading(false); });

  return () => { active = false; };   // cleanup: cancel on unmount
}, [apiFetch, employeeId, refreshKey]);
//                         ↑ re-runs whenever this changes
```

The `refreshKey` trick: after an upload or removal, `refresh()` increments
`refreshKey` by 1. Because `refreshKey` is in the dependency array, React
re-runs the effect, which re-fetches the document list.

### What is rendered

The page renders four possible sections (only the appropriate ones show):

```
1. Error banner       — if the fetch failed
2. Loading spinner    — while the fetch is in flight
3. Empty state        — if fetch succeeded but returned 0 documents
4. Card grid          — if there are documents to show
```

At the bottom, always rendered but invisible when closed:

```
5. DocumentViewer overlay — fullscreen image / PDF viewer
```

---

## 7. Modal components explained

All four modals follow the same structural pattern:

```jsx
function SomeModal({ ...props }) {
  const { popModal } = useModal();
  const { apiFetch } = useAuth();
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm();

  async function onSubmit(data) {
    const res = await apiFetch("...", { ... });
    if (!res.ok) { setError(...); notyfError(...); return; }
    popModal();
    setTimeout(() => notyfSuccess("..."), 150);  // slight delay so the modal closes first
    onSuccess?.();   // optional callback to refresh the parent page
  }

  return (
    <div className="modal-content ...">
      <div className="modal-header">...</div>
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="modal-body">...</div>
        <div className="modal-footer">
          <button onClick={popModal}>Cancel</button>
          <button type="submit" disabled={isSubmitting}>Save</button>
        </div>
      </form>
    </div>
  );
}
```

### UploadDocumentModal

**Purpose:** Upload a new file and link it to the employee.

**Two-step process:**
```
POST /api/documents          → creates the Document record, stores the file
POST /api/employee-documents → creates the EmployeeDocument link
```

**Why two steps?** Documents are a shared resource. The same file could be
linked to multiple employees or projects. The first call creates the file;
the second call creates the relationship.

### UpdateDescriptionModal

**Purpose:** Edit the text description of an existing document.

```
PUT /api/documents/{docuId}    body: { description: "..." }
```

Pre-populated with the current description (`defaultValues: { description: doc.description }`).

### ReplaceFileModal

**Purpose:** Swap the stored file while keeping the description.

```
PUT /api/documents/{docuId}/file    body: FormData with the new file
```

Shows a warning alert so the user knows the old file is permanently overwritten.

---

## 8. How the API calls work

### apiFetch

`apiFetch` is a helper from `useAuth()`. It automatically attaches the
user's JWT token to every request so the server knows who is calling.
You use it exactly like the native `fetch()`:

```jsx
const res = await apiFetch("/api/employee-documents", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ employeeId: 7, docuId: 12 }),
});
```

### parseApiError

When the server returns an error response (status 400, 404, etc.), the body
is a JSON object. `parseApiError` converts it into a field-error map:

```js
// Server response body:
{ "errors": { "description": "must not be blank" } }

// parseApiError returns:
{ description: "must not be blank" }
```

If the server returns a general error:
```js
// Server response body:
{ "error": "Document not found" }

// parseApiError returns:
{ _general: "Document not found" }
```

### Uploading files with FormData

Files cannot be sent as JSON. They require `multipart/form-data` encoding,
which the browser handles automatically when you use `FormData`:

```jsx
const formData = new FormData();
formData.append("file", file);            // the File object from FilePicker
formData.append("description", "text");   // optional text field

await apiFetch("/api/documents", {
  method: "POST",
  body: formData,
  // DO NOT set Content-Type header manually — the browser sets it automatically
  // with the correct boundary string when body is a FormData object
});
```

### Viewing a file — Blob URLs

The server stores files as binary data. To display them in the browser, we:

1. Fetch the raw bytes:
   ```jsx
   const res = await apiFetch(`/api/documents/${doc.docuId}/file`);
   const blob = await res.blob();   // blob = raw binary data
   ```

2. Create a temporary in-browser URL pointing to that data:
   ```jsx
   const url = URL.createObjectURL(blob);
   // url looks like: "blob:http://localhost:5173/550e8400-e29b-41d4-..."
   ```

3. Pass that URL to `DocumentViewer`, which sets it as the `src` of an `<img>`
   or `<iframe>` to display it.

4. When the viewer closes, revoke the URL to free memory:
   ```jsx
   URL.revokeObjectURL(url);
   ```

---

## 9. The Documents button in Employees.jsx

### What changed

Three things were changed in `Employees.jsx`:

**1. Added `useNavigate` to the import**
```jsx
import { useSearchParams, useNavigate } from "react-router-dom";
```

**2. Added `useNavigate` hook inside `ManageEmployeeModal`**
```jsx
const navigate = useNavigate();
```

`useNavigate()` returns a `navigate` function that programmatically changes
the URL — the same as clicking a link.

**3. Added a new menu item**
```jsx
{
  key: "documents",
  label: "Documents",
  icon: "icon-[tabler--files]",
  roles: null,           // null = visible to ALL roles
}
```

**4. Added the handler branch**
```jsx
if (key === "documents") {
  popModal();   // close the manage panel first (non-modal action)
  navigate(`/employees/${emp.employeeId}/documents`, {
    state: { employeeName: fullName(emp) },
  });
}
```

The CLAUDE.md convention says: when closing a modal to do a **non-modal**
action (like navigation), call `popModal()` first, then perform the action.
This ensures the modal stack is clean before the page changes.

---

## 10. Data flow diagram

```
Employees page
│
│  User clicks "Manage" on a row
│    → pushModal(<ManageEmployeeModal emp={...} />)
│
└─► ManageEmployeeModal
      │
      │  User clicks "Documents"
      │    → popModal()
      │    → navigate("/employees/7/documents", { state: { employeeName: "..." } })
      │
      └─► EmployeeDocuments page
            │
            │  useEffect fires on mount
            │    → GET /api/employee-documents?employee=7
            │    → setDocuments([...])
            │
            │  User clicks "Upload Document"
            │    → pushModal(<UploadDocumentModal employeeId="7" onSuccess={refresh} />)
            │
            └─► UploadDocumentModal
                  │
                  │  User picks a file and submits
                  │    → POST /api/documents              (creates Document record)
                  │    → POST /api/employee-documents     (creates link)
                  │    → popModal()
                  │    → onSuccess() → setRefreshKey(k+1)
                  │
                  └─► EmployeeDocuments page re-fetches the list
```

---

## 11. Glossary

| Term | Meaning |
|---|---|
| **Component** | A JavaScript function that returns JSX (the HTML-like syntax React uses). Each modal, page, and button is a component. |
| **Hook** | A special React function whose name starts with `use`. Hooks let components tap into React features like state (`useState`), side effects (`useEffect`), or context (`useAuth`, `useModal`). |
| **State** | Data that, when changed, causes React to re-render the component automatically. Managed with `useState`. |
| **Effect** | Code that runs *after* the component renders, used for things like API calls. Managed with `useEffect`. |
| **Route** | A mapping from a URL path to a component. Defined in `App.jsx`. |
| **URL parameter** | A variable segment in a URL path, e.g. `:employeeId` in `/employees/:employeeId/documents`. |
| **Navigation state** | Extra data passed alongside a navigation event. Not visible in the URL. |
| **Modal** | A dialog box that appears above the page. This app uses a stack-based system (`pushModal`/`popModal`). |
| **FormData** | A browser API for encoding form data, including file uploads, in `multipart/form-data` format. |
| **Blob** | Binary Large Object — raw binary data (e.g. a file's bytes) held in memory by the browser. |
| **Blob URL** | A temporary `blob:` URL created from a Blob so an `<img>` or `<iframe>` can display it. Must be revoked when done to free memory. |
| **JWT** | JSON Web Token — a string the server gives you after login that proves your identity on every subsequent request. `apiFetch` attaches it automatically. |
| **react-hook-form** | A library that manages form state, validation, and submit lifecycle. Replaces manual `useState`/`onChange` boilerplate. |
| **`register`** | An RHF function that connects an `<input>` or `<textarea>` to the form. Call it as `{...register("fieldName")}`. |
| **`handleSubmit`** | An RHF wrapper that validates the form, then calls your async submit function with the field values as a plain object. |
| **`isSubmitting`** | An RHF boolean that is `true` while your async submit function is running. Use it to disable the submit button. |
| **`setError`** | An RHF function that manually sets an error on a field (e.g. after an API rejection). |
| **`parseApiError`** | A shared helper in `utils/api.js` that converts the server's error response body into a `{ fieldName: "message" }` map. |
| **`apiFetch`** | A wrapper around `fetch` (from `useAuth`) that automatically adds the JWT auth header to every request. |
| **`popModal` after navigate** | The CLAUDE.md convention: when a modal action leads to navigation (a non-modal action), call `popModal()` first to keep the modal stack clean. |
