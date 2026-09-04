import "server-only";

import { createHash } from "node:crypto";

import { Prisma } from "@/generated/prisma/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AccessProfile } from "@/server/auth/access";
import { AuditEventRepository } from "@/server/repositories/audit-event-repository";
import { database } from "@/server/database/client";
import { canAddComment, canReadTicket } from "@/server/tickets/workflow";
import {
  attachmentBucket,
  attachmentLifecycleTimes,
  AttachmentPolicyError,
  authorizeAttachmentDownload,
  createAttachmentObjectKey,
  type AttachmentScanStatus,
  type AttachmentVisibility,
  validateAttachmentFile,
} from "@/server/attachments/policy";

export type AttachmentStorage = {
  upload: (objectKey: string, bytes: Uint8Array, contentType: string) => Promise<void>;
  download: (objectKey: string) => Promise<Blob>;
  remove: (objectKey: string) => Promise<void>;
};

export type TicketAttachmentView = {
  id: string;
  fileName: string;
  contentType: string;
  byteSize: number;
  visibility: AttachmentVisibility;
  scanStatus: AttachmentScanStatus;
  createdAt: Date;
  canDownload: boolean;
};

function storageAdapter(): AttachmentStorage {
  const bucket = createSupabaseAdminClient().storage.from(attachmentBucket);
  return {
    async upload(objectKey, bytes, contentType) {
      const { error } = await bucket.upload(objectKey, bytes, {
        contentType,
        cacheControl: "0",
        upsert: false,
      });
      if (error) throw error;
    },
    async download(objectKey) {
      const { data, error } = await bucket.download(objectKey);
      if (error || !data) throw error ?? new Error("Attachment data was not returned.");
      return data;
    },
    async remove(objectKey) {
      const { error } = await bucket.remove([objectKey]);
      if (error) throw error;
    },
  };
}

function subjectFromAccess(access: AccessProfile) {
  return {
    userId: access.userId,
    organizationId: access.organizationId,
    propertyIds: access.properties.map((property) => property.id),
    departmentIds: access.departmentIds,
    roles: access.roles,
  };
}

function ticketAccessRecord(ticket: {
  organizationId: string;
  propertyId: string;
  requesterUserId: string;
  affectedUserId: string | null;
  departmentId: string | null;
}) {
  return {
    organizationId: ticket.organizationId,
    propertyId: ticket.propertyId,
    requesterUserId: ticket.requesterUserId,
    affectedUserId: ticket.affectedUserId,
    departmentId: ticket.departmentId,
  };
}

function canUploadVisibility(
  access: AccessProfile,
  ticket: ReturnType<typeof ticketAccessRecord>,
  visibility: AttachmentVisibility,
) {
  return canAddComment(subjectFromAccess(access), ticket, visibility);
}

function attachmentAccess(access: AccessProfile, ticket: ReturnType<typeof ticketAccessRecord>) {
  return {
    userId: access.userId,
    ticketReadable: canReadTicket(subjectFromAccess(access), ticket),
    canReadInternal: canUploadVisibility(access, ticket, "internal"),
  };
}

async function recordActivity(input: {
  ticketId: string;
  organizationId: string;
  actorUserId?: string;
  activityType: string;
  metadata: Prisma.InputJsonObject;
}) {
  await database.ticketActivity.create({
    data: {
      organizationId: input.organizationId,
      ticketId: input.ticketId,
      actorUserId: input.actorUserId,
      activityType: input.activityType,
      requesterVisible: false,
      metadata: input.metadata,
    },
  });
}

export async function uploadTicketAttachment(
  access: AccessProfile,
  input: {
    ticketId: string;
    visibility: AttachmentVisibility;
    name: string;
    declaredContentType: string;
    bytes: Uint8Array;
  },
  correlationId: string,
  dependencies: { storage?: AttachmentStorage; now?: () => Date } = {},
) {
  const validated = validateAttachmentFile(input);
  const ticket = await database.ticket.findFirst({
    where: { id: input.ticketId, organizationId: access.organizationId },
    select: {
      id: true,
      ticketNumber: true,
      organizationId: true,
      propertyId: true,
      requesterUserId: true,
      affectedUserId: true,
      departmentId: true,
    },
  });
  if (!ticket) throw new AttachmentPolicyError("not_found");
  if (!canUploadVisibility(access, ticketAccessRecord(ticket), input.visibility))
    throw new AttachmentPolicyError("denied");

  const now = (dependencies.now ?? (() => new Date()))();
  const objectKey = createAttachmentObjectKey(ticket.organizationId, ticket.id);
  const lifecycle = attachmentLifecycleTimes(now);
  const checksumSha256 = createHash("sha256").update(input.bytes).digest("hex");
  const attachment = await database.attachmentMetadata.create({
    data: {
      organizationId: ticket.organizationId,
      ticketId: ticket.id,
      uploadedByUserId: access.userId,
      visibility: input.visibility,
      fileName: validated.fileName,
      contentType: validated.contentType,
      byteSize: validated.byteSize,
      storagePath: objectKey,
      uploadStatus: "pending",
      scanStatus: "pending",
      checksumSha256,
      uploadExpiresAt: lifecycle.uploadExpiresAt,
      retentionUntil: lifecycle.retentionUntil,
    },
  });

  await recordActivity({
    organizationId: ticket.organizationId,
    ticketId: ticket.id,
    actorUserId: access.userId,
    activityType: "attachment_upload_started",
    metadata: {
      attachmentId: attachment.id,
      byteSize: validated.byteSize,
      contentType: validated.contentType,
      visibility: input.visibility,
    },
  });

  const storage = dependencies.storage ?? storageAdapter();
  try {
    await storage.upload(objectKey, input.bytes, validated.contentType);
  } catch {
    await storage.remove(objectKey).catch(() => undefined);
    await database.attachmentMetadata.updateMany({
      where: { id: attachment.id, uploadStatus: "pending" },
      data: { uploadStatus: "abandoned", deletedAt: now },
    });
    await recordActivity({
      organizationId: ticket.organizationId,
      ticketId: ticket.id,
      actorUserId: access.userId,
      activityType: "attachment_upload_failed",
      metadata: { attachmentId: attachment.id },
    });
    throw new AttachmentPolicyError("storage_failed");
  }

  const completed = await database.attachmentMetadata.updateMany({
    where: { id: attachment.id, uploadStatus: "pending" },
    data: { uploadStatus: "uploaded", uploadedAt: now },
  });
  if (completed.count !== 1) {
    await storage.remove(objectKey).catch(() => undefined);
    await database.attachmentMetadata.updateMany({
      where: { id: attachment.id, uploadStatus: "abandoning" },
      data: { uploadStatus: "abandoned", deletedAt: now },
    });
    await recordActivity({
      organizationId: ticket.organizationId,
      ticketId: ticket.id,
      actorUserId: access.userId,
      activityType: "attachment_upload_failed",
      metadata: { attachmentId: attachment.id },
    });
    throw new AttachmentPolicyError("storage_failed");
  }

  const uploaded = await database.attachmentMetadata.findUniqueOrThrow({
    where: { id: attachment.id },
  });
  await recordActivity({
    organizationId: ticket.organizationId,
    ticketId: ticket.id,
    actorUserId: access.userId,
    activityType: "attachment_quarantined",
    metadata: { attachmentId: attachment.id, scanStatus: "pending" },
  });
  const auditRepository = new AuditEventRepository(database);
  await auditRepository.record({
    organizationId: ticket.organizationId,
    propertyId: ticket.propertyId,
    actorUserId: access.userId,
    action: "ticket.attachment_uploaded",
    entityType: "attachment",
    entityId: attachment.id,
    result: "success",
    correlationId,
    metadata: {
      ticketId: ticket.id,
      byteSize: validated.byteSize,
      contentType: validated.contentType,
      scanStatus: "pending",
    },
  });
  return uploaded;
}

export async function downloadTicketAttachment(
  access: AccessProfile,
  attachmentId: string,
  dependencies: { storage?: AttachmentStorage } = {},
) {
  const attachment = await database.attachmentMetadata.findFirst({
    where: { id: attachmentId, organizationId: access.organizationId },
    include: {
      ticket: {
        select: {
          organizationId: true,
          propertyId: true,
          requesterUserId: true,
          affectedUserId: true,
          departmentId: true,
        },
      },
    },
  });
  if (!attachment) throw new AttachmentPolicyError("not_found");
  authorizeAttachmentDownload(attachmentAccess(access, attachment.ticket), {
    uploadedByUserId: attachment.uploadedByUserId,
    visibility: attachment.visibility as AttachmentVisibility,
    uploadStatus: attachment.uploadStatus as
      "pending" | "uploaded" | "abandoning" | "deleting" | "abandoned" | "deleted",
    scanStatus: attachment.scanStatus as AttachmentScanStatus,
  });

  try {
    const data = await (dependencies.storage ?? storageAdapter()).download(attachment.storagePath);
    return {
      fileName: attachment.fileName,
      contentType: attachment.contentType,
      byteSize: attachment.byteSize,
      data: new Uint8Array(await data.arrayBuffer()),
    };
  } catch {
    throw new AttachmentPolicyError("storage_failed");
  }
}

export async function listTicketAttachments(access: AccessProfile, ticketId: string) {
  const ticket = await database.ticket.findFirst({
    where: { id: ticketId, organizationId: access.organizationId },
    select: {
      organizationId: true,
      propertyId: true,
      requesterUserId: true,
      affectedUserId: true,
      departmentId: true,
    },
  });
  if (!ticket) throw new AttachmentPolicyError("not_found");

  const rows = await database.attachmentMetadata.findMany({
    where: {
      ticketId,
      organizationId: access.organizationId,
      uploadStatus: "uploaded",
      deletedAt: null,
    },
    orderBy: { createdAt: "asc" },
  });

  return rows
    .filter(
      (row) =>
        row.visibility === "requester" ||
        canUploadVisibility(access, ticketAccessRecord(ticket), "internal"),
    )
    .map((row) => {
      let canDownload = true;
      try {
        authorizeAttachmentDownload(attachmentAccess(access, ticketAccessRecord(ticket)), {
          uploadedByUserId: row.uploadedByUserId,
          visibility: row.visibility as AttachmentVisibility,
          uploadStatus: row.uploadStatus as "uploaded",
          scanStatus: row.scanStatus as AttachmentScanStatus,
        });
      } catch {
        canDownload = false;
      }
      return {
        id: row.id,
        fileName: row.fileName,
        contentType: row.contentType,
        byteSize: row.byteSize,
        visibility: row.visibility as AttachmentVisibility,
        scanStatus: row.scanStatus as AttachmentScanStatus,
        createdAt: row.createdAt,
        canDownload,
      } satisfies TicketAttachmentView;
    });
}

export async function recordAttachmentScanResult(
  attachmentId: string,
  result: Exclude<AttachmentScanStatus, "pending">,
  scannedAt: Date,
) {
  const updated = await database.attachmentMetadata.updateMany({
    where: { id: attachmentId, uploadStatus: "uploaded", scanStatus: "pending" },
    data: { scanStatus: result, scanCompletedAt: scannedAt },
  });
  if (updated.count !== 1) throw new AttachmentPolicyError("not_found");
  const attachment = await database.attachmentMetadata.findUniqueOrThrow({
    where: { id: attachmentId },
  });
  await recordActivity({
    organizationId: attachment.organizationId,
    ticketId: attachment.ticketId,
    activityType: "attachment_scan_completed",
    metadata: { attachmentId, scanStatus: result },
  });
  return attachment;
}

async function cleanupRows(
  rows: Array<{
    id: string;
    organizationId: string;
    ticketId: string;
    storagePath: string;
    uploadStatus: string;
  }>,
  lifecycle: {
    initial: "pending" | "uploaded";
    claimed: "abandoning" | "deleting";
    complete: "abandoned" | "deleted";
  },
  now: Date,
  storage: AttachmentStorage,
) {
  let cleaned = 0;
  for (const row of rows) {
    try {
      if (row.uploadStatus === lifecycle.initial) {
        const claim = await database.attachmentMetadata.updateMany({
          where: { id: row.id, uploadStatus: lifecycle.initial },
          data: { uploadStatus: lifecycle.claimed },
        });
        if (claim.count !== 1) continue;
      } else if (row.uploadStatus !== lifecycle.claimed) {
        continue;
      }
      await storage.remove(row.storagePath);
      const updated = await database.attachmentMetadata.updateMany({
        where: { id: row.id, uploadStatus: lifecycle.claimed },
        data: { uploadStatus: lifecycle.complete, deletedAt: now },
      });
      if (updated.count !== 1) continue;
      cleaned += 1;
      await recordActivity({
        organizationId: row.organizationId,
        ticketId: row.ticketId,
        activityType:
          lifecycle.complete === "abandoned"
            ? "attachment_abandoned_cleanup"
            : "attachment_retention_deleted",
        metadata: { attachmentId: row.id },
      });
    } catch {
      // Leave the row eligible so a later background run can retry safely.
    }
  }
  return cleaned;
}

export async function cleanupAbandonedAttachmentUploads(
  now: Date,
  dependencies: { storage?: AttachmentStorage } = {},
) {
  const rows = await database.attachmentMetadata.findMany({
    where: {
      uploadExpiresAt: { lte: now },
      uploadStatus: { in: ["pending", "abandoning"] },
    },
    select: {
      id: true,
      organizationId: true,
      ticketId: true,
      storagePath: true,
      uploadStatus: true,
    },
    orderBy: { uploadExpiresAt: "asc" },
    take: 100,
  });
  return cleanupRows(
    rows,
    { initial: "pending", claimed: "abandoning", complete: "abandoned" },
    now,
    dependencies.storage ?? storageAdapter(),
  );
}

export async function cleanupExpiredTicketAttachments(
  now: Date,
  dependencies: { storage?: AttachmentStorage } = {},
) {
  const rows = await database.attachmentMetadata.findMany({
    where: {
      retentionUntil: { lte: now },
      uploadStatus: { in: ["uploaded", "deleting"] },
    },
    select: {
      id: true,
      organizationId: true,
      ticketId: true,
      storagePath: true,
      uploadStatus: true,
    },
    orderBy: { retentionUntil: "asc" },
    take: 100,
  });
  return cleanupRows(
    rows,
    { initial: "uploaded", claimed: "deleting", complete: "deleted" },
    now,
    dependencies.storage ?? storageAdapter(),
  );
}
