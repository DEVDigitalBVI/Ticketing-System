import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  getCurrentAccess: vi.fn(),
  accessCan: vi.fn(),
  getManagerReport: vi.fn(),
  reportToCsv: vi.fn(() => "KPI,Scope,Value,Unit\r\nTicket volume,Selected scope,2,tickets\r\n"),
}));

vi.mock("@/server/auth/access", () => ({ getCurrentAccess: mocks.getCurrentAccess }));
vi.mock("@/server/auth/authorization", () => ({ accessCan: mocks.accessCan }));
vi.mock("@/server/reporting/service", () => ({
  getManagerReport: mocks.getManagerReport,
  ReportingError: class ReportingError extends Error {
    constructor(
      message: string,
      readonly code: string,
    ) {
      super(message);
    }
  },
}));
vi.mock("@/server/reporting/csv", () => ({ reportToCsv: mocks.reportToCsv }));

import { GET } from "@/app/(service-desk)/reports/export/route";

const request = () =>
  new Request(
    "http://localhost:3000/reports/export?from=2026-08-01&to=2026-08-31&timezone=America%2FTortola",
  );

describe("authorized report export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentAccess.mockResolvedValue({ userId: "manager" });
    mocks.accessCan.mockReturnValue(true);
    mocks.getManagerReport.mockResolvedValue({ cards: { volume: 2 } });
  });

  it("rejects unauthenticated and unauthorized callers before building a report", async () => {
    mocks.getCurrentAccess.mockResolvedValueOnce(null);
    expect((await GET(request())).status).toBe(401);
    mocks.accessCan.mockReturnValueOnce(false);
    expect((await GET(request())).status).toBe(403);
    expect(mocks.getManagerReport).not.toHaveBeenCalled();
  });

  it("returns only the approved private CSV result", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-disposition")).toContain(
      "service-quality-2026-08-01-2026-08-31.csv",
    );
    expect(await response.text()).toContain("Ticket volume,Selected scope,2,tickets");
  });
});
