import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  attachmentFindFirst: vi.fn(),
  attachmentFindMany: vi.fn(),
  attachmentUpdateMany: vi.fn(),
  activityCreate: vi.fn(),
  auditRecord: vi.fn(),
}));

vi.mock("@/server/database/client", () => ({
  database: {
    attachmentMetadata: {
      findFirst: mocks.attachmentFindFirst,
      findMany: mocks.attachmentFindMany,
      updateMany: mocks.attachmentUpdateMany,
    },
    ticketActivity: { create: mocks.activityCreate },
  },
}));
vi.mock("@/server/repositories/audit-event-repository", () => ({
  AuditEventRepository: class AuditEventRepository {
    record = mocks.auditRecord;
  },
}));

import type { AccessProfile } from "@/server/auth/access";
import { AttachmentPolicyError } from "@/server/attachments/policy";
import {
  cleanupAbandonedAttachmentUploads,
  cleanupExpiredTicketAttachments,
  downloadTicketAttachment,
  type AttachmentStorage,
} from "@/server/attachments/service";

const access: AccessProfile = {
  userId: "user-one",
  authUserId: "auth-one",
  email: "one@example.invalid",
  displayName: "User One",
  organizationId: "org-one",
  organizationName: "Peter Island Resort and Spa",
  properties: [{ id: "property-one", name: "Peter Island Resort and Spa" }],
  departmentIds: ["department-one"],
  roles: ["requester"],
  assuranceLevel: "aal1",
  mustChangePassword: false,
};

function storage(): AttachmentStorage {
  return {
    upload: vi.fn(),
    download: vi.fn(),
    remove: vi.fn(),
  };
}

describe("ticket attachment storage service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.activityCreate.mockResolvedValue({});
    mocks.attachmentUpdateMany.mockResolvedValue({ count: 1 });
  });

  it("never asks storage for a guessed attachment unless its ticket is readable", async () => {
    mocks.attachmentFindFirst.mockResolvedValue({
      id: "attachment-one",
      organizationId: access.organizationId,
      uploadedByUserId: "someone-else",
      visibility: "requester",
      uploadStatus: "uploaded",
      scanStatus: "clean",
      storagePath: "private/opaque-key",
      fileName: "folio.pdf",
      contentType: "application/pdf",
      byteSize: 100,
      ticket: {
        organizationId: access.organizationId,
        propertyId: "property-one",
        requesterUserId: "another-requester",
        affectedUserId: null,
        departmentId: "another-department",
      },
    });
    const adapter = storage();

    await expect(
      downloadTicketAttachment(access, "attachment-one", { storage: adapter }),
    ).rejects.toEqual(new AttachmentPolicyError("not_found"));
    expect(adapter.download).not.toHaveBeenCalled();
  });

  it("removes expired pending objects and keeps failed cleanup eligible for retry", async () => {
    const now = new Date("2026-09-04T14:00:00.000Z");
    const rows = [
      {
        id: "one",
        organizationId: "org-one",
        ticketId: "ticket-one",
        storagePath: "opaque-one",
        uploadStatus: "pending",
      },
      {
        id: "two",
        organizationId: "org-one",
        ticketId: "ticket-two",
        storagePath: "opaque-two",
        uploadStatus: "pending",
      },
    ];
    mocks.attachmentFindMany.mockResolvedValue(rows);
    const adapter = storage();
    vi.mocked(adapter.remove)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("provider unavailable"));

    await expect(cleanupAbandonedAttachmentUploads(now, { storage: adapter })).resolves.toBe(1);
    expect(mocks.attachmentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          uploadExpiresAt: { lte: now },
          uploadStatus: { in: ["pending", "abandoning"] },
        },
        take: 100,
      }),
    );
    expect(mocks.attachmentUpdateMany).toHaveBeenCalledTimes(3);
    expect(mocks.activityCreate).toHaveBeenCalledTimes(1);
  });

  it("resumes cleanup after a worker claimed an abandoned upload", async () => {
    const now = new Date("2026-09-04T14:00:00.000Z");
    mocks.attachmentFindMany.mockResolvedValue([
      {
        id: "one",
        organizationId: "org-one",
        ticketId: "ticket-one",
        storagePath: "opaque-one",
        uploadStatus: "abandoning",
      },
    ]);
    const adapter = storage();

    await expect(cleanupAbandonedAttachmentUploads(now, { storage: adapter })).resolves.toBe(1);
    expect(mocks.attachmentUpdateMany).toHaveBeenCalledTimes(1);
    expect(mocks.attachmentUpdateMany).toHaveBeenCalledWith({
      where: { id: "one", uploadStatus: "abandoning" },
      data: { uploadStatus: "abandoned", deletedAt: now },
    });
  });

  it("deletes retained objects only through the explicit retention cleanup path", async () => {
    const now = new Date("2027-09-04T14:00:00.000Z");
    mocks.attachmentFindMany.mockResolvedValue([
      {
        id: "one",
        organizationId: "org-one",
        ticketId: "ticket-one",
        storagePath: "opaque-one",
        uploadStatus: "uploaded",
      },
    ]);
    const adapter = storage();

    await expect(cleanupExpiredTicketAttachments(now, { storage: adapter })).resolves.toBe(1);
    expect(mocks.attachmentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          retentionUntil: { lte: now },
          uploadStatus: { in: ["uploaded", "deleting"] },
        },
        take: 100,
      }),
    );
    expect(mocks.attachmentUpdateMany).toHaveBeenCalledWith({
      where: { id: "one", uploadStatus: "uploaded" },
      data: { uploadStatus: "deleting" },
    });
    expect(mocks.attachmentUpdateMany).toHaveBeenCalledWith({
      where: { id: "one", uploadStatus: "deleting" },
      data: { uploadStatus: "deleted", deletedAt: now },
    });
  });
});
