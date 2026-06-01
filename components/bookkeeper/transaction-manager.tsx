"use client";

import { useState } from "react";
import { Plus, Trash2, Check, X, Loader2, Link2 } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate, cn } from "@/lib/utils";

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  type: string;
  is_tax_deductible: boolean;
}

interface Category { id: string; name: string; type: string; }

export function TransactionManager({ userId, transactions: initial, categories }: {
  userId: string;
  transactions: Transaction[];
  categories: Category[];
}) {
  const [transactions, setTransactions] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    description: "",
    amount: "",
    category: categories.find(c => c.type === "expense")?.name || "Uncategorized",
    type: "expense",
    is_tax_deductible: false,
  });

  const handleAdd = async () => {
    if (!form.description || !form.amount) return;
    setSaving(true);
    const supabase = createClient();
    const amount = form.type === "expense" ? -Math.abs(Number(form.amount)) : Math.abs(Number(form.amount));
    const { data } = await supabase.from("transactions").insert({
      user_id: userId,
      date: form.date,
      description: form.description,
      amount,
      category: form.category,
      type: form.type,
      is_tax_deductible: form.is_tax_deductible,
    }).select().single();
    if (data) setTransactions(prev => [data, ...prev]);
    setForm({ date: new Date().toISOString().split("T")[0], description: "", amount: "", category: form.category, type: "expense", is_tax_deductible: false });
    setAdding(false);
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const supabase = createClient();
    await supabase.from("transactions").delete().eq("id", id);
    setTransactions(prev => prev.filter(t => t.id !== id));
  };

  const incomeCategories = categories.filter(c => c.type === "income");
  const expenseCategories = categories.filter(c => c.type === "expense");

  return (
    <div className="space-y-3">
      {/* Upload prompt */}
      {transactions.length === 0 && (
        <Link href="/dashboard/documents" className="flex items-center gap-2 p-3 rounded-lg border border-dashed border-border/60 text-xs text-muted-foreground hover:text-primary hover:border-primary/40 transition-all">
          <Link2 className="w-4 h-4" />
          Upload a bank statement to auto-import transactions
        </Link>
      )}

      {/* Transaction list */}
      <div className="space-y-1.5">
        {transactions.map(tx => (
          <div key={tx.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-accent/30 border border-border/40 group text-sm">
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{tx.description}</p>
              <p className="text-xs text-muted-foreground">{tx.category} · {formatDate(tx.date)}</p>
            </div>
            <span className={cn("font-semibold shrink-0 text-sm", tx.amount > 0 ? "text-green-400" : "text-red-400")}>
              {tx.amount > 0 ? "+" : ""}{formatCurrency(Math.abs(tx.amount))}
            </span>
            {tx.is_tax_deductible && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 shrink-0">tax</span>
            )}
            <button
              onClick={() => handleDelete(tx.id)}
              className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-red-400 transition-all shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Add form */}
      {adding ? (
        <div className="space-y-2 p-3 rounded-lg border border-border/60 bg-accent/20">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Type</label>
              <select
                value={form.type}
                onChange={e => {
                  const type = e.target.value;
                  const cat = type === "income" ? incomeCategories[0]?.name : expenseCategories[0]?.name;
                  setForm(p => ({ ...p, type, category: cat || p.category }));
                }}
                className="input-field text-xs mt-0.5"
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Date</label>
              <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className="input-field text-xs mt-0.5" />
            </div>
          </div>
          <input
            value={form.description}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            placeholder="Description"
            className="input-field text-xs"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={form.amount}
              onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
              placeholder="Amount"
              type="number"
              min="0"
              step="0.01"
              className="input-field text-xs"
            />
            <select
              value={form.category}
              onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
              className="input-field text-xs"
            >
              {(form.type === "income" ? incomeCategories : expenseCategories).map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_tax_deductible}
              onChange={e => setForm(p => ({ ...p, is_tax_deductible: e.target.checked }))}
              className="rounded"
            />
            Tax deductible
          </label>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={saving}
              className="flex-1 h-8 rounded-lg text-xs font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 flex items-center justify-center gap-1"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save
            </button>
            <button onClick={() => setAdding(false)} className="h-8 px-3 rounded-lg text-xs border border-border text-muted-foreground hover:bg-accent">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full h-8 rounded-lg text-xs border border-dashed border-border/60 hover:border-primary/40 text-muted-foreground hover:text-primary transition-all flex items-center justify-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> Add transaction
        </button>
      )}
    </div>
  );
}
