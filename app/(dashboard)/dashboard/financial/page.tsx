import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TrendingUp, PlusCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { AIChat } from "@/components/chat/ai-chat";
import { AccountsManager } from "@/components/financial/accounts-manager";
import { formatCurrency, calculateNetWorth } from "@/lib/utils";

const FINANCIAL_SUGGESTIONS = [
  "How should I split my investments between RRSP and TFSA?",
  "What's the best ETF portfolio for a moderate risk investor?",
  "How much should I save monthly to retire at 60?",
  "Should I pay down my mortgage or invest the extra money?",
  "What's the 50/30/20 budgeting rule and does it apply to me?",
  "How do I start investing with $10,000?",
];

export default async function FinancialPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [{ data: accounts }, { data: financialProfile }] = await Promise.all([
    supabase.from("accounts").select("*").eq("user_id", user.id).order("is_asset", { ascending: false }),
    supabase.from("financial_profiles").select("*").eq("user_id", user.id).single(),
  ]);

  const nw = accounts ? calculateNetWorth(accounts) : { assets: 0, liabilities: 0, netWorth: 0 };

  const userContext = {
    annualIncome: financialProfile?.annual_income || 0,
    riskTolerance: financialProfile?.risk_tolerance || "moderate",
    employmentType: financialProfile?.employment_type || "employed",
    investmentGoals: financialProfile?.investment_goals || [],
    netWorth: nw.netWorth,
    totalAssets: nw.assets,
    totalLiabilities: nw.liabilities,
    accounts: accounts?.map(a => ({ name: a.name, type: a.type, balance: a.balance, isAsset: a.is_asset })) || [],
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Financial Advisor"
        description="Investment strategy, retirement planning, wealth building, and savings optimization"
        icon={<TrendingUp className="w-5 h-5" />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 h-[calc(100vh-200px)]">
        {/* Left: Accounts */}
        <div className="lg:col-span-2 space-y-4 overflow-y-auto">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="stat-card">
              <p className="text-xs text-muted-foreground">Net Worth</p>
              <p className="text-base font-bold">{formatCurrency(nw.netWorth)}</p>
            </div>
            <div className="stat-card">
              <p className="text-xs text-muted-foreground">Assets</p>
              <p className="text-base font-bold text-green-400">{formatCurrency(nw.assets)}</p>
            </div>
            <div className="stat-card">
              <p className="text-xs text-muted-foreground">Liabilities</p>
              <p className="text-base font-bold text-red-400">{formatCurrency(nw.liabilities)}</p>
            </div>
          </div>

          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" /> Accounts & Holdings
              </h2>
            </div>
            <AccountsManager userId={user.id} accounts={accounts || []} />
          </div>
        </div>

        {/* Right: AI Chat */}
        <div className="lg:col-span-3 glass-card overflow-hidden flex flex-col">
          <div className="px-4 pt-4 pb-2 border-b border-border/40 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-400" />
            <span className="text-sm font-semibold">Financial Advisor AI</span>
            <span className="text-xs text-muted-foreground ml-auto">CFP expertise</span>
          </div>
          <div className="flex-1 overflow-hidden">
            <AIChat
              agent="financial"
              placeholder="Ask about investments, RRSP, retirement, budgeting…"
              suggestedQuestions={FINANCIAL_SUGGESTIONS}
              userContext={userContext}
              initialMessage={`Hello! I'm your FinWise Financial Advisor — think of me as your personal CFP.\n\nI can help you with:\n- **Investment strategy** — RRSP vs TFSA, ETF selection, asset allocation\n- **Retirement planning** — CPP/OAS optimization, RRIF conversion, withdrawal strategies\n- **Wealth building** — compound growth, dollar-cost averaging, rebalancing\n- **Budgeting** — 50/30/20 framework, savings rate optimization\n- **Debt strategy** — avalanche vs snowball, consolidation, mortgage vs invest\n\nI've loaded your financial profile. What would you like to work on today?`}
              className="h-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
