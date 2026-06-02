"use client";

import { useState } from "react";
import {
  Building2, Link2, RefreshCw, CheckCircle, Loader2,
  Unlink, ChevronRight, FileDown, Globe,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn, formatDate } from "@/lib/utils";

// ─── Bank data by country ────────────────────────────────────────────────────
const BANKS = {
  AU: [
    { name: "Commonwealth Bank", short: "CBA", color: "#ffd200", textColor: "#000",
      csv: "NetBank → Accounts → View Transactions → Export (choose date range) → CSV" },
    { name: "ANZ", short: "ANZ", color: "#007dba", textColor: "#fff",
      csv: "ANZ Internet Banking → Accounts → Export Transactions → CSV" },
    { name: "NAB", short: "NAB", color: "#e03e0e", textColor: "#fff",
      csv: "NAB Internet Banking → Accounts → Download Transactions → CSV" },
    { name: "Westpac", short: "WBC", color: "#d5002b", textColor: "#fff",
      csv: "Westpac Online Banking → Accounts → Transaction History → Export → CSV" },
    { name: "Macquarie", short: "MQG", color: "#000000", textColor: "#fff",
      csv: "Macquarie Online → Accounts → Download → CSV" },
    { name: "ING Australia", short: "ING", color: "#ff6200", textColor: "#fff",
      csv: "ING Online → Accounts → Statements → Download CSV" },
    { name: "Bendigo Bank", short: "BEN", color: "#e31837", textColor: "#fff",
      csv: "e-banking → Accounts → Transaction History → Export CSV" },
    { name: "St. George", short: "STG", color: "#007b40", textColor: "#fff",
      csv: "Internet Banking → Accounts → Transaction History → Export CSV" },
  ],
  NZ: [
    { name: "ANZ New Zealand", short: "ANZ", color: "#007dba", textColor: "#fff",
      csv: "ANZ Internet Banking → Accounts → Download Transactions → CSV" },
    { name: "ASB", short: "ASB", color: "#e31837", textColor: "#fff",
      csv: "FastNet Classic → Accounts → Export Transactions → CSV" },
    { name: "BNZ", short: "BNZ", color: "#e31837", textColor: "#fff",
      csv: "BNZ Internet Banking → Accounts → Download Transactions → CSV" },
    { name: "Westpac NZ", short: "WBC", color: "#d5002b", textColor: "#fff",
      csv: "Westpac One → Accounts → Statement → Export → CSV" },
    { name: "Kiwibank", short: "KWB", color: "#00a550", textColor: "#fff",
      csv: "Kiwibank Online → Accounts → Export Transactions → CSV" },
    { name: "TSB", short: "TSB", color: "#00408a", textColor: "#fff",
      csv: "TSB Online → Accounts → Transaction History → Export CSV" },
    { name: "Heartland", short: "HBL", color: "#f7941d", textColor: "#fff",
      csv: "Heartland Online → Accounts → Export → CSV" },
    { name: "The Co-operative Bank", short: "COB", color: "#00843d", textColor: "#fff",
      csv: "Online Banking → Accounts → Export Transactions → CSV" },
  ],
  CA: [
    { name: "TD Bank", short: "TD", color: "#3eb549", textColor: "#fff",
      csv: "EasyWeb → Accounts → Download → CSV (select date range)" },
    { name: "RBC", short: "RBC", color: "#006ac3", textColor: "#fff",
      csv: "Online Banking → Accounts → Download Transactions → CSV" },
    { name: "Scotiabank", short: "NS", color: "#ec1c2e", textColor: "#fff",
      csv: "Online Banking → Account History → Export" },
    { name: "BMO", short: "BMO", color: "#0075be", textColor: "#fff",
      csv: "Online Banking → Account Activity → Download" },
    { name: "CIBC", short: "CIBC", color: "#c41f3e", textColor: "#fff",
      csv: "Online Banking → Accounts → Download Transactions" },
  ],
  US: [
    { name: "Chase", short: "JPM", color: "#117aca", textColor: "#fff",
      csv: "Account Activity → Download Account Activity → CSV" },
    { name: "Bank of America", short: "BAC", color: "#e31837", textColor: "#fff",
      csv: "Accounts → Download → CSV" },
    { name: "Wells Fargo", short: "WF", color: "#d71e28", textColor: "#fff",
      csv: "Account Activity → Download Account Activity → CSV" },
    { name: "Citi", short: "C", color: "#003b8e", textColor: "#fff",
      csv: "Account Activity → Download → CSV" },
  ],
};

// ─── Open banking providers by country ───────────────────────────────────────
const OPEN_BANKING = {
  AU: {
    provider: "Basiq",
    description: "Australia's leading open banking platform. Connects to 180+ financial institutions via CDR (Consumer Data Right).",
    banks: "CommBank, ANZ, NAB, Westpac + 176 more",
    setupUrl: "https://basiq.io",
    free: "Free tier available",
    color: "#6366f1",
  },
  NZ: {
    provider: "Akahu",
    description: "New Zealand's open finance platform. Secure read-only access to your NZ bank accounts.",
    banks: "ANZ, ASB, BNZ, Westpac NZ, Kiwibank + more",
    setupUrl: "https://akahu.nz",
    free: "Free for personal use",
    color: "#10b981",
  },
  CA: {
    provider: "Plaid",
    description: "Connects to 12,000+ financial institutions across Canada and the US.",
    banks: "TD, RBC, Scotiabank, BMO, CIBC + more",
    setupUrl: "https://plaid.com",
    free: "Free sandbox tier",
    color: "#117aca",
  },
  US: {
    provider: "Plaid",
    description: "Connects to 12,000+ financial institutions across the US and Canada.",
    banks: "Chase, BofA, Wells Fargo, Citi + more",
    setupUrl: "https://plaid.com",
    free: "Free sandbox tier",
    color: "#117aca",
  },
};

type Country = "AU" | "NZ" | "CA" | "US";

interface BankConnection {
  id: string;
  institution_name: string;
  status: string;
  last_sync_at?: string;
  provider: string;
}

interface BankConnectProps {
  connections?: BankConnection[];
  onConnectionAdded?: () => void;
  defaultCountry?: Country;
}

export function BankConnect({ connections = [], defaultCountry = "AU" }: BankConnectProps) {
  const [activeTab, setActiveTab] = useState<"live" | "csv">("live");
  const [country, setCountry] = useState<Country>(defaultCountry);
  const [showGuide, setShowGuide] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const ob = OPEN_BANKING[country];
  const banks = BANKS[country] || [];

  const handleLiveConnect = async () => {
    setConnecting(true);
    setTimeout(() => {
      setConnecting(false);
      alert(
        `${ob.provider} integration requires API keys.\n\n` +
        `Sign up at ${ob.setupUrl} to get your keys, then add them to .env.local:\n\n` +
        (country === "AU"
          ? "BASIQ_API_KEY=your_key\nBASIQ_ENV=sandbox"
          : country === "NZ"
          ? "AKAHU_APP_TOKEN=your_token\nAKAHU_USER_TOKEN=your_token"
          : "PLAID_CLIENT_ID=your_id\nPLAID_SECRET=your_secret")
      );
    }, 800);
  };

  const countryFlags: Record<Country, string> = { AU: "🇦🇺", NZ: "🇳🇿", CA: "🇨🇦", US: "🇺🇸" };

  return (
    <div className="space-y-4">
      {/* Country selector */}
      <div className="flex gap-1.5 flex-wrap">
        {(["AU", "NZ", "CA", "US"] as Country[]).map((c) => (
          <button
            key={c}
            onClick={() => setCountry(c)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
              country === c
                ? "bg-primary/10 border-primary/30 text-primary"
                : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground"
            )}
          >
            {countryFlags[c]} {c}
          </button>
        ))}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-secondary rounded-lg w-fit">
        {[
          { id: "live", label: "🔴 Live Feed" },
          { id: "csv", label: "📄 CSV Import" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as "live" | "csv")}
            className={cn(
              "px-4 py-1.5 rounded-md text-xs font-medium transition-all",
              activeTab === tab.id
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Live feed tab */}
      {activeTab === "live" && (
        <div className="space-y-4">
          {/* Active connections */}
          {connections.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Connected</p>
              {connections.map((conn) => (
                <div key={conn.id} className="glass-card p-3 flex items-center gap-3">
                  <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{conn.institution_name}</p>
                    {conn.last_sync_at && (
                      <p className="text-xs text-muted-foreground">Last synced {formatDate(conn.last_sync_at)}</p>
                    )}
                  </div>
                  <Badge variant={conn.status === "active" ? "success" : "destructive"}>
                    {conn.status === "active" ? "Live" : "Error"}
                  </Badge>
                  <button className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                  <button className="p-1.5 rounded-lg hover:bg-accent text-red-400 hover:text-red-300 transition-colors">
                    <Unlink className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Provider card */}
          <div className="glass-card p-6 text-center space-y-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto text-white text-lg font-bold"
              style={{ background: ob.color, boxShadow: `0 8px 24px ${ob.color}40` }}
            >
              {ob.provider[0]}
            </div>
            <div>
              <h3 className="font-semibold">{ob.provider}</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">{ob.description}</p>
            </div>
            <p className="text-xs text-muted-foreground">{ob.banks}</p>

            <div className="flex flex-wrap gap-2 justify-center">
              <span className="text-xs px-2 py-1 rounded-full bg-secondary border border-border/60 text-muted-foreground">
                {ob.free}
              </span>
              <span className="text-xs px-2 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400">
                Read-only access
              </span>
              <span className="text-xs px-2 py-1 rounded-full bg-secondary border border-border/60 text-muted-foreground">
                256-bit encryption
              </span>
            </div>

            <button
              onClick={handleLiveConnect}
              disabled={connecting}
              className="w-full max-w-xs mx-auto h-10 rounded-lg font-semibold text-sm text-navy-950 bg-gradient-to-r from-gold-dark via-gold to-gold-light hover:brightness-110 disabled:opacity-60 transition-all flex items-center justify-center gap-2 shadow-md shadow-gold/20"
            >
              {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
              Connect via {ob.provider}
            </button>
          </div>
        </div>
      )}

      {/* CSV guide tab */}
      {activeTab === "csv" && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Download a CSV from your bank, then upload it in the <strong className="text-foreground">Upload Documents</strong> area above.
            FinWise AI will auto-extract and categorize every transaction.
          </p>
          <div className="space-y-1.5">
            {banks.map((bank) => (
              <div key={bank.name} className="border border-border/60 rounded-xl overflow-hidden">
                <button
                  onClick={() => setShowGuide(showGuide === bank.name ? null : bank.name)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-accent/30 transition-colors text-left"
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0"
                    style={{ backgroundColor: bank.color, color: bank.textColor }}
                  >
                    {bank.short}
                  </div>
                  <span className="text-sm font-medium flex-1">{bank.name}</span>
                  <ChevronRight className={cn(
                    "w-4 h-4 text-muted-foreground transition-transform shrink-0",
                    showGuide === bank.name && "rotate-90"
                  )} />
                </button>
                {showGuide === bank.name && (
                  <div className="px-4 pb-3 pt-1 border-t border-border/40 bg-accent/10">
                    <div className="flex items-start gap-2">
                      <FileDown className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <p className="text-xs text-muted-foreground">{bank.csv}</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2 ml-6">
                      Then drag & drop the CSV file in the upload area above — transactions import automatically.
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs text-muted-foreground">
            <Globe className="w-3.5 h-3.5 text-primary inline mr-1.5" />
            Don't see your bank? Upload your PDF or CSV statement anyway — FinWise AI reads any format.
          </div>
        </div>
      )}
    </div>
  );
}
