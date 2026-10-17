import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Brain,
  Check,
  Compass,
  ExternalLink,
  FolderKanban,
  Menu,
  Rocket,
  RotateCcw,
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
      "Capture the topic as a Spark, track it as a spike project item, and ship what you learn to your changelog.",
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

const starFields = ["Situation", "Task", "Action", "Result"] as const;

const captureSamples: {
  title: string;
  note: string;
  star: [string, string, string, string];
}[] = [
  {
    title: "Slow query",
    note: "Our order DB went slow when traffic spiked. I added a join index and changed the query to batch. Response time dropped from 800ms to 45ms.",
    star: [
      "Transaction latency spike from a database query bottleneck under load.",
      "Eliminate performance degradation on the critical order endpoint.",
      "Profiled queries, added a composite index, refactored to a batched fetcher.",
      "p95 latency −94% (800ms → 45ms), with no added server cost.",
    ],
  },
  {
    title: "Flaky CI",
    note: "CI was red for no reason a few times a day. Turned out a shared mock kept state between tests. I reset it before each test and the flakiness stopped.",
    star: [
      "Intermittent CI failures blocking merges for weeks.",
      "Find and remove the root cause of the non-deterministic failures.",
      "Traced the flake to a shared mock leaking state; reset it before each test.",
      "Green CI — no random failures since, merges unblocked.",
    ],
  },
  {
    title: "Learned WebSockets",
    note: "I kept saying I'd learn WebSockets but only ever watched videos. So one weekend I built a small live-presence demo with reconnect and message ordering, and shipped it as a spike.",
    star: [
      "Wanted real hands-on experience with real-time transport.",
      "Learn WebSockets by shipping something real, not another course.",
      "Built a live presence demo; handled reconnection and message ordering.",
      "A reusable spike shipped, and a skill gap turned into evidence.",
    ],
  },
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
    title: "Clear the inbox & plan next week",
    description:
      "Promote or archive your Sparks, then queue next week's project items in your backlog.",
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
    a: "Notion and Obsidian are blank canvases with no opinions and no constraints, and they often become a graveyard of passive note hoarding. pdevlog is an opinionated, structured system: it breaks ideas into STAR, turns sparks into a shippable backlog with release changelogs, and evaluates your technical gaps via the AI Staff Engineer Mirror.",
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
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setCount(text.length);
      return;
    }
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
  }, [text, delay]);

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

function CaptureDemo() {
  const [sampleIndex, setSampleIndex] = useState(0);
  const [structured, setStructured] = useState(false);
  const sample = captureSamples[sampleIndex];

  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <Trophy className="size-3.5 text-emerald-600 dark:text-emerald-400" />
          <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            Brag Log · STAR
          </p>
        </div>
        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] font-medium text-amber-600 dark:text-amber-400">
          Live demo
        </span>
      </div>

      <div className="space-y-3 p-3">
        <fieldset className="flex flex-wrap gap-1.5">
          <legend className="sr-only">Choose a sample rough note</legend>
          {captureSamples.map((item, index) => (
            <label key={item.title} className="cursor-pointer">
              <input
                type="radio"
                name="hero-capture-sample"
                checked={sampleIndex === index}
                onChange={() => {
                  setSampleIndex(index);
                  setStructured(false);
                }}
                className="peer sr-only"
              />
              <span className="block rounded-full border px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors peer-checked:border-amber-500/40 peer-checked:bg-amber-500/10 peer-checked:text-amber-600 peer-focus-visible:ring-2 peer-focus-visible:ring-ring dark:peer-checked:text-amber-400">
                {item.title}
              </span>
            </label>
          ))}
        </fieldset>

        <div className="rounded-md border bg-muted/40 p-2.5">
          <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            Rough note
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            &ldquo;{sample.note}&rdquo;
          </p>
        </div>

        <div
          role="status"
          aria-live="polite"
          aria-label="STAR breakdown"
          className="space-y-1.5">
          {starFields.map((label, index) => {
            const value = structured ? sample.star[index] : null;
            return (
              <div
                key={label}
                style={
                  structured ? { animationDelay: `${index * 70}ms` } : undefined
                }
                className={`flex gap-3 ${
                  structured ? "motion-safe:animate-fade-up" : ""
                }`}>
                <span className="w-16 shrink-0 font-mono text-[10px] tracking-wide text-emerald-600 uppercase dark:text-emerald-400">
                  {label}
                </span>
                {value ? (
                  <p className="text-xs text-muted-foreground">
                    {label === "Result" ? (
                      <Typewriter text={value} delay={150} />
                    ) : (
                      value
                    )}
                  </p>
                ) : (
                  <span
                    aria-hidden="true"
                    className="mt-1 inline-block h-2.5 w-28 rounded bg-muted-foreground/15"
                  />
                )}
              </div>
            );
          })}
        </div>

        <Button
          type="button"
          size="sm"
          onClick={() => setStructured((prev) => !prev)}>
          {structured ? (
            <>
              <RotateCcw className="size-3.5" />
              Start over
            </>
          ) : (
            <>
              <Sparkles className="size-3.5" />
              Break into STAR
            </>
          )}
        </Button>
      </div>
    </div>
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
        <CaptureDemo />
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
  const mobileNavRef = useRef<HTMLDetailsElement>(null);
  const closeMobileNav = () => mobileNavRef.current?.removeAttribute("open");

  const primaryCta = isAuthenticated ? (
    <Button asChild size="lg" className="group">
      <Link to="/dashboard">
        Open dashboard
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </Button>
  ) : (
    <Button
      asChild
      size="lg"
      className="max-[350px]:h-auto max-[350px]:shrink max-[350px]:whitespace-normal max-[350px]:py-2.5 max-[350px]:text-center">
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
            <span className="hidden font-mono font-semibold tracking-tight whitespace-nowrap sm:inline">
              Personal Dev Log
            </span>
          </Link>

          <nav className="hidden items-center gap-4 text-sm text-muted-foreground whitespace-nowrap md:flex lg:gap-6">
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
            <Link
              to="/guides"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-foreground transition-colors hover:text-primary">
              Guides
            </Link>
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
            <details ref={mobileNavRef} className="relative md:hidden">
              <summary
                aria-label="Open menu"
                className="flex size-11 cursor-pointer list-none items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground [&::-webkit-details-marker]:hidden">
                <Menu className="size-5" />
              </summary>
              <nav
                onClick={closeMobileNav}
                className="absolute top-full right-0 z-40 mt-2 w-56 rounded-xl border bg-background p-1.5 text-sm shadow-lg">
                {[
                  ["#problem", "The Problem"],
                  ["#solution", "The Solution"],
                  ["#routine", "5-Min Routine"],
                  ["#faq", "FAQ"],
                ].map(([href, label]) => (
                  <a
                    key={href}
                    href={href}
                    className="block rounded-md px-3 py-3 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                    {label}
                  </a>
                ))}
                <Link
                  to="/guides"
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-md px-3 py-3 font-medium text-foreground transition-colors hover:bg-accent hover:text-primary">
                  Guides
                </Link>
              </nav>
            </details>
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
              <strong className="font-semibold text-foreground">pdevlog</strong>{" "}
              captures your daily work as a durable, exportable record of
              impact — so you can prove what you built without relying on
              memory or scattered git commits.
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
              subtitle="pdevlog is the Autonomous Tech Lead and Career Vault your office never gave you — an objective read on your strengths and gaps, drawn from your own logs."
            />

            <Reveal delay={120}>
              <div className="mt-12 hidden overflow-x-auto rounded-xl border sm:block">
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

              <div className="mt-12 space-y-4 sm:hidden">
                {comparison.map((row) => (
                  <div
                    key={row.dimension}
                    className="rounded-xl border bg-card p-5">
                    <p className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
                      {row.dimension}
                    </p>
                    <p className="mt-3 font-mono text-[11px] tracking-wide text-primary uppercase">
                      With pdevlog
                    </p>
                    <p className="mt-1.5 flex gap-2 font-medium">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                      {row.after}
                    </p>
                    <p className="mt-3 border-t pt-3 text-sm">
                      <span className="font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
                        The old way
                      </span>
                      <span className="mt-1.5 block text-muted-foreground">
                        {row.before}
                      </span>
                    </p>
                  </div>
                ))}
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
                  <span className="inline-flex items-center gap-1.5 rounded-full border bg-amber-500/5 px-3 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
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
                        <Zap className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
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
          <nav
            aria-label="Footer"
            className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <Link
              to="/privacy"
              className="transition-colors hover:text-foreground">
              Privacy
            </Link>
            <Link
              to="/guides/export-your-data"
              className="transition-colors hover:text-foreground">
              Export docs
            </Link>
            <a
              href="https://github.com/farissbayu/pdevlog"
              target="_blank"
              rel="noreferrer"
              aria-label="Source code on GitHub (opens in a new tab)"
              className="inline-flex items-center gap-1 transition-colors hover:text-foreground">
              Source
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          </nav>
          <p>Built for developers who keep track</p>
        </div>
      </footer>
    </div>
  );
}
