import { Sparkles } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { SparkResponse } from "@/shared/schemas/spark";

import { SparkDialog } from "./spark-dialog";

type SparksContextValue = {
  openCapture: (initialContent?: string) => void;
  openSpark: (spark: SparkResponse) => void;
};

const SparksContext = createContext<SparksContextValue | null>(null);

export function useSparks(): SparksContextValue {
  const context = useContext(SparksContext);
  if (!context) {
    throw new Error("useSparks must be used within a SparksProvider");
  }
  return context;
}

export function SparksProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [spark, setSpark] = useState<SparkResponse | null>(null);
  const [initialContent, setInitialContent] = useState("");

  const openCapture = useCallback((content?: string) => {
    setSpark(null);
    setInitialContent(content ?? "");
    setOpen(true);
  }, []);

  const openSpark = useCallback((value: SparkResponse) => {
    setSpark(value);
    setInitialContent("");
    setOpen(true);
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();
        setSpark(null);
        setInitialContent("");
        setOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const value = useMemo(
    () => ({ openCapture, openSpark }),
    [openCapture, openSpark],
  );

  return (
    <SparksContext.Provider value={value}>
      {children}

      <button
        type="button"
        aria-label="Capture a spark"
        title="Capture a spark (⌘/Ctrl+K)"
        onClick={() => openCapture()}
        className="fixed right-6 bottom-6 z-40 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <Sparkles className="size-4" />
        <span className="hidden sm:inline">Spark</span>
      </button>

      <SparkDialog
        open={open}
        onOpenChange={setOpen}
        spark={spark}
        initialContent={initialContent}
      />
    </SparksContext.Provider>
  );
}
