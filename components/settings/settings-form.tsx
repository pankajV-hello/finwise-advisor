"use client";

import { useState } from "react";
import { Loader2, Save, CheckCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Profile { full_name?: string; country?: string; currency?: string; }
interface FinancialProfile {
  employment_type?: string;
  annual_income?: number;
  filing_status?: string;
  risk_tolerance?: string;
  monthly_expenses?: number;
  emergency_fund_months?: number;
  dependents?: number;
}

export function SettingsForm({ userId, profile, financialProfile }: {
  userId: string;
  profile?: Profile | null;
  financialProfile?: FinancialProfile | null;
}) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    full_name: profile?.full_name || "",
    country: profile?.country || "CA",
    currency: profile?.currency || "CAD",
    employment_type: financialProfile?.employment_type || "employed",
    annual_income: financialProfile?.annual_income || "",
    filing_status: financialProfile?.filing_status || "single",
    risk_tolerance: financialProfile?.risk_tolerance || "moderate",
    monthly_expenses: financialProfile?.monthly_expenses || "",
    emergency_fund_months: financialProfile?.emergency_fund_months || "",
    dependents: financialProfile?.dependents || 0,
  });

  const handleSave = async () => {
    setSaving(true);
    const supabase = createClient();
    await Promise.all([
      supabase.from("profiles").update({
        full_name: form.full_name,
        country: form.country,
        currency: form.currency,
      }).eq("id", userId),
      supabase.from("financial_profiles").update({
        employment_type: form.employment_type,
        annual_income: Number(form.annual_income) || 0,
        filing_status: form.filing_status,
        risk_tolerance: form.risk_tolerance,
        monthly_expenses: Number(form.monthly_expenses) || 0,
        emergency_fund_months: Number(form.emergency_fund_months) || 0,
        dependents: Number(form.dependents) || 0,
      }).eq("user_id", userId),
    ]);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const sections = [
    {
      title: "Personal", fields: [
        { key: "full_name", label: "Full Name", type: "text" },
        { key: "country", label: "Country", type: "select", options: [
          { value: "AU", label: "Australia 🇦🇺" },
          { value: "NZ", label: "New Zealand 🇳🇿" },
          { value: "CA", label: "Canada 🇨🇦" },
          { value: "US", label: "United States 🇺🇸" },
        ]},
        { key: "currency", label: "Currency", type: "select", options: [
          { value: "AUD", label: "AUD — Australian Dollar" },
          { value: "NZD", label: "NZD — New Zealand Dollar" },
          { value: "CAD", label: "CAD — Canadian Dollar" },
          { value: "USD", label: "USD — US Dollar" },
        ]},
      ]
    },
    {
      title: "Financial Profile", fields: [
        { key: "employment_type", label: "Employment Type", type: "select", options: [
          { value: "employed", label: "Employed (T4)" },
          { value: "self_employed", label: "Self-Employed" },
          { value: "retired", label: "Retired" },
          { value: "student", label: "Student" },
        ]},
        { key: "annual_income", label: "Annual Income ($)", type: "number" },
        { key: "monthly_expenses", label: "Monthly Expenses ($)", type: "number" },
        { key: "filing_status", label: "Tax Filing Status", type: "select", options: [
          { value: "single", label: "Single / Individual" },
          { value: "married", label: "Married / De Facto" },
          { value: "common_law", label: "Common-Law / Civil Union" },
          { value: "divorced", label: "Divorced / Separated" },
        ]},
        { key: "dependents", label: "Number of Dependents", type: "number" },
        { key: "emergency_fund_months", label: "Emergency Fund (months)", type: "number" },
        { key: "risk_tolerance", label: "Investment Risk Tolerance", type: "select", options: [
          { value: "conservative", label: "Conservative — Capital preservation" },
          { value: "moderate", label: "Moderate — Balanced growth" },
          { value: "aggressive", label: "Aggressive — Maximum growth" },
        ]},
      ]
    }
  ];

  return (
    <div className="space-y-6">
      {sections.map(section => (
        <div key={section.title} className="glass-card p-5">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">{section.title}</h2>
          <div className="space-y-3">
            {section.fields.map(field => (
              <div key={field.key} className="grid grid-cols-2 gap-4 items-center">
                <label className="text-sm text-muted-foreground">{field.label}</label>
                {field.type === "select" ? (
                  <select
                    value={form[field.key as keyof typeof form] as string}
                    onChange={e => setForm(p => ({ ...p, [field.key]: e.target.value }))}
                    className="input-field text-sm"
                  >
                    {field.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : (
                  <input
                    type={field.type}
                    value={form[field.key as keyof typeof form] as string | number}
                    onChange={e => setForm(p => ({ ...p, [field.key]: e.target.value }))}
                    className="input-field text-sm"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full h-10 rounded-lg font-semibold text-sm text-white bg-gradient-to-r from-primary via-primary to-sky hover:brightness-110 disabled:opacity-60 transition-all flex items-center justify-center gap-2 shadow-md shadow-primary/25"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
        {saving ? "Saving…" : saved ? "Saved!" : "Save Settings"}
      </button>
    </div>
  );
}
