"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  TrendingUp,
  Home,
  BookOpen,
  Target,
  Bell,
  Settings,
  LogOut,
  Sparkles,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const navItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    description: "Financial overview",
  },
  {
    label: "Tax Advisor",
    href: "/dashboard/tax",
    icon: Receipt,
    description: "Tax planning & filing",
  },
  {
    label: "Financial Advice",
    href: "/dashboard/financial",
    icon: TrendingUp,
    description: "Investments & wealth",
  },
  {
    label: "Mortgage",
    href: "/dashboard/mortgage",
    icon: Home,
    description: "Mortgage calculator & advice",
  },
  {
    label: "Bookkeeper",
    href: "/dashboard/bookkeeper",
    icon: BookOpen,
    description: "Expenses & P&L",
  },
  {
    label: "Goals",
    href: "/dashboard/goals",
    icon: Target,
    description: "Financial goals",
  },
  {
    label: "Documents",
    href: "/dashboard/documents",
    icon: FileText,
    description: "Upload & bank connect",
  },
];

interface SidebarProps {
  userName?: string;
  userEmail?: string;
}

export function Sidebar({ userName, userEmail }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-60 flex flex-col border-r border-border bg-card/85 backdrop-blur-xl">
      {/* Logo */}
      <div className="px-5 pt-6 pb-5 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary via-primary to-sky flex items-center justify-center shadow-md shadow-primary/25">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="font-display font-bold text-base tracking-tight brand-gradient">
              FinWise AI
            </div>
            <div className="text-[10px] text-muted-foreground tracking-widest uppercase">
              Financial Advisor
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "sidebar-item",
                  isActive && "active"
                )}
              >
                <item.icon
                  className={cn(
                    "w-4 h-4 shrink-0",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                />
                <div className="flex-1 min-w-0">
                  <div className="truncate">{item.label}</div>
                  {isActive && (
                    <div className="text-[10px] text-muted-foreground truncate">
                      {item.description}
                    </div>
                  )}
                </div>
                {isActive && (
                  <div className="w-1 h-1 rounded-full bg-primary shrink-0" />
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Alerts */}
      <div className="px-3 py-2 border-t border-border/40 space-y-0.5">
        <Link href="/dashboard/alerts">
          <div className={cn("sidebar-item", pathname === "/dashboard/alerts" && "active")}>
            <Bell className="w-4 h-4 shrink-0" />
            <span>Alerts</span>
          </div>
        </Link>
        <Link href="/dashboard/settings">
          <div className={cn("sidebar-item", pathname === "/dashboard/settings" && "active")}>
            <Settings className="w-4 h-4 shrink-0" />
            <span>Settings</span>
          </div>
        </Link>
      </div>

      {/* User */}
      <div className="px-3 pb-4 pt-3 border-t border-border/40">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-sky border border-border flex items-center justify-center text-xs font-semibold text-white shrink-0">
            {(userName || userEmail || "U")[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium truncate">
              {userName || "User"}
            </div>
            <div className="text-[10px] text-muted-foreground truncate">
              {userEmail}
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
