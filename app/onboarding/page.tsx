import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

export const metadata = { title: "Get started — FinWise AI" };

export default async function OnboardingPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // Already onboarded → go to dashboard
  if (profile?.onboarding_completed) redirect("/dashboard");

  return <OnboardingWizard userId={user.id} userName={profile?.full_name || undefined} />;
}
