import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Ban,
  Brain,
  Check,
  Compass,
  FolderKanban,
  Rocket,
  Scissors,
  Sparkles,
  Trophy,
  Zap,
} from "lucide-react";
import { Link } from "react-router";

import { GoogleIcon } from "@/client/components/google-icon";
import { Reveal } from "@/client/components/reveal";
import { ThemeToggle } from "@/client/components/theme-toggle";
import { Button } from "@/client/components/ui/button";
import { meQueryOptions } from "@/client/features/auth/api";

const trustPoints = [
  "Your data stays private to you",
  "No monthly fees",
  "Export Markdown anytime",
];

const problems: { title: string; description: string }[] = [
  {
    title: "Your Work Just Cycles Through the Same CRUD Forms",
    description:
      "Management only cares that features ship fast. Nobody cares whether your code is resilient, has unit tests, or is free of race conditions. Without noticing, you spend years never touching caching layers, background queues, or performance telemetry.",
  },
  {
    title: "When It's Time to Update Your CV, You Forget What You Built",
    description:
      'A year of fighting fires, but when an interviewer asks "What is the biggest technical and business impact you have ever made?", you blank. Your work log is buried in messy git commits or vanished Slack chats.',
  },
  {
    title: "You Want to Learn New Tech, But Lose Hours to Videos",
    description:
      "On the weekend you want to learn WebSockets, Go, or AI, but you end up watching a 30-hour course or fighting button CSS and user auth. By Monday, you give up before a single line of real fundamentals ever runs.",
  },
  {
    title: "No Tech Lead Is Correcting Your Career Direction",
    description:
      "Without a mentor or Staff Engineer, you do not know your real strengths or the technical blindspots holding you back from Senior. You only find out when you bomb the technical interview at your dream company.",
  },
];

const comparison: { dimension: string; before: string; after: string }[] = [
  {
    dimension: "Recording Wins",
    before: "Relying only on memory and messy git commits.",
    after:
      "Captured in STAR format (Situation, Task, Action, Result) with AI help in just 2 minutes.",
  },
  {
    dimension: "Exploring New Tech",
    before:
      "Watching dozens of hours of course videos, then abandoning it to scope creep.",
    after:
      "Skill Shredder: one toy project, a 15-min Spike 0, and a strict Ignore List. Done in one session.",
  },
  {
    dimension: "Ideas & Inspiration",
    before: "Jotted somewhere random, then evaporating and lost.",
    after:
      "Sparks (Cmd+K): capture instantly, attach a screenshot, and promote to your backlog when ready.",
  },
  {
    dimension: "Competency Evaluation",
    before:
      "Waiting on a manager's review that often does not understand the tech.",
    after:
      "AI Staff Engineer Mirror: dynamically evaluate your CV + devlog to see Superpowers and Gaps.",
  },
  {
    dimension: "Data Sovereignty",
    before: "Scattered across office Notion, Jira, or company-owned tools.",
    after: "100% Yours: runs on your own Edge, export Markdown & PDF anytime.",
  },
];

const shredderSteps = [
  "Fundamental Pillars: boil the topic down to 2–3 core concepts, no fluff.",
  "Spike 0 (15 minutes): scratch code to prove the syntax or connection runs in the terminal.",
  "The Ignore List: the things you are FORBIDDEN to think about today.",
  "Practice Challenge: test your understanding with no AI help.",
  "Export straight into a Today I Learned (TIL) note.",
];

const competencyPoints = [
  "Engineering Archetype: your professional position (e.g. Product-Centric Fullstack Craftsman).",
  "Core Superpowers: your main technical strengths, backed by real evidence.",
  "Growth Opportunities: an honest read on your gaps, plus concrete Next Steps to close them.",
  "Dashboard Snapshot: a daily reminder of what you are improving this month.",
];

const sparksPoints = [
  "Press Cmd+K from any screen to drop an idea, link, or bug screenshot.",
  "Promote a spark into a Project Item (feat, fix, perf, refactor, spike, docs).",
  "When a feature ships, generate a CHANGELOG.md Markdown file automatically.",
];

const routine: { meta: string; title: string; description: string }[] = [
  {
    meta: "While Coding · 10 seconds",
    title: "Capture ideas without breaking flow",
    description:
      "Press Cmd+K to grab a wild idea or paste a bug screenshot, then get straight back to coding.",
  },
  {
    meta: "End of Workday · 3-5 minutes",
    title: "Draft one brag log",
    description:
      'Open Brag Logs, hit "Draft with AI", type 2 sentences about today\'s win, then move the project item to "Shipped".',
  },
  {
    meta: "Weekend · 20 minutes",
    title: "Clear the inbox & shred one skill",
    description:
      "Promote or archive your Sparks, then run one Skill Shredder session to learn something new.",
  },
  {
    meta: "End of Month · 30 minutes",
    title: "Re-analyze & set targets",
    description:
      'Open Profile, run "Re-analyze with AI", and review Growth Blindspots to set next month\'s target.',
  },
];

const sovereignty: { title: string; description: string }[] = [
  {
    title: "100% Edge Privacy",
    description: "Built on Cloudflare Workers and your own D1 SQLite.",
  },
  {
    title: "Zero Lock-in",
    description:
      "Download all your Brag Logs and Notes as pure .md files, or print them to PDF anytime.",
  },
  {
    title: "NDA-Safe",
    description:
      "You never log sensitive client data; just capture architecture patterns, technical decisions, and metric impact.",
  },
];

const faqs: { q: string; a: string }[] = [
  {
    q: "Do I have to write a long journal every day?",
    a: "No. pdevlog is low-friction by design. You just write 1–2 rough sentences as-is, and let AI break them into industry-standard STAR. It takes about 2 minutes a day on average.",
  },
  {
    q: "How is this different from Notion, Obsidian, or Apple Notes?",
    a: "Notion and Obsidian are blank canvases with no opinions and no constraints, and they often become a graveyard of passive note hoarding. pdevlog is an opinionated, structured system: it breaks ideas into STAR, forces learning through Spike 0 and the Ignore List, generates release changelogs, and evaluates your technical gaps via the AI Staff Engineer Mirror.",
  },
  {
    q: "My office uses no sprint system or formal performance metrics. Is this still useful?",
    a: "This app was built specifically for you. Because your office lacks those systems, you risk losing your own professional track record. pdevlog brings an international engineering standard straight to your desk, no matter how your office is run.",
  },
  {
    q: "Is my data safe?",
    a: "Very. Your account uses Google OAuth with cryptographically signed JWT sessions. The D1 database is strictly isolated per user with cascade deletion. You have full rights to export or delete your entire account at any time.",
  },
];

function Typewriter({ text, delay = 0 }: { text: string; delay?: number }) {
  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const [count, setCount] = useState(() => (reduceMotion ? text.length : 0));

  useEffect(() => {
    if (reduceMotion) return;
    let index = 0;
    let timer: number | undefined;
    const start = window.setTimeout(() => {
      timer = window.setInterval(() => {
        index += 1;
        setCount(index);
        if (index >= text.length) window.clearInterval(timer);
      }, 28);
    }, delay);
    return () => {
      window.clearTimeout(start);
      if (timer) window.clearInterval(timer);
    };
  }, [text, delay, reduceMotion]);

  const done = count >= text.length;

  return (
    <span>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">{text.slice(0, count)}</span>
      {done ? null : (
        <span aria-hidden="true" className="motion-safe:animate-pulse">
          ▍
        </span>
      )}
    </span>
  );
}

function HeroPreview() {
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm motion-safe:animate-scale-in">
      <div className="flex items-center gap-1.5 border-b px-4 py-3">
        <span className="size-2.5 rounded-full bg-destructive/60" />
        <span className="size-2.5 rounded-full bg-amber-500/60" />
        <span className="size-2.5 rounded-full bg-emerald-500/60" />
        <span className="ml-3 font-mono text-xs text-muted-foreground">
          pdevlog
        </span>
      </div>
      <div className="space-y-4 p-4">
        <div className="rounded-lg border bg-background p-3">
          <div className="flex items-center gap-2">
            <Compass className="size-4 text-primary" />
            <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              Competency Snapshot
            </p>
          </div>
          <p className="mt-1.5 text-sm font-semibold">
            Product-Centric Fullstack Craftsman
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {["API Design", "Query Optimization", "DX"].map((skill) => (
              <span
                key={skill}
                className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                {skill}
              </span>
            ))}
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
              Gap: caching layer
            </span>
          </div>
        </div>
        <div className="overflow-hidden rounded-lg border bg-background">
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Trophy className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              Brag Log · STAR
            </p>
          </div>
          <div className="space-y-1.5 px-3 py-2.5 text-xs">
            <p>
              <span className="font-semibold text-muted-foreground">
                Result:{" "}
              </span>
              <Typewriter
                text="p95 latency −94% (800ms → 45ms), with no added server cost."
                delay={600}
              />
            </p>
            <p className="text-muted-foreground">
              Action: query profiling, composite indexing, batch fetcher.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function BragPreview() {
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="border-b bg-muted/40 px-4 py-3">
        <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
          Raw draft
        </p>
        <p className="mt-1 text-sm">
          "Our order DB went slow when traffic spiked. I added a join index and
          changed the query to batch. Response time dropped from 800ms to 45ms."
        </p>
      </div>
      <div className="space-y-2.5 p-4">
        {[
          [
            "Situation",
            "Transaction latency spike from a database query bottleneck.",
          ],
          [
            "Task",
            "Eliminate performance degradation on the critical endpoint.",
          ],
          [
            "Action",
            "Profiled queries, implemented composite indexing, refactored to a batch fetcher.",
          ],
          [
            "Result",
            "p95 latency down 94% (800ms → 45ms) with no added server cost.",
          ],
        ].map(([label, value]) => (
          <div key={label} className="flex gap-3">
            <span className="w-16 shrink-0 font-mono text-[10px] uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
              {label}
            </span>
            <p className="text-sm text-muted-foreground">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ShredderPreview() {
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-medium">
          <Scissors className="size-4 text-indigo-600 dark:text-indigo-400" />
          WebSockets
        </span>
        <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">
          Building
        </span>
      </div>
      <div className="space-y-3 p-4">
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
          <p className="text-[10px] font-semibold tracking-wide text-primary uppercase">
            The "Todo App" for WebSockets
          </p>
          <p className="mt-0.5 text-sm font-medium">
            2-client terminal walkie-talkie
          </p>
        </div>
        <div className="rounded-md border bg-muted/40 p-2.5">
          <p className="font-mono text-[11px] text-muted-foreground">
            {"// Spike 0 · 15 min"}
          </p>
          <p className="font-mono text-[11px]">
            new WebSocket("wss://echo.workers.dev")
          </p>
        </div>
        <ul className="space-y-1.5">
          {[
            { label: "Scaffold an echo server", done: true },
            { label: "Broadcast to all clients", done: true },
            { label: "Handle disconnect", done: false },
          ].map((milestone) => (
            <li
              key={milestone.label}
              className="flex items-center gap-2 text-sm">
              <span
                className={
                  milestone.done
                    ? "flex size-4 items-center justify-center rounded border border-primary bg-primary text-primary-foreground"
                    : "flex size-4 items-center justify-center rounded border border-input"
                }>
                {milestone.done ? <Check className="size-3" /> : null}
              </span>
              <span
                className={
                  milestone.done
                    ? "text-muted-foreground line-through"
                    : undefined
                }>
                {milestone.label}
              </span>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/5 p-2.5">
          <Ban className="size-3.5 text-amber-600 dark:text-amber-400" />
          {["No auth", "No styling", "No database"].map((item) => (
            <span
              key={item}
              className="rounded-full bg-background px-2 py-0.5 text-[11px] text-muted-foreground">
              {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function IndexedList({
  items,
  className,
}: {
  items: { title: string; description: string; meta?: string }[];
  className?: string;
}) {
  return (
    <div className={`grid gap-x-10 gap-y-6 sm:grid-cols-2 ${className ?? ""}`}>
      {items.map((item, index) => (
        <Reveal key={item.title} delay={index * 60}>
          <div className="flex gap-4 border-t pt-4">
            <span className="pt-0.5 font-mono text-xs text-muted-foreground">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div>
              {item.meta ? (
                <p className="font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
                  {item.meta}
                </p>
              ) : null}
              <h3 className="font-medium text-balance">{item.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {item.description}
              </p>
            </div>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  subtitle,
  center = true,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  center?: boolean;
}) {
  return (
    <div
      className={`mx-auto max-w-2xl space-y-3 ${center ? "text-center" : ""}`}>
      <Reveal>
        <span className="font-mono text-xs font-medium tracking-wide text-primary uppercase">
          {eyebrow}
        </span>
      </Reveal>
      <Reveal delay={80}>
        <h2 className="text-3xl font-semibold tracking-tight text-balance">
          {title}
        </h2>
      </Reveal>
      {subtitle ? (
        <Reveal delay={160}>
          <p className="text-muted-foreground">{subtitle}</p>
        </Reveal>
      ) : null}
    </div>
  );
}

export function LandingPage() {
  const { data } = useQuery(meQueryOptions);
  const isAuthenticated = Boolean(data);

  const primaryCta = isAuthenticated ? (
    <Button asChild size="lg" className="group">
      <Link to="/dashboard">
        Open dashboard
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </Button>
  ) : (
    <Button asChild size="lg">
      <a href="/api/auth/google">
        <GoogleIcon />
        Sign in with Google — 100% Free &amp; Private
      </a>
    </Button>
  );

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
            <a
              href="#problem"
              className="transition-colors hover:text-foreground">
              The Problem
            </a>
            <a
              href="#solution"
              className="transition-colors hover:text-foreground">
              The Solution
            </a>
            <a
              href="#routine"
              className="transition-colors hover:text-foreground">
              5-Min Routine
            </a>
            <a href="#faq" className="transition-colors hover:text-foreground">
              FAQ
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
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-primary/5 px-3 py-1 text-xs font-medium text-muted-foreground motion-safe:animate-fade-up">
              <Scissors className="size-3.5 text-primary motion-safe:animate-pulse" />
              For Solo Developers &amp; Engineers Outside the Unicorn Startup
              Bubble
            </span>
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl motion-safe:animate-fade-up [animation-delay:80ms]">
              Stop Repeating 1 Year of Experience 5 Times Over.
            </h1>
            <p className="max-w-prose text-lg text-muted-foreground motion-safe:animate-fade-up [animation-delay:160ms]">
              Most developers work without a Tech Lead, without 1-on-1s, and
              without architectural feedback.{" "}
              <strong className="font-semibold text-foreground">pdevlog</strong>{" "}
              is your personal Autonomous Tech Lead and Career Vault — turn
              daily work into real proof of impact (STAR), break into new tech
              in 60 minutes, and get an objective competency mirror without
              waiting on an office review.
            </p>
            <div className="flex flex-wrap items-center gap-3 motion-safe:animate-fade-up [animation-delay:240ms]">
              {primaryCta}
              <Button asChild size="lg" variant="outline">
                <a href="#solution">See How It Works ↓</a>
              </Button>
            </div>
            <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground motion-safe:animate-fade-up [animation-delay:320ms]">
              {trustPoints.map((point) => (
                <li key={point} className="flex items-center gap-1.5">
                  <Check className="size-3.5 text-primary" />
                  {point}
                </li>
              ))}
            </ul>
          </div>

          <HeroPreview />
        </section>

        <section
          id="problem"
          className="scroll-mt-20 border-t bg-muted/30 py-20">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <SectionHeading
              eyebrow="A reality rarely talked about"
              title='Stuck in an Office Where "As Long As It Runs" Is the Standard? Here Is the Real Cost:'
              subtitle="Working at a local software house, agency, or SMB, or going it alone as an indie hacker, often makes you feel productive while your technical depth stands still."
            />

            <IndexedList items={problems} className="mt-12" />
          </div>
        </section>

        <section id="shift" className="scroll-mt-20 py-20">
          <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
            <SectionHeading
              eyebrow="A new paradigm"
              title="Stop Relying on Office Luck. Hold Your Own Technical Bar."
            />

            <Reveal delay={120}>
              <div className="mt-12 overflow-x-auto rounded-xl border">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-muted/50 text-left">
                      <th className="px-4 py-3 font-medium">Dimension</th>
                      <th className="px-4 py-3 font-medium text-muted-foreground">
                        The Old Way (Passive &amp; Drifting)
                      </th>
                      <th className="px-4 py-3 font-medium text-primary">
                        With pdevlog (Intentional &amp; Measured)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.map((row) => (
                      <tr key={row.dimension} className="border-t align-top">
                        <td className="px-4 py-3 font-medium whitespace-nowrap">
                          {row.dimension}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {row.before}
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex gap-2">
                            <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                            {row.after}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Reveal>
          </div>
        </section>

        <section
          id="solution"
          className="scroll-mt-20 border-t bg-muted/30 py-20">
          <div className="mx-auto w-full max-w-6xl space-y-20 px-4 sm:px-6">
            <SectionHeading
              eyebrow="Transformative solutions"
              title="How pdevlog Solves Each Problem Above"
            />

            <div className="grid items-center gap-12 lg:grid-cols-2">
              <div className="space-y-6">
                <Reveal>
                  <span className="inline-flex items-center gap-1.5 rounded-full border bg-emerald-500/5 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    <Trophy className="size-3.5" />
                    Brag Logs + AI STAR
                  </span>
                </Reveal>
                <Reveal delay={60}>
                  <h3 className="text-2xl font-semibold tracking-tight text-balance">
                    From a Rough Technical Rant to a High-Value Impact
                    Portfolio.
                  </h3>
                </Reveal>
                <Reveal delay={120}>
                  <p className="text-muted-foreground">
                    Type it exactly as you would say it. AI formats it into a
                    professional STAR structure ready for a raise, appraisal, or
                    resume.
                  </p>
                </Reveal>
              </div>
              <Reveal delay={120}>
                <BragPreview />
              </Reveal>
            </div>

            <div className="grid items-center gap-12 lg:grid-cols-2">
              <Reveal delay={120} className="lg:order-2">
                <div className="space-y-6">
                  <span className="inline-flex items-center gap-1.5 rounded-full border bg-indigo-500/5 px-3 py-1 text-xs font-medium text-indigo-600 dark:text-indigo-400">
                    <Scissors className="size-3.5" />
                    Anti-Tutorial Hell Engine
                  </span>
                  <h3 className="text-2xl font-semibold tracking-tight text-balance">
                    Break Through New-Tech Fear in 60 Minutes. Build a Real Toy
                    Project.
                  </h3>
                  <p className="text-muted-foreground">
                    Skill Shredder thinks like a Staff Engineer:
                  </p>
                  <ol className="space-y-2">
                    {shredderSteps.map((step, index) => (
                      <li key={step} className="flex gap-3 text-sm">
                        <span className="font-mono text-xs text-muted-foreground">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="text-muted-foreground">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </Reveal>
              <Reveal delay={120} className="lg:order-1">
                <ShredderPreview />
              </Reveal>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Reveal>
                <div className="h-full rounded-xl border bg-card p-6">
                  <span className="inline-flex items-center gap-1.5 rounded-full border bg-violet-500/5 px-3 py-1 text-xs font-medium text-violet-600 dark:text-violet-400">
                    <Brain className="size-3.5" />
                    Engineering Competency Insights
                  </span>
                  <h3 className="mt-4 text-xl font-semibold tracking-tight text-balance">
                    An Objective Mirror Without RPG Points or Rigid Numbers.
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    AI dissects your CV together with your real devlog track
                    record (brag logs and notes) to produce:
                  </p>
                  <ul className="mt-4 space-y-2">
                    {competencyPoints.map((point) => (
                      <li key={point} className="flex gap-2 text-sm">
                        <Compass className="mt-0.5 size-4 shrink-0 text-violet-600 dark:text-violet-400" />
                        <span className="text-muted-foreground">{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>

              <Reveal delay={80}>
                <div className="h-full rounded-xl border bg-card p-6">
                  <span className="inline-flex items-center gap-1.5 rounded-full border bg-yellow-500/5 px-3 py-1 text-xs font-medium text-yellow-600 dark:text-yellow-400">
                    <Rocket className="size-3.5" />
                    Sparks &amp; Workspace Delivery Machine
                  </span>
                  <h3 className="mt-4 text-xl font-semibold tracking-tight text-balance">
                    Capture an Idea in 5 Seconds. Ship a Professional Changelog
                    in 1 Click.
                  </h3>
                  <ul className="mt-4 space-y-2">
                    {sparksPoints.map((point) => (
                      <li key={point} className="flex gap-2 text-sm">
                        <Zap className="mt-0.5 size-4 shrink-0 text-yellow-600 dark:text-yellow-400" />
                        <span className="text-muted-foreground">{point}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-5 flex items-center gap-3 rounded-lg border bg-muted/40 px-3 py-2.5">
                    <FolderKanban className="size-4 text-muted-foreground" />
                    <span className="font-mono text-xs text-muted-foreground">
                      CHANGELOG.md
                    </span>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                      generated
                    </span>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        <section id="routine" className="scroll-mt-20 py-20">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <SectionHeading
              eyebrow="Low-friction habit"
              title="Not a Burdensome Diary. A 5-Minute System That Flows With Your Code."
            />

            <IndexedList items={routine} className="mt-12" />
          </div>
        </section>

        <section className="border-t bg-muted/30 py-20">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <SectionHeading
              eyebrow="Your data, not the company's"
              title="Keep Your Career History Where No HR or Office Can Delete It."
            />

            <IndexedList items={sovereignty} className="mt-12" />
          </div>
        </section>

        <section id="faq" className="scroll-mt-20 border-t py-20">
          <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
            <SectionHeading
              eyebrow="FAQ"
              title="Answering the Most Common Doubts"
            />

            <div className="mt-12 space-y-3">
              {faqs.map((faq, index) => (
                <Reveal key={faq.q} delay={index * 60}>
                  <details className="group rounded-xl border bg-card px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                      {faq.q}
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full border text-muted-foreground transition-transform group-open:rotate-45">
                        +
                      </span>
                    </summary>
                    <p className="mt-3 text-sm text-muted-foreground">
                      {faq.a}
                    </p>
                  </details>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t bg-muted/30 py-20">
          <div className="mx-auto w-full max-w-3xl px-4 text-center sm:px-6">
            <Reveal>
              <Sparkles className="mx-auto size-6 text-primary" />
            </Reveal>
            <Reveal delay={80}>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-balance">
                Control of Your Career Is Too Valuable to Leave to Office Luck.
              </h2>
            </Reveal>
            <Reveal delay={160}>
              <p className="mx-auto mt-3 max-w-prose text-muted-foreground">
                Start building an irrefutable professional track record today.
                From the first spark and the first line of code, to the
                evaluation of your career blindspots.
              </p>
            </Reveal>
            <Reveal delay={240}>
              <div className="mt-8 flex justify-center">
                {isAuthenticated ? (
                  <Button asChild size="lg" className="group">
                    <Link to="/dashboard">
                      Open dashboard
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </Button>
                ) : (
                  <Button asChild size="lg">
                    <a href="/api/auth/google">
                      <GoogleIcon />
                      Start Your Personal Dev Log Now — Free
                    </a>
                  </Button>
                )}
              </div>
            </Reveal>
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
          <p>Built for developers who keep track</p>
        </div>
      </footer>
    </div>
  );
}
