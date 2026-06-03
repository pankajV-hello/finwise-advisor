import { describe, it, expect } from "vitest";
import {
  freqMultiplier, classifyDocument, annualisePayslip,
  financialYearStartMonth, monthsElapsedInFY, annualiseFromYTD,
} from "@/lib/documents/mapping";

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

  it("recognises mortgage statements", () => {
    expect(classifyDocument("mortgage_statement")).toBe("mortgage");
    expect(classifyDocument("Home Loan Statement")).toBe("mortgage");
    expect(classifyDocument("loan statement")).toBe("mortgage");
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
    expect(r.annualIncome).toBe(0);
    expect(r.annualTax).toBe(0);
    expect(r.annualSuper).toBe(0);
    expect(r.method).toBe("none");
  });

  it("ignores negative/garbage values", () => {
    const r = annualisePayslip({ grossPay: -100, taxDeducted: -50, payFrequency: "monthly" });
    expect(r.annualIncome).toBe(0);
    expect(r.annualTax).toBe(0);
  });

  it("reports the method used", () => {
    expect(annualisePayslip({ annualSalary: 100000 }).method).toBe("stated_salary");
    expect(annualisePayslip({ grossPay: 5000, payFrequency: "monthly" }).method).toBe("period_multiplier");
    expect(annualisePayslip({}).method).toBe("none");
  });
});

describe("financialYearStartMonth", () => {
  it("AU = July, NZ = April, CA/US = January", () => {
    expect(financialYearStartMonth("AU")).toBe(7);
    expect(financialYearStartMonth("NZ")).toBe(4);
    expect(financialYearStartMonth("CA")).toBe(1);
    expect(financialYearStartMonth("US")).toBe(1);
    expect(financialYearStartMonth(undefined)).toBe(7); // defaults to AU
  });
});

describe("monthsElapsedInFY", () => {
  it("AU FY (Jul start): April is month 10", () => {
    expect(monthsElapsedInFY("2026-04-30", 7)).toBe(10);
  });
  it("AU FY: July is month 1", () => {
    expect(monthsElapsedInFY("2025-07-31", 7)).toBe(1);
  });
  it("AU FY: June is month 12", () => {
    expect(monthsElapsedInFY("2026-06-30", 7)).toBe(12);
  });
  it("calendar FY (Jan start): March is month 3", () => {
    expect(monthsElapsedInFY("2026-03-15", 1)).toBe(3);
  });
  it("returns 0 for an invalid date", () => {
    expect(monthsElapsedInFY("not-a-date", 7)).toBe(0);
    expect(monthsElapsedInFY(undefined, 7)).toBe(0);
  });
});

describe("annualiseFromYTD", () => {
  it("projects YTD over the full year", () => {
    // $124,168 YTD over 10 months → ~$149,000/yr
    expect(annualiseFromYTD(124168, 10)).toBe(149002);
  });
  it("returns 0 for missing data", () => {
    expect(annualiseFromYTD(0, 10)).toBe(0);
    expect(annualiseFromYTD(50000, 0)).toBe(0);
  });
});

describe("annualisePayslip with YTD", () => {
  it("uses YTD projection when no annual salary is stated", () => {
    const r = annualisePayslip(
      { ytdGross: 124168, ytdTax: 38000, periodEnd: "2026-04-30", payFrequency: "monthly" },
      "AU"
    );
    expect(r.method).toBe("ytd_projection");
    expect(r.annualIncome).toBe(149002); // 124168/10*12
    expect(r.annualTax).toBe(45600); // 38000/10*12
  });

  it("stated annual salary still wins over YTD", () => {
    const r = annualisePayslip(
      { annualSalary: 156250, ytdGross: 124168, periodEnd: "2026-04-30" },
      "AU"
    );
    expect(r.method).toBe("stated_salary");
    expect(r.annualIncome).toBe(156250);
  });
});
