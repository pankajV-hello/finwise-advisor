"use client";

import { useState, useMemo } from "react";
import {
  Calculator, TrendingDown, TrendingUp, Lightbulb, ChevronDown, ChevronUp,
  PiggyBank, Receipt, Award, Building2, Clock, LineChart,
} from "lucide-react";
import { calculateTax, type Jurisdiction } from "@/lib/tax/calculator";
import { getTaxSuggestions, type TaxTip } from "@/lib/tax/suggestions";
import { formatCurrency, cn } from "@/lib/utils";

const CATEGORY_ICON: Record<TaxTip["category"], React.ElementType> = {
  super: PiggyBank,
  deduction: Receipt,
  credit: Award,
  structure: Building2,
  timing: Clock,
  investment: LineChart,
};

interface Props {
  country: string;
  annualIncome: number;
  taxWithheld: number;
  superContribution: number;
  taxYear: number;
}

export function TaxCalculation({
  country, annualIncome, taxWithheld, superContribution, taxYear,
}: Props) {
  const jurisdiction = (["AU", "NZ", "CA", "US"].includes(country) ? country : "AU") as Jurisdiction;
  const [income, setIncome] = useState(String(annualIncome || ""));
  const [withheld, setWithheld] = useState(String(taxWithheld || ""));
  const [deductions, setDeductions] = useState("");
  const [showBreakdown, setShowBreakdown] = useState(false);

  const result = useMemo(
    () =>
      calculateTax({
        jurisdiction,
        grossIncome: Number(income) || 0,
        deductions: Number(deductions) || 0,
        taxWithheld: Number(withheld) || 0,
      }),
    [jurisdiction, income, deductions, withheld]
  );

  const tips = useMemo(
    () => getTaxSuggestions({ jurisdiction, grossIncome: Number(income) || 0, superContribution, result }),
    [jurisdiction, income, superContribution, result]
  );

  const cur = result.currency;
  const isRefund = result.refundOrOwing >= 0;

  return (
    <div className="space-y-4">
      {/* Inputs */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Calculator className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Tax Estimate · {result.authority} · {taxYear}</h3>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">Gross income</label>
            <input value={income} onChange={(e) => setIncome(e.target.value)} type="number"
              className="input-field text-sm" placeholder="0" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">Deductions</label>
            <input value={deductions} onChange={(e) => setDeductions(e.target.value)} type="number"
              className="input-field text-sm" placeholder="0" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">Tax withheld</label>
            <input value={withheld} onChange={(e) => setWithheld(e.target.value)} type="number"
              className="input-field text-sm" placeholder="0" />
          </div>
        </div>
      </div>

      {/* Result */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass-card p-4">
          <p className="text-xs text-muted-foreground">Estimated Tax</p>
          <p className="text-2xl font-bold text-red-500">{formatCurrency(result.totalTax, cur)}</p>
          <p className="text-[11px] text-muted-foreground mt-1">
            {result.levyName && result.levy > 0 ? `incl. ${formatCurrency(result.levy, cur)} ${result.levyName}` : "income tax"}
          </p>
        </div>
        <div className={cn("glass-card p-4 border", isRefund ? "border-green-500/30" : "border-red-500/30")}>
          <p className="text-xs text-muted-foreground">{isRefund ? "Estimated Refund" : "Estimated Owing"}</p>
          <p className={cn("text-2xl font-bold flex items-center gap-1", isRefund ? "text-green-600" : "text-red-500")}>
            {isRefund ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
            {formatCurrency(Math.abs(result.refundOrOwing), cur)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">vs tax withheld</p>
        </div>
      </div>

      {/* Rates */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass-card p-3 text-center">
          <p className="text-[10px] text-muted-foreground">Taxable Income</p>
          <p className="text-sm font-bold mt-0.5">{formatCurrency(result.taxableIncome, cur)}</p>
        </div>
        <div className="glass-card p-3 text-center">
          <p className="text-[10px] text-muted-foreground">Effective Rate</p>
          <p className="text-sm font-bold mt-0.5">{(result.effectiveRate * 100).toFixed(1)}%</p>
        </div>
        <div className="glass-card p-3 text-center">
          <p className="text-[10px] text-muted-foreground">Marginal Rate</p>
          <p className="text-sm font-bold mt-0.5 text-primary">{(result.marginalRate * 100).toFixed(0)}%</p>
        </div>
      </div>

      {/* Bracket breakdown */}
      <div className="glass-card overflow-hidden">
        <button onClick={() => setShowBreakdown(!showBreakdown)}
          className="w-full flex items-center justify-between p-3 hover:bg-accent/30 transition-colors">
          <span className="text-xs font-medium">How your tax is calculated</span>
          {showBreakdown ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>
        {showBreakdown && (
          <div className="px-4 pb-3 border-t border-border/40">
            <div className="space-y-1 mt-2">
              {result.bracketBreakdown.map((b, i) => (
                <div key={i} className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{cur} {b.band} @ {(b.rate * 100).toFixed(1)}%</span>
                  <span className="font-medium">{formatCurrency(b.tax, cur)}</span>
                </div>
              ))}
              {result.levy > 0 && (
                <div className="flex justify-between text-xs pt-1 border-t border-border/40">
                  <span className="text-muted-foreground">{result.levyName}</span>
                  <span className="font-medium">{formatCurrency(result.levy, cur)}</span>
                </div>
              )}
              <div className="flex justify-between text-xs pt-1 border-t border-border/40 font-semibold">
                <span>Total tax</span>
                <span>{formatCurrency(result.totalTax, cur)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Suggestions */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Lightbulb className="w-4 h-4 text-amber-500" />
          <h3 className="font-semibold text-sm">Ways to save tax ({result.authority}-allowed)</h3>
        </div>
        <div className="space-y-2">
          {tips.map((tip, i) => {
            const Icon = CATEGORY_ICON[tip.category];
            return (
              <div key={i} className="glass-card p-3 flex gap-3">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold">{tip.title}</p>
                    {tip.estimatedSaving && (
                      <span className="text-[10px] font-semibold text-green-600 bg-green-500/10 px-1.5 py-0.5 rounded shrink-0">
                        {tip.estimatedSaving}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{tip.detail}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
