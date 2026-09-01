"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { NewTicketFormOptions } from "@/server/tickets/intake";

const issueTypes = [
  {
    value: "device",
    icon: "▣",
    title: "Device or equipment",
    detail: "Computer, printer, phone, TV",
  },
  {
    value: "access",
    icon: "◇",
    title: "Account or access",
    detail: "Sign-in, password, permissions",
  },
  { value: "network", icon: "⌁", title: "Network or Wi-Fi", detail: "Connection, speed, coverage" },
  {
    value: "other",
    icon: "•••",
    title: "Something else",
    detail: "Software, request, or question",
  },
] as const;

function statusMessage(search: { status?: string; ticket?: string }) {
  switch (search.status) {
    case "created":
      return {
        tone: "success" as const,
        title: `Request received: ${search.ticket ?? "ticket created"}`,
        detail: "IT will review it next. You can follow updates from My tickets.",
      };
    case "invalid":
      return {
        tone: "error" as const,
        title: "We could not submit your request",
        detail: "Check the required fields and remove unsupported text, then try again.",
      };
    case "denied":
      return {
        tone: "error" as const,
        title: "You do not have access to submit that request",
        detail: "Choose only active options available to your signed-in account.",
      };
    case "failed":
      return {
        tone: "error" as const,
        title: "We could not submit your request",
        detail: "Please try again. If the issue continues, contact IT directly.",
      };
    default:
      return null;
  }
}

export function NewTicketForm({
  options,
  search,
}: {
  options: NewTicketFormOptions;
  search: { status?: string; ticket?: string };
}) {
  const [summary, setSummary] = useState("");
  const [selectedPropertyId, setSelectedPropertyId] = useState(options.properties[0]?.id ?? "");
  const [selectedCategoryId, setSelectedCategoryId] = useState(options.categories[0]?.id ?? "");
  const message = statusMessage(search);

  const visibleLocations = useMemo(
    () => options.serviceLocations.filter((location) => location.propertyId === selectedPropertyId),
    [options.serviceLocations, selectedPropertyId],
  );
  const visibleDepartments = useMemo(
    () => options.departments.filter((department) => department.propertyId === selectedPropertyId),
    [options.departments, selectedPropertyId],
  );
  const visibleSubcategories = useMemo(
    () =>
      options.subcategories.filter((subcategory) => subcategory.categoryId === selectedCategoryId),
    [options.subcategories, selectedCategoryId],
  );

  return (
    <>
      <div className="form-layout">
        <form className="ticket-form" action="/auth/new-ticket" method="post">
          <div className="form-section">
            <div className="section-number">1</div>
            <div className="form-section-content">
              <h2>What is happening?</h2>
              <p className="field-intro">Choose the closest option. You can explain more below.</p>
              <fieldset className="choice-grid">
                <legend className="sr-only">Issue type</legend>
                {issueTypes.map((type, index) => (
                  <label className="choice-card" key={type.value}>
                    <input
                      type="radio"
                      name="type"
                      value={type.value}
                      defaultChecked={index === 0}
                    />
                    <span className="choice-icon" aria-hidden="true">
                      {type.icon}
                    </span>
                    <strong>{type.title}</strong>
                    <small>{type.detail}</small>
                  </label>
                ))}
              </fieldset>
              <label className="field-label" htmlFor="summary">
                Short summary
              </label>
              <input
                id="summary"
                name="summary"
                type="text"
                maxLength={100}
                placeholder="For example: Front desk printer stops after each page"
                required
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
              />
              <div className="field-meta">
                <span>Describe the result, not the technical cause.</span>
                <span aria-live="polite">{summary.length} / 100</span>
              </div>
              <label className="field-label" htmlFor="details">
                What were you trying to do?
              </label>
              <textarea
                id="details"
                name="details"
                rows={5}
                maxLength={4000}
                placeholder="Include what you expected, what happened instead, and any message you saw."
                required
              />
              <div className="field-pair">
                <div>
                  <label className="field-label" htmlFor="category">
                    Category
                  </label>
                  <select
                    id="category"
                    name="categoryId"
                    required
                    value={selectedCategoryId}
                    onChange={(event) => setSelectedCategoryId(event.target.value)}
                  >
                    {options.categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label" htmlFor="subcategory">
                    Subcategory
                  </label>
                  <select
                    id="subcategory"
                    key={selectedCategoryId}
                    name="subcategoryId"
                    defaultValue=""
                  >
                    <option value="">Choose one if it helps</option>
                    {visibleSubcategories.map((subcategory) => (
                      <option key={subcategory.id} value={subcategory.id}>
                        {subcategory.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="form-section">
            <div className="section-number">2</div>
            <div className="form-section-content">
              <h2>Where is the issue?</h2>
              <div className="field-pair">
                <div>
                  <label className="field-label" htmlFor="property">
                    Property
                  </label>
                  <select
                    id="property"
                    name="propertyId"
                    value={selectedPropertyId}
                    onChange={(event) => setSelectedPropertyId(event.target.value)}
                  >
                    {options.properties.map((property) => (
                      <option key={property.id} value={property.id}>
                        {property.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label" htmlFor="location">
                    Area or room
                  </label>
                  <select
                    id="location"
                    key={selectedPropertyId}
                    name="serviceLocationId"
                    defaultValue=""
                  >
                    <option value="">Choose the nearest room or service location</option>
                    {visibleLocations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <label className="field-label" htmlFor="department">
                Department
              </label>
              <select id="department" key={selectedPropertyId} name="departmentId" defaultValue="">
                <option value="">Choose the department most affected</option>
                {visibleDepartments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
              <label className="toggle-row">
                <span>
                  <strong>This affects a guest-facing service</strong>
                  <small>
                    Examples include check-in, guest Wi-Fi, room access, or point of sale.
                  </small>
                </span>
                <input
                  className="switch"
                  type="checkbox"
                  name="guest-impact"
                  aria-label="This affects a guest-facing service"
                />
              </label>
            </div>
          </div>

          <div className="form-section">
            <div className="section-number">3</div>
            <div className="form-section-content">
              <h2>How much is work affected?</h2>
              <fieldset className="segmented-control">
                <legend className="sr-only">Work impact</legend>
                <label>
                  <input type="radio" name="impact" value="low" />
                  <span>I can still work</span>
                </label>
                <label>
                  <input type="radio" name="impact" value="medium" defaultChecked />
                  <span>Work is difficult</span>
                </label>
                <label>
                  <input type="radio" name="impact" value="high" />
                  <span>Work has stopped</span>
                </label>
                <label>
                  <input type="radio" name="impact" value="critical" />
                  <span>Guest service has stopped</span>
                </label>
              </fieldset>
              <h2>How urgent is it?</h2>
              <fieldset className="segmented-control">
                <legend className="sr-only">Urgency</legend>
                <label>
                  <input type="radio" name="urgency" value="low" />
                  <span>It can wait today</span>
                </label>
                <label>
                  <input type="radio" name="urgency" value="medium" defaultChecked />
                  <span>Please help soon</span>
                </label>
                <label>
                  <input type="radio" name="urgency" value="high" />
                  <span>This is urgent</span>
                </label>
                <label>
                  <input type="radio" name="urgency" value="critical" />
                  <span>This is happening now</span>
                </label>
              </fieldset>
            </div>
          </div>
          <div className="form-actions">
            <Link className="secondary-button" href="/">
              Cancel
            </Link>
            <button className="primary-button" type="submit">
              Review request <span aria-hidden="true">→</span>
            </button>
          </div>
        </form>

        <aside className="form-aside">
          <p className="overline">What happens next</p>
          <ol className="process-list">
            <li>
              <span>1</span>
              <div>
                <strong>IT reviews your request</strong>
                <small>We check the impact and route it to the right person.</small>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <strong>You receive updates</strong>
                <small>Follow progress here or from your work email.</small>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <strong>Confirm the fix</strong>
                <small>Tell us whether everything is working again.</small>
              </div>
            </li>
          </ol>
          <div className="privacy-note">
            <strong>Your privacy</strong>
            <p>Do not include passwords, payment card details, or guest personal information.</p>
          </div>
        </aside>
      </div>
      <div
        className={`toast${message ? " is-visible" : ""}`}
        role={message?.tone === "error" ? "alert" : "status"}
        aria-live="polite"
      >
        <span className="toast-check" aria-hidden="true">
          {message?.tone === "error" ? "!" : "✓"}
        </span>
        <span>
          <strong>{message?.title ?? "Request ready for review"}</strong>
          <small>
            {message?.detail ?? "Your information is retained locally for this design step."}
          </small>
        </span>
      </div>
    </>
  );
}
