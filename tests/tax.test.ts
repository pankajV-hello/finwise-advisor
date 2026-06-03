import { describe, it, expect } from "vitest";
import { calculateTax, taxFromBrackets, JURISDICTIONS } from "@/lib/tax/calculator";
import { getTaxSuggestions } from "@/lib/tax/suggestions";

describe("taxFromBrackets (AU 2024-25)", () => {
  const au = JURISDICTIONS.AU.brackets;

  it("is zero below the tax-free threshold", () => {
    expect(taxFromBrackets(18200, au).tax).toBe(0);
  });

  it("taxes $45,000 correctly (16% on 26,800)", () => {
    // (45000-18200)*0.16 = 4288
    expect(Math.round(taxFromBrackets(45000, au).tax)).toBe(4288);
  });

  it("taxes $135,000 correctly", () => {
    // 4288 + (135000-45000)*0.30 = 4288 + 27000 = 31288
    expect(Math.round(taxFromBrackets(135000, au).tax)).toBe(31288);
  });

  it("reports correct marginal rate", () => {
    expect(taxFromBrackets(200000, au).marginalRate).toBe(0.45);
    expect(taxFromBrackets(50000, au).marginalRate).toBe(0.3);
  });
});

describe("calculateTax — AU full (income $156,250)", () => {
  const r = calculateTax({ jurisdiction: "AU", grossIncome: 156250, taxWithheld: 48360 });

  it("computes income tax on the ATO brackets", () => {
    // 4288 + (135000-45000)*0.30 + (156250-135000)*0.37
    // = 4288 + 27000 + 7862.5 = 39150.5
    expect(r.incomeTax).toBe(39151);
  });

  it("adds 2% Medicare levy", () => {
    expect(r.levy).toBe(Math.round(156250 * 0.02)); // 3125
    expect(r.levyName).toBe("Medicare Levy");
  });

  it("total tax = income tax + levy", () => {
    expect(r.totalTax).toBe(39151 + 3125);
  });

  it("marginal rate is 37%", () => {
    expect(r.marginalRate).toBe(0.37);
  });

  it("effective rate is total tax / gross", () => {
    expect(r.effectiveRate).toBeCloseTo((39151 + 3125) / 156250, 4);
  });

  it("computes refund/owing vs withheld", () => {
    // withheld 48360 - total 42276 = +6084 refund
    expect(r.refundOrOwing).toBe(48360 - (39151 + 3125));
    expect(r.refundOrOwing).toBeGreaterThan(0); // refund
  });
});

describe("calculateTax — deductions reduce tax", () => {
  it("a $10k deduction lowers tax", () => {
    const base = calculateTax({ jurisdiction: "AU", grossIncome: 100000 });
    const withDeduction = calculateTax({ jurisdiction: "AU", grossIncome: 100000, deductions: 10000 });
    expect(withDeduction.totalTax).toBeLessThan(base.totalTax);
    // saving ≈ 10000 * (0.30 marginal + 0.02 levy) = ~3200
    expect(base.totalTax - withDeduction.totalTax).toBeGreaterThan(3000);
  });
});

describe("calculateTax — other jurisdictions sanity", () => {
  it("NZ applies 10.5% from the first dollar (no tax-free threshold)", () => {
    const r = calculateTax({ jurisdiction: "NZ", grossIncome: 10000 });
    expect(r.incomeTax).toBe(Math.round(10000 * 0.105));
  });

  it("US applies the standard deduction before tax", () => {
    const r = calculateTax({ jurisdiction: "US", grossIncome: 14600 });
    expect(r.taxableIncome).toBe(0); // entirely covered by standard deduction
    expect(r.totalTax).toBe(0);
  });

  it("CA applies the basic personal amount", () => {
    const r = calculateTax({ jurisdiction: "CA", grossIncome: 15705 });
    expect(r.taxableIncome).toBe(0);
  });

  it("never returns negative tax or NaN", () => {
    for (const j of ["AU", "NZ", "CA", "US"] as const) {
      const r = calculateTax({ jurisdiction: j, grossIncome: 0 });
      expect(r.totalTax).toBe(0);
      expect(Number.isFinite(r.effectiveRate)).toBe(true);
    }
  });
});

describe("getTaxSuggestions", () => {
  it("AU suggests salary sacrifice when below the cap", () => {
    const result = calculateTax({ jurisdiction: "AU", grossIncome: 156250 });
    const tips = getTaxSuggestions({ jurisdiction: "AU", grossIncome: 156250, superContribution: 18000, result });
    expect(tips.some((t) => t.category === "super")).toBe(true);
  });

  it("always includes the professional-advice tip", () => {
    const result = calculateTax({ jurisdiction: "NZ", grossIncome: 80000 });
    const tips = getTaxSuggestions({ jurisdiction: "NZ", grossIncome: 80000, result });
    expect(tips[tips.length - 1].title).toMatch(/professional/i);
  });

  it("returns jurisdiction-appropriate tips (CA mentions RRSP)", () => {
    const result = calculateTax({ jurisdiction: "CA", grossIncome: 90000 });
    const tips = getTaxSuggestions({ jurisdiction: "CA", grossIncome: 90000, result });
    expect(tips.some((t) => t.detail.includes("RRSP"))).toBe(true);
  });
});
