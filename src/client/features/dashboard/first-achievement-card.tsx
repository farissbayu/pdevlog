import { Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/client/components/ui/button";
import { Textarea } from "@/client/components/ui/textarea";
import {
  useCreateBragLogMutation,
  useGenerateStarBreakdownMutation,
} from "@/client/features/brag-logs/api";

const MIN_LENGTH = 20;

/**
 * Zero-state for a brand new account: one rough note in, one saved achievement
 * out. Reuses the existing STAR endpoint and the normal create mutation, so a
 * successful generation is already a record — no separate onboarding flow.
 */
export function FirstAchievementCard() {
  const [content, setContent] = useState("");
  const generate = useGenerateStarBreakdownMutation();
  const create = useCreateBragLogMutation();

  const busy = generate.isPending || create.isPending;
  const canSubmit = content.trim().length >= MIN_LENGTH && !busy;

  const handleSubmit = () => {
    generate.mutate(
      { content: content.trim() },
      {
        onSuccess: (breakdown) => {
          create.mutate(
            {
              ...breakdown,
              occurred_at: new Date().toISOString().slice(0, 10),
            },
            {
              onSuccess: () => {
                setContent("");
                toast.success("First achievement saved");
              },
              onError: (error) => toast.error(error.message),
            },
          );
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  return (
    <section className="rounded-lg border bg-card p-5 sm:p-6">
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 font-medium">
          <Sparkles className="size-4 text-primary" />
          What did you ship today?
        </h2>
        <p className="text-sm text-muted-foreground">
          A rough note is enough — AI writes the STAR. One line now is one
          achievement you can still prove next year.
        </p>
      </div>

      <div className="mt-4 space-y-3">
        <Textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="e.g. Our order endpoint took 800ms under load. I added a composite index and batched the query; p95 dropped to 45ms."
          rows={3}
          className="resize-none"
          aria-label="Describe what you shipped"
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {content.trim().length < MIN_LENGTH
              ? "Add a bit more detail — roughly a sentence."
              : "Ready to generate."}
          </p>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {generate.isPending
              ? "Generating..."
              : create.isPending
                ? "Saving..."
                : "Generate & save"}
          </Button>
        </div>
      </div>
    </section>
  );
}
