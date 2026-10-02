import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect } from "react";

import type { AttachmentResponse } from "@/shared/schemas/attachment";

type SparkLightboxProps = {
  attachments: AttachmentResponse[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
};

export function SparkLightbox({
  attachments,
  index,
  onIndexChange,
  onClose,
}: SparkLightboxProps) {
  const current = attachments[index];

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      } else if (event.key === "ArrowRight" && index < attachments.length - 1) {
        onIndexChange(index + 1);
      } else if (event.key === "ArrowLeft" && index > 0) {
        onIndexChange(index - 1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [index, attachments.length, onIndexChange, onClose]);

  if (!current) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <button
        type="button"
        aria-label="Close"
        className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
        onClick={onClose}
      >
        <X className="size-5" />
      </button>

      {attachments.length > 1 && index > 0 ? (
        <button
          type="button"
          aria-label="Previous image"
          className="absolute left-4 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
          onClick={(event) => {
            event.stopPropagation();
            onIndexChange(index - 1);
          }}
        >
          <ChevronLeft className="size-6" />
        </button>
      ) : null}

      <img
        src={current.url}
        alt="Spark attachment"
        className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain"
        onClick={(event) => event.stopPropagation()}
      />

      {attachments.length > 1 && index < attachments.length - 1 ? (
        <button
          type="button"
          aria-label="Next image"
          className="absolute right-4 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
          onClick={(event) => {
            event.stopPropagation();
            onIndexChange(index + 1);
          }}
        >
          <ChevronRight className="size-6" />
        </button>
      ) : null}

      {attachments.length > 1 ? (
        <span className="absolute bottom-5 rounded-full bg-white/10 px-3 py-1 text-xs text-white">
          {index + 1} / {attachments.length}
        </span>
      ) : null}
    </div>
  );
}
