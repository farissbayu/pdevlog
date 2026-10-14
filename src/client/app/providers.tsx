import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { ThemeProvider } from "@/client/components/theme-provider";
import { Toaster } from "@/client/components/ui/sonner";
import { meQueryOptions } from "@/client/features/auth/api";
import type { MeResponse } from "@/shared/schemas/auth";

export function AppProviders({
  children,
  initialMe,
}: {
  children: ReactNode;
  initialMe?: MeResponse;
}) {
  const [queryClient] = useState(() => {
    const client = new QueryClient({
      defaultOptions: {
        queries: {
          retry: 1,
          refetchOnWindowFocus: false,
        },
      },
    });

    if (initialMe) {
      client.setQueryData(meQueryOptions.queryKey, initialMe);
    }

    return client;
  });

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      <Toaster position="top-right" />
    </ThemeProvider>
  );
}
