"use client";

import { useState } from "react";
import { Loader2, Save, CheckCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface TaxProfile {
  id?: string;
  employment_income?: number;
  self_employment_income?: number;
  investment_income?: number;
  rental_income?: number;
  rrsp_contributions?: number;
  rrsp_room?: number;
  tfsa_room?: number;
  charitable_donations?: number;
  medical_expenses?: number;
  home_office_expenses?: number;
  tax_paid?: number;
}

interface Props {
  userId: string;
  existingProfile?: TaxProfile | null;
  taxYear: number;
}

export function TaxProfileForm({ userId, existingProfile, taxYear }: Props) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    employment_income: existingProfile?.employment_income ?? "",
    self_employment_income: existingProfile?.self_employment_income ?? "",
    investment_income: existingProfile?.investment_income ?? "",
    rental_income: existingProfile?.rental_income ?? "",
    rrsp_contributions: existingProfile?.rrsp_contributions ?? "",
    rrsp_room: existingProfile?.rrsp_room ?? "",
    tfsa_room: existingProfile?.tfsa_room ?? "",
    charitable_donations: existingProfile?.charitable_donations ?? "",
    medical_expenses: existingProfile?.medical_expenses ?? "",
    home_office_expenses: existingProfile?.home_office_expenses ?? "",
    tax_paid: existingProfile?.tax_paid ?? "",
  });

  const fields = [
    { key: "employment_income", label: "Employment Income (T4)", group: "income" },
    { key: "self_employment_income", label: "Self-Employment Income", group: "income" },
    { key: "investment_income", label: "Investment Income", group: "income" },
    { key: "rental_income", label: "Rental Income", group: "income" },
    { key: "rrsp_contributions", label: "RRSP Contributions", group: "deductions" },
    { key: "rrsp_room", label: "RRSP Contribution Room", group: "deductions" },
    { key: "tfsa_room", label: "TFSA Room Remaining", group: "deductions" },
    { key: "charitable_donations", label: "Charitable Donations", group: "deductions" },
    { key: "medical_expenses", label: "Medical Expenses", group: "deductions" },
    { key: "home_office_expenses", label: "Home Office Expenses", group: "deductions" },
    { key: "tax_paid", label: "Income Tax Already Paid", group: "tax" },
  ];

  const handleSave = async () => {
    setSaving(true);
    const supabase = createClient();
    const data = {
      user_id: userId,
      tax_year: taxYear,
      ...Object.fromEntries(
        Object.entries(form).map(([k, v]) => [k, v === "" ? 0 : Number(v)])
      ),
    };
    await supabase.from("tax_profiles").upsert(data, { onConflict: "user_id,tax_year" });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const groups = [
    { id: "income", label: "Income" },
    { id: "deductions", label: "Deductions & Room" },
    { id: "tax", label: "Tax Paid" },
  ];

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <div key={group.id}>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{group.label}</p>
          <div className="space-y-2">
            {fields.filter(f => f.group === group.id).map((field) => (
              <div key={field.key} className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground w-40 shrink-0">{field.label}</label>
                <div className="relative flex-1">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                  <input
                    type="number"
                    value={form[field.key as keyof typeof form]}
                    onChange={(e) => setForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                    placeholder="0"
                    min="0"
                    className="input-field pl-6 text-right text-sm"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full h-9 rounded-lg text-sm font-medium bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {saving ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : saved ? (
          <CheckCircle className="w-4 h-4" />
        ) : (
          <Save className="w-4 h-4" />
        )}
        {saving ? "Saving…" : saved ? "Saved!" : "Save Tax Profile"}
      </button>
    </div>
  );
}
