import type { PromotionRule } from "@/lib/promotion/types";

export class PromotionRuleRegistry {
  private readonly rules = new Map<string, PromotionRule>();

  register(rule: PromotionRule): this {
    if (this.rules.has(rule.id)) {
      throw new Error(`Promotion rule already registered: ${rule.id}`);
    }
    this.rules.set(rule.id, rule);
    return this;
  }

  registerMany(rules: readonly PromotionRule[]): this {
    for (const rule of rules) this.register(rule);
    return this;
  }

  get(ruleId: string): PromotionRule | null {
    return this.rules.get(ruleId) ?? null;
  }

  list(): PromotionRule[] {
    return [...this.rules.values()];
  }
}

export function createPromotionRuleRegistry(rules: readonly PromotionRule[] = []): PromotionRuleRegistry {
  return new PromotionRuleRegistry().registerMany(rules);
}
