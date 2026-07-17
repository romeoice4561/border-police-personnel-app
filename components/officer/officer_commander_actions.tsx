/**
 * OfficerCommanderActions (Phase 44 — Officer Intelligence Workspace,
 * Task 7).
 *
 * "ประเด็นที่ควรดำเนินการ" — renders the deterministic (non-AI)
 * recommendations already computed by
 * composeOfficerIntelligenceViewModel/buildCommanderActions
 * (lib/officer_intelligence/view_model.ts). This component performs no
 * business logic — only severity -> visual treatment mapping. Birthday
 * proximity is never included in the recommendations list (enforced
 * upstream in the composer, not here).
 */
import type { CommanderActionItem } from "@/lib/officer_intelligence/types";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CircleCheck, Info } from "lucide-react";

const SEVERITY_META = {
  urgent: { labelTh: "เร่งด่วน", tone: "critical" as const, icon: AlertTriangle },
  recommended: { labelTh: "ควรดำเนินการ", tone: "warning" as const, icon: CircleCheck },
  informational: { labelTh: "ข้อมูลประกอบ", tone: "neutral" as const, icon: Info },
};

export function OfficerCommanderActions({ items }: { items: CommanderActionItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>ประเด็นที่ควรดำเนินการ</CardTitle>
      </CardHeader>
      <CardBody>
        {items.length === 0 ? (
          <p className="text-sm text-muted">ไม่มีประเด็นที่ต้องดำเนินการในขณะนี้</p>
        ) : (
          <ul className="space-y-2">
            {items.map((item, index) => {
              const meta = SEVERITY_META[item.severity];
              const Icon = meta.icon;
              return (
                <li key={index} className="flex items-start gap-2.5 rounded-lg border border-border px-3 py-2.5">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="wrap-break-word text-sm text-foreground">{item.textTh}</p>
                  </div>
                  <Badge tone={meta.tone}>{meta.labelTh}</Badge>
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
