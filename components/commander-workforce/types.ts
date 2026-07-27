/**
 * Presentation props for Commander Workforce Intelligence UI (Phase 52.2).
 * Components consume CommanderWorkforceViewModel only — no intelligence math.
 */
import type { CommanderWorkforceViewModel } from "@/lib/commander_workforce/types";

export type WorkforcePageProps = {
  viewModel: CommanderWorkforceViewModel;
};

export type WorkforceSectionProps = {
  viewModel: CommanderWorkforceViewModel;
};
