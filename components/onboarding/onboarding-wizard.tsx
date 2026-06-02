"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles, User, Building2, Check, ChevronRight, ChevronLeft,
  Briefcase, Users, Rocket, TrendingUp, Home, Loader2, ShieldCheck,
  Wallet, Target, PiggyBank, Plane, GraduationCap, CreditCard, Car,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn, formatCurrency } from "@/lib/utils";
import { TERMS_VERSION, SHORT_DISCLAIMER, getAdviceWarning } from "@/lib/legal";
import Link from "next/link";

type Country = "AU" | "NZ" | "CA" | "US";
const CURRENCY: Record<Country, string> = { AU: "AUD", NZ: "NZD", CA: "CAD", US: "USD" };
const COUNTRY_LABEL: Record<Country, string> = {
  AU: "🇦🇺 Australia", NZ: "🇳🇿 New Zealand", CA: "🇨🇦 Canada", US: "🇺🇸 United States",
};

const INCOME_SOURCES = [
  { id: "salary", label: "One job (salary / PAYG)", icon: Briefcase, periodic: "annual salary" },
  { id: "multiple_jobs", label: "Multiple jobs", icon: Users, periodic: "total annual" },
  { id: "side_hustle", label: "Side hustle / freelance", icon: Rocket, periodic: "annual" },
  { id: "small_business", label: "Small business / ABN", icon: Building2, periodic: "annual profit" },
  { id: "investments", label: "Investments / dividends", icon: TrendingUp, periodic: "annual" },
  { id: "rental", label: "Rental property", icon: Home, periodic: "annual rent" },
];

const GOAL_TYPES = [
  { id: "emergency", label: "Emergency fund", icon: PiggyBank },
  { id: "house", label: "Buy a home", icon: Home },
  { id: "retirement", label: "Retirement", icon: Target },
  { id: "vacation", label: "Travel", icon: Plane },
  { id: "education", label: "Education", icon: GraduationCap },
  { id: "debt_payoff", label: "Pay off debt", icon: CreditCard },
  { id: "car", label: "Buy a car", icon: Car },
  { id: "wealth", label: "Build wealth", icon: TrendingUp },
];

const BUSINESS_STRUCTURES = [
  { id: "sole_trader", label: "Sole trader" },
  { id: "company", label: "Company / Pty Ltd" },
  { id: "partnership", label: "Partnership" },
  { id: "trust", label: "Trust" },
];

interface Props {
  userId: string;
  userName?: string;
}

export function OnboardingWizard({ userId, userName }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Form state
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [entityType, setEntityType] = useState<"individual" | "sme" | null>(null);
  const [country, setCountry] = useState<Country | null>(null);

  // Individual
  const [sources, setSources] = useState<string[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [age, setAge] = useState("");
  const [dependents, setDependents] = useState("0");
  const [ownsHome, setOwnsHome] = useState<boolean | null>(null);
  const [monthlyExpenses, setMonthlyExpenses] = useState("");
  const [risk, setRisk] = useState("moderate");
  const [topGoal, setTopGoal] = useState("");
  const [goalAmount, setGoalAmount] = useState("");

  // SME
  const [businessName, setBusinessName] = useState("");
  const [businessStructure, setBusinessStructure] = useState("sole_trader");
  const [industry, setIndustry] = useState("");
  const [revenue, setRevenue] = useState("");
  const [gstRegistered, setGstRegistered] = useState(false);
  const [employees, setEmployees] = useState("0");

  const totalIncome = sources.reduce((sum, s) => sum + (Number(amounts[s]) || 0), 0);
  const cur = country ? CURRENCY[country] : "AUD";

  // ── Step definitions (dynamic by entity type) ──────────────────────────────
  const individualSteps = ["terms", "entity", "country", "sources", "amounts", "context", "goal", "review"];
  const smeSteps = ["terms", "entity", "country", "business", "review"];
  const steps = entityType === "sme" ? smeSteps : individualSteps;
  const currentStep = steps[step];
  const progress = Math.round(((step + 1) / steps.length) * 100);

  const toggleSource = (id: string) => {
    setSources((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  const canAdvance = (): boolean => {
    switch (currentStep) {
      case "terms": return acceptedTerms;
      case "entity": return entityType !== null;
      case "country": return country !== null;
      case "sources": return sources.length > 0;
      case "amounts": return totalIncome > 0;
      case "context": return age !== "" && ownsHome !== null;
      case "goal": return topGoal !== "";
      case "business": return businessName !== "" && revenue !== "";
      default: return true;
    }
  };

  const next = () => {
    if (step < steps.length - 1) setStep(step + 1);
    else finish();
  };
  const back = () => step > 0 && setStep(step - 1);

  // ── Save everything to all relevant tables ──────────────────────────────────
  const finish = async () => {
    setSaving(true);
    const supabase = createClient();
    const taxYear = new Date().getFullYear();

    try {
      // 1. Profile
      await supabase.from("profiles").update({
        country, currency: cur, entity_type: entityType,
        onboarding_completed: true,
        accepted_terms_at: new Date().toISOString(),
        accepted_terms_version: TERMS_VERSION,
        ...(entityType === "sme" && {
          business_name: businessName,
          business_structure: businessStructure,
          business_industry: industry,
          gst_registered: gstRegistered,
          employee_count: Number(employees) || 0,
          annual_revenue: Number(revenue) || 0,
        }),
      }).eq("id", userId);

      if (entityType === "individual") {
        // 2. Financial profile → feeds Dashboard + Financial Advisor
        const incomeSourcesJson = sources.map((s) => ({
          type: s,
          label: INCOME_SOURCES.find((x) => x.id === s)?.label,
          amount: Number(amounts[s]) || 0,
        }));
        const employmentType = sources.includes("small_business") || sources.includes("side_hustle")
          ? "self_employed" : "employed";

        await supabase.from("financial_profiles").upsert({
          user_id: userId,
          annual_income: totalIncome,
          income_sources: incomeSourcesJson,
          age: Number(age) || null,
          dependents: Number(dependents) || 0,
          owns_home: ownsHome,
          monthly_expenses: Number(monthlyExpenses) || 0,
          risk_tolerance: risk,
          employment_type: employmentType,
        }, { onConflict: "user_id" });

        // 3. Tax profile → feeds Tax Advisor (pre-filled income)
        const employmentIncome = sources
          .filter((s) => s === "salary" || s === "multiple_jobs")
          .reduce((sum, s) => sum + (Number(amounts[s]) || 0), 0);
        const selfEmploymentIncome = sources
          .filter((s) => s === "side_hustle" || s === "small_business")
          .reduce((sum, s) => sum + (Number(amounts[s]) || 0), 0);
        const investmentIncome = Number(amounts["investments"]) || 0;
        const rentalIncome = Number(amounts["rental"]) || 0;

        await supabase.from("tax_profiles").upsert({
          user_id: userId,
          tax_year: taxYear,
          employment_income: employmentIncome,
          self_employment_income: selfEmploymentIncome,
          investment_income: investmentIncome,
          rental_income: rentalIncome,
        }, { onConflict: "user_id,tax_year" });

        // 4. Top goal → feeds Goals + Dashboard
        if (topGoal) {
          await supabase.from("goals").insert({
            user_id: userId,
            name: GOAL_TYPES.find((g) => g.id === topGoal)?.label || "My Goal",
            type: topGoal === "wealth" ? "other" : topGoal,
            target_amount: Number(goalAmount) || 10000,
            current_amount: 0,
            priority: "high",
            status: "active",
          });
        }

        // 5. Welcome alert
        await supabase.from("alerts").insert({
          user_id: userId,
          type: "tip",
          title: "Welcome to FinWise AI! 🎉",
          message: `Your profile is set up with ${formatCurrency(totalIncome, cur)} annual income. Explore the Tax, Financial, and Mortgage advisors — they're pre-filled with your details.`,
          severity: "success",
        });
      } else {
        // SME financial profile
        await supabase.from("financial_profiles").upsert({
          user_id: userId,
          annual_income: Number(revenue) || 0,
          employment_type: "self_employed",
        }, { onConflict: "user_id" });

        await supabase.from("alerts").insert({
          user_id: userId,
          type: "tip",
          title: "Welcome to FinWise AI for Business! 🎉",
          message: `${businessName} is set up. Use the Bookkeeper for BAS/GST tracking and the Tax Advisor for business deductions.`,
          severity: "success",
        });
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      console.error("Onboarding save error:", err);
      setSaving(false);
      alert("Something went wrong saving your profile. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-secondary z-50">
        <div className="h-full bg-gradient-to-r from-primary to-sky transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          {/* Logo */}
          <div className="flex items-center justify-center gap-2.5 mb-8">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-sky flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-display font-bold text-lg brand-gradient">FinWise AI</span>
          </div>

          <div className="glass-card p-6 sm:p-8 animate-fade-in">
            {/* ── TERMS ── */}
            {currentStep === "terms" && (
              <div className="space-y-5">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <ShieldCheck className="w-6 h-6 text-primary" />
                  </div>
                  <h1 className="text-xl font-display font-bold">Welcome{userName ? `, ${userName.split(" ")[0]}` : ""}! 👋</h1>
                  <p className="text-sm text-muted-foreground mt-1">Before we start, a quick but important note.</p>
                </div>
                <div className="rounded-xl border border-amber-300/60 bg-amber-50 p-4">
                  <p className="text-xs text-amber-800 leading-relaxed">{SHORT_DISCLAIMER}</p>
                </div>
                <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border border-border hover:bg-accent transition-colors">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded accent-primary"
                  />
                  <span className="text-xs text-muted-foreground">
                    I understand FinWise AI provides general guidance only — not personal financial advice — and I
                    agree to the{" "}
                    <Link href="/legal/terms" target="_blank" className="text-primary hover:underline">Terms</Link>,{" "}
                    <Link href="/legal/privacy" target="_blank" className="text-primary hover:underline">Privacy Policy</Link>, and{" "}
                    <Link href="/legal/disclaimer" target="_blank" className="text-primary hover:underline">Disclaimer</Link>.
                  </span>
                </label>
              </div>
            )}

            {/* ── ENTITY ── */}
            {currentStep === "entity" && (
              <div className="space-y-5">
                <div className="text-center">
                  <h1 className="text-xl font-display font-bold">How will you use FinWise?</h1>
                  <p className="text-sm text-muted-foreground mt-1">This tailors everything to your needs.</p>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {[
                    { id: "individual", icon: User, title: "Individual / Personal", desc: "Manage your personal finances, tax, super, and goals" },
                    { id: "sme", icon: Building2, title: "Business / SME", desc: "Bookkeeping, GST/BAS, business tax, and cash flow" },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setEntityType(opt.id as "individual" | "sme")}
                      className={cn(
                        "flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all",
                        entityType === opt.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                      )}
                    >
                      <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center shrink-0", entityType === opt.id ? "bg-primary text-white" : "bg-accent text-muted-foreground")}>
                        <opt.icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{opt.title}</p>
                        <p className="text-xs text-muted-foreground">{opt.desc}</p>
                      </div>
                      {entityType === opt.id && <Check className="w-5 h-5 text-primary shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── COUNTRY ── */}
            {currentStep === "country" && (
              <div className="space-y-5">
                <div className="text-center">
                  <h1 className="text-xl font-display font-bold">Where are you based?</h1>
                  <p className="text-sm text-muted-foreground mt-1">Tax rules and accounts differ by country.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {(["AU", "NZ", "CA", "US"] as Country[]).map((c) => (
                    <button
                      key={c}
                      onClick={() => setCountry(c)}
                      className={cn(
                        "p-4 rounded-xl border-2 text-center transition-all",
                        country === c ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                      )}
                    >
                      <div className="text-3xl mb-1">{COUNTRY_LABEL[c].split(" ")[0]}</div>
                      <div className="text-sm font-medium">{COUNTRY_LABEL[c].split(" ").slice(1).join(" ")}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{CURRENCY[c]}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── INCOME SOURCES ── */}
            {currentStep === "sources" && (
              <div className="space-y-5">
                <div className="text-center">
                  <h1 className="text-xl font-display font-bold">Where does your income come from?</h1>
                  <p className="text-sm text-muted-foreground mt-1">Select all that apply.</p>
                </div>
                <div className="grid grid-cols-1 gap-2.5">
                  {INCOME_SOURCES.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => toggleSource(s.id)}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all",
                        sources.includes(s.id) ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                      )}
                    >
                      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", sources.includes(s.id) ? "bg-primary text-white" : "bg-accent text-muted-foreground")}>
                        <s.icon className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-medium flex-1">{s.label}</span>
                      {sources.includes(s.id) && <Check className="w-4 h-4 text-primary shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── AMOUNTS ── */}
            {currentStep === "amounts" && (
              <div className="space-y-5">
                <div className="text-center">
                  <h1 className="text-xl font-display font-bold">How much from each source?</h1>
                  <p className="text-sm text-muted-foreground mt-1">Annual, before tax. Estimates are fine.</p>
                </div>
                <div className="space-y-3">
                  {sources.map((s) => {
                    const src = INCOME_SOURCES.find((x) => x.id === s)!;
                    return (
                      <div key={s}>
                        <label className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
                          <src.icon className="w-3.5 h-3.5" /> {src.label} <span className="text-[10px]">({src.periodic})</span>
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                          <input
                            type="number"
                            value={amounts[s] || ""}
                            onChange={(e) => setAmounts((p) => ({ ...p, [s]: e.target.value }))}
                            placeholder="0"
                            className="input-field pl-7"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 flex items-center justify-between">
                  <span className="text-sm font-medium">Total annual income</span>
                  <span className="text-xl font-bold text-primary">{formatCurrency(totalIncome, cur)}</span>
                </div>
              </div>
            )}

            {/* ── CONTEXT ── */}
            {currentStep === "context" && (
              <div className="space-y-5">
                <div className="text-center">
                  <h1 className="text-xl font-display font-bold">A bit about you</h1>
                  <p className="text-sm text-muted-foreground mt-1">Helps us personalise projections.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Your age</label>
                    <input type="number" value={age} onChange={(e) => setAge(e.target.value)} placeholder="35" className="input-field" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Dependents</label>
                    <input type="number" value={dependents} onChange={(e) => setDependents(e.target.value)} placeholder="0" className="input-field" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Approx. monthly expenses</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                    <input type="number" value={monthlyExpenses} onChange={(e) => setMonthlyExpenses(e.target.value)} placeholder="3,000" className="input-field pl-7" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-2">Do you own your home?</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[{ v: true, l: "Yes, I own" }, { v: false, l: "No, I rent" }].map((o) => (
                      <button key={o.l} onClick={() => setOwnsHome(o.v)}
                        className={cn("p-3 rounded-xl border-2 text-sm font-medium transition-all", ownsHome === o.v ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-primary/40")}>
                        {o.l}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-2">Investment risk comfort</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[{ v: "conservative", l: "Cautious" }, { v: "moderate", l: "Balanced" }, { v: "aggressive", l: "Growth" }].map((o) => (
                      <button key={o.v} onClick={() => setRisk(o.v)}
                        className={cn("p-2.5 rounded-xl border-2 text-xs font-medium transition-all", risk === o.v ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-primary/40")}>
                        {o.l}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── GOAL ── */}
            {currentStep === "goal" && (
              <div className="space-y-5">
                <div className="text-center">
                  <h1 className="text-xl font-display font-bold">What's your #1 financial goal?</h1>
                  <p className="text-sm text-muted-foreground mt-1">We'll track it on your dashboard.</p>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {GOAL_TYPES.map((g) => (
                    <button key={g.id} onClick={() => setTopGoal(g.id)}
                      className={cn("flex items-center gap-2.5 p-3 rounded-xl border-2 text-left transition-all", topGoal === g.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40")}>
                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", topGoal === g.id ? "bg-primary text-white" : "bg-accent text-muted-foreground")}>
                        <g.icon className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-medium">{g.label}</span>
                    </button>
                  ))}
                </div>
                {topGoal && (
                  <div className="animate-fade-in">
                    <label className="text-xs text-muted-foreground block mb-1">Target amount (optional)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                      <input type="number" value={goalAmount} onChange={(e) => setGoalAmount(e.target.value)} placeholder="50,000" className="input-field pl-7" />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── SME BUSINESS ── */}
            {currentStep === "business" && (
              <div className="space-y-4">
                <div className="text-center">
                  <h1 className="text-xl font-display font-bold">Tell us about your business</h1>
                  <p className="text-sm text-muted-foreground mt-1">We'll configure GST/BAS and tax accordingly.</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Business name</label>
                  <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Acme Pty Ltd" className="input-field" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Structure</label>
                  <div className="grid grid-cols-2 gap-2">
                    {BUSINESS_STRUCTURES.map((b) => (
                      <button key={b.id} onClick={() => setBusinessStructure(b.id)}
                        className={cn("p-2.5 rounded-xl border-2 text-xs font-medium transition-all", businessStructure === b.id ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-primary/40")}>
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Industry</label>
                    <input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="Consulting" className="input-field" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Employees</label>
                    <input type="number" value={employees} onChange={(e) => setEmployees(e.target.value)} placeholder="0" className="input-field" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Annual revenue</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                    <input type="number" value={revenue} onChange={(e) => setRevenue(e.target.value)} placeholder="120,000" className="input-field pl-7" />
                  </div>
                </div>
                <label className="flex items-center gap-2.5 cursor-pointer p-3 rounded-xl border border-border">
                  <input type="checkbox" checked={gstRegistered} onChange={(e) => setGstRegistered(e.target.checked)} className="w-4 h-4 rounded accent-primary" />
                  <span className="text-sm">Registered for GST{country === "AU" ? " (BAS lodgement)" : country === "NZ" ? " (GST returns)" : ""}</span>
                </label>
              </div>
            )}

            {/* ── REVIEW ── */}
            {currentStep === "review" && (
              <div className="space-y-5">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-2xl bg-success/10 flex items-center justify-center mx-auto mb-3">
                    <Check className="w-6 h-6 text-success" />
                  </div>
                  <h1 className="text-xl font-display font-bold">You're all set!</h1>
                  <p className="text-sm text-muted-foreground mt-1">Here's what we'll build for you.</p>
                </div>
                <div className="space-y-2.5">
                  {entityType === "individual" ? (
                    <>
                      <ReviewRow icon={Wallet} label="Annual income" value={formatCurrency(totalIncome, cur)} />
                      <ReviewRow icon={User} label="Profile" value={`${age || "—"} yrs · ${dependents} dependents · ${ownsHome ? "homeowner" : "renter"}`} />
                      <ReviewRow icon={Target} label="Top goal" value={GOAL_TYPES.find((g) => g.id === topGoal)?.label || "—"} />
                      <ReviewRow icon={TrendingUp} label="Risk profile" value={risk} />
                    </>
                  ) : (
                    <>
                      <ReviewRow icon={Building2} label="Business" value={businessName} />
                      <ReviewRow icon={Briefcase} label="Structure" value={BUSINESS_STRUCTURES.find((b) => b.id === businessStructure)?.label || "—"} />
                      <ReviewRow icon={Wallet} label="Revenue" value={formatCurrency(Number(revenue) || 0, cur)} />
                    </>
                  )}
                </div>
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                  <p className="text-xs text-muted-foreground">
                    ✨ Your <strong className="text-foreground">Dashboard</strong>, <strong className="text-foreground">Tax Advisor</strong>,
                    {entityType === "individual" ? " Financial Advisor," : " Bookkeeper,"} and goals will be pre-filled and ready to use.
                  </p>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center gap-3 mt-7">
              {step > 0 && (
                <button onClick={back} disabled={saving}
                  className="h-11 px-4 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-accent transition-colors flex items-center gap-1.5">
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
              )}
              <button onClick={next} disabled={!canAdvance() || saving}
                className="flex-1 h-11 rounded-xl bg-gradient-to-r from-primary to-sky text-white text-sm font-semibold hover:brightness-105 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-md shadow-primary/25">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {currentStep === "review" ? "Build my dashboard" : "Continue"}
                {!saving && currentStep !== "review" && <ChevronRight className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <p className="text-center text-[10px] text-muted-foreground mt-4">
            Step {step + 1} of {steps.length} · You can change all of this later in Settings
          </p>
        </div>
      </div>
    </div>
  );
}

function ReviewRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-lg bg-accent/50">
      <Icon className="w-4 h-4 text-primary shrink-0" />
      <span className="text-xs text-muted-foreground flex-1">{label}</span>
      <span className="text-sm font-semibold capitalize">{value}</span>
    </div>
  );
}
