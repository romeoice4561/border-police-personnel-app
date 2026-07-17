import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/layout/providers";
import { AppShell } from "@/components/layout/app_shell";
import { THEME_STORAGE_KEY, DEFAULT_THEME, THEMES } from "@/lib/theme/theme_config";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Border Patrol Personnel Intelligence",
  description: "Production dashboard for Border Patrol personnel records.",
  manifest: "/manifest.json",
  icons: {
    // /favicon.ico (app/favicon.ico, Next's default-file convention) is
    // served automatically and still applies as the fallback `shortcut`
    // icon for browsers/crawlers that only ever request /favicon.ico
    // directly; these entries additionally point modern browsers at the
    // real branding PNGs (sharper, and correctly reflect the official mark
    // at exactly the sizes browsers request).
    icon: [
      { url: "/assets/branding/bppis-favicon.png", type: "image/png" },
      { url: "/assets/branding/bppis-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/assets/branding/bppis-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/assets/branding/bppis-icon.png" }],
  },
};

/**
 * Phase 48A.1 (revised) — no-hydration-flash theme bootstrap, without a
 * React-tracked <script> element.
 *
 * ThemeProvider sets `data-theme` via a React effect, which only runs AFTER
 * hydration — for any non-default theme, the first painted frame would
 * otherwise briefly show the DEFAULT_THEME palette before flashing to the
 * stored one. This tiny script runs synchronously in <head>, before the body
 * paints, and sets `data-theme` directly from the SAME localStorage key
 * ThemeProvider reads — so the very first frame is already correct.
 *
 * ROOT CAUSE of the "Encountered a script tag while rendering React
 * component" warning (investigated against React's compiled source,
 * node_modules/next/dist/compiled/react-dom/.../react-dom-client.development.js):
 * ANY `<script>` JSX element — whether a raw `<script>` or `next/script`'s
 * `beforeInteractive` output (which itself renders a real `<script>` element
 * for the app directory, per node_modules/next/dist/client/script.js) — is
 * re-encountered by React on EVERY render pass that includes it. `AuthGate`'s
 * `redirect()` (next/navigation, thrown during render) forces exactly such a
 * re-render of the whole route tree on an unauthorized-route hit, and React
 * warns because a `<script>` element appearing outside the page's initial
 * server HTML is inert (browsers don't execute script elements inserted via
 * DOM diffing) — the warning is correct in general, just not applicable here
 * (this script only ever needs to run ONCE, on true first paint; it is
 * deliberately inert on any later encounter).
 *
 * FIX: inject the script as a raw HTML STRING via `dangerouslySetInnerHTML`
 * on the `<head>` element itself, rather than as a JSX `<script>` child.
 * React then treats `<head>`'s content as one opaque HTML blob — the same
 * mechanism it already uses for any `dangerouslySetInnerHTML` — and never
 * creates or reconciles a tracked `<script>` element, so it never re-triggers
 * this warning on any subsequent render, INCLUDING the redirect() case.
 * Execution semantics are identical to before: the browser parses and runs
 * this script exactly once, from the initial server-rendered HTML, before
 * hydration — no dependency on `next/script`'s runtime.
 *
 * Built from the shared theme constants (not duplicated literals) so the
 * valid-theme list and storage key can never drift from theme_config.ts.
 * try/catch guards a private-browsing session where localStorage throws.
 */
const THEME_BOOTSTRAP_SCRIPT = `<script>(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});var valid=${JSON.stringify(THEMES)};if(t&&valid.indexOf(t)!==-1){document.documentElement.setAttribute('data-theme',t);}else{document.documentElement.setAttribute('data-theme',${JSON.stringify(DEFAULT_THEME)});}}catch(e){document.documentElement.setAttribute('data-theme',${JSON.stringify(DEFAULT_THEME)});}})();</script>`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      // The theme-bootstrap script below sets `data-theme` on this element
      // BEFORE React hydrates, from the same localStorage key ThemeProvider
      // reads — by design, that attribute never matches server-rendered HTML
      // (the server has no theme preference to read). This is the standard,
      // documented fix for exactly this pattern (React docs: "third-party
      // scripts and browser extensions"; the same approach next-themes uses)
      // — it suppresses ONLY the mismatch warning for this element's
      // attributes, not for children, and not for any other hydration bug.
      suppressHydrationWarning
    >
      {/* dangerouslySetInnerHTML on <head> itself (not a <script> JSX child —
          see THEME_BOOTSTRAP_SCRIPT above for why): React treats this as one
          opaque HTML string, so it never creates/reconciles a tracked
          `<script>` element and never re-triggers the "script tag while
          rendering" warning, including on AuthGate's redirect() re-render.
          suppressHydrationWarning here too: React's own metadata tags
          (title/meta/link, hoisted from `export const metadata` and from
          page-level <head> content) are appended into this SAME <head> after
          the raw HTML string on the client — server and client legitimately
          end up with a different literal `innerHTML` snapshot for this one
          element, which is expected, not a real bug. */}
      <head dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} suppressHydrationWarning />
      <body className="min-h-full">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
