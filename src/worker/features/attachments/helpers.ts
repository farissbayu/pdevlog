import { and, eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";

import {
  ALLOWED_IMAGE_TYPES,
  MAX_STORAGE_PER_OWNER,
  MAX_ATTACHMENT_SIZE,
  attachmentUrl,
  type AttachmentOwnerType,
  type AttachmentResponse,
} from "@/shared/schemas/attachment";
import type { Database } from "@/worker/db";
import {
  attachments,
  type AttachmentRow,
} from "@/worker/db/schema";

export type AttachmentError =
  | { code: "unsupported_type"; message: string }
  | { code: "too_large"; message: string }
  | { code: "too_many"; message: string };

export class AttachmentUploadError extends Error {
  readonly error: AttachmentError;

  constructor(error: AttachmentError) {
    super(error.message);
    this.name = "AttachmentUploadError";
    this.error = error;
  }
}

function fileExtension(mimeType: string): string {
  switch (mimeType) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "bin";
  }
}

export function attachmentR2Key(
  userId: string,
  ownerType: AttachmentOwnerType,
  ownerId: string,
  attachmentId: string,
  mimeType: string,
): string {
  return `attachments/${userId}/${ownerType}/${ownerId}/${attachmentId}.${fileExtension(
    mimeType,
  )}`;
}

export function toAttachmentResponse(row: AttachmentRow): AttachmentResponse {
  return {
    id: row.id,
    ownerType: row.ownerType,
    ownerId: row.ownerId,
    mimeType: row.mimeType,
    size: row.size,
    width: row.width,
    height: row.height,
    url: attachmentUrl(row.id),
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

export async function loadAttachments(
  db: Database,
  ownerType: AttachmentOwnerType,
  ownerId: string,
  userId: string,
): Promise<AttachmentRow[]> {
  return db
    .select()
    .from(attachments)
    .where(
      and(
        eq(attachments.ownerType, ownerType),
        eq(attachments.ownerId, ownerId),
        eq(attachments.userId, userId),
      ),
    );
}

export async function loadAttachmentsByOwnerIds(
  db: Database,
  ownerType: AttachmentOwnerType,
  ownerIds: string[],
  userId: string,
): Promise<Map<string, AttachmentRow[]>> {
  const map = new Map<string, AttachmentRow[]>();
  if (ownerIds.length === 0) {
    return map;
  }

  const rows = await db
    .select()
    .from(attachments)
    .where(
      and(
        eq(attachments.ownerType, ownerType),
        inArray(attachments.ownerId, ownerIds),
        eq(attachments.userId, userId),
      ),
    );

  for (const row of rows) {
    const list = map.get(row.ownerId) ?? [];
    list.push(row);
    map.set(row.ownerId, list);
  }
  return map;
}

export async function findOwnedAttachment(
  db: Database,
  id: string,
  userId: string,
): Promise<AttachmentRow | undefined> {
  const [row] = await db
    .select()
    .from(attachments)
    .where(and(eq(attachments.id, id), eq(attachments.userId, userId)))
    .limit(1);
  return row;
}

export async function createAttachment(
  db: Database,
  bucket: R2Bucket,
  params: {
    ownerType: AttachmentOwnerType;
    ownerId: string;
    userId: string;
    file: File;
  },
): Promise<AttachmentRow> {
  const { ownerType, ownerId, userId, file } = params;

  if (
    !ALLOWED_IMAGE_TYPES.includes(
      file.type as (typeof ALLOWED_IMAGE_TYPES)[number],
    )
  ) {
    throw new AttachmentUploadError({
      code: "unsupported_type",
      message: "Only PNG, JPEG, WebP and GIF images are supported",
    });
  }
  if (file.size > MAX_ATTACHMENT_SIZE) {
    throw new AttachmentUploadError({
      code: "too_large",
      message: "Image exceeds the 10 MB limit",
    });
  }

  const existing = await loadAttachments(db, ownerType, ownerId, userId);
  if (existing.length >= MAX_STORAGE_PER_OWNER) {
    throw new AttachmentUploadError({
      code: "too_many",
      message: `A spark can hold at most ${MAX_STORAGE_PER_OWNER} images`,
    });
  }

  const id = nanoid();
  const r2Key = attachmentR2Key(userId, ownerType, ownerId, id, file.type);
  const body = await file.arrayBuffer();

  await bucket.put(r2Key, body, {
    httpMetadata: { contentType: file.type },
  });

  const row: AttachmentRow = {
    id,
    userId,
    ownerType,
    ownerId,
    r2Key,
    mimeType: file.type,
    size: file.size,
    width: null,
    height: null,
    createdAt: new Date(),
  };

  await db.insert(attachments).values(row);
  return row;
}

export async function moveAttachments(
  db: Database,
  params: {
    fromOwnerType: AttachmentOwnerType;
    fromOwnerId: string;
    toOwnerType: AttachmentOwnerType;
    toOwnerId: string;
    userId: string;
  },
): Promise<void> {
  const { fromOwnerType, fromOwnerId, toOwnerType, toOwnerId, userId } = params;
  await db
    .update(attachments)
    .set({ ownerType: toOwnerType, ownerId: toOwnerId })
    .where(
      and(
        eq(attachments.ownerType, fromOwnerType),
        eq(attachments.ownerId, fromOwnerId),
        eq(attachments.userId, userId),
      ),
    );
}

export async function deleteOwnedAttachments(
  db: Database,
  bucket: R2Bucket,
  ownerType: AttachmentOwnerType,
  ownerId: string,
  userId: string,
): Promise<void> {
  const rows = await loadAttachments(db, ownerType, ownerId, userId);
  if (rows.length === 0) {
    return;
  }
  await bucket.delete(rows.map((row) => row.r2Key));
  await db
    .delete(attachments)
    .where(
      and(
        eq(attachments.ownerType, ownerType),
        eq(attachments.ownerId, ownerId),
        eq(attachments.userId, userId),
      ),
    );
}
