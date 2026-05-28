# Report Generation Module — Plan

## Overview
A dedicated Reports page where users select a report type, set filters (including a date range), click **Generate**, review the result, then **Print or Save as PDF** using the browser's native print dialog.

No new libraries are needed. PDF export uses `window.print()` with print-specific CSS that hides everything except the report content.

---

## Reports to Implement

| # | Report Name | Primary Date Field | Extra Filters |
|---|---|---|---|
| 1 | Service Report Summary | `service_reports.added_on` | project, status, payment method |
| 2 | Billing / Revenue | `service_report_billing_item.added_on` | project, payment method |
| 3 | Service Schedule | `service_schedule.date` | project, status |
| 4 | Vehicle Usage | `vehicle_logs.added_on` | vehicle, driver (employee) |
| 5 | Fuel / Gas Expense | `vehicle_logs.added_on` (via gas log join) | vehicle |
| 6 | Purchase Orders | `purchase_orders.added_on` | project, purpose, payment method |
| 7 | Project Status | `projects.added_on` | status, type |

---

## Backend

### Structure
```
controller/ReportController.java
service/ReportService.java
dto/report/
  ServiceReportSummaryRow.java
  BillingRevenueRow.java
  ServiceScheduleRow.java
  VehicleUsageRow.java
  FuelExpenseRow.java
  PurchaseOrderRow.java
  ProjectStatusRow.java
```

### Endpoint Pattern
All endpoints live under `GET /api/reports/{type}` or as separate methods — one per report.

Each endpoint accepts:
- `startDate` — `LocalDate`, required
- `endDate` — `LocalDate`, required
- type-specific optional filters (e.g. `projectId`, `status`, `vehicleId`)

Use `@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)` for date params.

Queries use JPQL `BETWEEN :startDate AND :endDate` against the primary date field.

Return a flat list DTO — no nested objects. All foreign key names resolved to display strings in the query or service layer.

No audit logging on report endpoints (read-only).

### Access Control
Reports are accessible to: `ADMIN`, `ACCOUNTING`, `STAFF`. Restrict in `SecurityConfig`.

---

## Frontend

### Route
```
/reports   →  Reports.jsx   (Private, no role restriction beyond login)
```

### Page Structure (`Reports.jsx`)
1. **Report selector** — dropdown to pick one of the 7 report types
2. **Filter bar** — date range pickers (start/end, both required) + type-specific dropdowns that appear conditionally
3. **Generate button** — calls the backend, stores result in state
4. **Report output area** — a `<div id="print-area">` containing:
   - Report title and applied filters shown as a header
   - Generated date/time
   - Data table
5. **Print / Save as PDF button** — calls `window.print()`, visible only when data is loaded

### Print / PDF Pattern
Add a `<style>` block (or a `reports-print.css`) with:
```css
@media print {
  body > * { display: none; }
  #print-area { display: block !important; }
  /* hide print button inside print area */
  #print-area .no-print { display: none; }
}
```

The report header inside `#print-area` must include:
- Company name / system name
- Report type name
- Applied filters (date range, any extras)
- Generated on: `<date>`

### Loading & Error States
- Show a spinner while fetching
- Show an inline alert on error using `_general` key pattern (same as form errors)
- Show "No data found for the selected filters." when the result list is empty

---

## Implementation Order
1. Backend: DTO classes + ReportService queries + ReportController
2. Frontend: Reports.jsx page + route in App.jsx + nav link in Layout
3. Print CSS

---

## Out of Scope
- Scheduled/automated report emails
- Excel/CSV export
- Saving reports to the database
