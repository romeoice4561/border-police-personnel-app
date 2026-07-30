import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/layout/providers";
import { AppShell } from "@/components/layout/app_shell";
import { ServiceWorkerRegistration } from "@/components/pwa/service_worker_registration";
import { IosInstallBanner } from "@/components/pwa/ios_install_banner";
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
      { url: "/icons/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    // PWA install/manifest section (additive): a real 180x180 Apple touch
    // icon with an OPAQUE background (iOS renders transparent PNG icons as
    // black, so this one is composited onto the app's theme background —
    // see the icon-generation note in public/icons — never the same file
    // as the transparent branding source).
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  // PWA install/manifest section (additive) — Apple's own web-app meta tags;
  // Next's Metadata API emits these instead of hand-written <meta> tags.
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "BPPIS",
  },
  other: {
    "mobile-web-app-capable": "yes",
    // Next 16's appleWebApp.capable no longer emits this legacy Apple tag on
    // its own (only status-bar-style/title) — added explicitly since older
    // iOS/iPadOS Safari versions still key standalone-mode eligibility off it.
    "apple-mobile-web-app-capable": "yes",
  },
};

// PWA install/manifest section (additive): themeColor here is Next 15+'s
// dedicated `viewport` export (Metadata.themeColor moved out of
// `metadata` there) — matches manifest.json's theme_color exactly so the
// browser UI and the installed app agree. No existing page set a custom
// viewport before this, so this is purely additive.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1d4ed8",
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
        {/* PWA install/manifest section (additive): registers /sw.js on the
            client only, after mount — never during SSR, never blocking
            render. See the component's own doc comment for cache scope. */}
        <ServiceWorkerRegistration />
        <Providers>
          <AppShell>{children}</AppShell>
          {/* PWA install/manifest section (additive): iOS/iPadOS Safari has no
              native install prompt — this dismissible banner is the only
              install affordance there. Mounted globally so it works on every
              route, including the login page. */}
          <IosInstallBanner />
        </Providers>
      </body>
    </html>
  );
}
