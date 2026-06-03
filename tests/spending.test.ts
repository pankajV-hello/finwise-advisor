import { describe, it, expect } from "vitest";
import { analyzeSpending, type Txn } from "@/lib/insights/spending";

const month = (day: number) => `2026-05-${String(day).padStart(2, "0")}`;

describe("analyzeSpending — basics", () => {
  const txns: Txn[] = [
    { date: month(1), description: "Salary", amount: 8000, category: "Salary / PAYG" },
    { date: month(2), description: "Rent", amount: -2500, category: "Housing & Rent" },
    { date: month(5), description: "Woolworths", amount: -600, category: "Food & Groceries" },
    { date: month(8), description: "Uber Eats", amount: -200, category: "Dining Out" },
    { date: month(12), description: "Netflix", amount: -20, category: "Subscriptions" },
    { date: month(20), description: "Netflix", amount: -20, category: "Subscriptions" },
  ];

  it("computes income, spend, and net", () => {
    const r = analyzeSpending(txns);
    expect(r.monthlyIncome).toBe(8000);
    expect(r.monthlySpend).toBe(2500 + 600 + 200 + 20 + 20);
    expect(r.monthlyNet).toBe(r.monthlyIncome - r.monthlySpend);
  });

  it("ranks categories by spend", () => {
    const r = analyzeSpending(txns);
    expect(r.topCategories[0].category).toBe("Housing & Rent");
  });

  it("separates essential vs discretionary", () => {
    const r = analyzeSpending(txns);
    expect(r.essentialSpend).toBeGreaterThan(0); // rent + groceries
    expect(r.discretionarySpend).toBeGreaterThan(0); // dining + subs
  });

  it("detects recurring charges", () => {
    const r = analyzeSpending(txns);
    expect(r.recurring.some((x) => /netflix/i.test(x.description))).toBe(true);
  });
});

describe("analyzeSpending — flags", () => {
  it("alerts when spending exceeds income", () => {
    const txns: Txn[] = [
      { date: month(1), description: "Salary", amount: 3000, category: "Salary / PAYG" },
      { date: month(2), description: "Rent", amount: -3500, category: "Housing & Rent" },
    ];
    const r = analyzeSpending(txns);
    expect(r.flags.some((f) => f.severity === "alert" && /more than you earn/i.test(f.title))).toBe(true);
  });

  it("flags high housing spend over 30% of income", () => {
    const txns: Txn[] = [
      { date: month(1), description: "Salary", amount: 5000, category: "Salary / PAYG" },
      { date: month(2), description: "Rent", amount: -2500, category: "Housing & Rent" }, // 50%
    ];
    const r = analyzeSpending(txns);
    expect(r.flags.some((f) => /housing/i.test(f.title))).toBe(true);
  });

  it("celebrates a strong savings rate", () => {
    const txns: Txn[] = [
      { date: month(1), description: "Salary", amount: 8000, category: "Salary / PAYG" },
      { date: month(2), description: "Rent", amount: -1500, category: "Housing & Rent" },
    ];
    const r = analyzeSpending(txns);
    expect(r.savingsRate).toBeGreaterThan(0.2);
    expect(r.flags.some((f) => f.severity === "success")).toBe(true);
  });

  it("attaches an estimated monthly saving to actionable flags", () => {
    const txns: Txn[] = [
      { date: month(1), description: "Salary", amount: 5000, category: "Salary / PAYG" },
      { date: month(2), description: "Rent", amount: -2500, category: "Housing & Rent" },
    ];
    const r = analyzeSpending(txns);
    const housingFlag = r.flags.find((f) => /housing/i.test(f.title));
    expect(housingFlag?.monthlySaving).toBeGreaterThan(0);
  });
});

describe("analyzeSpending — edge cases", () => {
  it("handles empty transactions", () => {
    const r = analyzeSpending([]);
    expect(r.monthlySpend).toBe(0);
    expect(r.byCategory).toEqual([]);
  });

  it("uses an income override when provided", () => {
    const txns: Txn[] = [{ date: month(2), description: "Rent", amount: -2000, category: "Housing & Rent" }];
    const r = analyzeSpending(txns, 6000);
    expect(r.monthlyIncome).toBe(6000);
  });

  it("never returns a negative savings rate", () => {
    const txns: Txn[] = [
      { date: month(1), description: "Salary", amount: 1000, category: "Salary / PAYG" },
      { date: month(2), description: "Rent", amount: -5000, category: "Housing & Rent" },
    ];
    const r = analyzeSpending(txns);
    expect(r.savingsRate).toBeGreaterThanOrEqual(0);
  });
});
