# Asset inventory policy and ownership

Last updated: 2026-09-04

Step 15 makes the service desk the business source of truth for resort asset identity, accountability, location, lifecycle, and commercial context. It does not connect to Level.io or claim ownership of live telemetry.

## Field ownership

| Major field group                    | Source of truth                                            | Rules                                                                                                                                                                                                        |
| ------------------------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Resort asset tag                     | Service desk `Asset.assetTag`                              | Human-facing Peter Island identifier; case-insensitively unique within the organisation. It is never reused as a serial number or external ID.                                                               |
| Serial number                        | Manufacturer/vendor, recorded in the service desk          | Stored separately from the resort tag; optional and case-insensitively unique within the organisation when known.                                                                                            |
| Asset type                           | Service desk `AssetType`                                   | Organisation-managed classification. Initial approved types are workstation, laptop, printer, network equipment, phone, point-of-sale device, television, audio-visual equipment, server, and shared device. |
| Lifecycle status                     | Service desk `AssetStatus` and `Asset`                     | Current business state. Initial statuses are in stock, deployed, in repair, retired, and disposed. Retirement is a workflow, never a hard delete.                                                            |
| Property, building/area, room/outlet | Service desk resort hierarchy and `Asset`                  | Current location uses approved property, building, and service-location records. Composite foreign keys prevent cross-property or mismatched room/building links.                                            |
| Move history                         | Service desk `AssetLocationHistory`                        | Append-only from/to snapshot, reason, actor, and timestamp. Creation records the initial location.                                                                                                           |
| Department and custodian             | Service desk `Asset`, `AssetAssignment`, and managed users | Current responsibility lives on the asset; assignment records preserve the historical custodian/department, assigning actor, note, and effective interval.                                                   |
| Criticality                          | Service desk `Asset`                                       | Business impact classification: low, standard, high, or mission critical. It is not inferred from monitoring data.                                                                                           |
| Purchase and warranty                | Service desk `ProcurementMetadata` and `Vendor`            | IT-managed commercial context: vendor, dates, cost/currency, purchase order, warranty reference, and notes.                                                                                                  |
| External system identity             | `ExternalSystemLink`                                       | Namespaced external IDs remain separate from asset tags and serial numbers. The pair of system and external ID is unique per organisation.                                                                   |
| Level.io telemetry and device state  | `LevelDeviceInventory` snapshot owned by Level.io          | Step 21 stores only the approved operational snapshot. Sync never overwrites the service-desk asset record; association is through `ExternalSystemLink`.                                                     |

## Authorization and lifecycle

- `asset.read` allows technicians, IT managers, and system administrators to view asset lists, details, and history within their property scope.
- `asset.manage` allows IT managers and system administrators to create, edit, transfer, assign, and retire assets within their property scope.
- Every mutation reloads organisation/property records, validates hierarchy and active reference data, uses optimistic concurrency, and records an audit event.
- Cross-property transfers require management permission for both properties and clear the old responsibility assignment. Location history retains both sides of the move.
- Retired records cannot be edited, transferred, or reassigned. Database triggers prohibit asset deletion and history rewriting.

## Validation and identifiers

Asset tags, serials, type/status codes, vendor names, and external identities have database-backed uniqueness rules. Blank identity fields, invalid criticality, negative purchase costs, malformed currency codes, reversed warranty dates, mismatched hierarchy links, and incomplete retirement fields are rejected. All identifiers are organisation-bound through composite foreign keys.
