import { describe, it, expect } from "vitest";
import {
  formatCurrency,
  formatPercent,
  calculateMortgagePayment,
  generateAmortizationSchedule,
  calculateNetWorth,
  getFinancialHealthScore,
  computeSavingsRate,
} from "@/lib/utils";

describe("formatCurrency", () => {
  it("formats AUD by default", () => {
    expect(formatCurrency(156250)).toContain("156,250");
  });
  it("uses correct symbol per currency", () => {
    expect(formatCurrency(1000, "USD")).toContain("$");
    expect(formatCurrency(1000, "NZD")).toMatch(/\$|NZ/);
  });
  it("handles negatives and zero", () => {
    expect(formatCurrency(0)).toContain("0");
    expect(formatCurrency(-500)).toMatch(/-|\(/); // minus or parentheses
  });
  it("rounds to at most 2 decimals", () => {
    const out = formatCurrency(1234.5678);
    expect(out).toMatch(/1,234\.57/);
  });
});

describe("formatPercent", () => {
  it("formats with 1 decimal by default", () => {
    expect(formatPercent(5.25)).toBe("5.3%");
  });
  it("respects decimals arg", () => {
    expect(formatPercent(5.25, 2)).toBe("5.25%");
  });
});

describe("calculateMortgagePayment", () => {
  it("computes a known monthly payment (500k, 5.25%, 25yr)", () => {
    const { payment, totalInterest, totalPaid } = calculateMortgagePayment(500000, 0.0525, 25);
    // Standard amortization ≈ $2,994.96/mo
    expect(payment).toBeGreaterThan(2990);
    expect(payment).toBeLessThan(3000);
    expect(totalPaid).toBeCloseTo(payment * 300, 0);
    expect(totalInterest).toBeCloseTo(totalPaid - 500000, 0);
  });

  it("handles zero interest rate", () => {
    const { payment, totalInterest } = calculateMortgagePayment(120000, 0, 10);
    expect(payment).toBeCloseTo(1000, 5); // 120k / 120 months
    expect(totalInterest).toBe(0);
  });

  it("bi-weekly has more payments and less total interest than monthly", () => {
    const monthly = calculateMortgagePayment(400000, 0.05, 25, "monthly");
    const biweekly = calculateMortgagePayment(400000, 0.05, 25, "bi-weekly");
    // bi-weekly payment is roughly half the monthly
    expect(biweekly.payment).toBeLessThan(monthly.payment);
    // total interest over same amortization should be lower for more frequent compounding
    expect(biweekly.totalInterest).toBeLessThan(monthly.totalInterest);
  });

  it("returns positive finite numbers", () => {
    const r = calculateMortgagePayment(750000, 0.0599, 30);
    expect(Number.isFinite(r.payment)).toBe(true);
    expect(r.payment).toBeGreaterThan(0);
  });
});

describe("generateAmortizationSchedule", () => {
  it("pays the loan to (near) zero by the end", () => {
    const schedule = generateAmortizationSchedule(300000, 0.05, 25);
    const last = schedule[schedule.length - 1];
    expect(last.balance).toBeLessThan(1); // fully amortized
  });

  it("principal portion increases over time", () => {
    const schedule = generateAmortizationSchedule(300000, 0.05, 25);
    expect(schedule[schedule.length - 1].principal).toBeGreaterThan(schedule[0].principal);
  });

  it("interest portion decreases over time", () => {
    const schedule = generateAmortizationSchedule(300000, 0.05, 25);
    expect(schedule[schedule.length - 1].interest).toBeLessThan(schedule[0].interest);
  });

  it("sum of principal ≈ loan amount", () => {
    const principal = 300000;
    const schedule = generateAmortizationSchedule(principal, 0.05, 25);
    const totalPrincipal = schedule.reduce((s, r) => s + r.principal, 0);
    expect(totalPrincipal).toBeCloseTo(principal, -1); // within ~$10
  });
});

describe("calculateNetWorth", () => {
  it("subtracts liabilities from assets", () => {
    const r = calculateNetWorth([
      { balance: 100000, is_asset: true },
      { balance: 50000, is_asset: true },
      { balance: 30000, is_asset: false },
    ]);
    expect(r.assets).toBe(150000);
    expect(r.liabilities).toBe(30000);
    expect(r.netWorth).toBe(120000);
  });

  it("treats liability balances as positive magnitude", () => {
    const r = calculateNetWorth([
      { balance: 100000, is_asset: true },
      { balance: -20000, is_asset: false }, // stored negative
    ]);
    expect(r.liabilities).toBe(20000);
    expect(r.netWorth).toBe(80000);
  });

  it("handles empty list", () => {
    const r = calculateNetWorth([]);
    expect(r).toEqual({ assets: 0, liabilities: 0, netWorth: 0 });
  });
});

describe("computeSavingsRate", () => {
  it("computes from real income & expenses", () => {
    // 156,250/yr = ~13,020/mo; spend 8,000 → save ~5,020 → ~38.6%
    const r = computeSavingsRate(156250, 8000);
    expect(r).toBeGreaterThan(0.38);
    expect(r).toBeLessThan(0.39);
  });

  it("returns 0 when income unknown", () => {
    expect(computeSavingsRate(0, 2000)).toBe(0);
  });

  it("clamps to 0 when expenses exceed income", () => {
    expect(computeSavingsRate(60000, 9000)).toBe(0); // 5k/mo income, 9k spend
  });

  it("clamps to 1 max and handles zero expenses", () => {
    expect(computeSavingsRate(120000, 0)).toBe(1);
  });

  it("is not a hardcoded constant (varies with input)", () => {
    expect(computeSavingsRate(120000, 5000)).not.toBe(computeSavingsRate(120000, 2000));
  });
});

describe("getFinancialHealthScore", () => {
  it("awards A+ for excellent finances", () => {
    const r = getFinancialHealthScore({
      emergencyFundMonths: 6,
      debtToIncome: 0.1,
      savingsRate: 0.25,
      hasInsurance: true,
      hasWill: true,
      investmentDiversified: true,
    });
    expect(r.score).toBe(100);
    expect(r.grade).toBe("A+");
  });

  it("awards F for poor finances", () => {
    const r = getFinancialHealthScore({
      emergencyFundMonths: 0,
      debtToIncome: 0.9,
      savingsRate: 0,
      hasInsurance: false,
      hasWill: false,
      investmentDiversified: false,
    });
    expect(r.score).toBe(0);
    expect(r.grade).toBe("F");
  });

  it("score never exceeds 100 or drops below 0", () => {
    const r = getFinancialHealthScore({
      emergencyFundMonths: 12,
      debtToIncome: 0,
      savingsRate: 1,
      hasInsurance: true,
      hasWill: true,
      investmentDiversified: true,
    });
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.score).toBeGreaterThanOrEqual(0);
  });

  it("returns a valid colour", () => {
    const r = getFinancialHealthScore({
      emergencyFundMonths: 3,
      debtToIncome: 0.3,
      savingsRate: 0.1,
      hasInsurance: false,
      hasWill: false,
      investmentDiversified: true,
    });
    expect(r.color).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
