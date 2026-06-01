"use client";

import { useState } from "react";
import {
  Building2,
  Link2,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Loader2,
  ExternalLink,
  Unlink,
  ChevronRight,
  FileDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatDate } from "@/lib/utils";

// Popular Canadian & US banks for manual CSV export guide
const BANK_GUIDES = [
  {
    name: "TD Bank",
    country: "CA",
    logo: "TD",
    csvInstructions:
      "EasyWeb → Accounts → Download → CSV (Date Range)",
    color: "#3eb549",
  },
  {
    name: "RBC",
    country: "CA",
    logo: "RBC",
    csvInstructions: "Online Banking → Accounts → Download Transactions → CSV",
    color: "#006ac3",
  },
  {
    name: "Scotiabank",
    country: "CA",
    logo: "NS",
    csvInstructions:
      "Online Banking → Accounts → Transaction History → Export",
    color: "#ec1c2e",
  },
  {
    name: "BMO",
    country: "CA",
    logo: "BMO",
    csvInstructions: "Online Banking → Account Activity → Download",
    color: "#0075be",
  },
  {
    name: "CIBC",
    country: "CA",
    logo: "CIBC",
    csvInstructions: "Online Banking → Accounts → Download Transactions",
    color: "#c41f3e",
  },
  {
    name: "Chase",
    country: "US",
    logo: "JPM",
    csvInstructions: "Account Activity → Download Account Activity → CSV",
    color: "#117aca",
  },
  {
    name: "Bank of America",
    country: "US",
    logo: "BAC",
    csvInstructions: "Accounts → Download → CSV",
    color: "#e31837",
  },
  {
    name: "Wells Fargo",
    country: "US",
    logo: "WF",
    csvInstructions:
      "Account Activity → Download Account Activity → CSV",
    color: "#d71e28",
  },
];

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
}

export function BankConnect({
  connections = [],
  onConnectionAdded,
}: BankConnectProps) {
  const [activeTab, setActiveTab] = useState<"plaid" | "csv">("plaid");
  const [showGuide, setShowGuide] = useState<string | null>(null);
  const [connectingPlaid, setConnectingPlaid] = useState(false);

  const handlePlaidConnect = async () => {
    setConnectingPlaid(true);
    // In production: initialize Plaid Link, get link_token from /api/plaid/link-token
    // then open Plaid Link widget, exchange public_token for access_token
    // For now show an informational message
    setTimeout(() => {
      setConnectingPlaid(false);
      alert(
        "Plaid integration requires API keys. See SETUP.md for configuration instructions."
      );
    }, 1000);
  };

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-secondary rounded-lg w-fit">
        <button
          onClick={() => setActiveTab("plaid")}
          className={cn(
            "px-4 py-1.5 rounded-md text-xs font-medium transition-all",
            activeTab === "plaid"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Live Bank Feed
        </button>
        <button
          onClick={() => setActiveTab("csv")}
          className={cn(
            "px-4 py-1.5 rounded-md text-xs font-medium transition-all",
            activeTab === "csv"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          CSV Export Guide
        </button>
      </div>

      {/* Plaid tab */}
      {activeTab === "plaid" && (
        <div className="space-y-4">
          {/* Active connections */}
          {connections.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Connected Accounts
              </p>
              {connections.map((conn) => (
                <div
                  key={conn.id}
                  className="glass-card p-3 flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-lg bg-accent border border-border flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {conn.institution_name}
                    </p>
                    {conn.last_sync_at && (
                      <p className="text-xs text-muted-foreground">
                        Last synced {formatDate(conn.last_sync_at)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        conn.status === "active" ? "success" : "destructive"
                      }
                    >
                      {conn.status === "active" ? "Live" : "Error"}
                    </Badge>
                    <button className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                    <button className="p-1.5 rounded-lg hover:bg-accent text-red-400 hover:text-red-300 transition-colors">
                      <Unlink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Connect button */}
          <div className="glass-card p-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto">
              <Link2 className="w-7 h-7 text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold">Connect Your Bank</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
                Securely link your bank accounts via Plaid for automatic
                transaction sync. Works with 12,000+ banks in Canada & US.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center text-[10px] text-muted-foreground">
              {["TD", "RBC", "Scotiabank", "BMO", "CIBC", "Chase", "BofA", "+more"].map(
                (b) => (
                  <span
                    key={b}
                    className="px-2 py-0.5 rounded-full bg-secondary border border-border/60"
                  >
                    {b}
                  </span>
                )
              )}
            </div>
            <Button
              variant="gold"
              onClick={handlePlaidConnect}
              disabled={connectingPlaid}
              className="w-full max-w-xs mx-auto"
            >
              {connectingPlaid ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Link2 className="w-4 h-4 mr-2" />
              )}
              Connect Bank Account
            </Button>
            <div className="flex items-center justify-center gap-4 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-green-400" />
                256-bit encryption
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-green-400" />
                Read-only access
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-green-400" />
                Powered by Plaid
              </span>
            </div>
          </div>
        </div>
      )}

      {/* CSV guide tab */}
      {activeTab === "csv" && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Download a CSV from your bank, then upload it above. FinWise AI
            will automatically extract and categorize all transactions.
          </p>
          <div className="grid grid-cols-1 gap-2">
            {BANK_GUIDES.map((bank) => (
              <div key={bank.name} className="glass-card overflow-hidden">
                <button
                  onClick={() =>
                    setShowGuide(showGuide === bank.name ? null : bank.name)
                  }
                  className="w-full flex items-center gap-3 p-3 hover:bg-accent/30 transition-colors text-left"
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                    style={{ backgroundColor: bank.color }}
                  >
                    {bank.logo}
                  </div>
                  <div className="flex-1">
                    <span className="text-sm font-medium">{bank.name}</span>
                    <Badge variant="secondary" className="ml-2 text-[9px]">
                      {bank.country}
                    </Badge>
                  </div>
                  <ChevronRight
                    className={cn(
                      "w-4 h-4 text-muted-foreground transition-transform",
                      showGuide === bank.name && "rotate-90"
                    )}
                  />
                </button>
                {showGuide === bank.name && (
                  <div className="px-4 pb-3 pt-1 border-t border-border/40">
                    <div className="flex items-start gap-2">
                      <FileDown className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <p className="text-xs text-muted-foreground">
                        {bank.csvInstructions}
                      </p>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2">
                      Then drag & drop the downloaded CSV file in the upload
                      area above.
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
