import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  TrendingUp, TrendingDown, Receipt, Home, BookOpen,
  Target, Bell, ArrowRight, Sparkles, FileText, AlertTriangle
} from "lucide-react";
import { formatCurrency, calculateNetWorth, getFinancialHealthScore } from "@/lib/utils";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [
    { data: profile },
    { data: financialProfile },
    { data: accounts },
    { data: goals },
    { data: alerts },
    { data: recentTx },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("financial_profiles").select("*").eq("user_id", user.id).single(),
    supabase.from("accounts").select("*").eq("user_id", user.id),
    supabase.from("goals").select("*").eq("user_id", user.id).eq("status", "active").order("priority"),
    supabase.from("alerts").select("*").eq("user_id", user.id).eq("is_read", false).order("created_at", { ascending: false }).limit(3),
    supabase.from("transactions").select("*").eq("user_id", user.id).order("date", { ascending: false }).limit(5),
  ]);

  const netWorthData = accounts ? calculateNetWorth(accounts) : { assets: 0, liabilities: 0, netWorth: 0 };

  const healthScore = getFinancialHealthScore({
    emergencyFundMonths: financialProfile?.emergency_fund_months || 0,
    debtToIncome: financialProfile?.annual_income
      ? (netWorthData.liabilities / 12) / (financialProfile.annual_income / 12)
      : 0,
    savingsRate: 0.12,
    hasInsurance: false,
    hasWill: false,
    investmentDiversified: (accounts?.length || 0) > 2,
  });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = profile?.full_name?.split(" ")[0] || "there";

  const quickLinks = [
    { href: "/dashboard/tax", icon: Receipt, label: "Tax Advisor", color: "text-amber-500", bg: "bg-yellow-400/10 border-yellow-400/20", desc: "Plan your 2024 return" },
    { href: "/dashboard/financial", icon: TrendingUp, label: "Financial Advice", color: "text-green-600", bg: "bg-green-400/10 border-green-400/20", desc: "Investment guidance" },
    { href: "/dashboard/mortgage", icon: Home, label: "Mortgage", color: "text-blue-600", bg: "bg-blue-400/10 border-blue-400/20", desc: "Calculate payments" },
    { href: "/dashboard/bookkeeper", icon: BookOpen, label: "Bookkeeper", color: "text-purple-600", bg: "bg-purple-400/10 border-purple-400/20", desc: "Track expenses" },
    { href: "/dashboard/documents", icon: FileText, label: "Documents", color: "text-cyan-600", bg: "bg-cyan-400/10 border-cyan-400/20", desc: "Upload & analyze" },
    { href: "/dashboard/goals", icon: Target, label: "Goals", color: "text-orange-500", bg: "bg-orange-400/10 border-orange-400/20", desc: "Track progress" },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{greeting}, {firstName} 👋</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {new Date().toLocaleDateString("en-CA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        {(alerts?.length || 0) > 0 && (
          <Link href="/dashboard/alerts" className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-400/10 border border-yellow-400/20 text-amber-500 text-sm hover:bg-yellow-400/15 transition-colors">
            <Bell className="w-4 h-4" />
            {alerts!.length} alert{alerts!.length > 1 ? "s" : ""}
          </Link>
        )}
      </div>

      {/* Net Worth + Health Score */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-5 md:col-span-2">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Net Worth</p>
              <p className="text-3xl font-bold mt-1">{formatCurrency(netWorthData.netWorth)}</p>
            </div>
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-green-600" /> Total Assets
              </p>
              <p className="text-lg font-semibold text-green-600 mt-0.5">{formatCurrency(netWorthData.assets)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <TrendingDown className="w-3 h-3 text-red-500" /> Total Liabilities
              </p>
              <p className="text-lg font-semibold text-red-500 mt-0.5">{formatCurrency(netWorthData.liabilities)}</p>
            </div>
          </div>
          {accounts && accounts.length === 0 && (
            <Link href="/dashboard/bookkeeper" className="mt-4 flex items-center gap-2 text-xs text-primary hover:underline">
              <ArrowRight className="w-3.5 h-3.5" /> Add your accounts to track net worth
            </Link>
          )}
        </div>

        {/* Health Score */}
        <div className="glass-card p-5 flex flex-col items-center justify-center text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-3">Financial Health</p>
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center border-4 mb-3"
            style={{ borderColor: healthScore.color, boxShadow: `0 0 20px ${healthScore.color}30` }}
          >
            <div>
              <div className="text-2xl font-bold" style={{ color: healthScore.color }}>{healthScore.grade}</div>
              <div className="text-xs text-muted-foreground">{healthScore.score}/100</div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {healthScore.score >= 75 ? "Excellent shape!" : healthScore.score >= 55 ? "Good foundation" : "Room to grow"}
          </p>
        </div>
      </div>

      {/* Quick links */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Advisors</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {quickLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              <div className={`glass-card p-4 border hover:scale-[1.02] transition-all duration-200 cursor-pointer ${link.bg}`}>
                <link.icon className={`w-5 h-5 ${link.color} mb-2`} />
                <p className="text-sm font-semibold">{link.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{link.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Goals + Recent transactions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Goals */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" /> Goals
            </h2>
            <Link href="/dashboard/goals" className="text-xs text-primary hover:underline">Manage →</Link>
          </div>
          {goals && goals.length > 0 ? (
            <div className="space-y-4">
              {goals.slice(0, 3).map((goal) => {
                const pct = Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100));
                return (
                  <div key={goal.id}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{goal.name}</span>
                      <span className="text-muted-foreground">{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary to-sky transition-all duration-700"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>{formatCurrency(goal.current_amount)}</span>
                      <span>{formatCurrency(goal.target_amount)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6">
              <Target className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground mb-3">No goals yet</p>
              <Link href="/dashboard/goals" className="text-xs text-primary hover:underline">Set your first goal →</Link>
            </div>
          )}
        </div>

        {/* Recent transactions */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" /> Recent
            </h2>
            <Link href="/dashboard/bookkeeper" className="text-xs text-primary hover:underline">All →</Link>
          </div>
          {recentTx && recentTx.length > 0 ? (
            <div className="space-y-2.5">
              {recentTx.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{tx.description}</p>
                    <p className="text-xs text-muted-foreground">{tx.category}</p>
                  </div>
                  <span className={`text-sm font-semibold shrink-0 ml-2 ${tx.amount > 0 ? "text-green-600" : "text-red-500"}`}>
                    {tx.amount > 0 ? "+" : ""}{formatCurrency(Math.abs(tx.amount))}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <BookOpen className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground mb-3">No transactions yet</p>
              <Link href="/dashboard/documents" className="text-xs text-primary hover:underline">Upload a bank statement →</Link>
            </div>
          )}
        </div>
      </div>

      {/* Alerts */}
      {alerts && alerts.length > 0 && (
        <div className="glass-card p-5">
          <h2 className="font-semibold flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> Alerts
          </h2>
          <div className="space-y-2">
            {alerts.map((alert) => (
              <div key={alert.id} className="flex items-start gap-3 p-3 rounded-lg bg-yellow-400/5 border border-yellow-400/15">
                <Bell className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">{alert.title}</p>
                  <p className="text-xs text-muted-foreground">{alert.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
