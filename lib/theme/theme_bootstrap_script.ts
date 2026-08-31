/**
 * Blocking theme-bootstrap JS (no FOUC).
 *
 * Shared by the RootLayout injector so the valid-theme list and storage key
 * cannot drift from `theme_config.ts`. try/catch guards private-browsing
 * sessions where localStorage throws.
 *
 * The returned string is the SCRIPT BODY only — no wrapping <script> tags.
 */
import { DEFAULT_THEME, THEME_STORAGE_KEY, THEMES } from "@/lib/theme/theme_config";

export function buildThemeBootstrapScript(): string {
  return `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});var valid=${JSON.stringify(THEMES)};if(t&&valid.indexOf(t)!==-1){document.documentElement.setAttribute('data-theme',t);}else{document.documentElement.setAttribute('data-theme',${JSON.stringify(DEFAULT_THEME)});}}catch(e){document.documentElement.setAttribute('data-theme',${JSON.stringify(DEFAULT_THEME)});}})();`;
}
