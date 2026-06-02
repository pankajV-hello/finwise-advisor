import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Receipt, Plus, FileText } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { AIChat } from "@/components/chat/ai-chat";
import { TaxProfileForm } from "@/components/tax/tax-profile-form";
import { AdviceWarning } from "@/components/legal/advice-warning";
import { formatCurrency } from "@/lib/utils";

const TAX_SUGGESTIONS = [
  "What RRSP deductions can I claim for 2024?",
  "How do I report freelance income on my T1?",
  "What's the capital gains inclusion rate in Canada?",
  "Can I claim home office expenses working remotely?",
  "What medical expenses are tax deductible?",
  "How does the TFSA differ from RRSP for tax purposes?",
];

export default async function TaxPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [{ data: taxProfile }, { data: financialProfile }, { data: profile }] = await Promise.all([
    supabase.from("tax_profiles").select("*").eq("user_id", user.id).eq("tax_year", new Date().getFullYear() - 1).single(),
    supabase.from("financial_profiles").select("*").eq("user_id", user.id).single(),
    supabase.from("profiles").select("country").eq("id", user.id).single(),
  ]);

  const userContext = {
    country: profile?.country || "CA",
    taxYear: new Date().getFullYear() - 1,
    employmentIncome: taxProfile?.employment_income || financialProfile?.annual_income || 0,
    selfEmploymentIncome: taxProfile?.self_employment_income || 0,
    rrspContributions: taxProfile?.rrsp_contributions || 0,
    rrspRoom: taxProfile?.rrsp_room || 0,
    tfsaRoom: taxProfile?.tfsa_room || 0,
    filingStatus: taxProfile?.filing_status || "not_filed",
    charitableDonations: taxProfile?.charitable_donations || 0,
    medicalExpenses: taxProfile?.medical_expenses || 0,
    homeOfficeExpenses: taxProfile?.home_office_expenses || 0,
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Tax Advisor"
        description="AI-powered Canadian & US tax planning, deductions, and filing guidance"
        icon={<Receipt className="w-5 h-5" />}
      />

      <AdviceWarning country={profile?.country || "AU"} className="mb-4" />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 h-[calc(100vh-200px)]">
        {/* Left: Tax profile form + summary */}
        <div className="lg:col-span-2 space-y-4 overflow-y-auto">
          {/* Quick stats */}
          {taxProfile && (
            <div className="grid grid-cols-2 gap-3">
              <div className="stat-card">
                <p className="text-xs text-muted-foreground">Total Income</p>
                <p className="text-lg font-bold text-foreground">
                  {formatCurrency((taxProfile.employment_income || 0) + (taxProfile.self_employment_income || 0) + (taxProfile.investment_income || 0))}
                </p>
              </div>
              <div className="stat-card">
                <p className="text-xs text-muted-foreground">RRSP Contributions</p>
                <p className="text-lg font-bold text-green-600">
                  {formatCurrency(taxProfile.rrsp_contributions || 0)}
                </p>
              </div>
              <div className="stat-card">
                <p className="text-xs text-muted-foreground">Est. Refund</p>
                <p className="text-lg font-bold text-primary">
                  {taxProfile.expected_refund ? formatCurrency(taxProfile.expected_refund) : "—"}
                </p>
              </div>
              <div className="stat-card">
                <p className="text-xs text-muted-foreground">Filing Status</p>
                <p className="text-sm font-semibold capitalize mt-1">{taxProfile.filing_status?.replace("_", " ") || "Not filed"}</p>
              </div>
            </div>
          )}

          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-sm">Tax Year {new Date().getFullYear() - 1} Profile</h2>
            </div>
            <TaxProfileForm
              userId={user.id}
              existingProfile={taxProfile}
              taxYear={new Date().getFullYear() - 1}
            />
          </div>
        </div>

        {/* Right: AI Chat */}
        <div className="lg:col-span-3 glass-card overflow-hidden flex flex-col">
          <div className="px-4 pt-4 pb-2 border-b border-border/40 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-semibold">Tax Advisor AI</span>
            <span className="text-xs text-muted-foreground ml-auto">CRA & IRS expertise</span>
          </div>
          <div className="flex-1 overflow-hidden">
            <AIChat
              agent="tax"
              placeholder="Ask about deductions, RRSP, capital gains, T4, filing tips…"
              suggestedQuestions={TAX_SUGGESTIONS}
              userContext={userContext}
              initialMessage={`Hello! I'm your FinWise Tax Advisor. I specialize in Canadian (CRA) and US (IRS) tax planning.\n\nI can help you with:\n- **RRSP/TFSA optimization** — maximizing your contributions and deductions\n- **T4, T1, T2 guidance** — understanding your slips and forms\n- **Deductions you may have missed** — home office, medical, charitable donations\n- **Capital gains & investment income** — proper reporting and tax treatment\n- **Self-employment income** — business expenses and quarterly instalments\n\nWhat would you like help with for your ${new Date().getFullYear() - 1} return?`}
              className="h-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
