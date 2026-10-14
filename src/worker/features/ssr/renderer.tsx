import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToString } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router";

import { ThemeProvider } from "@/client/components/theme-provider";
import { meQueryOptions } from "@/client/features/auth/api";
import { GuidesPage } from "@/client/features/guides/guides-page";
import { LandingPage } from "@/client/features/landing/landing-page";
import type { MeResponse } from "@/shared/schemas/auth";

export function renderApp(path: string, me: MeResponse | null): string {
  const queryClient = new QueryClient();
  if (me) {
    queryClient.setQueryData(meQueryOptions.queryKey, me);
  }

  return renderToString(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/guides/:slug" element={<GuidesPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

export function renderGuideNotFound(slug: string): string {
  return renderToString(
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
      <p className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
        404
      </p>
      <h1 className="text-2xl font-semibold tracking-tight">
        Guide not found
      </h1>
      <p className="text-muted-foreground">
        There is no guide with the slug &ldquo;{slug}&rdquo;.
      </p>
      <a
        href="/guides/overview"
        className="font-medium text-primary underline-offset-4 hover:underline"
      >
        Browse the guides
      </a>
    </main>,
  );
}
