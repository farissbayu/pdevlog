import { useEffect, useMemo, useRef } from "react";

import { parseApiError } from "@/client/lib/api";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_STORAGE_PER_OWNER,
  MAX_ATTACHMENT_SIZE,
  type AttachmentResponse,
} from "@/shared/schemas/attachment";

export function isAllowedImage(file: File): boolean {
  return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function validateImageFile(
  file: File,
  currentCount: number,
): string | null {
  if (!isAllowedImage(file)) {
    return "Only PNG, JPEG, WebP and GIF images are supported";
  }
  if (file.size > MAX_ATTACHMENT_SIZE) {
    return `Image must be under ${formatBytes(MAX_ATTACHMENT_SIZE)}`;
  }
  if (currentCount >= MAX_STORAGE_PER_OWNER) {
    return `You can attach at most ${MAX_STORAGE_PER_OWNER} images`;
  }
  return null;
}

export function extractImageFiles(data: DataTransfer | null): File[] {
  if (!data) {
    return [];
  }
  const files: File[] = [];
  if (data.items && data.items.length > 0) {
    for (const item of data.items) {
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          files.push(file);
        }
      }
    }
  }
  if (files.length === 0 && data.files) {
    for (const file of data.files) {
      if (file.type.startsWith("image/")) {
        files.push(file);
      }
    }
  }
  return files;
}

export type PreviewFile = {
  file: File;
  url: string;
};

export function useFilePreviews(files: File[]): PreviewFile[] {
  const previews = useMemo(
    () => files.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [files],
  );
  const urlsRef = useRef<string[]>([]);

  useEffect(() => {
    urlsRef.current = previews.map((preview) => preview.url);
    return () => {
      for (const url of urlsRef.current) {
        URL.revokeObjectURL(url);
      }
    };
  }, [previews]);

  return previews;
}

export async function uploadAttachment(
  ownerPath: "sparks" | "notes",
  ownerId: string,
  file: File,
): Promise<AttachmentResponse> {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(`/api/${ownerPath}/${ownerId}/attachments`, {
    method: "POST",
    body: form,
    credentials: "include",
  });
  if (!response.ok) {
    throw await parseApiError(response, "Failed to upload image");
  }
  const data = (await response.json()) as { attachment: AttachmentResponse };
  return data.attachment;
}

export async function deleteAttachment(attachmentId: string): Promise<void> {
  const response = await fetch(`/api/attachments/${attachmentId}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!response.ok) {
    throw await parseApiError(response, "Failed to delete image");
  }
}
