import {
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Info,
  Repeat, PieChart, Lightbulb,
} from "lucide-react";
import type { SpendingInsights, SpendFlag } from "@/lib/insights/spending";
import { formatCurrency, cn } from "@/lib/utils";

const FLAG_STYLE: Record<SpendFlag["severity"], { bg: string; text: string; icon: React.ElementType }> = {
  alert: { bg: "bg-red-50 border-red-200", text: "text-red-600", icon: AlertTriangle },
  warning: { bg: "bg-amber-50 border-amber-200", text: "text-amber-600", icon: AlertTriangle },
  info: { bg: "bg-blue-50 border-blue-200", text: "text-blue-600", icon: Info },
  success: { bg: "bg-green-50 border-green-200", text: "text-green-600", icon: CheckCircle },
};

const KIND_COLOR: Record<string, string> = {
  essential: "bg-blue-500",
  discretionary: "bg-amber-500",
  other: "bg-slate-400",
};

export function SpendingInsightsPanel({ insights, currency = "AUD" }: { insights: SpendingInsights; currency?: string }) {
  const { monthlyIncome, monthlySpend, monthlyNet, savingsRate, topCategories, flags, recurring, essentialSpend, discretionarySpend } = insights;
  const totalPotentialSaving = flags.reduce((s, f) => s + (f.monthlySaving || 0), 0);

  if (insights.byCategory.length === 0) {
    return (
      <div className="glass-card p-6 text-center">
        <PieChart className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
        <p className="text-sm text-muted-foreground">
          Upload a bank statement (PDF or CSV) to see where your money goes and how to save.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Headline */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="glass-card p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Monthly Income</p>
          <p className="text-base font-bold text-green-600">{formatCurrency(monthlyIncome, currency)}</p>
        </div>
        <div className="glass-card p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Monthly Spend</p>
          <p className="text-base font-bold text-red-500">{formatCurrency(monthlySpend, currency)}</p>
        </div>
        <div className="glass-card p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Net / month</p>
          <p className={cn("text-base font-bold", monthlyNet >= 0 ? "text-green-600" : "text-red-500")}>
            {formatCurrency(monthlyNet, currency)}
          </p>
        </div>
        <div className="glass-card p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Savings Rate</p>
          <p className={cn("text-base font-bold", savingsRate >= 0.2 ? "text-green-600" : savingsRate >= 0.1 ? "text-amber-500" : "text-red-500")}>
            {Math.round(savingsRate * 100)}%
          </p>
        </div>
      </div>

      {/* Potential savings banner */}
      {totalPotentialSaving > 0 && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Lightbulb className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">Potential savings: {formatCurrency(totalPotentialSaving, currency)}/mo</p>
            <p className="text-xs text-muted-foreground">
              ≈ {formatCurrency(totalPotentialSaving * 12, currency)}/yr if you act on the flags below.
            </p>
          </div>
        </div>
      )}

      {/* Where your money goes */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <PieChart className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Where your money goes</h3>
          <span className="text-[10px] text-muted-foreground ml-auto">monthly average</span>
        </div>
        <div className="space-y-2.5">
          {topCategories.map((c) => (
            <div key={c.category}>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium flex items-center gap-1.5">
                  <span className={cn("w-2 h-2 rounded-full", KIND_COLOR[c.kind])} />
                  {c.category}
                </span>
                <span className="text-muted-foreground">
                  {formatCurrency(c.total, currency)} · {Math.round(c.pctOfIncome * 100)}%
                </span>
              </div>
              <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full", KIND_COLOR[c.kind])}
                  style={{ width: `${Math.min(100, Math.round(c.pctOfSpend * 100))}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-3 pt-3 border-t border-border/40 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500" /> Essential {formatCurrency(essentialSpend, currency)}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" /> Discretionary {formatCurrency(discretionarySpend, currency)}
          </span>
        </div>
      </div>

      {/* Flags & suggestions */}
      {flags.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="w-4 h-4 text-amber-500" />
            <h3 className="font-semibold text-sm">Insights & ways to save</h3>
          </div>
          <div className="space-y-2">
            {flags.map((f, i) => {
              const s = FLAG_STYLE[f.severity];
              const Icon = s.icon;
              return (
                <div key={i} className={cn("rounded-xl border p-3 flex gap-3", s.bg)}>
                  <Icon className={cn("w-4 h-4 shrink-0 mt-0.5", s.text)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold">{f.title}</p>
                      {f.monthlySaving ? (
                        <span className="text-[10px] font-semibold text-green-600 bg-green-500/10 px-1.5 py-0.5 rounded shrink-0">
                          save ~{formatCurrency(f.monthlySaving, currency)}/mo
                        </span>
                      ) : null}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{f.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recurring */}
      {recurring.length > 0 && (
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Repeat className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">Recurring charges</h3>
          </div>
          <div className="space-y-1.5">
            {recurring.slice(0, 6).map((r, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="truncate flex-1 text-muted-foreground">{r.description}</span>
                <span className="text-[10px] text-muted-foreground mx-2">×{r.count}</span>
                <span className="font-medium">{formatCurrency(r.monthlyCost, currency)}/mo</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground text-center">
        General budgeting insights, not financial advice. Figures are estimates from your imported transactions.
      </p>
    </div>
  );
}
