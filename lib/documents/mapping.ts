/**
 * Pure, testable helpers for mapping extracted document data into the right
 * financial fields. Kept separate from the API route so they can be unit-tested.
 */

export type DocClass = "payslip" | "tax_form" | "bank" | "investment" | "mortgage" | "other";

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
  if (d.includes("mortgage") || d.includes("home loan") || d.includes("loan statement")) return "mortgage";
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
  periodEnd?: string; // YYYY-MM-DD
  ytdGross?: number;
  ytdTax?: number;
  ytdSuper?: number;
}

export interface AnnualisedFigures {
  annualIncome: number;
  annualTax: number;
  annualSuper: number;
  method: "stated_salary" | "ytd_projection" | "period_multiplier" | "none";
}

/** Financial-year start month (1-12) by country. */
export function financialYearStartMonth(country?: string): number {
  switch ((country || "AU").toUpperCase()) {
    case "AU": return 7; // July
    case "NZ": return 4; // April
    case "CA":
    case "US":
    default: return 1; // January
  }
}

/** Months elapsed in the financial year up to (and including) the period end. */
export function monthsElapsedInFY(periodEndISO: string | undefined, fyStartMonth: number): number {
  if (!periodEndISO) return 0;
  const d = new Date(periodEndISO);
  if (isNaN(d.getTime())) return 0;
  const m = d.getMonth() + 1; // 1-12
  let elapsed = m - fyStartMonth + 1;
  if (elapsed <= 0) elapsed += 12;
  return Math.min(12, Math.max(1, elapsed));
}

/** Project a full-year figure from a year-to-date amount and months elapsed. */
export function annualiseFromYTD(ytd: number | undefined, monthsElapsed: number): number {
  if (!ytd || ytd <= 0 || monthsElapsed <= 0) return 0;
  return Math.round((ytd / monthsElapsed) * 12);
}

/**
 * Annualise payslip figures. Priority (most → least accurate):
 *   1. Stated annual salary on the slip
 *   2. Year-to-date figures projected over the financial year
 *   3. Single-period gross × pay frequency
 */
export function annualisePayslip(inc: PayslipIncome, country?: string): AnnualisedFigures {
  const mult = freqMultiplier(inc.payFrequency);
  const fyStart = financialYearStartMonth(country);
  const monthsElapsed = monthsElapsedInFY(inc.periodEnd, fyStart);

  // 1. Stated annual salary (income only; tax/super still need a basis)
  if (inc.annualSalary && inc.annualSalary > 0) {
    return {
      annualIncome: Math.round(inc.annualSalary),
      annualTax:
        annualiseFromYTD(inc.ytdTax, monthsElapsed) ||
        (inc.taxDeducted && inc.taxDeducted > 0 ? Math.round(inc.taxDeducted * mult) : 0),
      annualSuper:
        annualiseFromYTD(inc.ytdSuper, monthsElapsed) ||
        (inc.superContribution && inc.superContribution > 0 ? Math.round(inc.superContribution * mult) : 0),
      method: "stated_salary",
    };
  }

  // 2. Year-to-date projection
  const ytdIncome = annualiseFromYTD(inc.ytdGross, monthsElapsed);
  if (ytdIncome > 0) {
    return {
      annualIncome: ytdIncome,
      annualTax:
        annualiseFromYTD(inc.ytdTax, monthsElapsed) ||
        (inc.taxDeducted && inc.taxDeducted > 0 ? Math.round(inc.taxDeducted * mult) : 0),
      annualSuper:
        annualiseFromYTD(inc.ytdSuper, monthsElapsed) ||
        (inc.superContribution && inc.superContribution > 0 ? Math.round(inc.superContribution * mult) : 0),
      method: "ytd_projection",
    };
  }

  // 3. Single-period × frequency
  const annualIncome = inc.grossPay && inc.grossPay > 0 ? Math.round(inc.grossPay * mult) : 0;
  return {
    annualIncome,
    annualTax: inc.taxDeducted && inc.taxDeducted > 0 ? Math.round(inc.taxDeducted * mult) : 0,
    annualSuper: inc.superContribution && inc.superContribution > 0 ? Math.round(inc.superContribution * mult) : 0,
    method: annualIncome > 0 ? "period_multiplier" : "none",
  };
}
