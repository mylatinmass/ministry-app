# Priory priest-allocation Google Sheet

The Priory Sheet assigns priests to mission availability windows. It never
contains a mission's detailed Mass, Confession, sick-call, patient, address, or
private appointment records.

## Required tabs and columns

Column names are case-insensitive. Spaces and punctuation are normalized to
underscores by the importer.

### Priests

| Priest ID | Display Name | Active |
| --- | --- | --- |
| `fr-example` | Father Example | `TRUE` |

`Priest ID` is permanent. Renaming a priest does not change this value.

### Allocations

| Allocation ID | Priest ID | Mission ID | Mission Name | Rule Type | Day of Week | Date | Start Time | End Time | Effective From | Effective To | Time Zone | Active | Request ID |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `alloc-001` | `fr-example` | `olv-miami` | OLV Miami | `weekly` | Sunday |  | 06:00 | 14:00 | 2026-09-01 | 2027-06-30 | America/New_York | TRUE |  |
| `alloc-002` | `fr-example` | `mission-two` | Mission Two | `one_time` |  | 2026-09-08 | 09:00 | 17:00 |  |  | America/New_York | TRUE |  |

`Rule Type` is `weekly` or `one_time`. Weekly rows require `Day of Week` and
may have effective dates. One-time rows require `Date`. Allocation times cannot
cross midnight; use two rows when a window crosses midnight.

### Exceptions

| Exception ID | Allocation ID | Priest ID | Date | Action | Replacement Mission ID | Replacement Mission Name | Replacement Start Time | Replacement End Time | Active |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `exception-001` | `alloc-001` | `fr-example` | 2026-12-06 | cancel |  |  |  |  | TRUE |
| `exception-002` | `alloc-001` | `fr-example` | 2026-12-13 | replace | `mission-two` | Mission Two | 08:00 | 16:00 | TRUE |

`Action` is `cancel` or `replace`.

### Requests

| Request ID | Mission ID | Mission Name | Requested Start | Requested End | Event Type | Urgency | Priest ID | Status | Created At | Allocation ID |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

The app appends new rows with `pending` status. Priory staff may change the
status to `declined`. To approve, add or update an Allocation row carrying the
same `Request ID`; the mission app recognizes that linked allocation as the
approval and updates its local request automatically. No confidential
appointment data belongs here.

Do not delete every Priest or Allocation row to clear a schedule. Mark rows
inactive instead. An unexpectedly empty source is treated as a failed import so
the last verified mission schedule cannot be erased by a broken Sheet response.

## Google permissions

1. Create a dedicated Google service account for each mission deployment.
2. Share the spreadsheet with that service account.
3. Protect `Priests`, `Allocations`, and `Exceptions` so the service account
   cannot edit them.
4. Permit the service account to append to `Requests`.
5. Store credentials only in the deployment's encrypted environment variables.
6. Configure the Spreadsheet ID and Mission ID in Chapel Settings.

Each mission has its own application database and deployment. Several missions
may read the same Priory Sheet without receiving access to one another's local
events or private appointment details.
