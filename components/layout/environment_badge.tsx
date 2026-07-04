/**
 * EnvironmentBadge (Phase 16A): a small Development / Production indicator in
 * the app chrome. Reads NODE_ENV (inlined at build time, safe on the client).
 * Production renders a quiet neutral pill; non-production a visible warning
 * pill so it's obvious you're not looking at live data.
 */
import { Badge } from "@/components/ui/badge";

export function EnvironmentBadge() {
  const env = process.env.NODE_ENV;
  const isProd = env === "production";
  const label = isProd ? "Production" : env === "test" ? "Test" : "Development";

  return (
    <Badge tone={isProd ? "neutral" : "warning"} className="uppercase tracking-wide">
      {label}
    </Badge>
  );
}
