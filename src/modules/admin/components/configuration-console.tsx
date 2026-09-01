import Link from "next/link";

import {
  configurationEntityLabels,
  type ConfigurationEntityType,
} from "@/modules/admin/configuration";
import type { ConfigurationCatalog } from "@/server/configuration/service";

type SearchState = {
  entity?: string;
  id?: string;
  status?: string;
};

function statusMessage(search: SearchState, entityType: ConfigurationEntityType) {
  if (search.entity !== entityType || !search.status) return null;
  switch (search.status) {
    case "created":
      return { tone: "success", text: `${configurationEntityLabels[entityType]} saved.` };
    case "updated":
      return { tone: "success", text: `${configurationEntityLabels[entityType]} updated.` };
    case "deactivated":
      return { tone: "success", text: `${configurationEntityLabels[entityType]} deactivated.` };
    case "duplicate":
      return {
        tone: "error",
        text: "An active record with that code or name already exists in this scope.",
      };
    case "invalid":
      return { tone: "error", text: "The submitted values were invalid or linked incorrectly." };
    case "linked":
      return {
        tone: "error",
        text: "Deactivate or move active dependent records before deactivating this value.",
      };
    case "not_found":
      return { tone: "error", text: "That record no longer exists in this organisation." };
    case "mfa":
      return { tone: "error", text: "Administrator MFA verification is required." };
    default:
      return { tone: "error", text: "The configuration change could not be completed." };
  }
}

function StateBadge({ isActive }: { isActive: boolean }) {
  return (
    <span className={`audit-result${isActive ? "" : " failure"}`}>
      {isActive ? "active" : "inactive"}
    </span>
  );
}

export function ConfigurationConsole({
  catalog,
  search,
}: {
  catalog: ConfigurationCatalog;
  search: SearchState;
}) {
  const activeProperties = catalog.properties.filter((record) => record.isActive);
  const activeBuildingAreas = catalog.buildingAreas.filter((record) => record.isActive);
  const activeDepartments = catalog.departments.filter((record) => record.isActive);
  const activeCategories = catalog.ticketCategories.filter((record) => record.isActive);

  return (
    <div className="configuration-stack">
      <section className="admin-card">
        <div className="admin-card-header">
          <div>
            <p className="overline">Configuration administration</p>
            <h1>Resort hierarchy and service taxonomy</h1>
            <p>
              Administrators can add, update, and deactivate the values used across tickets and
              assets without editing code.
            </p>
          </div>
        </div>
      </section>

      <section className="admin-card">
        <div className="admin-card-header">
          <div>
            <h2>Properties</h2>
            <p>Organisation-level resorts or operating properties.</p>
          </div>
        </div>
        {statusMessage(search, "property") ? (
          <p
            className={
              statusMessage(search, "property")?.tone === "success" ? "form-success" : "form-error"
            }
            role={statusMessage(search, "property")?.tone === "success" ? "status" : "alert"}
          >
            {statusMessage(search, "property")?.text}
          </p>
        ) : null}
        <form className="admin-form-grid" action="/auth/admin-configuration" method="post">
          <input type="hidden" name="entityType" value="property" />
          <input
            type="hidden"
            name="intent"
            value={search.entity === "property" && search.id ? "update" : "create"}
          />
          {search.entity === "property" && search.id ? (
            <input type="hidden" name="id" value={search.id} />
          ) : null}
          <label>
            <span>Code</span>
            <input
              name="code"
              required
              defaultValue={
                search.entity === "property"
                  ? catalog.properties.find((record) => record.id === search.id)?.code
                  : undefined
              }
            />
          </label>
          <label>
            <span>Name</span>
            <input
              name="name"
              required
              defaultValue={
                search.entity === "property"
                  ? catalog.properties.find((record) => record.id === search.id)?.name
                  : undefined
              }
            />
          </label>
          <label>
            <span>Timezone</span>
            <input
              name="timezone"
              required
              defaultValue={
                search.entity === "property"
                  ? catalog.properties.find((record) => record.id === search.id)?.timezone
                  : "America/Tortola"
              }
            />
          </label>
          <div className="admin-form-actions">
            <button className="primary-button" type="submit">
              {search.entity === "property" && search.id ? "Save property" : "Add property"}
            </button>
            {search.entity === "property" && search.id ? (
              <Link className="text-link inline-link" href="/admin/configuration">
                Cancel
              </Link>
            ) : null}
          </div>
        </form>
        <div className="audit-table-wrap">
          <table className="audit-table admin-table">
            <caption className="sr-only">Configured properties</caption>
            <thead>
              <tr>
                <th>Name</th>
                <th>Code</th>
                <th>Timezone</th>
                <th>State</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {catalog.properties.map((record) => (
                <tr key={record.id}>
                  <td>{record.name}</td>
                  <td>{record.code}</td>
                  <td>{record.timezone}</td>
                  <td>
                    <StateBadge isActive={record.isActive} />
                  </td>
                  <td className="admin-actions-cell">
                    <Link
                      className="text-link inline-link"
                      href={`/admin/configuration?entity=property&id=${record.id}`}
                    >
                      Edit
                    </Link>
                    {record.isActive ? (
                      <form action="/auth/admin-configuration" method="post">
                        <input type="hidden" name="entityType" value="property" />
                        <input type="hidden" name="intent" value="deactivate" />
                        <input type="hidden" name="id" value={record.id} />
                        <button className="ghost-button" type="submit">
                          Deactivate
                        </button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <EntitySection
        entityType="building_area"
        heading="Buildings or Areas"
        description="Intermediate resort hierarchy used to group villas, pavilions, and operating zones."
        search={search}
        rows={catalog.buildingAreas.map((record) => ({
          id: record.id,
          primary: record.name,
          secondary: `${record.propertyName} · ${record.kind}`,
          code: record.code,
          isActive: record.isActive,
        }))}
        form={
          <EntityForm
            actionLabel={
              search.entity === "building_area" && search.id
                ? "Save building or area"
                : "Add building or area"
            }
          >
            <input type="hidden" name="entityType" value="building_area" />
            <input
              type="hidden"
              name="intent"
              value={search.entity === "building_area" && search.id ? "update" : "create"}
            />
            {search.entity === "building_area" && search.id ? (
              <input type="hidden" name="id" value={search.id} />
            ) : null}
            <label>
              <span>Property</span>
              <select
                name="propertyId"
                defaultValue={
                  search.entity === "building_area"
                    ? catalog.buildingAreas.find((record) => record.id === search.id)?.propertyId
                    : activeProperties[0]?.id
                }
              >
                {activeProperties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Type</span>
              <select
                name="kind"
                defaultValue={
                  search.entity === "building_area"
                    ? catalog.buildingAreas.find((record) => record.id === search.id)?.kind
                    : "building"
                }
              >
                <option value="building">Building</option>
                <option value="area">Area</option>
              </select>
            </label>
            <label>
              <span>Code</span>
              <input
                name="code"
                required
                defaultValue={
                  search.entity === "building_area"
                    ? catalog.buildingAreas.find((record) => record.id === search.id)?.code
                    : undefined
                }
              />
            </label>
            <label>
              <span>Name</span>
              <input
                name="name"
                required
                defaultValue={
                  search.entity === "building_area"
                    ? catalog.buildingAreas.find((record) => record.id === search.id)?.name
                    : undefined
                }
              />
            </label>
          </EntityForm>
        }
      />

      <EntitySection
        entityType="service_location"
        heading="Rooms or Service Locations"
        description="Leaf locations where technicians and staff can place work."
        search={search}
        rows={catalog.serviceLocations.map((record) => ({
          id: record.id,
          primary: record.name,
          secondary: `${record.propertyName} · ${record.buildingAreaName} · ${record.kind === "room" ? "room" : "service location"}`,
          code: record.code,
          isActive: record.isActive,
        }))}
        form={
          <EntityForm
            actionLabel={
              search.entity === "service_location" && search.id ? "Save location" : "Add location"
            }
          >
            <input type="hidden" name="entityType" value="service_location" />
            <input
              type="hidden"
              name="intent"
              value={search.entity === "service_location" && search.id ? "update" : "create"}
            />
            {search.entity === "service_location" && search.id ? (
              <input type="hidden" name="id" value={search.id} />
            ) : null}
            <label>
              <span>Property</span>
              <select
                name="propertyId"
                defaultValue={
                  search.entity === "service_location"
                    ? catalog.serviceLocations.find((record) => record.id === search.id)?.propertyId
                    : activeProperties[0]?.id
                }
              >
                {activeProperties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Building or area</span>
              <select
                name="buildingAreaId"
                defaultValue={
                  search.entity === "service_location"
                    ? catalog.serviceLocations.find((record) => record.id === search.id)
                        ?.buildingAreaId
                    : activeBuildingAreas[0]?.id
                }
              >
                {activeBuildingAreas.map((record) => (
                  <option key={record.id} value={record.id}>
                    {record.propertyName} · {record.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Type</span>
              <select
                name="kind"
                defaultValue={
                  search.entity === "service_location"
                    ? catalog.serviceLocations.find((record) => record.id === search.id)?.kind
                    : "room"
                }
              >
                <option value="room">Room</option>
                <option value="service_location">Service location</option>
              </select>
            </label>
            <label>
              <span>Code</span>
              <input
                name="code"
                required
                defaultValue={
                  search.entity === "service_location"
                    ? catalog.serviceLocations.find((record) => record.id === search.id)?.code
                    : undefined
                }
              />
            </label>
            <label>
              <span>Name</span>
              <input
                name="name"
                required
                defaultValue={
                  search.entity === "service_location"
                    ? catalog.serviceLocations.find((record) => record.id === search.id)?.name
                    : undefined
                }
              />
            </label>
          </EntityForm>
        }
      />

      <EntitySection
        entityType="department"
        heading="Departments"
        description="Operational resort departments that raise or own service issues."
        search={search}
        rows={catalog.departments.map((record) => ({
          id: record.id,
          primary: record.name,
          secondary: record.propertyName,
          code: record.code,
          isActive: record.isActive,
        }))}
        form={
          <EntityForm
            actionLabel={
              search.entity === "department" && search.id ? "Save department" : "Add department"
            }
          >
            <input type="hidden" name="entityType" value="department" />
            <input
              type="hidden"
              name="intent"
              value={search.entity === "department" && search.id ? "update" : "create"}
            />
            {search.entity === "department" && search.id ? (
              <input type="hidden" name="id" value={search.id} />
            ) : null}
            <label>
              <span>Property</span>
              <select
                name="propertyId"
                defaultValue={
                  search.entity === "department"
                    ? catalog.departments.find((record) => record.id === search.id)?.propertyId
                    : activeProperties[0]?.id
                }
              >
                {activeProperties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Code</span>
              <input
                name="code"
                required
                defaultValue={
                  search.entity === "department"
                    ? catalog.departments.find((record) => record.id === search.id)?.code
                    : undefined
                }
              />
            </label>
            <label>
              <span>Name</span>
              <input
                name="name"
                required
                defaultValue={
                  search.entity === "department"
                    ? catalog.departments.find((record) => record.id === search.id)?.name
                    : undefined
                }
              />
            </label>
          </EntityForm>
        }
      />

      <EntitySection
        entityType="support_team"
        heading="Support Teams"
        description="Teams used to route and report internal support ownership."
        search={search}
        rows={catalog.supportTeams.map((record) => ({
          id: record.id,
          primary: record.name,
          secondary: record.departmentName
            ? `${record.propertyName} · ${record.departmentName}`
            : `${record.propertyName} · Unassigned department`,
          code: record.code,
          isActive: record.isActive,
        }))}
        form={
          <EntityForm
            actionLabel={
              search.entity === "support_team" && search.id
                ? "Save support team"
                : "Add support team"
            }
          >
            <input type="hidden" name="entityType" value="support_team" />
            <input
              type="hidden"
              name="intent"
              value={search.entity === "support_team" && search.id ? "update" : "create"}
            />
            {search.entity === "support_team" && search.id ? (
              <input type="hidden" name="id" value={search.id} />
            ) : null}
            <label>
              <span>Property</span>
              <select
                name="propertyId"
                defaultValue={
                  search.entity === "support_team"
                    ? catalog.supportTeams.find((record) => record.id === search.id)?.propertyId
                    : activeProperties[0]?.id
                }
              >
                {activeProperties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Department</span>
              <select
                name="departmentId"
                defaultValue={
                  search.entity === "support_team"
                    ? (catalog.supportTeams.find((record) => record.id === search.id)
                        ?.departmentId ?? "")
                    : ""
                }
              >
                <option value="">No department</option>
                {activeDepartments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.propertyName} · {department.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Code</span>
              <input
                name="code"
                required
                defaultValue={
                  search.entity === "support_team"
                    ? catalog.supportTeams.find((record) => record.id === search.id)?.code
                    : undefined
                }
              />
            </label>
            <label>
              <span>Name</span>
              <input
                name="name"
                required
                defaultValue={
                  search.entity === "support_team"
                    ? catalog.supportTeams.find((record) => record.id === search.id)?.name
                    : undefined
                }
              />
            </label>
          </EntityForm>
        }
      />

      <EntitySection
        entityType="ticket_category"
        heading="Ticket Categories"
        description="Top-level IT request groupings used across the service desk."
        search={search}
        rows={catalog.ticketCategories.map((record) => ({
          id: record.id,
          primary: record.name,
          secondary: "Organisation-wide",
          code: record.code,
          isActive: record.isActive,
        }))}
        form={
          <EntityForm
            actionLabel={
              search.entity === "ticket_category" && search.id ? "Save category" : "Add category"
            }
          >
            <input type="hidden" name="entityType" value="ticket_category" />
            <input
              type="hidden"
              name="intent"
              value={search.entity === "ticket_category" && search.id ? "update" : "create"}
            />
            {search.entity === "ticket_category" && search.id ? (
              <input type="hidden" name="id" value={search.id} />
            ) : null}
            <label>
              <span>Code</span>
              <input
                name="code"
                required
                defaultValue={
                  search.entity === "ticket_category"
                    ? catalog.ticketCategories.find((record) => record.id === search.id)?.code
                    : undefined
                }
              />
            </label>
            <label>
              <span>Name</span>
              <input
                name="name"
                required
                defaultValue={
                  search.entity === "ticket_category"
                    ? catalog.ticketCategories.find((record) => record.id === search.id)?.name
                    : undefined
                }
              />
            </label>
          </EntityForm>
        }
      />

      <EntitySection
        entityType="ticket_subcategory"
        heading="Ticket Subcategories"
        description="Category-specific issue values used to keep intake consistent."
        search={search}
        rows={catalog.ticketSubcategories.map((record) => ({
          id: record.id,
          primary: record.name,
          secondary: record.categoryName,
          code: record.code,
          isActive: record.isActive,
        }))}
        form={
          <EntityForm
            actionLabel={
              search.entity === "ticket_subcategory" && search.id
                ? "Save subcategory"
                : "Add subcategory"
            }
          >
            <input type="hidden" name="entityType" value="ticket_subcategory" />
            <input
              type="hidden"
              name="intent"
              value={search.entity === "ticket_subcategory" && search.id ? "update" : "create"}
            />
            {search.entity === "ticket_subcategory" && search.id ? (
              <input type="hidden" name="id" value={search.id} />
            ) : null}
            <label>
              <span>Category</span>
              <select
                name="categoryId"
                defaultValue={
                  search.entity === "ticket_subcategory"
                    ? catalog.ticketSubcategories.find((record) => record.id === search.id)
                        ?.categoryId
                    : activeCategories[0]?.id
                }
              >
                {activeCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Code</span>
              <input
                name="code"
                required
                defaultValue={
                  search.entity === "ticket_subcategory"
                    ? catalog.ticketSubcategories.find((record) => record.id === search.id)?.code
                    : undefined
                }
              />
            </label>
            <label>
              <span>Name</span>
              <input
                name="name"
                required
                defaultValue={
                  search.entity === "ticket_subcategory"
                    ? catalog.ticketSubcategories.find((record) => record.id === search.id)?.name
                    : undefined
                }
              />
            </label>
          </EntityForm>
        }
      />
    </div>
  );
}

function EntityForm({ children, actionLabel }: { children: React.ReactNode; actionLabel: string }) {
  return (
    <form className="admin-form-grid" action="/auth/admin-configuration" method="post">
      {children}
      <div className="admin-form-actions">
        <button className="primary-button" type="submit">
          {actionLabel}
        </button>
      </div>
    </form>
  );
}

function EntitySection({
  entityType,
  heading,
  description,
  rows,
  form,
  search,
}: {
  entityType: ConfigurationEntityType;
  heading: string;
  description: string;
  rows: Array<{ id: string; primary: string; secondary: string; code: string; isActive: boolean }>;
  form: React.ReactNode;
  search: SearchState;
}) {
  const message = statusMessage(search, entityType);

  return (
    <section className="admin-card">
      <div className="admin-card-header">
        <div>
          <h2>{heading}</h2>
          <p>{description}</p>
        </div>
      </div>
      {message ? (
        <p
          className={message.tone === "success" ? "form-success" : "form-error"}
          role={message.tone === "success" ? "status" : "alert"}
        >
          {message.text}
        </p>
      ) : null}
      {form}
      <div className="audit-table-wrap">
        <table className="audit-table admin-table">
          <caption className="sr-only">{heading}</caption>
          <thead>
            <tr>
              <th>Name</th>
              <th>Scope</th>
              <th>Code</th>
              <th>State</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.primary}</td>
                <td>{row.secondary}</td>
                <td>{row.code}</td>
                <td>
                  <StateBadge isActive={row.isActive} />
                </td>
                <td className="admin-actions-cell">
                  <Link
                    className="text-link inline-link"
                    href={`/admin/configuration?entity=${entityType}&id=${row.id}`}
                  >
                    Edit
                  </Link>
                  {row.isActive ? (
                    <form action="/auth/admin-configuration" method="post">
                      <input type="hidden" name="entityType" value={entityType} />
                      <input type="hidden" name="intent" value="deactivate" />
                      <input type="hidden" name="id" value={row.id} />
                      <button className="ghost-button" type="submit">
                        Deactivate
                      </button>
                    </form>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
