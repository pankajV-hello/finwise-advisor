import { describe, it, expect } from "vitest";
import { freqMultiplier, classifyDocument, annualisePayslip } from "@/lib/documents/mapping";

describe("freqMultiplier", () => {
  it("maps each frequency correctly", () => {
    expect(freqMultiplier("monthly")).toBe(12);
    expect(freqMultiplier("Monthly")).toBe(12);
    expect(freqMultiplier("weekly")).toBe(52);
    expect(freqMultiplier("fortnightly")).toBe(26);
    expect(freqMultiplier("bi-weekly")).toBe(26);
    expect(freqMultiplier("biweekly")).toBe(26);
    expect(freqMultiplier("quarterly")).toBe(4);
    expect(freqMultiplier("annually")).toBe(1);
    expect(freqMultiplier("yearly")).toBe(1);
  });

  it("does NOT treat fortnightly as weekly (the classic bug)", () => {
    // 'fortnightly' contains neither 'week' first nor should fall to 52
    expect(freqMultiplier("fortnightly")).toBe(26);
    expect(freqMultiplier("Fortnightly pay")).toBe(26);
  });

  it("defaults to monthly for empty/unknown", () => {
    expect(freqMultiplier("")).toBe(12);
    expect(freqMultiplier(undefined)).toBe(12);
    expect(freqMultiplier("whenever")).toBe(12);
  });
});

describe("classifyDocument", () => {
  it("recognises payslips under varied labels", () => {
    expect(classifyDocument("salary_slip")).toBe("payslip");
    expect(classifyDocument("payslip")).toBe("payslip");
    expect(classifyDocument("Pay Slip")).toBe("payslip");
    expect(classifyDocument("SALARY")).toBe("payslip");
  });

  it("recognises tax forms", () => {
    expect(classifyDocument("t4")).toBe("tax_form");
    expect(classifyDocument("w2")).toBe("tax_form");
    expect(classifyDocument("w-2")).toBe("tax_form");
    expect(classifyDocument("1040")).toBe("tax_form");
  });

  it("recognises bank and investment", () => {
    expect(classifyDocument("bank_statement")).toBe("bank");
    expect(classifyDocument("investment_statement")).toBe("investment");
  });

  it("falls back to other", () => {
    expect(classifyDocument("receipt")).toBe("other");
    expect(classifyDocument(undefined)).toBe("other");
  });
});

describe("annualisePayslip", () => {
  it("uses stated annual salary when present", () => {
    const r = annualisePayslip({
      grossPay: 13020.84,
      taxDeducted: 4030,
      superContribution: 1562.5,
      payFrequency: "monthly",
      annualSalary: 156250,
    });
    expect(r.annualIncome).toBe(156250);
    expect(r.annualTax).toBe(48360); // 4030 * 12
    expect(r.annualSuper).toBe(18750); // 1562.5 * 12
  });

  it("annualises monthly gross when no annual salary", () => {
    const r = annualisePayslip({ grossPay: 10000, taxDeducted: 2500, payFrequency: "monthly" });
    expect(r.annualIncome).toBe(120000);
    expect(r.annualTax).toBe(30000);
  });

  it("annualises fortnightly correctly (×26, not ×52)", () => {
    const r = annualisePayslip({ grossPay: 5000, taxDeducted: 1200, payFrequency: "fortnightly" });
    expect(r.annualIncome).toBe(130000); // 5000 * 26
    expect(r.annualTax).toBe(31200);
  });

  it("annualises weekly (×52)", () => {
    const r = annualisePayslip({ grossPay: 2000, payFrequency: "weekly" });
    expect(r.annualIncome).toBe(104000);
  });

  it("returns zeros when no usable income data", () => {
    const r = annualisePayslip({ payFrequency: "monthly" });
    expect(r).toEqual({ annualIncome: 0, annualTax: 0, annualSuper: 0 });
  });

  it("ignores negative/garbage values", () => {
    const r = annualisePayslip({ grossPay: -100, taxDeducted: -50, payFrequency: "monthly" });
    expect(r.annualIncome).toBe(0);
    expect(r.annualTax).toBe(0);
  });
});
