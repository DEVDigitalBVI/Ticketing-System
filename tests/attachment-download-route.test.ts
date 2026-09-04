import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  finalize: vi.fn((response: Response) => response),
  createSupabaseRouteClient: vi.fn(),
  readCurrentAccess: vi.fn(),
  downloadTicketAttachment: vi.fn(),
}));

vi.mock("@/lib/supabase/route", () => ({
  createSupabaseRouteClient: mocks.createSupabaseRouteClient,
}));
vi.mock("@/server/auth/access", () => ({ readCurrentAccess: mocks.readCurrentAccess }));
vi.mock("@/server/attachments/service", () => ({
  downloadTicketAttachment: mocks.downloadTicketAttachment,
}));

import { GET } from "@/app/attachments/[attachmentId]/route";
import { AttachmentPolicyError } from "@/server/attachments/policy";

const attachmentId = "d2dc3b89-9e11-42c7-b7a2-0f4e6e98b901";
const access = { userId: "user-one", mustChangePassword: false };

function request() {
  return new NextRequest(`http://localhost:3000/attachments/${attachmentId}`);
}

function context(id = attachmentId) {
  return { params: Promise.resolve({ attachmentId: id }) };
}

describe("private attachment download route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createSupabaseRouteClient.mockReturnValue({ supabase: {}, finalize: mocks.finalize });
    mocks.readCurrentAccess.mockResolvedValue(access);
  });

  it("does not disclose attachments to unauthenticated callers", async () => {
    mocks.readCurrentAccess.mockResolvedValue(null);
    const response = await GET(request(), context());
    expect(response.status).toBe(404);
    expect(mocks.downloadTicketAttachment).not.toHaveBeenCalled();
  });

  it("treats guessed identifiers without ticket authorization as not found", async () => {
    mocks.downloadTicketAttachment.mockRejectedValue(new AttachmentPolicyError("not_found"));
    const response = await GET(request(), context());
    expect(response.status).toBe(404);
  });

  it("locks quarantined files from authorized users other than the uploader", async () => {
    mocks.downloadTicketAttachment.mockRejectedValue(new AttachmentPolicyError("quarantined"));
    const response = await GET(request(), context());
    expect(response.status).toBe(423);
  });

  it("streams authorized files without caching or exposing an object URL", async () => {
    mocks.downloadTicketAttachment.mockResolvedValue({
      fileName: "guest folio.pdf",
      contentType: "application/pdf",
      byteSize: 8,
      data: new TextEncoder().encode("%PDF-1.7"),
    });
    const response = await GET(request(), context());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-disposition")).toContain("guest folio.pdf");
    expect(response.headers.get("location")).toBeNull();
    expect(await response.text()).toBe("%PDF-1.7");
  });
});
