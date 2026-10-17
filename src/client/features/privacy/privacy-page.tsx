import { ArrowLeft, ExternalLink, ShieldCheck } from "lucide-react";
import { Link } from "react-router";

import { ThemeToggle } from "@/client/components/theme-toggle";

const SOURCE_URL = "https://github.com/farissbayu/pdevlog";

const sections: { title: string; body: string }[] = [
  {
    title: "Sign-in and account",
    body: "You sign in only with Google OAuth. We store the name, email address, and avatar URL Google returns, and nothing else. Your session is a signed, HTTP-only cookie (HS256 JWT) that expires after 30 days.",
  },
  {
    title: "What you create stays yours",
    body: "Your workspaces, tags, brag logs, notes, sparks, projects, and attachments are scoped to your account. Every request is filtered by your session user id, and a request for another user's data returns 404, not a partial result.",
  },
  {
    title: "Where it lives",
    body: "The app runs on Cloudflare Workers. Relational data is stored in a D1 SQLite database and file attachments in R2 object storage, both under this deployment's Cloudflare account.",
  },
  {
    title: "AI features",
    body: "When you run an AI-assisted feature (STAR breakdown, CV parsing, skill insights, or the competency mirror), the text you choose to include is sent to the AI provider this deployment is configured with — OpenRouter by default — to generate the response. If that matters to you, review that provider's own data terms.",
  },
  {
    title: "No ads, no trackers",
    body: "The app does not embed third-party analytics, advertising, or tracking scripts, and it does not sell your data.",
  },
  {
    title: "Export and delete at any time",
    body: "Export your brag logs as Markdown from Settings, print any note to PDF, or delete your whole account. Deletion removes your user record and every object you own, including attachments.",
  },
];

export function PrivacyPage() {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <img
              src="/pdevlog-icon.png"
              alt="Personal Dev Log"
              className="size-7 shrink-0 rounded-md"
            />
            <span className="hidden font-mono font-semibold tracking-tight sm:inline">
              Personal Dev Log
            </span>
          </Link>
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
              <ArrowLeft className="size-4" />
              Back
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">
        <span className="inline-flex items-center gap-1.5 font-mono text-xs font-medium tracking-wide text-primary uppercase">
          <ShieldCheck className="size-3.5" />
          Privacy
        </span>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance">
          Your data is private to you.
        </h1>
        <p className="mt-3 max-w-prose text-muted-foreground">
          This page describes how the software handles your data. It is a
          plain-language summary of what the code actually does, not a legal
          contract.
        </p>

        <div className="mt-10 space-y-8">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="font-medium">{section.title}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {section.body}
              </p>
            </section>
          ))}
        </div>

        <p className="mt-10 border-t pt-6 text-sm text-muted-foreground">
          You can read the full source on{" "}
          <a
            href={SOURCE_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-4 hover:underline">
            GitHub
            <ExternalLink className="size-3.5" aria-hidden="true" />
          </a>
          .{" "}
          <Link
            to="/guides/export-your-data"
            className="font-medium text-foreground underline-offset-4 hover:underline">
            Learn how to export your data
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
