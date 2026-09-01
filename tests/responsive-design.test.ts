import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const stylesheet = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

function relativeLuminance(hex: string) {
  const channels = hex.match(/.{2}/g)?.map((channel) => Number.parseInt(channel, 16) / 255) ?? [];
  const [red, green, blue] = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(first: string, second: string) {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);

  return (
    (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05)
  );
}

describe("approved responsive design contract", () => {
  it("retains the desktop rail, technician master-detail grid, and design tokens", () => {
    expect(stylesheet).toContain("--sidebar-width: 264px");
    expect(stylesheet).toContain("grid-template-columns: minmax(0, 1fr) 326px");
    expect(stylesheet).toContain('--font-display: "Avenir Next"');
    expect(stylesheet).toContain("--palette-signal: #0cdc2a");
    expect(stylesheet).toContain("--palette-indigo: #384166");
    expect(stylesheet).toContain("--palette-teal: #0b735f");
    expect(stylesheet).toContain("--palette-sage: #639d75");
    expect(stylesheet).toContain("--palette-sand: #e3dba9");
    expect(stylesheet).toContain("--canvas: #f7f5e8");
  });

  it("switches to the approved mobile drawer and single-column form at 390 by 844", () => {
    expect(stylesheet).toContain("@media (max-width: 780px)");
    expect(stylesheet).toMatch(/\.sidebar\s*\{[\s\S]*?transform: translateX\(-105%\)/);
    expect(stylesheet).toMatch(/\.form-layout\s*\{\s*grid-template-columns: 1fr/);
    expect(stylesheet).toMatch(/\.choice-grid\s*\{\s*grid-template-columns: 1fr/);
    expect(stylesheet).toMatch(/\.tab-list\s*\{[\s\S]*?flex-wrap: wrap/);
    expect(stylesheet).toMatch(/@media \(max-width: 780px\)[\s\S]*?\.tab-list\s*\{\s*width: 100%/);
    expect(stylesheet).toMatch(/\.search-field\s*\{[\s\S]*?max-width: 100%/);
    expect(stylesheet).toContain("env(safe-area-inset-bottom)");
  });

  it("keeps the login composition responsive and within the approved palette", () => {
    expect(stylesheet).toMatch(/\.login-page\s*\{[\s\S]*?margin-left: 0/);
    expect(stylesheet).toContain("@media (max-width: 700px)");
    expect(stylesheet).toMatch(
      /@media \(max-width: 700px\)[\s\S]*?\.login-page\s*\{\s*display: block/,
    );
    expect(stylesheet).toMatch(/\.login-story\s*\{[\s\S]*?background: var\(--palette-indigo\)/);
  });

  it("keeps admin tables horizontally contained and admin forms collapsing by breakpoint", () => {
    expect(stylesheet).toMatch(/\.audit-table-wrap\s*\{[\s\S]*?overflow-x: auto/);
    expect(stylesheet).toMatch(/\.admin-table\s*\{\s*min-width: 760px/);
    expect(stylesheet).toMatch(/\.audit-table\s*\{\s*width: 100%;[\s\S]*?min-width: 880px/);
    expect(stylesheet).toMatch(
      /@media \(max-width: 1100px\)[\s\S]*?\.admin-card-header\s*\{\s*display: grid/,
    );
    expect(stylesheet).toMatch(
      /@media \(max-width: 1100px\)[\s\S]*?\.admin-form-actions,[\s\S]*?\.admin-actions-cell\s*\{[\s\S]*?flex-direction: column/,
    );
    expect(stylesheet).toMatch(
      /@media \(max-width: 1100px\)[\s\S]*?\.admin-form-grid\s*\{\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/,
    );
    expect(stylesheet).toMatch(
      /@media \(max-width: 780px\)[\s\S]*?\.admin-form-grid\s*\{\s*grid-template-columns: 1fr/,
    );
  });

  it("stacks the overview hero call-to-action cleanly at tablet widths", () => {
    expect(stylesheet).toMatch(
      /@media \(max-width: 1100px\)[\s\S]*?\.hero-header\s*\{[\s\S]*?flex-direction: column;[\s\S]*?align-items: flex-start;/,
    );
    expect(stylesheet).toMatch(
      /@media \(max-width: 1100px\)[\s\S]*?\.hero-header \.primary-button\s*\{[\s\S]*?align-self: flex-start;/,
    );
    expect(stylesheet).toMatch(
      /@media \(max-width: 780px\)[\s\S]*?\.page-header \.primary-button\s*\{\s*width: 100%/,
    );
  });

  it("keeps authenticated account tasks within flexible single-column cards", () => {
    expect(stylesheet).toMatch(/\.auth-task-page\s*\{[\s\S]*?place-items: center/);
    expect(stylesheet).toMatch(/\.auth-task-card\s*\{\s*width: min\(100%, 520px\)/);
    expect(stylesheet).toMatch(/\.auth-task-card\.wide\s*\{\s*width: min\(100%, 650px\)/);
    expect(stylesheet).toMatch(/\.mfa-secret code\s*\{[\s\S]*?overflow-wrap: anywhere/);
  });

  it("retains accessible target, focus, contrast, and motion rules", () => {
    expect(stylesheet).toContain("min-height: 44px");
    expect(stylesheet).toContain(":focus-visible");
    expect(stylesheet).toContain("@media (prefers-reduced-motion: reduce)");
    expect(stylesheet).toContain("@media (prefers-contrast: more)");
    expect(stylesheet).toContain("min-width: 320px");
  });

  it("keeps the approved palette in accessible foreground and background pairings", () => {
    expect(contrastRatio("384166", "ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("0b735f", "ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("0cdc2a", "384166")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("e3dba9", "384166")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("639d75", "1d2422")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("626a78", "fffefa")).toBeGreaterThanOrEqual(4.5);
  });
});
