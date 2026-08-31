/**
 * Injects the no-FOUC theme bootstrap script via Next's SSR HTML stream.
 *
 * React 19 warns when a JSX <script> appears inside a hydrating component tree
 * ("Encountered a script tag while rendering React component"). The previous
 * body-level `<script dangerouslySetInnerHTML>` in app/layout.tsx triggered
 * that warning on every route (including /login).
 *
 * `useServerInsertedHTML` inserts the script into the SSR HTML outside the
 * client React tree, so React never reconciles a <script> element — while the
 * browser still executes it once from the initial document (same semantics as
 * before). Do NOT put dangerouslySetInnerHTML on <head>: that wiped Next-
 * managed stylesheets on RSC re-render (AuthGate redirect / router.refresh).
 */
"use client";

import { useRef } from "react";
import { useServerInsertedHTML } from "next/navigation";
import { buildThemeBootstrapScript } from "@/lib/theme/theme_bootstrap_script";

export function ThemeBootstrap() {
  const inserted = useRef(false);

  useServerInsertedHTML(() => {
    if (inserted.current) return null;
    inserted.current = true;
    return (
      <script
        id="bpp-theme-bootstrap"
        dangerouslySetInnerHTML={{ __html: buildThemeBootstrapScript() }}
      />
    );
  });

  return null;
}
