import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  // select("*") so a missing onboarding column (pre-migration) doesn't error
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // New users go through onboarding first (only if the column exists & is false)
  if (profile && profile.onboarding_completed === false) {
    redirect("/onboarding");
  }

  return (
    <div className="min-h-screen flex">
      <Sidebar
        userName={profile?.full_name || undefined}
        userEmail={profile?.email || user.email}
      />
      <main className="flex-1 ml-60 min-h-screen overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
