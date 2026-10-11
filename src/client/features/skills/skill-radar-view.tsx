import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  CheckCircle2,
  Compass,
  FileText,
  RefreshCw,
  Sparkles,
  Trophy,
} from "lucide-react";

import { cn } from "cn";

import { Button } from "@/client/components/ui/button";
import { skillsQueryOptions, useSyncGrowthMutation } from "./api";
import { MilestoneCard } from "./components/milestone-card";
import { SkillRadarChart } from "./components/skill-radar-chart";

export interface SkillRadarViewProps {
  onNavigateToCv?: () => void;
}

export function SkillRadarView({ onNavigateToCv }: SkillRadarViewProps) {
  const { data, isLoading, error } = useQuery(skillsQueryOptions());
  const syncMutation = useSyncGrowthMutation();
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <RefreshCw className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-6 text-center text-sm text-destructive">
        Failed to load Skill Radar data. Please try again.
      </div>
    );
  }

  const { skills, radar } = data;
  const currentSkill =
    skills.find((s) => s.slug === (selectedSlug ?? skills[0]?.slug)) ??
    skills[0];

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Compass className="size-5 text-primary" />
            <h2 className="text-xl font-bold tracking-tight">
              Skill Radar & Mastery
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Objective self-appraisal backed by verified logs, technical notes,
            and CV credentials.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onNavigateToCv && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={onNavigateToCv}
            >
              <FileText className="size-3.5" />
              Sync from CV
            </Button>
          )}
          <Button
            variant="default"
            size="sm"
            className="gap-2 text-xs"
            disabled={syncMutation.isPending}
            onClick={() => syncMutation.mutate()}
          >
            <RefreshCw
              className={cn(
                "size-3.5",
                syncMutation.isPending && "animate-spin",
              )}
            />
            {syncMutation.isPending ? "Auditing Devlog..." : "Audit & Sync Radar"}
          </Button>
        </div>
      </div>

      {/* Onboarding callout if 0 milestones */}
      {radar.totalAchievedMilestones === 0 && onNavigateToCv && (
        <div className="flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Sparkles className="size-4 text-primary" />
              Bootstrap your radar baseline from your CV
            </div>
            <p className="text-xs text-muted-foreground">
              Upload your resume in the Resume &amp; CV tab to automatically map
              your past engineering accomplishments across the 25 milestones!
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 gap-1.5"
            onClick={onNavigateToCv}
          >
            <FileText className="size-3.5" />
            Open Resume &amp; CV
          </Button>
        </div>
      )}

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex items-center gap-4 rounded-xl border bg-card p-4 shadow-2xs">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Trophy className="size-5" />
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums">
              {radar.overallLevel.toFixed(1)}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                / 5.0
              </span>
            </p>
            <p className="text-xs text-muted-foreground font-medium">
              Overall Technical Depth
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-xl border bg-card p-4 shadow-2xs">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-5" />
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums">
              {radar.totalAchievedMilestones}
            </p>
            <p className="text-xs text-muted-foreground font-medium">
              Verified Milestones Unlocked
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-xl border bg-card p-4 shadow-2xs">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <BookOpen className="size-5" />
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums">
              {radar.totalEvidences}
            </p>
            <p className="text-xs text-muted-foreground font-medium">
              Evidence Logs & Notes Linked
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid: Radar on Left, Milestone Matrix on Right */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left Column: Radar Visualizer */}
        <div className="flex flex-col items-center justify-center rounded-2xl border bg-card/60 p-6 shadow-2xs lg:col-span-5">
          <div className="mb-2 text-center">
            <h3 className="text-sm font-semibold text-foreground">
              Mastery Radar
            </h3>
            <p className="text-xs text-muted-foreground">
              Click an axis to inspect milestones & proof
            </p>
          </div>

          <SkillRadarChart
            axes={radar.axes}
            size={340}
            activeSlug={currentSkill?.slug}
            onSelectAxis={(slug) => setSelectedSlug(slug)}
          />

          <div className="mt-4 flex flex-wrap justify-center gap-2 text-center text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="size-2 rounded-full bg-primary" />
              Evidence-Weighted Level
            </span>
            <span className="inline-flex items-center gap-1 font-mono text-[11px]">
              🤖 Zero-friction auto audit
            </span>
          </div>
        </div>

        {/* Right Column: Skill Pillars & Milestones */}
        <div className="space-y-6 lg:col-span-7">
          {/* Pillar Selector Tabs */}
          <div className="flex flex-wrap gap-2 border-b pb-3">
            {skills.map((s) => {
              const isSelected = s.slug === currentSkill?.slug;
              return (
                <button
                  key={s.slug}
                  type="button"
                  onClick={() => setSelectedSlug(s.slug)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                    isSelected
                      ? "bg-primary text-primary-foreground shadow-2xs"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <span>{s.name}</span>
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.2 text-[10px] font-mono",
                      isSelected
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-background text-muted-foreground",
                    )}
                  >
                    L{s.score.toFixed(1)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Current Skill Header */}
          {currentSkill && (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold">{currentSkill.name}</h3>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    {currentSkill.description}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xl font-bold tabular-nums text-primary">
                    L{currentSkill.score.toFixed(1)}
                  </span>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Mastery Score
                  </p>
                </div>
              </div>

              {/* Milestones Stepper / List */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Mastery Milestones (Levels 1 - 5)
                  </h4>
                  <span className="text-xs text-muted-foreground">
                    {
                      currentSkill.milestones.filter(
                        (m) => m.status === "achieved",
                      ).length
                    }{" "}
                    of 5 unlocked
                  </span>
                </div>

                <div className="space-y-3">
                  {currentSkill.milestones.map((milestone) => (
                    <MilestoneCard key={milestone.id} milestone={milestone} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

