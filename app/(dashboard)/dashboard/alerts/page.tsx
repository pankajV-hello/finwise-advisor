import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Bell, CheckCircle, AlertTriangle, Info, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { formatDate } from "@/lib/utils";

const SEVERITY_ICONS = {
  info: Info,
  warning: AlertTriangle,
  success: CheckCircle,
  error: AlertTriangle,
};
const SEVERITY_COLORS = {
  info: "text-blue-600 bg-blue-400/10 border-blue-400/20",
  warning: "text-amber-500 bg-yellow-400/10 border-yellow-400/20",
  success: "text-green-600 bg-green-400/10 border-green-400/20",
  error: "text-red-500 bg-red-400/10 border-red-400/20",
};

export default async function AlertsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: alerts } = await supabase
    .from("alerts")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  // Mark all as read
  await supabase.from("alerts").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <PageHeader
        title="Alerts"
        description="Financial notifications, reminders, and AI-generated insights"
        icon={<Bell className="w-5 h-5" />}
      />

      {!alerts || alerts.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
          <h3 className="font-semibold mb-2">No alerts yet</h3>
          <p className="text-sm text-muted-foreground">
            Alerts will appear here when you hit goal milestones, budget thresholds, or tax deadlines.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => {
            const severity = (alert.severity || "info") as keyof typeof SEVERITY_COLORS;
            const Icon = SEVERITY_ICONS[severity] || Info;
            return (
              <div key={alert.id} className={`flex items-start gap-4 p-4 rounded-xl border ${SEVERITY_COLORS[severity]}`}>
                <Icon className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-sm">{alert.title}</p>
                  <p className="text-sm opacity-80 mt-0.5">{alert.message}</p>
                  <p className="text-xs opacity-60 mt-1">{formatDate(alert.created_at)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
