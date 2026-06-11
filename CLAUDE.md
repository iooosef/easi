- add comment documentation on each class and method definition inside classes
  - brief and short, straightforward easy to understand comments
  - no comment documentation on the following:
    - entities
    - repositories
    - repository methods

Refer to [Role.java](src/main/java/dev/tjj/easi/entity/Role.java) when doing anything about roles or authorization. 

Add appropriate jakarta.validation for all DTO and ensure input are validated in controllers with @Valid

### endpoint documentation
document all REST endpoints using springdoc-openapi annotations from io.swagger.v3.oas.annotations

@Tag(name, description) on every @RestController class
@Operation(summary, description) on every controller method

summary: short action phrase under 60 chars, starts with a verb (e.g. "Get user by ID")
description: 1-3 sentences explaining behavior, side effects, or edge cases


@ApiResponses listing every status code the method can return, including success and known errors (400, 401, 403, 404, 409, etc.)
@Parameter(description, example) on every @PathVariable and @RequestParam
@Schema(description, example) on every DTO field (request and response)
use allowableValues on @Schema for string fields with a fixed set of values
do not duplicate jakarta.validation constraints inside @Schema, they are picked up automatically
use @Operation(hidden = true) for internal or debug endpoints

### audit logging                                                                                                                     
Every service method that adds, updates, or deletes data must call `logService.logByEmail(...)` after the operation succeeds.                                                                                                                                                 
- Inject `LogService` as a constructor dependency in every service that mutates data.                                                   - Retrieve the actor via `SecurityContextHolder.getContext().getAuthentication().getName()` (store in a private `getEmail()` helper).
- Use `LogType.AUDIT` and `LogSeverity.INFO` for all normal mutations.
- `action` values: `"CREATE"`, `"UPDATE"`, `"DELETE"`
- `entityType`: the entity class name (e.g. `"Project"`)
- `entityId`: the entity's primary key as a String
- `description`: plain-English summary (e.g. `"Registered project #5"`, `"Deleted employee #12"`)
- `ipAddress`: pass `null` from service layer (resolved at controller/filter level)
- Log after `repository.save()` / `repository.delete()` so the entry is only written on success.

### FRONTEND
Frontend in /frontend dir
Frontend framework is React using FlyonUI (Tailwind CSS component library)

### frontend form validation
All forms that submit to the API must handle validation errors inline on each field using FlyonUI's `is-invalid` and `helper-text` pattern.

Backend returns `{ "errors": { "fieldName": "message" } }` for `@Valid` violations, or `{ "error": "message" }` for other errors.

Parse errors with this helper (defined per page file):
```js
async function parseApiError(res) {
  const data = await res.json().catch(() => ({}))
  if (data.errors) return data.errors
  return { _general: data.message ?? data.error ?? `Error ${res.status}` }
}
```

Form error state is an object `{}` (not a string or null). On a failed response:
1. `setFormError(await parseApiError(res))` — sets field-level errors
2. `notyfError('Action failed')` — shows a toast immediately

Each field renders:
```jsx
<input className={`input input-bordered w-full${formError.fieldName ? ' is-invalid' : ''}`} ... />
{formError.fieldName && <span className="helper-text">{formError.fieldName}</span>}
```

General (non-field) errors use key `_general` and render as a compact alert at the bottom of the form. Reset `formError` to `{}` (not `null`) when opening or closing a modal.

### modal system
The app uses a layered modal system in `frontend/src/modal/`.

**BEFORE writing any modal code, re-read this section.**

**API** — import using the explicit path (use `'./modals/index.js'` from `src/`, `'../modals/index.js'` from subdirs):
```js
import { useModal } from './modals/index.js'
const { pushModal, popModal, replaceModal, clearModals } = useModal()
```

| Control | Behaviour |
|---|---|
| `pushModal(jsx)` | Adds a new layer on top of the stack |
| `popModal()` | Removes the top layer |
| `replaceModal(jsx)` | Swaps the top layer (no stack growth) |
| `clearModals()` | Closes all layers |

**Rules:**
- Use `pushModal` / `popModal` for ALL modal flows. Do not use the legacy `<Modal>` component or state-driven modal patterns for new modals.
- Every modal layer MUST be its own React component. Never pass inline JSX with event handlers or state to `pushModal` — closures captured at call time go stale and break interaction. Trivial static content (no handlers, no state) is the only exception.
- Each modal component calls `useModal()` itself to get `pushModal`/`popModal`. Never pass these as props.
- Clicking the backdrop does NOT close the modal — backdrop-dismiss is disabled globally to prevent accidental form loss.
- Do not add `e.stopPropagation()` to buttons inside modals; the system handles click isolation.
- Z-indexes start at 100 and increment per layer, safely above all other UI.

**Stacking vs closing:**
- To open a sub-modal on top (e.g. edit form from a manage panel): call `pushModal(<SubModal />)` — do NOT call `popModal()` first. The sub-modal sits on top; closing it reveals the parent.
- To close the current modal and do a non-modal action (navigate, open legacy modal): call `popModal()` first, then the action.

**Component pattern:**
```jsx
// Layer 1 — manage panel component
function ManageThingModal({ thing, onRefresh }) {
  const { pushModal, popModal } = useModal()
  const { hasRole } = useAuth()

  function handleAction(key) {
    if (key === 'update') pushModal(<UpdateThingModal thing={thing} onSuccess={onRefresh} />)
    if (key === 'delete') { popModal(); onDelete(thing) }  // non-modal action: pop first
  }

  return (
    <div className="modal-content w-full max-w-2xl my-auto">
      <div className="modal-header">
        <h3 className="modal-title">{thing.name}</h3>
        <button type="button" className="btn btn-text btn-circle btn-sm absolute end-3 top-3" onClick={popModal}>
          <span className="icon-[tabler--x] size-4"></span>
        </button>
      </div>
      <div className="modal-body">
        <ModalNav items={MENU_ITEMS} hasRole={hasRole} onSelect={handleAction} />
      </div>
    </div>
  )
}

// Layer 2 — edit form component (pushed from layer 1)
function UpdateThingModal({ thing, onSuccess }) {
  const { popModal } = useModal()
  const { apiFetch } = useAuth()
  const [form, setForm] = useState({ ... })
  const [formError, setFormError] = useState({})

  async function handleSubmit(e) {
    // ... submit logic ...
    popModal()       // closes this layer; layer 1 reappears
    onSuccess?.()
  }

  return (
    <div className="modal-content w-full max-w-2xl my-auto">
      <div className="modal-header">...</div>
      <div className="modal-body"><form onSubmit={handleSubmit}>...</form></div>
      <div className="modal-footer">
        <button onClick={popModal}>Cancel</button>
        <button type="submit">Save</button>
      </div>
    </div>
  )
}

// Caller (page component) — only needs pushModal
function openManage(item) {
  pushModal(<ManageThingModal thing={item} onRefresh={() => setRefreshKey(k => k + 1)} />)
}
```

### ModalNav — action grid inside modals

Use `ModalNav` (`frontend/src/ModalNav.jsx`) whenever a modal needs to present a list of navigable actions (e.g. a "Manage" panel). It renders a labelled grid of icon cards, one per action.

```jsx
import ModalNav from './modals/ModalNav.jsx'

<ModalNav
  title="Manage"        // section label shown above the grid (optional)
  items={MENU_ITEMS}
  hasRole={hasRole}     // from useAuth(); filters items by role
  onSelect={handleAction}  // handleAction decides whether to push or pop+act
/>
```

**Item shape:**
```js
{ key: 'update', label: 'Update Details', icon: 'icon-[tabler--pencil]', roles: ['ADMIN', 'STAFF'] }
// roles: null  →  visible to all roles
// roles: [...]  →  visible only if hasRole(...roles) is true
```

- Do not build inline button lists for action menus inside modals — always use `ModalNav`.
- `onSelect` should call the component's own `handleAction` function, not a closure from the parent page.
- The default grid is `grid-cols-5`. Pass `cols={4}` (or `cols={3}`) to override when fewer columns look better. Empty columns are intentional.

### reports
See [PLAN.md](PLAN.md) for the full implementation plan.

**Backend rules:**
- All report endpoints are GET-only — no audit logging required.
- Accept `startDate` and `endDate` as `@RequestParam` with `@DateTimeFormat(iso = DateTimeFormat.ISO.DATE)`, both required.
- Return a flat list DTO per report type — no nested objects. Resolve FK display names (e.g. project name, employee name) in the JPQL query or in the service layer.
- All report DTOs live in `dto/report/`. Apply `@Schema` on every field per the endpoint documentation rules.
- Use JPQL `BETWEEN :startDate AND :endDate` on the primary date field documented in PLAN.md for each report.
- Restrict report endpoints to roles `ADMIN`, `ACCOUNTING`, `STAFF` in `SecurityConfig`.

**Frontend rules:**
- All report UI lives in `Reports.jsx`.
- The printable content must be wrapped in `<div id="print-area">`. The print button calls `window.print()`.
- Add `@media print` CSS that hides everything except `#print-area`. Elements inside the print area that must not appear in print (e.g. the print button itself) get class `no-print`.
- The print area header must include: system/company name, report type, applied filters, and generated-on datetime.
- Show a loading spinner while fetching. On empty result, show "No data found for the selected filters." On error, use the `_general` error pattern.
- The Print / Save as PDF button is only rendered when data is loaded and non-empty.