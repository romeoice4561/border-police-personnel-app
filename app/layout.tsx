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
 * No-hydration-flash theme bootstrap (same localStorage key as ThemeProvider).
 *
 * Runs synchronously as the first child of <body> so `data-theme` is set
 * before the rest of the body paints. JS only — no wrapping <script> tags
 * (those belong on the JSX element below).
 *
 * IMPORTANT: do NOT inject this via `dangerouslySetInnerHTML` on <head>.
 * Next.js / React append stylesheet <link>s, font preloads, and metadata
 * into <head> after hydration. Re-applying an opaque innerHTML string on
 * RootLayout re-render (e.g. AuthGate redirect(), or officer-save
 * `router.refresh()` RSC reconciliation) replaces the entire <head> with
 * only this bootstrap script — wiping global CSS. That made every Tailwind
 * utility disappear and exploded BppisLogo to its HTML width/height attrs
 * (4759×4401). Body-level injection leaves Next-managed <head> intact.
 */
const THEME_BOOTSTRAP_JS = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});var valid=${JSON.stringify(THEMES)};if(t&&valid.indexOf(t)!==-1){document.documentElement.setAttribute('data-theme',t);}else{document.documentElement.setAttribute('data-theme',${JSON.stringify(DEFAULT_THEME)});}}catch(e){document.documentElement.setAttribute('data-theme',${JSON.stringify(DEFAULT_THEME)});}})();`;

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
      <body className="min-h-full">
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_JS }} />
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
