/**
 * Spending insights engine — analyses transactions to show WHERE money goes,
 * flags overspending against sensible benchmarks, detects recurring
 * subscriptions, and suggests legitimate ways to save.
 *
 * Pure & deterministic (no AI call) so it's fast, free, and unit-tested.
 * All guidance is general budgeting information, not financial advice.
 */

export interface Txn {
  date: string;
  description: string;
  amount: number; // positive = income, negative = expense
  category: string;
  type?: string;
}

// Categories that are typically essential ("needs") vs discretionary ("wants")
const ESSENTIAL = new Set([
  "Housing & Rent", "Mortgage Repayments", "Food & Groceries", "Transport & Vehicle",
  "Healthcare & Medical", "Utilities", "Insurance", "Education & Training",
  "GST / Tax Paid", "Childcare", "Debt Repayment",
]);
const DISCRETIONARY = new Set([
  "Entertainment", "Shopping & Personal", "Subscriptions", "Dining Out",
  "Food & Dining", "Travel", "Hobbies", "Gaming",
]);

function classifyCategory(category: string): "essential" | "discretionary" | "other" {
  if (ESSENTIAL.has(category)) return "essential";
  if (DISCRETIONARY.has(category)) return "discretionary";
  const c = category.toLowerCase();
  if (/(rent|mortgage|grocer|fuel|petrol|electric|water|gas|insurance|medical|pharm|school|childcare)/.test(c))
    return "essential";
  if (/(dining|restaurant|cafe|coffee|uber eats|takeaway|entertainment|netflix|spotify|subscription|shopping|amazon|game|bar|pub|alcohol)/.test(c))
    return "discretionary";
  return "other";
}

export interface CategorySpend {
  category: string;
  total: number; // monthly-normalised
  count: number;
  pctOfSpend: number;
  pctOfIncome: number;
  kind: "essential" | "discretionary" | "other";
}

export interface SpendFlag {
  severity: "alert" | "warning" | "info" | "success";
  title: string;
  detail: string;
  monthlySaving?: number; // estimated $/month if acted on
}

export interface SpendingInsights {
  months: number;
  monthlyIncome: number;
  monthlySpend: number;
  monthlyNet: number;
  savingsRate: number; // 0..1
  essentialSpend: number;
  discretionarySpend: number;
  byCategory: CategorySpend[];
  topCategories: CategorySpend[];
  recurring: Array<{ description: string; amount: number; count: number; monthlyCost: number }>;
  flags: SpendFlag[];
}

// Benchmark share of income (monthly) — exceeding these raises a flag
const BENCHMARKS: Record<string, number> = {
  "Housing & Rent": 0.30,
  "Mortgage Repayments": 0.30,
  "Dining Out": 0.10,
  "Food & Dining": 0.10,
  "Entertainment": 0.08,
  "Shopping & Personal": 0.10,
  "Subscriptions": 0.04,
  "Transport & Vehicle": 0.15,
};

function monthsBetween(dates: string[]): number {
  const valid = dates.map((d) => new Date(d)).filter((d) => !isNaN(d.getTime()));
  if (valid.length === 0) return 1;
  const min = Math.min(...valid.map((d) => d.getTime()));
  const max = Math.max(...valid.map((d) => d.getTime()));
  const days = (max - min) / 86400000;
  return Math.max(1, Math.round((days / 30.4) * 10) / 10 || 1);
}

/** Normalise a transaction description for recurring-charge detection. */
function normaliseDesc(desc: string): string {
  return desc.toLowerCase().replace(/\d+/g, "").replace(/\s+/g, " ").trim().slice(0, 40);
}

export function analyzeSpending(transactions: Txn[], monthlyIncomeOverride?: number): SpendingInsights {
  const expenses = transactions.filter((t) => t.amount < 0);
  const income = transactions.filter((t) => t.amount > 0);
  const months = monthsBetween(transactions.map((t) => t.date));

  const totalSpend = expenses.reduce((s, t) => s + Math.abs(t.amount), 0);
  const totalIncome = income.reduce((s, t) => s + t.amount, 0);
  const monthlySpend = Math.round(totalSpend / months);
  const monthlyIncome = Math.round(
    monthlyIncomeOverride && monthlyIncomeOverride > 0 ? monthlyIncomeOverride : totalIncome / months
  );
  const monthlyNet = monthlyIncome - monthlySpend;
  const savingsRate = monthlyIncome > 0 ? Math.max(0, monthlyNet / monthlyIncome) : 0;

  // Aggregate by category
  const catMap = new Map<string, { total: number; count: number }>();
  for (const t of expenses) {
    const c = catMap.get(t.category) || { total: 0, count: 0 };
    c.total += Math.abs(t.amount);
    c.count += 1;
    catMap.set(t.category, c);
  }

  const byCategory: CategorySpend[] = [...catMap.entries()]
    .map(([category, v]) => {
      const monthly = Math.round(v.total / months);
      return {
        category,
        total: monthly,
        count: v.count,
        pctOfSpend: totalSpend > 0 ? v.total / totalSpend : 0,
        pctOfIncome: monthlyIncome > 0 ? monthly / monthlyIncome : 0,
        kind: classifyCategory(category),
      };
    })
    .sort((a, b) => b.total - a.total);

  const essentialSpend = byCategory.filter((c) => c.kind === "essential").reduce((s, c) => s + c.total, 0);
  const discretionarySpend = byCategory.filter((c) => c.kind === "discretionary").reduce((s, c) => s + c.total, 0);

  // Recurring charge detection (same normalised description appearing 2+ times)
  const recurMap = new Map<string, { amount: number; count: number; desc: string }>();
  for (const t of expenses) {
    const key = normaliseDesc(t.description);
    if (!key) continue;
    const r = recurMap.get(key) || { amount: Math.abs(t.amount), count: 0, desc: t.description };
    r.count += 1;
    recurMap.set(key, r);
  }
  const recurring = [...recurMap.values()]
    .filter((r) => r.count >= 2)
    .map((r) => ({
      description: r.desc,
      amount: Math.round(r.amount),
      count: r.count,
      monthlyCost: Math.round((r.amount * r.count) / months),
    }))
    .sort((a, b) => b.monthlyCost - a.monthlyCost)
    .slice(0, 10);

  // ── Flags ────────────────────────────────────────────────────────────────
  const flags: SpendFlag[] = [];

  // Overall cashflow
  if (monthlyNet < 0) {
    flags.push({
      severity: "alert",
      title: "You're spending more than you earn",
      detail: `Monthly spend of ${monthlySpend.toLocaleString()} exceeds income of ${monthlyIncome.toLocaleString()}. Trim discretionary categories first.`,
      monthlySaving: Math.abs(monthlyNet),
    });
  } else if (savingsRate < 0.1 && monthlyIncome > 0) {
    flags.push({
      severity: "warning",
      title: "Low savings rate",
      detail: `You're saving about ${Math.round(savingsRate * 100)}% — a healthy target is 20%. Closing the gap frees up ${Math.round((0.2 - savingsRate) * monthlyIncome).toLocaleString()}/mo.`,
      monthlySaving: Math.round((0.2 - savingsRate) * monthlyIncome),
    });
  } else if (savingsRate >= 0.2) {
    flags.push({
      severity: "success",
      title: "Strong savings rate",
      detail: `You're saving ${Math.round(savingsRate * 100)}% of income — above the 20% target. Consider directing surplus to super/retirement or an offset account.`,
    });
  }

  // Category benchmark breaches
  if (monthlyIncome > 0) {
    for (const c of byCategory) {
      const benchmark = BENCHMARKS[c.category];
      if (benchmark && c.pctOfIncome > benchmark) {
        const over = Math.round((c.pctOfIncome - benchmark) * monthlyIncome);
        flags.push({
          severity: c.pctOfIncome > benchmark * 1.5 ? "alert" : "warning",
          title: `High ${c.category.toLowerCase()} spend`,
          detail: `${c.category} is ${Math.round(c.pctOfIncome * 100)}% of income (typical ≤ ${Math.round(benchmark * 100)}%). Reducing to the benchmark saves ~${over.toLocaleString()}/mo.`,
          monthlySaving: over,
        });
      }
    }
  }

  // Discretionary share
  if (monthlyIncome > 0 && discretionarySpend / monthlyIncome > 0.3) {
    flags.push({
      severity: "warning",
      title: "Discretionary spending is high",
      detail: `Wants (dining, shopping, entertainment, subscriptions) are ${Math.round((discretionarySpend / monthlyIncome) * 100)}% of income. The 50/30/20 guide suggests ≤ 30%.`,
      monthlySaving: Math.round(discretionarySpend - 0.3 * monthlyIncome),
    });
  }

  // Subscriptions total
  const subsMonthly = recurring
    .filter((r) => classifyCategory("Subscriptions") && /netflix|spotify|prime|disney|subscription|gym|apple|google|youtube|stan|binge|kayo/i.test(r.description))
    .reduce((s, r) => s + r.monthlyCost, 0);
  if (subsMonthly > 0) {
    flags.push({
      severity: "info",
      title: "Recurring subscriptions detected",
      detail: `About ${subsMonthly.toLocaleString()}/mo in subscriptions. Review for ones you no longer use — cancelling unused services is the easiest saving.`,
      monthlySaving: Math.round(subsMonthly * 0.3),
    });
  }

  return {
    months,
    monthlyIncome,
    monthlySpend,
    monthlyNet,
    savingsRate,
    essentialSpend,
    discretionarySpend,
    byCategory,
    topCategories: byCategory.slice(0, 6),
    recurring,
    flags,
  };
}
