/**
 * Client providers (Phase 14 UI): the TanStack Query client, created once per
 * browser session. Wraps the app in the root layout so every client component
 * can use the data hooks.
 */
"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LanguageProvider } from "@/components/i18n/language_provider";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  // Phase 43: LanguageProvider wraps the whole app so every page/component
  // shares one language state (single source, single toggle).
  return (
    <QueryClientProvider client={client}>
      <LanguageProvider>{children}</LanguageProvider>
    </QueryClientProvider>
  );
}
