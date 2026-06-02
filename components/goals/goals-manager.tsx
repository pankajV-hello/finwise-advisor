"use client";

import { useState } from "react";
import { Plus, Trash2, Check, X, Loader2, Target } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

interface Goal {
  id: string;
  name: string;
  type: string;
  target_amount: number;
  current_amount: number;
  target_date?: string;
  monthly_contribution?: number;
  priority: string;
  status: string;
}

const GOAL_TYPES = [
  { value: "retirement", label: "🎯 Retirement" },
  { value: "emergency", label: "🚨 Emergency Fund" },
  { value: "house", label: "🏠 Home Purchase" },
  { value: "vacation", label: "✈️ Vacation" },
  { value: "education", label: "🎓 Education" },
  { value: "debt_payoff", label: "💳 Debt Payoff" },
  { value: "car", label: "🚗 Car" },
  { value: "other", label: "💡 Other" },
];

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-yellow-500",
  low: "bg-green-500",
};

export function GoalsManager({ userId, goals: initial }: { userId: string; goals: Goal[] }) {
  const [goals, setGoals] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", type: "retirement", target_amount: "",
    current_amount: "", monthly_contribution: "",
    target_date: "", priority: "medium",
  });

  const handleAdd = async () => {
    if (!form.name || !form.target_amount) return;
    setSaving(true);
    const supabase = createClient();
    const { data } = await supabase.from("goals").insert({
      user_id: userId,
      name: form.name,
      type: form.type,
      target_amount: Number(form.target_amount),
      current_amount: Number(form.current_amount) || 0,
      monthly_contribution: Number(form.monthly_contribution) || 0,
      target_date: form.target_date || null,
      priority: form.priority,
      status: "active",
    }).select().single();
    if (data) setGoals(prev => [...prev, data]);
    setForm({ name: "", type: "retirement", target_amount: "", current_amount: "", monthly_contribution: "", target_date: "", priority: "medium" });
    setAdding(false);
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const supabase = createClient();
    await supabase.from("goals").delete().eq("id", id);
    setGoals(prev => prev.filter(g => g.id !== id));
  };

  const handleUpdateAmount = async (id: string, newAmount: number) => {
    const supabase = createClient();
    await supabase.from("goals").update({ current_amount: newAmount }).eq("id", id);
    setGoals(prev => prev.map(g => g.id === id ? { ...g, current_amount: newAmount } : g));
  };

  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-sm flex items-center gap-2">
        <Target className="w-4 h-4 text-primary" /> Financial Goals ({goals.length})
      </h2>

      {goals.length === 0 && !adding && (
        <div className="text-center py-8 text-muted-foreground">
          <Target className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No goals yet. Create your first one!</p>
        </div>
      )}

      {/* Goal cards */}
      <div className="space-y-3">
        {goals.map(goal => {
          const pct = Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100));
          const typeEmoji = GOAL_TYPES.find(t => t.value === goal.type)?.label.split(" ")[0] || "🎯";
          return (
            <div key={goal.id} className="p-3.5 rounded-xl bg-accent/40 border border-border/50 group">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{typeEmoji}</span>
                  <div>
                    <p className="text-sm font-semibold">{goal.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_COLORS[goal.priority] || "bg-muted"}`} />
                      <span className="text-xs text-muted-foreground capitalize">{goal.priority} priority</span>
                      {goal.target_date && (
                        <span className="text-xs text-muted-foreground">· {new Date(goal.target_date).getFullYear()}</span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(goal.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-red-500 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <Progress
                value={pct}
                className="h-1.5 mb-2"
                indicatorClassName="bg-gradient-to-r from-primary to-sky"
              />
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{formatCurrency(goal.current_amount)}</span>
                <span className="font-semibold text-primary">{pct}%</span>
                <span className="text-muted-foreground">{formatCurrency(goal.target_amount)}</span>
              </div>
              {goal.monthly_contribution && goal.monthly_contribution > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  +{formatCurrency(goal.monthly_contribution)}/mo contribution
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Add form */}
      {adding ? (
        <div className="space-y-2.5 p-3 rounded-xl border border-border/60 bg-accent/20">
          <input
            value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            placeholder="Goal name (e.g. House Down Payment)"
            className="input-field text-sm"
          />
          <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} className="input-field text-sm">
            {GOAL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Target ($)</label>
              <input type="number" value={form.target_amount} onChange={e => setForm(p => ({ ...p, target_amount: e.target.value }))} placeholder="0" className="input-field text-sm mt-0.5" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Saved so far ($)</label>
              <input type="number" value={form.current_amount} onChange={e => setForm(p => ({ ...p, current_amount: e.target.value }))} placeholder="0" className="input-field text-sm mt-0.5" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Monthly contribution</label>
              <input type="number" value={form.monthly_contribution} onChange={e => setForm(p => ({ ...p, monthly_contribution: e.target.value }))} placeholder="500" className="input-field text-sm mt-0.5" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Target date</label>
              <input type="date" value={form.target_date} onChange={e => setForm(p => ({ ...p, target_date: e.target.value }))} className="input-field text-sm mt-0.5" />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Priority</label>
            <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))} className="input-field text-sm mt-0.5">
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={saving} className="flex-1 h-9 rounded-lg text-sm font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 flex items-center justify-center gap-1.5">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Save Goal
            </button>
            <button onClick={() => setAdding(false)} className="h-9 px-3 rounded-lg text-sm border border-border text-muted-foreground hover:bg-accent">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="w-full h-9 rounded-lg text-sm border border-dashed border-border/60 hover:border-primary/40 text-muted-foreground hover:text-primary transition-all flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" /> Add goal
        </button>
      )}
    </div>
  );
}
