import { describe, expect, it } from "vitest";

import type { AccessProfile } from "@/server/auth/access";
import {
  attachmentLifecycleTimes,
  attachmentMaxBytes,
  AttachmentPolicyError,
  authorizeAttachmentDownload,
  createAttachmentObjectKey,
  safeAttachmentFilename,
  shouldCleanupAbandonedUpload,
  shouldCleanupRetainedObject,
  validateAttachmentFile,
} from "@/server/attachments/policy";

const requester: AccessProfile = {
  userId: "user-requester",
  authUserId: "auth-requester",
  email: "requester@example.invalid",
  displayName: "Requester",
  organizationId: "org-one",
  organizationName: "Peter Island Resort and Spa",
  properties: [{ id: "property-one", name: "Peter Island Resort and Spa" }],
  departmentIds: ["department-one"],
  roles: ["requester"],
  assuranceLevel: "aal1",
  mustChangePassword: false,
};
const otherRequester = { ...requester, userId: "user-other", authUserId: "auth-other" };
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);

describe("private ticket attachment policy", () => {
  it("creates unpredictable opaque keys without including the filename", () => {
    const first = createAttachmentObjectKey("org-one", "ticket-one");
    const second = createAttachmentObjectKey("org-one", "ticket-one");
    expect(first).toMatch(/^org-one\/ticket-one\/[0-9a-f-]{36}$/);
    expect(second).not.toBe(first);
    expect(first).not.toContain("screenshot");
  });

  it("sanitizes path traversal, control characters, and unsafe filename characters", () => {
    expect(safeAttachmentFilename("../../guest\u0000<folio>.pdf")).toBe("guest_folio_.pdf");
    expect(safeAttachmentFilename("..\\..\\résumé?.pdf")).toBe("résumé_.pdf");
  });

  it("accepts allowed files only when bytes, declared type, and extension agree", () => {
    expect(
      validateAttachmentFile({
        name: "arrival-screen.png",
        declaredContentType: "image/png",
        bytes: png,
      }),
    ).toEqual({ fileName: "arrival-screen.png", contentType: "image/png", byteSize: png.length });
    expect(() =>
      validateAttachmentFile({
        name: "malware.png",
        declaredContentType: "image/png",
        bytes: new TextEncoder().encode("MZ executable"),
      }),
    ).toThrowError(new AttachmentPolicyError("spoofed_type"));
    expect(() =>
      validateAttachmentFile({
        name: "renamed.txt",
        declaredContentType: "application/pdf",
        bytes: new TextEncoder().encode("%PDF-1.7"),
      }),
    ).toThrowError(new AttachmentPolicyError("spoofed_type"));
  });

  it("rejects oversized files at the exact byte boundary", () => {
    expect(() =>
      validateAttachmentFile({
        name: "large.txt",
        declaredContentType: "text/plain",
        bytes: new Uint8Array(attachmentMaxBytes + 1).fill(65),
      }),
    ).toThrowError(new AttachmentPolicyError("oversized"));
  });

  it("does not grant access merely because another user knows an attachment key", () => {
    expect(() =>
      authorizeAttachmentDownload(
        { userId: otherRequester.userId, ticketReadable: false, canReadInternal: false },
        {
          uploadedByUserId: requester.userId,
          visibility: "requester",
          uploadStatus: "uploaded",
          scanStatus: "clean",
        },
      ),
    ).toThrowError(new AttachmentPolicyError("not_found"));
  });

  it("quarantines unscanned files from every authorized user except the uploader", () => {
    expect(() =>
      authorizeAttachmentDownload(
        { userId: requester.userId, ticketReadable: true, canReadInternal: false },
        {
          uploadedByUserId: requester.userId,
          visibility: "requester",
          uploadStatus: "uploaded",
          scanStatus: "pending",
        },
      ),
    ).not.toThrow();

    const affectedUser = {
      ...otherRequester,
      userId: "user-affected",
      authUserId: "auth-affected",
    };
    expect(() =>
      authorizeAttachmentDownload(
        { userId: affectedUser.userId, ticketReadable: true, canReadInternal: false },
        {
          uploadedByUserId: requester.userId,
          visibility: "requester",
          uploadStatus: "uploaded",
          scanStatus: "pending",
        },
      ),
    ).toThrowError(new AttachmentPolicyError("quarantined"));
  });

  it("blocks infected content even for its uploader", () => {
    expect(() =>
      authorizeAttachmentDownload(
        { userId: requester.userId, ticketReadable: true, canReadInternal: false },
        {
          uploadedByUserId: requester.userId,
          visibility: "requester",
          uploadStatus: "uploaded",
          scanStatus: "infected",
        },
      ),
    ).toThrowError(new AttachmentPolicyError("infected"));
  });

  it("selects abandoned uploads and expired retained objects at exact clock boundaries", () => {
    const now = new Date("2026-09-04T12:00:00.000Z");
    const times = attachmentLifecycleTimes(now);
    expect(
      shouldCleanupAbandonedUpload("pending", times.uploadExpiresAt, times.uploadExpiresAt),
    ).toBe(true);
    expect(
      shouldCleanupAbandonedUpload(
        "pending",
        times.uploadExpiresAt,
        new Date(times.uploadExpiresAt.getTime() - 1),
      ),
    ).toBe(false);
    expect(
      shouldCleanupRetainedObject("uploaded", times.retentionUntil, times.retentionUntil),
    ).toBe(true);
    expect(shouldCleanupRetainedObject("deleted", times.retentionUntil, times.retentionUntil)).toBe(
      false,
    );
  });
});
