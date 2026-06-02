"use client";

import { useState } from "react";
import { Plus, Trash2, TrendingUp, TrendingDown, Loader2, Edit2, Check, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, cn } from "@/lib/utils";

interface Account {
  id: string;
  name: string;
  type: string;
  institution?: string;
  balance: number;
  is_asset: boolean;
  interest_rate?: number;
}

const ACCOUNT_TYPES = [
  { value: "checking", label: "Chequing" },
  { value: "savings", label: "Savings / HISA" },
  { value: "rrsp", label: "RRSP" },
  { value: "tfsa", label: "TFSA" },
  { value: "fhsa", label: "FHSA" },
  { value: "investment", label: "Investment (non-reg)" },
  { value: "crypto", label: "Crypto" },
  { value: "real_estate", label: "Real Estate" },
  { value: "credit_card", label: "Credit Card" },
  { value: "loan", label: "Personal Loan" },
  { value: "mortgage", label: "Mortgage" },
  { value: "other", label: "Other" },
];

const DEBT_TYPES = ["credit_card", "loan", "mortgage"];

export function AccountsManager({ userId, accounts: initialAccounts }: { userId: string; accounts: Account[] }) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newAccount, setNewAccount] = useState({ name: "", type: "savings", institution: "", balance: "", interest_rate: "" });

  const isDebt = (type: string) => DEBT_TYPES.includes(type);

  const handleAdd = async () => {
    if (!newAccount.name || !newAccount.balance) return;
    setSaving(true);
    const supabase = createClient();
    const data = {
      user_id: userId,
      name: newAccount.name,
      type: newAccount.type,
      institution: newAccount.institution || null,
      balance: Number(newAccount.balance),
      is_asset: !isDebt(newAccount.type),
      interest_rate: newAccount.interest_rate ? Number(newAccount.interest_rate) / 100 : null,
    };
    const { data: created } = await supabase.from("accounts").insert(data).select().single();
    if (created) setAccounts(prev => [...prev, created]);
    setNewAccount({ name: "", type: "savings", institution: "", balance: "", interest_rate: "" });
    setAdding(false);
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const supabase = createClient();
    await supabase.from("accounts").delete().eq("id", id);
    setAccounts(prev => prev.filter(a => a.id !== id));
  };

  const assets = accounts.filter(a => a.is_asset);
  const liabilities = accounts.filter(a => !a.is_asset);

  const renderGroup = (list: Account[], label: string, isAsset: boolean) => (
    <div>
      <p className={cn("text-xs font-semibold uppercase tracking-wider mb-2", isAsset ? "text-green-600" : "text-red-500")}>
        {isAsset ? <TrendingUp className="inline w-3.5 h-3.5 mr-1" /> : <TrendingDown className="inline w-3.5 h-3.5 mr-1" />}
        {label}
      </p>
      {list.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">None added yet</p>
      ) : (
        <div className="space-y-2">
          {list.map(acc => (
            <div key={acc.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-accent/40 border border-border/50 group">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{acc.name}</p>
                <p className="text-xs text-muted-foreground">{ACCOUNT_TYPES.find(t => t.value === acc.type)?.label || acc.type}</p>
              </div>
              <span className={cn("text-sm font-semibold shrink-0", isAsset ? "text-green-600" : "text-red-500")}>
                {formatCurrency(acc.balance)}
              </span>
              <button
                onClick={() => handleDelete(acc.id)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-red-500 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      {renderGroup(assets, "Assets", true)}
      {renderGroup(liabilities, "Liabilities", false)}

      {/* Add form */}
      {adding ? (
        <div className="space-y-2.5 p-3 rounded-lg border border-border/60 bg-accent/30">
          <input
            value={newAccount.name}
            onChange={e => setNewAccount(p => ({ ...p, name: e.target.value }))}
            placeholder="Account name (e.g. TD TFSA)"
            className="input-field text-sm"
          />
          <select
            value={newAccount.type}
            onChange={e => setNewAccount(p => ({ ...p, type: e.target.value }))}
            className="input-field text-sm"
          >
            {ACCOUNT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={newAccount.balance}
              onChange={e => setNewAccount(p => ({ ...p, balance: e.target.value }))}
              placeholder="Balance ($)"
              type="number"
              className="input-field text-sm"
            />
            <input
              value={newAccount.institution}
              onChange={e => setNewAccount(p => ({ ...p, institution: e.target.value }))}
              placeholder="Institution"
              className="input-field text-sm"
            />
          </div>
          {isDebt(newAccount.type) && (
            <input
              value={newAccount.interest_rate}
              onChange={e => setNewAccount(p => ({ ...p, interest_rate: e.target.value }))}
              placeholder="Interest rate (% e.g. 5.25)"
              type="number"
              step="0.01"
              className="input-field text-sm"
            />
          )}
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={saving}
              className="flex-1 h-8 rounded-lg text-xs font-medium bg-primary/15 text-primary border border-primary/25 hover:bg-primary/25 transition-colors flex items-center justify-center gap-1"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Save
            </button>
            <button
              onClick={() => setAdding(false)}
              className="h-8 px-3 rounded-lg text-xs text-muted-foreground hover:text-foreground border border-border hover:bg-accent transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full h-9 rounded-lg text-sm border border-dashed border-border/60 hover:border-primary/40 text-muted-foreground hover:text-primary transition-all flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add account
        </button>
      )}
    </div>
  );
}
