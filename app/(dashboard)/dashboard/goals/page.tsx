import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Target } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { AIChat } from "@/components/chat/ai-chat";
import { GoalsManager } from "@/components/goals/goals-manager";

const GOALS_SUGGESTIONS = [
  "How much do I need to save monthly to buy a house in 3 years?",
  "What's a realistic retirement savings target for someone my age?",
  "How do I build a 6-month emergency fund faster?",
  "Should I prioritize debt payoff or investing?",
  "What's the best account for a vacation savings goal?",
];

export default async function GoalsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [{ data: goals }, { data: financialProfile }] = await Promise.all([
    supabase.from("goals").select("*").eq("user_id", user.id).order("priority").order("created_at"),
    supabase.from("financial_profiles").select("annual_income, monthly_expenses").eq("user_id", user.id).single(),
  ]);

  const userContext = {
    goals: goals?.map(g => ({
      name: g.name, type: g.type, target: g.target_amount,
      current: g.current_amount, targetDate: g.target_date, status: g.status,
    })) || [],
    monthlyIncome: financialProfile?.annual_income ? financialProfile.annual_income / 12 : 0,
    monthlyExpenses: financialProfile?.monthly_expenses || 0,
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Financial Goals"
        description="Set, track, and achieve your financial goals with AI guidance"
        icon={<Target className="w-5 h-5" />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 h-[calc(100vh-200px)]">
        <div className="lg:col-span-2 overflow-y-auto">
          <div className="glass-card p-5">
            <GoalsManager userId={user.id} goals={goals || []} />
          </div>
        </div>

        <div className="lg:col-span-3 glass-card overflow-hidden flex flex-col">
          <div className="px-4 pt-4 pb-2 border-b border-border/40 flex items-center gap-2">
            <Target className="w-4 h-4 text-orange-500" />
            <span className="text-sm font-semibold">Goals Advisor AI</span>
          </div>
          <div className="flex-1 overflow-hidden">
            <AIChat
              agent="general"
              placeholder="Ask about savings strategies, timelines, goal planning…"
              suggestedQuestions={GOALS_SUGGESTIONS}
              userContext={userContext}
              initialMessage={`Hello! I'm your FinWise Goals Advisor.\n\nI'll help you set realistic financial goals and build a plan to achieve them.\n\n${goals && goals.length > 0 ? `You currently have **${goals.length} active goal${goals.length > 1 ? "s" : ""}**. Let's review your progress and optimize your savings strategy.` : "You haven't set any goals yet. Let's start by identifying your top financial priorities."}\n\nCommon goals I help with:\n- 🏠 **Home purchase** — down payment planning\n- 🎓 **Education** — RESP, savings timeline\n- 🌴 **Retirement** — RRSP, TFSA, CPP optimization\n- 🚨 **Emergency fund** — 3-6 months of expenses\n- 💳 **Debt payoff** — avalanche vs snowball strategy\n\nWhat's your most important financial goal right now?`}
              className="h-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
