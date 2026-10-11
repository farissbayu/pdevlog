import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  FileText,
  Lightbulb,
  Loader2,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
} from "lucide-react";

import { Button } from "@/client/components/ui/button";
import type { SkillInsights } from "@/shared/schemas/profile";

export interface SkillInsightsViewProps {
  insights: SkillInsights | null;
  analyzedAt: string | null;
  onAnalyze: () => void;
  isAnalyzing: boolean;
  onNavigateToCv: () => void;
  hasCvContent: boolean;
}

export function SkillInsightsView({
  insights,
  analyzedAt,
  onAnalyze,
  isAnalyzing,
  onNavigateToCv,
  hasCvContent,
}: SkillInsightsViewProps) {
  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            <h2 className="text-xl font-bold tracking-tight">
              Engineering Competency Insights
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Dynamic AI evaluation of where you excel and high-impact areas for
            career growth based on your CV and devlogs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {hasCvContent ? (
            <Button
              variant="default"
              size="sm"
              className="gap-2 text-xs"
              disabled={isAnalyzing}
              onClick={onAnalyze}
            >
              {isAnalyzing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              {isAnalyzing
                ? "Analyzing Profile..."
                : insights
                  ? "Re-analyze with AI"
                  : "Analyze Skills & Growth"}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={onNavigateToCv}
            >
              <FileText className="size-3.5" />
              Upload CV First
            </Button>
          )}
        </div>
      </div>

      {/* Live Processing Indicator */}
      {isAnalyzing && (
        <div className="flex items-center gap-2.5 rounded-xl border border-primary/30 bg-primary/5 p-4 text-xs text-muted-foreground animate-pulse">
          <Loader2 className="size-4 animate-spin text-primary shrink-0" />
          <span>
            Evaluating CV experience and devlog notes to synthesize your
            superpowers, identify blind spots, and formulate next steps...
          </span>
        </div>
      )}

      {insights ? (
        <div className="space-y-6">
          {/* Archetype & Summary Card */}
          <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card p-6 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 font-mono text-xs font-semibold text-primary">
                <Sparkles className="size-3.5" />
                {insights.archetype}
              </span>
              {analyzedAt && (
                <span className="text-[11px] text-muted-foreground font-mono">
                  Analyzed on {new Date(analyzedAt).toLocaleDateString()}
                </span>
              )}
            </div>

            <p className="mt-3 text-sm leading-relaxed text-foreground">
              {insights.summary}
            </p>
          </div>

          {/* Two Columns: Strengths vs Growth Areas */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Strengths Column (Unggul di mana) */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Core Superpowers ({insights.strengths.length})
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Proven technical proficiencies backed by concrete evidence
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {insights.strengths.map((s, idx) => (
                  <div
                    key={`${s.area}-${idx}`}
                    className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-2 transition-all hover:border-emerald-500/40"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-foreground">
                        {s.area}
                      </h4>
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                        Strength
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {s.description}
                    </p>

                    {s.evidenceSummary && (
                      <div className="rounded-lg bg-background/80 border border-emerald-500/20 p-2.5 text-[11px] text-emerald-700 dark:text-emerald-300 flex items-start gap-2">
                        <Trophy className="size-3.5 shrink-0 mt-0.5 text-emerald-500" />
                        <span className="leading-relaxed">
                          <strong>Evidence:</strong> {s.evidenceSummary}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Growth Areas Column (Aspek yang kurang) */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <TrendingUp className="size-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Growth Opportunities ({insights.growthAreas.length})
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Identified blind spots and actionable ways to bridge them
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {insights.growthAreas.map((g, idx) => (
                  <div
                    key={`${g.area}-${idx}`}
                    className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-2.5 transition-all hover:border-amber-500/40"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-foreground">
                        {g.area}
                      </h4>
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                        Growth Area
                      </span>
                    </div>

                    <div className="flex items-start gap-2 text-xs text-amber-800 dark:text-amber-200">
                      <AlertCircle className="size-3.5 shrink-0 mt-0.5 text-amber-500" />
                      <p className="leading-relaxed">
                        <strong>Gap:</strong> {g.gap}
                      </p>
                    </div>

                    <div className="rounded-lg bg-background/80 border border-amber-500/20 p-2.5 text-[11px] text-muted-foreground flex items-start gap-2">
                      <Lightbulb className="size-3.5 shrink-0 mt-0.5 text-amber-500" />
                      <p className="leading-relaxed">
                        <strong className="text-foreground">Next Step:</strong>{" "}
                        {g.recommendation}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recommended Next Steps Card */}
          {insights.recommendedNextSteps.length > 0 && (
            <div className="rounded-xl border bg-card p-5 space-y-3 shadow-2xs">
              <div className="flex items-center gap-2 border-b pb-2.5">
                <Target className="size-4 text-primary" />
                <h4 className="text-sm font-semibold text-foreground">
                  Strategic Next Steps to Log in pdevlog
                </h4>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {insights.recommendedNextSteps.map((step, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2.5 rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground"
                  >
                    <ArrowRight className="size-3.5 shrink-0 mt-0.5 text-primary" />
                    <span className="leading-relaxed text-foreground/90">
                      {step}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Empty State */
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed p-10 text-center space-y-4">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles className="size-7" />
          </div>

          <div className="max-w-md space-y-1.5">
            <h3 className="text-base font-semibold text-foreground">
              Discover Where You Excel and Where to Grow
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Our AI evaluates your CV and developer logs to highlight your
              technical superpowers, pinpoint missing areas, and formulate
              concrete next milestones.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {hasCvContent ? (
              <Button
                onClick={onAnalyze}
                disabled={isAnalyzing}
                className="gap-2"
              >
                {isAnalyzing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                Analyze My Competencies
              </Button>
            ) : (
              <Button onClick={onNavigateToCv} className="gap-2">
                <FileText className="size-4" />
                Upload CV in Resume &amp; CV Tab
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

