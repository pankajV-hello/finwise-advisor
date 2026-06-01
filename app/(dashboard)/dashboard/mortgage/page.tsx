import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Home } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { AIChat } from "@/components/chat/ai-chat";
import { MortgageCalculator } from "@/components/mortgage/mortgage-calculator";

const MORTGAGE_SUGGESTIONS = [
  "Should I go fixed or variable rate right now?",
  "How much interest will I save with bi-weekly payments?",
  "What's the mortgage stress test and will I qualify?",
  "When should I break my mortgage to refinance?",
  "What's the Home Buyers' Plan (RRSP) and should I use it?",
  "How much can I prepay without penalty?",
];

export default async function MortgagePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: mortgages } = await supabase
    .from("mortgages")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at");

  const primaryMortgage = mortgages?.[0];

  const userContext = primaryMortgage
    ? {
        loanAmount: primaryMortgage.loan_amount,
        interestRate: (primaryMortgage.interest_rate * 100).toFixed(2) + "%",
        amortizationYears: primaryMortgage.amortization_years,
        paymentFrequency: primaryMortgage.payment_frequency,
        isVariableRate: primaryMortgage.is_variable_rate,
        lender: primaryMortgage.lender,
        startDate: primaryMortgage.start_date,
      }
    : { note: "No mortgage profile saved yet" };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Mortgage Advisor"
        description="Calculate payments, compare rates, model prepayments, and get refinancing guidance"
        icon={<Home className="w-5 h-5" />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 h-[calc(100vh-200px)]">
        {/* Left: Calculator */}
        <div className="lg:col-span-2 overflow-y-auto">
          <div className="glass-card p-5">
            <h2 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <Home className="w-4 h-4 text-blue-400" /> Mortgage Calculator
            </h2>
            <MortgageCalculator userId={user.id} existingMortgage={primaryMortgage} />
          </div>
        </div>

        {/* Right: AI Chat */}
        <div className="lg:col-span-3 glass-card overflow-hidden flex flex-col">
          <div className="px-4 pt-4 pb-2 border-b border-border/40 flex items-center gap-2">
            <Home className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-semibold">Mortgage Advisor AI</span>
            <span className="text-xs text-muted-foreground ml-auto">Canadian mortgage specialist</span>
          </div>
          <div className="flex-1 overflow-hidden">
            <AIChat
              agent="mortgage"
              placeholder="Ask about rates, amortization, refinancing, FHSA…"
              suggestedQuestions={MORTGAGE_SUGGESTIONS}
              userContext={userContext}
              initialMessage={`Hello! I'm your FinWise Mortgage Advisor. I specialize in Canadian mortgage financing.\n\nI can help you:\n- **Calculate payments** — monthly, bi-weekly, accelerated bi-weekly comparisons\n- **Build amortization schedules** — see exactly where each payment goes\n- **Compare fixed vs variable** — with current rate environment analysis\n- **Model prepayments** — how extra payments shorten your amortization\n- **Refinancing analysis** — break-even calculations, IRD penalties\n- **First-time buyer programs** — FHSA, Home Buyers' Plan, First Home Savings\n\n${primaryMortgage ? `I can see you have a mortgage on file for **${primaryMortgage.property_name}**. Want me to run scenarios on it?` : "Enter your mortgage details in the calculator to get personalized analysis."}`}
              className="h-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
