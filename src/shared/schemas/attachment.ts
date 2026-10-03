import { z } from "zod";

export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
export const MAX_STORAGE_PER_OWNER = 20;

export const ALLOWED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

export const attachmentOwnerTypeSchema = z.enum([
  "spark",
  "note",
  "brag-log",
]);

export const attachmentResponseSchema = z.object({
  id: z.string(),
  ownerType: attachmentOwnerTypeSchema,
  ownerId: z.string(),
  mimeType: z.string(),
  size: z.number(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  url: z.string(),
  createdAt: z.string(),
});

export type AttachmentOwnerType = z.infer<typeof attachmentOwnerTypeSchema>;
export type AttachmentResponse = z.infer<typeof attachmentResponseSchema>;

export function attachmentUrl(id: string): string {
  return `/api/attachments/${id}`;
}
