import type { VisibilityState } from "@tanstack/react-table";
import { useCallback, useState } from "react";

const STORAGE_KEY = "pdevlog-admin-user-columns";

function readStoredVisibility(): VisibilityState {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as VisibilityState;
    }
  } catch {
    // ignore malformed values
  }
  return {};
}

export function usePersistentColumnVisibility(): {
  columnVisibility: VisibilityState;
  setColumnVisibility: (visibility: VisibilityState) => void;
} {
  const [columnVisibility, setState] = useState<VisibilityState>(
    readStoredVisibility,
  );

  const setColumnVisibility = useCallback((visibility: VisibilityState) => {
    setState(visibility);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(visibility));
    } catch {
      // ignore storage failures (private mode, quota)
    }
  }, []);

  return { columnVisibility, setColumnVisibility };
}
