import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const stylesheet = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

describe("approved responsive design contract", () => {
  it("retains the desktop rail, technician master-detail grid, and design tokens", () => {
    expect(stylesheet).toContain("--sidebar-width: 264px");
    expect(stylesheet).toContain("grid-template-columns: minmax(0, 1fr) 326px");
    expect(stylesheet).toContain('--font-display: "Avenir Next"');
    expect(stylesheet).toContain("--canvas: #f4f1eb");
  });

  it("switches to the approved mobile drawer and single-column form at 390 by 844", () => {
    expect(stylesheet).toContain("@media (max-width: 780px)");
    expect(stylesheet).toMatch(/\.sidebar\s*\{[\s\S]*?transform: translateX\(-105%\)/);
    expect(stylesheet).toMatch(/\.form-layout\s*\{\s*grid-template-columns: 1fr/);
    expect(stylesheet).toMatch(/\.choice-grid\s*\{\s*grid-template-columns: 1fr/);
    expect(stylesheet).toContain("env(safe-area-inset-bottom)");
  });

  it("retains accessible target, focus, contrast, and motion rules", () => {
    expect(stylesheet).toContain("min-height: 44px");
    expect(stylesheet).toContain(":focus-visible");
    expect(stylesheet).toContain("@media (prefers-reduced-motion: reduce)");
    expect(stylesheet).toContain("@media (prefers-contrast: more)");
    expect(stylesheet).toContain("min-width: 320px");
  });
});
