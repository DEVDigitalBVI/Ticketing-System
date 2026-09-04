import { randomUUID } from "node:crypto";

export const attachmentBucket = "ticket-attachments";
export const attachmentMaxBytes = 10 * 1024 * 1024;
export const attachmentUploadLifetimeMs = 60 * 60 * 1000;
export const attachmentRetentionMs = 365 * 24 * 60 * 60 * 1000;

export type AttachmentUploadStatus =
  "pending" | "uploaded" | "abandoning" | "deleting" | "abandoned" | "deleted";
export type AttachmentScanStatus = "pending" | "clean" | "infected" | "failed";
export type AttachmentVisibility = "requester" | "internal";

const allowedExtensions: Record<string, readonly string[]> = {
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/webp": [".webp"],
  "application/pdf": [".pdf"],
  "text/plain": [".txt"],
};

export class AttachmentPolicyError extends Error {
  constructor(
    readonly code:
      | "denied"
      | "invalid_file"
      | "oversized"
      | "spoofed_type"
      | "quarantined"
      | "infected"
      | "not_found"
      | "storage_failed",
  ) {
    super(code);
  }
}

export function safeAttachmentFilename(value: string) {
  const leaf = value.split(/[\\/]/).at(-1)?.normalize("NFKC") ?? "";
  const cleaned = leaf
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[^\p{L}\p{N} ._()-]/gu, "_")
    .replace(/\s+/g, " ")
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 120);
  return cleaned || "attachment";
}

function detectedContentType(bytes: Uint8Array) {
  if (
    bytes.length >= 8 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)
  )
    return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "image/jpeg";
  if (
    bytes.length >= 12 &&
    new TextDecoder("ascii").decode(bytes.slice(0, 4)) === "RIFF" &&
    new TextDecoder("ascii").decode(bytes.slice(8, 12)) === "WEBP"
  )
    return "image/webp";
  if (bytes.length >= 5 && new TextDecoder("ascii").decode(bytes.slice(0, 5)) === "%PDF-")
    return "application/pdf";

  if (bytes.length > 0 && !bytes.includes(0)) {
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      return "text/plain";
    } catch {
      return null;
    }
  }
  return null;
}

export function validateAttachmentFile(input: {
  name: string;
  declaredContentType: string;
  bytes: Uint8Array;
}) {
  if (input.bytes.length === 0) throw new AttachmentPolicyError("invalid_file");
  if (input.bytes.length > attachmentMaxBytes) throw new AttachmentPolicyError("oversized");

  const contentType = detectedContentType(input.bytes);
  if (!contentType || contentType !== input.declaredContentType)
    throw new AttachmentPolicyError("spoofed_type");

  const fileName = safeAttachmentFilename(input.name);
  const lowerName = fileName.toLocaleLowerCase("en-US");
  if (!allowedExtensions[contentType]?.some((extension) => lowerName.endsWith(extension)))
    throw new AttachmentPolicyError("spoofed_type");

  return { fileName, contentType, byteSize: input.bytes.length };
}

export function createAttachmentObjectKey(organizationId: string, ticketId: string) {
  return `${organizationId}/${ticketId}/${randomUUID()}`;
}

type AttachmentAccessRecord = {
  uploadedByUserId: string;
  visibility: AttachmentVisibility;
  uploadStatus: AttachmentUploadStatus;
  scanStatus: AttachmentScanStatus;
};

export function authorizeAttachmentDownload(
  access: { userId: string; ticketReadable: boolean; canReadInternal: boolean },
  attachment: AttachmentAccessRecord,
) {
  if (!access.ticketReadable) throw new AttachmentPolicyError("not_found");
  if (attachment.visibility === "internal" && !access.canReadInternal)
    throw new AttachmentPolicyError("not_found");
  if (attachment.uploadStatus !== "uploaded") throw new AttachmentPolicyError("not_found");
  if (attachment.scanStatus === "infected") throw new AttachmentPolicyError("infected");
  if (attachment.scanStatus !== "clean" && attachment.uploadedByUserId !== access.userId)
    throw new AttachmentPolicyError("quarantined");
}

export function attachmentLifecycleTimes(now: Date) {
  return {
    uploadExpiresAt: new Date(now.getTime() + attachmentUploadLifetimeMs),
    retentionUntil: new Date(now.getTime() + attachmentRetentionMs),
  };
}

export function shouldCleanupAbandonedUpload(
  uploadStatus: AttachmentUploadStatus,
  uploadExpiresAt: Date,
  now: Date,
) {
  return uploadStatus === "pending" && uploadExpiresAt <= now;
}

export function shouldCleanupRetainedObject(
  uploadStatus: AttachmentUploadStatus,
  retentionUntil: Date,
  now: Date,
) {
  return uploadStatus === "uploaded" && retentionUntil <= now;
}
