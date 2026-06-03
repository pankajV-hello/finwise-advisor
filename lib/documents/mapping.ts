/**
 * Pure, testable helpers for mapping extracted document data into the right
 * financial fields. Kept separate from the API route so they can be unit-tested.
 */

export type DocClass = "payslip" | "tax_form" | "bank" | "investment" | "other";

/** Annual multiplier for a pay frequency string. */
export function freqMultiplier(frequency?: string): number {
  const s = (frequency || "").toLowerCase().trim();
  if (!s) return 12;
  // fortnightly / bi-weekly = every 2 weeks = 26 pays/year (check before "weekly")
  if (s.includes("fortnight") || s.includes("bi-week") || s.includes("biweek") || s.includes("bi week")) {
    return 26;
  }
  if (s.includes("week")) return 52;
  if (s.includes("month")) return 12;
  if (s.includes("quarter")) return 4;
  if (s.includes("annual") || s.includes("year")) return 1;
  return 12; // sensible default
}

/** Classify a (possibly messy) documentType string into a known bucket. */
export function classifyDocument(documentType?: string): DocClass {
  const d = (documentType || "").toLowerCase();
  if (d.includes("salary") || d.includes("payslip") || d.includes("pay_slip") || d.includes("pay slip")) {
    return "payslip";
  }
  if (["t4", "t1", "w2", "w-2", "1040"].some((t) => d.includes(t))) return "tax_form";
  if (d.includes("bank")) return "bank";
  if (d.includes("investment")) return "investment";
  return "other";
}

export interface PayslipIncome {
  grossPay?: number;
  taxDeducted?: number;
  superContribution?: number;
  payFrequency?: string;
  annualSalary?: number;
}

export interface AnnualisedFigures {
  annualIncome: number;
  annualTax: number;
  annualSuper: number;
}

/**
 * Annualise payslip figures. Prefers a stated annual salary; otherwise
 * multiplies the per-period gross by the frequency multiplier.
 */
export function annualisePayslip(inc: PayslipIncome): AnnualisedFigures {
  const mult = freqMultiplier(inc.payFrequency);
  const annualIncome =
    inc.annualSalary && inc.annualSalary > 0
      ? Math.round(inc.annualSalary)
      : inc.grossPay && inc.grossPay > 0
        ? Math.round(inc.grossPay * mult)
        : 0;
  const annualTax = inc.taxDeducted && inc.taxDeducted > 0 ? Math.round(inc.taxDeducted * mult) : 0;
  const annualSuper =
    inc.superContribution && inc.superContribution > 0 ? Math.round(inc.superContribution * mult) : 0;
  return { annualIncome, annualTax, annualSuper };
}
