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