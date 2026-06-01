"use client";

import { useState, useEffect } from "react";
import { Loader2, Save, CheckCircle, BarChart3 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { calculateMortgagePayment, generateAmortizationSchedule, formatCurrency } from "@/lib/utils";

interface MortgageData {
  id?: string;
  property_name?: string;
  loan_amount?: number;
  interest_rate?: number;
  amortization_years?: number;
  payment_frequency?: string;
  is_variable_rate?: boolean;
  lender?: string;
  start_date?: string;
  down_payment?: number;
  purchase_price?: number;
}

export function MortgageCalculator({ userId, existingMortgage }: { userId: string; existingMortgage?: MortgageData | null }) {
  const [form, setForm] = useState({
    property_name: existingMortgage?.property_name || "Primary Residence",
    purchase_price: existingMortgage?.purchase_price || "",
    down_payment: existingMortgage?.down_payment || "",
    loan_amount: existingMortgage?.loan_amount || "",
    interest_rate: existingMortgage?.interest_rate ? (existingMortgage.interest_rate * 100).toFixed(2) : "",
    amortization_years: existingMortgage?.amortization_years || 25,
    payment_frequency: existingMortgage?.payment_frequency || "monthly",
    lender: existingMortgage?.lender || "",
  });

  const [result, setResult] = useState<{ payment: number; totalInterest: number; totalPaid: number } | null>(null);
  const [schedule, setSchedule] = useState<Array<{ year: number; payment: number; principal: number; interest: number; balance: number }>>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);

  const loanAmount = Number(form.loan_amount) ||
    (Number(form.purchase_price) - Number(form.down_payment)) || 0;
  const rate = Number(form.interest_rate) / 100 || 0;
  const years = Number(form.amortization_years) || 25;
  const freq = form.payment_frequency as "monthly" | "bi-weekly" | "weekly";

  useEffect(() => {
    if (loanAmount > 0 && rate > 0) {
      const r = calculateMortgagePayment(loanAmount, rate, years, freq);
      setResult(r);
      setSchedule(generateAmortizationSchedule(loanAmount, rate, years));
    }
  }, [loanAmount, rate, years, freq]);

  const handleSave = async () => {
    if (!loanAmount || !rate) return;
    setSaving(true);
    const supabase = createClient();
    const data = {
      user_id: userId,
      property_name: form.property_name,
      purchase_price: Number(form.purchase_price) || null,
      down_payment: Number(form.down_payment) || null,
      loan_amount: loanAmount,
      interest_rate: rate,
      amortization_years: years,
      payment_frequency: freq,
      lender: form.lender || null,
    };
    if (existingMortgage?.id) {
      await supabase.from("mortgages").update(data).eq("id", existingMortgage.id);
    } else {
      await supabase.from("mortgages").insert(data);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const fields: Array<{ key: keyof typeof form; label: string; type?: string; step?: string; options?: Array<{value:string;label:string}> }> = [
    { key: "property_name", label: "Property Name" },
    { key: "purchase_price", label: "Purchase Price ($)", type: "number" },
    { key: "down_payment", label: "Down Payment ($)", type: "number" },
    { key: "loan_amount", label: "Mortgage Amount ($)", type: "number" },
    { key: "interest_rate", label: "Interest Rate (%)", type: "number", step: "0.01" },
    { key: "amortization_years", label: "Amortization (years)", type: "number" },
    {
      key: "payment_frequency", label: "Payment Frequency",
      options: [
        { value: "monthly", label: "Monthly" },
        { value: "bi-weekly", label: "Bi-weekly" },
        { value: "weekly", label: "Weekly" },
      ],
    },
    { key: "lender", label: "Lender (optional)" },
  ];

  return (
    <div className="space-y-4">
      {/* Form */}
      <div className="space-y-2.5">
        {fields.map(f => (
          <div key={f.key}>
            <label className="text-xs text-muted-foreground block mb-1">{f.label}</label>
            {f.options ? (
              <select
                value={form[f.key] as string}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                className="input-field text-sm"
              >
                {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : (
              <input
                type={f.type || "text"}
                step={f.step}
                value={form[f.key] as string | number}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                placeholder={f.key === "loan_amount" ? "Auto-calculated or enter manually" : ""}
                className="input-field text-sm"
              />
            )}
          </div>
        ))}
      </div>

      {/* Results */}
      {result && loanAmount > 0 && (
        <div className="space-y-3">
          <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 text-center">
            <p className="text-xs text-muted-foreground mb-1 capitalize">{form.payment_frequency} Payment</p>
            <p className="text-3xl font-bold text-primary">{formatCurrency(result.payment)}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-3 rounded-lg bg-accent/50 text-center">
              <p className="text-xs text-muted-foreground">Total Interest</p>
              <p className="text-sm font-bold text-red-400">{formatCurrency(result.totalInterest)}</p>
            </div>
            <div className="p-3 rounded-lg bg-accent/50 text-center">
              <p className="text-xs text-muted-foreground">Total Paid</p>
              <p className="text-sm font-bold">{formatCurrency(result.totalPaid)}</p>
            </div>
          </div>

          {/* Amortization toggle */}
          <button
            onClick={() => setShowSchedule(!showSchedule)}
            className="w-full h-8 rounded-lg text-xs border border-border/60 hover:border-primary/30 text-muted-foreground hover:text-primary transition-all flex items-center justify-center gap-1.5"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            {showSchedule ? "Hide" : "Show"} amortization schedule
          </button>

          {showSchedule && schedule.length > 0 && (
            <div className="rounded-lg border border-border/60 overflow-hidden">
              <div className="grid grid-cols-4 bg-secondary text-xs font-semibold text-muted-foreground px-3 py-2">
                <span>Year</span><span className="text-right">Principal</span>
                <span className="text-right">Interest</span><span className="text-right">Balance</span>
              </div>
              <div className="max-h-48 overflow-y-auto">
                {schedule.map(row => (
                  <div key={row.year} className="grid grid-cols-4 text-xs px-3 py-1.5 border-t border-border/40 hover:bg-accent/30">
                    <span className="text-muted-foreground">Yr {row.year}</span>
                    <span className="text-right text-green-400">{formatCurrency(row.principal)}</span>
                    <span className="text-right text-red-400">{formatCurrency(row.interest)}</span>
                    <span className="text-right">{formatCurrency(row.balance)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving || !loanAmount || !rate}
        className="w-full h-9 rounded-lg text-sm font-medium bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
        {saving ? "Saving…" : saved ? "Saved!" : "Save Mortgage"}
      </button>
    </div>
  );
}
