import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { BookOpen } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { AIChat } from "@/components/chat/ai-chat";
import { TransactionManager } from "@/components/bookkeeper/transaction-manager";
import { formatCurrency } from "@/lib/utils";

const BOOKKEEPER_SUGGESTIONS = [
  "What were my top 5 expense categories this month?",
  "Summarize my income vs expenses for the last 3 months",
  "Which expenses are tax deductible?",
  "What's my monthly savings rate?",
  "Am I spending too much on dining out?",
  "Create a P&L statement for my self-employment income",
];

export default async function BookkeeperPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];

  const [{ data: transactions }, { data: categories }] = await Promise.all([
    supabase.from("transactions").select("*").eq("user_id", user.id)
      .gte("date", firstOfMonth).order("date", { ascending: false }),
    supabase.from("categories").select("*").eq("user_id", user.id).order("type").order("name"),
  ]);

  // Calculate monthly totals
  const income = transactions?.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0) || 0;
  const expenses = transactions?.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0) || 0;
  const net = income - expenses;

  // Top categories
  const catMap: Record<string, number> = {};
  transactions?.filter(t => t.amount < 0).forEach(t => {
    catMap[t.category] = (catMap[t.category] || 0) + Math.abs(t.amount);
  });
  const topCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const userContext = {
    currentMonth: now.toLocaleString("en-CA", { month: "long", year: "numeric" }),
    monthlyIncome: income,
    monthlyExpenses: expenses,
    netCashflow: net,
    savingsRate: income > 0 ? ((net / income) * 100).toFixed(1) + "%" : "N/A",
    topExpenseCategories: topCats.map(([cat, amt]) => `${cat}: ${formatCurrency(amt)}`),
    transactionCount: transactions?.length || 0,
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title="AI Bookkeeper"
        description="Track income & expenses, generate P&L reports, and get bookkeeping guidance"
        icon={<BookOpen className="w-5 h-5" />}
      />

      {/* Monthly summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="stat-card">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Income</p>
          <p className="text-2xl font-bold text-green-400">{formatCurrency(income)}</p>
          <p className="text-xs text-muted-foreground mt-1">This month</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Expenses</p>
          <p className="text-2xl font-bold text-red-400">{formatCurrency(expenses)}</p>
          <p className="text-xs text-muted-foreground mt-1">This month</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Net</p>
          <p className={`text-2xl font-bold ${net >= 0 ? "text-green-400" : "text-red-400"}`}>{formatCurrency(net)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {income > 0 ? `${((net / income) * 100).toFixed(0)}% savings rate` : "Add income"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 h-[calc(100vh-320px)]">
        {/* Left: Transactions */}
        <div className="lg:col-span-2 glass-card p-5 overflow-hidden flex flex-col">
          <h2 className="font-semibold text-sm mb-4">Transactions</h2>
          <div className="flex-1 overflow-y-auto">
            <TransactionManager
              userId={user.id}
              transactions={transactions || []}
              categories={categories || []}
            />
          </div>
        </div>

        {/* Right: AI Chat */}
        <div className="lg:col-span-3 glass-card overflow-hidden flex flex-col">
          <div className="px-4 pt-4 pb-2 border-b border-border/40 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-semibold">AI Bookkeeper</span>
            <span className="text-xs text-muted-foreground ml-auto">P&L · Expenses · Tax</span>
          </div>
          <div className="flex-1 overflow-hidden">
            <AIChat
              agent="bookkeeper"
              placeholder="Ask for P&L, spending analysis, tax deductions…"
              suggestedQuestions={BOOKKEEPER_SUGGESTIONS}
              userContext={userContext}
              initialMessage={`Hello! I'm your FinWise AI Bookkeeper — your personal accountant.\n\nThis month so far:\n- **Income:** ${formatCurrency(income)}\n- **Expenses:** ${formatCurrency(expenses)}\n- **Net:** ${formatCurrency(net)} (${income > 0 ? ((net / income) * 100).toFixed(0) + "% savings rate" : "add income to calculate"})\n\nI can help you:\n- **Categorize transactions** and find errors\n- **Generate P&L statements** — monthly, quarterly, yearly\n- **Identify tax-deductible expenses** — business, medical, charitable\n- **Track HST/GST** for self-employed individuals\n- **Budget variance analysis** — where are you over/under?\n\nUpload a bank statement in the Documents section to auto-import transactions. What would you like to review?`}
              className="h-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
