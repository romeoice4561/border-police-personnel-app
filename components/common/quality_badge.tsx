/**
 * QualityBadge (Phase 14 UI).
 *
 * Renders a quality score as a labeled status pill using the shared banding
 * (lib/ui/quality). Status tone + a text label (band name) so identity is never
 * color-alone. Shows the numeric score alongside the band.
 */
import { Badge } from "@/components/ui/badge";
import { bandForScore } from "@/lib/ui/quality";

export function QualityBadge({ score }: { score: number | null | undefined }) {
  const { band, tone } = bandForScore(score);
  const label = score === null || score === undefined ? band : `${band} · ${score}`;
  return (
    <Badge tone={tone} className="tabular-nums">
      {label}
    </Badge>
  );
}
