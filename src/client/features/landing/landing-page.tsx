import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpen,
  Download,
  FolderKanban,
  GraduationCap,
  LayoutDashboard,
  Sparkles,
  Tags,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router";

import { GoogleIcon } from "@/client/components/google-icon";
import { ThemeToggle } from "@/client/components/theme-toggle";
import { Button } from "@/client/components/ui/button";
import { meQueryOptions } from "@/client/features/auth/api";

type Feature = {
  icon: LucideIcon;
  title: string;
  description: string;
  accent: string;
};

const features: Feature[] = [
  {
    icon: FolderKanban,
    title: "Workspaces",
    description:
      "Split your work and learning contexts so every entry has an obvious home.",
    accent: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  {
    icon: Trophy,
    title: "Brag logs",
    description:
      "Capture wins in STAR format, or paste rough notes and let AI draft the breakdown.",
    accent: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  {
    icon: GraduationCap,
    title: "Notes",
    description:
      "Write in Markdown with live preview, syntax highlighting and a table of contents.",
    accent: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  {
    icon: Tags,
    title: "Tags",
    description:
      "Cross-cut everything with tags so the right lesson resurfaces when you need it.",
    accent: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
  {
    icon: LayoutDashboard,
    title: "Dashboard",
    description:
      "See totals and recent activity at a glance, then jump straight back in.",
    accent: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  },
  {
    icon: Download,
    title: "Yours to keep",
    description:
      "Export your logs and notes anytime. No lock-in, no surprises.",
    accent: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  },
];

const steps: { icon: LucideIcon; title: string; description: string }[] = [
  {
    icon: BookOpen,
    title: "Capture",
    description:
      "Dump the raw details while they are fresh — a win, a bug, something you learned.",
  },
  {
    icon: Tags,
    title: "Organize",
    description:
      "File it under a workspace and tag it, so it stays findable months later.",
  },
  {
    icon: Sparkles,
    title: "Reflect",
    description:
      "Turn notes into STAR stories for reviews, interviews and your own growth.",
  },
];

function HeroPreview() {
  return (
    <div className="relative isolate">
      <div
        aria-hidden="true"
        className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-tr from-primary/15 via-transparent to-primary/5 blur-2xl"
      />
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex items-center gap-1.5 border-b px-4 py-3">
          <span className="size-2.5 rounded-full bg-destructive/60" />
          <span className="size-2.5 rounded-full bg-amber-500/60" />
          <span className="size-2.5 rounded-full bg-emerald-500/60" />
          <span className="ml-3 font-mono text-xs text-muted-foreground">
            pdevlog
          </span>
        </div>
        <div className="space-y-4 p-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Workspaces", value: "4" },
              { label: "Brag Logs", value: "28" },
              { label: "Notes", value: "63" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-lg border bg-background p-3">
                <p className="text-lg font-semibold tabular-nums">
                  {stat.value}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
          <div className="overflow-hidden rounded-lg border bg-background">
            {[
              {
                title: "Shipped the billing migration",
                kind: "Brag Log",
                tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                icon: Trophy,
              },
              {
                title: "Notes on Postgres indexing",
                kind: "Note",
                tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                icon: GraduationCap,
              },
              {
                title: "Cut API p95 latency by 40%",
                kind: "Brag Log",
                tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                icon: Trophy,
              },
            ].map((item) => (
              <div
                key={item.title}
                className="flex items-center gap-3 border-b px-3 py-2.5 last:border-b-0"
              >
                <span
                  className={`flex size-7 shrink-0 items-center justify-center rounded-full ${item.tone}`}
                >
                  <item.icon className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{item.title}</p>
                  <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                    {item.kind}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function LandingPage() {
  const { data } = useQuery(meQueryOptions);
  const isAuthenticated = Boolean(data);

  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <img
              src="/pdevlog-icon.png"
              alt="Personal Dev Log"
              className="size-7 shrink-0 rounded-md"
            />
            <span className="font-mono font-semibold tracking-tight">
              Personal Dev Log
            </span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">
              Features
            </a>
            <a href="#workflow" className="transition-colors hover:text-foreground">
              Workflow
            </a>
          </nav>

          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            {isAuthenticated ? (
              <Button asChild size="sm">
                <Link to="/dashboard">
                  Dashboard
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            ) : (
              <Button asChild size="sm">
                <Link to="/login">Sign in</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-primary/5 px-3 py-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="size-3.5 text-primary" />
              Track your wins, remember your lessons
            </span>
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Your personal dev log.
            </h1>
            <p className="max-w-prose text-lg text-muted-foreground">
              A private home for brag-worthy wins and the lessons behind them.
              Capture what you shipped, organize it once, and turn it into a
              story when it matters.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              {isAuthenticated ? (
                <Button asChild size="lg">
                  <Link to="/dashboard">
                    Open your dashboard
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              ) : (
                <Button asChild size="lg">
                  <a href="/api/auth/google">
                    <GoogleIcon />
                    Continue with Google
                  </a>
                </Button>
              )}
              <Button asChild size="lg" variant="outline">
                <a href="#features">See features</a>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Sign in with Google. Your log stays private to you.
            </p>
          </div>

          <HeroPreview />
        </section>

        <section
          id="features"
          className="scroll-mt-20 border-t bg-muted/30 py-20"
        >
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl space-y-3 text-center">
              <h2 className="text-3xl font-semibold tracking-tight">
                Everything you need to keep a dev log
              </h2>
              <p className="text-muted-foreground">
                Purpose-built for developers who want to remember the work, not
                just do it.
              </p>
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-xl border bg-card p-5 transition-all duration-200 hover:border-primary/40 hover:shadow-md"
                >
                  <div
                    className={`flex size-10 items-center justify-center rounded-lg ${feature.accent}`}
                  >
                    <feature.icon className="size-5" />
                  </div>
                  <h3 className="mt-4 font-medium">{feature.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="workflow" className="scroll-mt-20 py-20">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl space-y-3 text-center">
              <h2 className="text-3xl font-semibold tracking-tight">
                From scattered notes to a clear story
              </h2>
              <p className="text-muted-foreground">
                Three habits, one place to keep them.
              </p>
            </div>

            <ol className="mt-12 grid gap-4 md:grid-cols-3">
              {steps.map((step, index) => (
                <li
                  key={step.title}
                  className="relative rounded-xl border bg-card p-6"
                >
                  <span className="font-mono text-sm text-muted-foreground">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="mt-4 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <step.icon className="size-5" />
                  </div>
                  <h3 className="mt-4 font-medium">{step.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    {step.description}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-t bg-muted/30 py-20">
          <div className="mx-auto w-full max-w-3xl px-4 text-center sm:px-6">
            <h2 className="text-3xl font-semibold tracking-tight text-balance">
              Start your dev log today
            </h2>
            <p className="mx-auto mt-3 max-w-prose text-muted-foreground">
              Your next performance review, interview or retro will thank you
              for the notes you take now.
            </p>
            <div className="mt-8 flex justify-center">
              {isAuthenticated ? (
                <Button asChild size="lg">
                  <Link to="/dashboard">
                    Open your dashboard
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              ) : (
                <Button asChild size="lg">
                  <a href="/api/auth/google">
                    <GoogleIcon />
                    Continue with Google
                  </a>
                </Button>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <img
              src="/pdevlog-icon.png"
              alt=""
              className="size-5 rounded"
              aria-hidden="true"
            />
            <span className="font-mono">Personal Dev Log</span>
          </div>
          <p>Built for developers who keep track.</p>
        </div>
      </footer>
    </div>
  );
}
