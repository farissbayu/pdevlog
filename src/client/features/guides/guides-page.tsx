import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronRight,
  Clock,
  LayoutDashboard,
  Menu,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useParams } from "react-router";
import { cn } from "cn";

import { MarkdownRenderer } from "@/client/components/markdown-renderer";
import { ThemeToggle } from "@/client/components/theme-toggle";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { meQueryOptions } from "@/client/features/auth/api";
import { NoteToc } from "@/client/features/notes/note-toc";

import {
  GUIDES,
  GUIDE_CATEGORIES,
  getGuideBySlug,
  type GuideCategoryGroup,
} from "./guides-data";

function filterCategories(
  categories: GuideCategoryGroup[],
  query: string,
): GuideCategoryGroup[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return categories;
  }

  return categories
    .map((group) => ({
      category: group.category,
      guides: group.guides.filter(
        (guide) =>
          guide.title.toLowerCase().includes(trimmed) ||
          guide.description.toLowerCase().includes(trimmed) ||
          guide.category.toLowerCase().includes(trimmed) ||
          guide.content.toLowerCase().includes(trimmed),
      ),
    }))
    .filter((group) => group.guides.length > 0);
}

function DocsSidebarNav({
  categories,
  activeSlug,
  searchQuery,
  onSearchChange,
  onSelectGuide,
}: {
  categories: GuideCategoryGroup[];
  activeSlug: string;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onSelectGuide?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="p-4 pb-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Filter guides..."
            aria-label="Filter guides"
            className="h-8 bg-background pl-8 text-xs"
          />
        </div>
      </div>

      <nav
        aria-label="Documentation topics"
        className="flex-1 space-y-6 overflow-y-auto p-4 pt-3"
      >
        {categories.length === 0 ? (
          <p className="px-2 py-4 text-xs text-muted-foreground">
            No guides match &ldquo;{searchQuery}&rdquo;.
          </p>
        ) : (
          categories.map((group) => (
            <div key={group.category} className="space-y-1.5">
              <p className="px-2 font-mono text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                {group.category}
              </p>
              <ul className="space-y-0.5 border-l pl-2">
                {group.guides.map((guide) => {
                  const isActive = guide.slug === activeSlug;
                  return (
                    <li key={guide.slug}>
                      <Link
                        to={`/guides/${guide.slug}`}
                        onClick={onSelectGuide}
                        className={cn(
                          "-ml-[9px] flex items-center justify-between gap-2 rounded-r-md border-l-2 py-1.5 pr-2.5 pl-3 text-sm transition-colors",
                          isActive
                            ? "border-primary bg-primary/10 font-medium text-foreground"
                            : "border-transparent text-muted-foreground hover:border-border hover:bg-accent/60 hover:text-foreground",
                        )}
                      >
                        <span className="truncate">{guide.title}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </nav>
    </div>
  );
}

export function GuidesPage() {
  const { slug } = useParams<{ slug?: string }>();
  const location = useLocation();
  const { data: authData } = useQuery(meQueryOptions);
  const isAuthenticated = Boolean(authData?.user);

  const [searchQuery, setSearchQuery] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const defaultSlug = GUIDES[0]?.slug ?? "overview";
  const resolvedSlug = slug ?? defaultSlug;
  const activeGuide = getGuideBySlug(resolvedSlug);

  useEffect(() => {
    setMobileNavOpen(false);
    if (!location.hash) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [resolvedSlug, location.hash]);

  const filteredCategories = useMemo(
    () => filterCategories(GUIDE_CATEGORIES, searchQuery),
    [searchQuery],
  );

  if (!slug && GUIDES.length > 0) {
    return <Navigate to={`/guides/${defaultSlug}`} replace />;
  }

  if (!activeGuide) {
    return <Navigate to={`/guides/${defaultSlug}`} replace />;
  }

  const currentIndex = GUIDES.findIndex(
    (guide) => guide.slug === activeGuide.slug,
  );
  const previousGuide = currentIndex > 0 ? GUIDES[currentIndex - 1] : null;
  const nextGuide =
    currentIndex >= 0 && currentIndex < GUIDES.length - 1
      ? GUIDES[currentIndex + 1]
      : null;

  return (
    <div className="flex min-h-svh flex-col bg-background">
      {/* Top Documentation Header */}
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <Button
              variant="ghost"
              size="icon-sm"
              className="lg:hidden"
              aria-label="Toggle guides menu"
              onClick={() => setMobileNavOpen((prev) => !prev)}
            >
              {mobileNavOpen ? (
                <X className="size-4" />
              ) : (
                <Menu className="size-4" />
              )}
            </Button>

            <Link
              to={`/guides/${defaultSlug}`}
              className="flex items-center gap-2"
            >
              <img
                src="/pdevlog-icon.png"
                alt="Personal Dev Log"
                className="size-7 shrink-0 rounded-md"
              />
              <span className="font-mono text-sm font-semibold tracking-tight sm:text-base">
                Personal Dev Log
              </span>
            </Link>

            <span className="inline-flex items-center gap-1 rounded-md border bg-primary/10 px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wide text-primary uppercase">
              <BookOpen className="size-3" />
              Docs
            </span>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            {isAuthenticated ? (
              <Button asChild size="sm" variant="outline" className="gap-1.5">
                <Link to="/dashboard">
                  <LayoutDashboard className="size-3.5" />
                  <span>Back to Dashboard</span>
                </Link>
              </Button>
            ) : (
              <div className="flex items-center gap-1.5">
                <Button asChild size="sm" variant="ghost">
                  <Link to="/">Home</Link>
                </Button>
                <Button asChild size="sm">
                  <Link to="/login">Sign in</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Sidebar Drawer */}
      {mobileNavOpen ? (
        <div className="fixed inset-0 top-14 z-40 flex lg:hidden">
          <div
            className="fixed inset-0 top-14 bg-black/50 backdrop-blur-xs"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="relative z-10 w-72 max-w-[85vw] border-r bg-background shadow-xl">
            <DocsSidebarNav
              categories={filteredCategories}
              activeSlug={activeGuide.slug}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onSelectGuide={() => setMobileNavOpen(false)}
            />
          </aside>
        </div>
      ) : null}

      {/* 3-Column Documentation Body */}
      <div className="mx-auto flex w-full max-w-7xl flex-1">
        {/* Left Topic Navigation Sidebar */}
        <aside className="sticky top-14 hidden h-[calc(100svh-3.5rem)] w-64 shrink-0 border-r bg-sidebar/40 lg:block">
          <DocsSidebarNav
            categories={filteredCategories}
            activeSlug={activeGuide.slug}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        </aside>

        {/* Center Documentation Reader */}
        <main className="min-w-0 flex-1 px-4 py-8 sm:px-8 lg:px-12">
          <article className="mx-auto max-w-3xl">
            {/* Breadcrumb & Reading Metadata */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5 font-mono">
                <span className="text-primary font-medium uppercase">
                  {activeGuide.category}
                </span>
                <ChevronRight className="size-3.5" />
                <span className="truncate text-foreground">
                  {activeGuide.title}
                </span>
              </div>

              <div className="flex items-center gap-1.5 font-mono">
                <Clock className="size-3.5" />
                <span>{activeGuide.readingMinutes} min read</span>
              </div>
            </div>

            {/* Article Header */}
            <header className="mb-8 border-b pb-6">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {activeGuide.title}
              </h1>
              {activeGuide.description ? (
                <p className="mt-2.5 text-base leading-relaxed text-muted-foreground">
                  {activeGuide.description}
                </p>
              ) : null}
            </header>

            {/* Mobile/Tablet Table of Contents */}
            {activeGuide.headings.length > 0 ? (
              <details className="mb-6 rounded-lg border bg-card px-4 py-3 xl:hidden">
                <summary className="cursor-pointer font-mono text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  On this page ({activeGuide.headings.length})
                </summary>
                <div className="mt-3">
                  <NoteToc headings={activeGuide.headings} />
                </div>
              </details>
            ) : null}

            {/* Markdown Body */}
            <MarkdownRenderer content={activeGuide.content} />

            {/* Previous / Next Guide Pagination */}
            <nav
              aria-label="Guide pagination"
              className="mt-14 grid gap-4 border-t pt-8 sm:grid-cols-2"
            >
              {previousGuide ? (
                <Link
                  to={`/guides/${previousGuide.slug}`}
                  className="group flex flex-col justify-between rounded-lg border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-accent/40"
                >
                  <span className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
                    <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
                    Previous
                  </span>
                  <span className="mt-1.5 font-medium text-foreground group-hover:text-primary">
                    {previousGuide.title}
                  </span>
                  <span className="mt-0.5 text-xs text-muted-foreground">
                    {previousGuide.category}
                  </span>
                </Link>
              ) : (
                <div />
              )}

              {nextGuide ? (
                <Link
                  to={`/guides/${nextGuide.slug}`}
                  className="group flex flex-col items-end justify-between rounded-lg border bg-card p-4 text-right transition-colors hover:border-primary/50 hover:bg-accent/40"
                >
                  <span className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
                    Next
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                  <span className="mt-1.5 font-medium text-foreground group-hover:text-primary">
                    {nextGuide.title}
                  </span>
                  <span className="mt-0.5 text-xs text-muted-foreground">
                    {nextGuide.category}
                  </span>
                </Link>
              ) : (
                <div />
              )}
            </nav>
          </article>
        </main>

        {/* Right Sticky "On this page" TOC */}
        <aside className="sticky top-14 hidden h-[calc(100svh-3.5rem)] w-60 shrink-0 overflow-y-auto py-8 pr-6 pl-2 xl:block">
          <div className="space-y-6">
            <NoteToc headings={activeGuide.headings} />

            <div className="rounded-lg border bg-card/60 p-3.5 text-xs">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <Sparkles className="size-3.5 text-primary" />
                <span>Ready to put this into practice?</span>
              </div>
              <p className="mt-1 text-muted-foreground">
                Jump back into your workspace to log a win, note, or spark.
              </p>
              <Button
                asChild
                size="sm"
                variant="outline"
                className="mt-3 h-7 w-full text-xs"
              >
                <Link to={isAuthenticated ? "/dashboard" : "/login"}>
                  {isAuthenticated ? "Open Dashboard" : "Get Started"}
                </Link>
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

