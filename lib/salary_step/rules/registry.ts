import type { SalaryStepRule } from "@/lib/salary_step/types";

export class SalaryStepRuleRegistry {
  private readonly rules = new Map<string, SalaryStepRule>();

  register(rule: SalaryStepRule): this {
    if (this.rules.has(rule.id)) {
      throw new Error(`Salary step rule already registered: ${rule.id}`);
    }
    this.rules.set(rule.id, rule);
    return this;
  }

  registerMany(rules: readonly SalaryStepRule[]): this {
    for (const rule of rules) this.register(rule);
    return this;
  }

  get(ruleId: string): SalaryStepRule | null {
    return this.rules.get(ruleId) ?? null;
  }

  list(): SalaryStepRule[] {
    return [...this.rules.values()];
  }
}

export function createSalaryStepRuleRegistry(rules: readonly SalaryStepRule[] = []): SalaryStepRuleRegistry {
  return new SalaryStepRuleRegistry().registerMany(rules);
}
