import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Settings } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { SettingsForm } from "@/components/settings/settings-form";

export default async function SettingsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [{ data: profile }, { data: financialProfile }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("financial_profiles").select("*").eq("user_id", user.id).single(),
  ]);

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <PageHeader
        title="Settings"
        description="Manage your profile and financial preferences"
        icon={<Settings className="w-5 h-5" />}
      />
      <SettingsForm userId={user.id} profile={profile} financialProfile={financialProfile} />
    </div>
  );
}
