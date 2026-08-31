"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

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

export function NewTicketForm() {
  const [summary, setSummary] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    window.setTimeout(() => setSubmitted(false), 3400);
  }

  return (
    <>
      <div className="form-layout">
        <form className="ticket-form" onSubmit={submit}>
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
                placeholder="Include what you expected, what happened instead, and any message you saw."
                required
              />
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
                  <select id="property" name="property">
                    <option>Peter Island Resort and Spa</option>
                  </select>
                </div>
                <div>
                  <label className="field-label" htmlFor="location">
                    Area or room
                  </label>
                  <select id="location" name="location">
                    <option>Front Office</option>
                    <option>Reservations</option>
                    <option>Main Restaurant</option>
                    <option>Guest Room</option>
                    <option>Other</option>
                  </select>
                </div>
              </div>
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
      <div className={`toast${submitted ? " is-visible" : ""}`} role="status" aria-live="polite">
        <span className="toast-check" aria-hidden="true">
          ✓
        </span>
        <span>
          <strong>Request ready for review</strong>
          <small>Your information is retained locally for this design step.</small>
        </span>
      </div>
    </>
  );
}
