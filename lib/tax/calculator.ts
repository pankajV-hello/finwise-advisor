/**
 * Multi-jurisdiction income-tax calculator.
 *
 * Pure, deterministic, and unit-tested. Brackets are simplified resident /
 * single-filer rates for guidance only — NOT a substitute for a registered
 * tax agent. Always show a disclaimer alongside output.
 *
 * Sources (2024–25):
 *  AU  ATO resident rates from 1 Jul 2024 + 2% Medicare levy
 *  NZ  IRD rates from 31 Jul 2024 + ~1.6% ACC earner levy (capped)
 *  CA  CRA federal rates 2024 + basic personal amount (federal only)
 *  US  IRS federal rates 2024 single + standard deduction
 */

export type Jurisdiction = "AU" | "NZ" | "CA" | "US";

export interface TaxBracket {
  upTo: number | null; // null = no upper bound
  rate: number; // e.g. 0.30
}

export interface JurisdictionConfig {
  name: string;
  authority: string;
  currency: string;
  brackets: TaxBracket[];
  /** Income below this is tax-free / personal allowance handled in brackets. */
  personalAllowance: number;
  /** A flat standard deduction subtracted from gross before tax (US). */
  standardDeduction: number;
  /** Secondary levy (Medicare / ACC) applied to taxable income. */
  levy?: { name: string; rate: number; cap?: number; threshold?: number };
}

export const JURISDICTIONS: Record<Jurisdiction, JurisdictionConfig> = {
  AU: {
    name: "Australia",
    authority: "ATO",
    currency: "AUD",
    personalAllowance: 0,
    standardDeduction: 0,
    brackets: [
      { upTo: 18200, rate: 0 },
      { upTo: 45000, rate: 0.16 },
      { upTo: 135000, rate: 0.3 },
      { upTo: 190000, rate: 0.37 },
      { upTo: null, rate: 0.45 },
    ],
    levy: { name: "Medicare Levy", rate: 0.02, threshold: 26000 },
  },
  NZ: {
    name: "New Zealand",
    authority: "IRD",
    currency: "NZD",
    personalAllowance: 0,
    standardDeduction: 0,
    brackets: [
      { upTo: 15600, rate: 0.105 },
      { upTo: 53500, rate: 0.175 },
      { upTo: 78100, rate: 0.3 },
      { upTo: 180000, rate: 0.33 },
      { upTo: null, rate: 0.39 },
    ],
    levy: { name: "ACC Earner Levy", rate: 0.016, cap: 142283 },
  },
  CA: {
    name: "Canada",
    authority: "CRA",
    currency: "CAD",
    personalAllowance: 15705, // basic personal amount (federal)
    standardDeduction: 0,
    brackets: [
      { upTo: 55867, rate: 0.15 },
      { upTo: 111733, rate: 0.205 },
      { upTo: 173205, rate: 0.26 },
      { upTo: 246752, rate: 0.29 },
      { upTo: null, rate: 0.33 },
    ],
  },
  US: {
    name: "United States",
    authority: "IRS",
    currency: "USD",
    personalAllowance: 0,
    standardDeduction: 14600, // single, 2024
    brackets: [
      { upTo: 11600, rate: 0.1 },
      { upTo: 47150, rate: 0.12 },
      { upTo: 100525, rate: 0.22 },
      { upTo: 191950, rate: 0.24 },
      { upTo: 243725, rate: 0.32 },
      { upTo: 609350, rate: 0.35 },
      { upTo: null, rate: 0.37 },
    ],
  },
};

export interface TaxResult {
  jurisdiction: Jurisdiction;
  authority: string;
  currency: string;
  grossIncome: number;
  deductions: number;
  taxableIncome: number;
  incomeTax: number;
  levy: number;
  levyName: string;
  totalTax: number;
  netIncome: number;
  effectiveRate: number; // totalTax / grossIncome
  marginalRate: number; // rate of the top bracket the income reaches
  taxWithheld: number;
  refundOrOwing: number; // positive = refund, negative = amount owing
  bracketBreakdown: Array<{ band: string; rate: number; tax: number }>;
}

/** Progressive tax on an amount given a bracket set. */
export function taxFromBrackets(
  taxable: number,
  brackets: TaxBracket[]
): { tax: number; marginalRate: number; breakdown: Array<{ band: string; rate: number; tax: number }> } {
  let tax = 0;
  let lower = 0;
  let marginalRate = 0;
  const breakdown: Array<{ band: string; rate: number; tax: number }> = [];

  for (const b of brackets) {
    const upper = b.upTo ?? Infinity;
    if (taxable > lower) {
      const amountInBand = Math.min(taxable, upper) - lower;
      if (amountInBand > 0) {
        const bandTax = amountInBand * b.rate;
        tax += bandTax;
        marginalRate = b.rate;
        breakdown.push({
          band: `${lower.toLocaleString()}–${b.upTo ? upper.toLocaleString() : "∞"}`,
          rate: b.rate,
          tax: Math.round(bandTax),
        });
      }
    }
    lower = upper;
    if (taxable <= upper) break;
  }
  return { tax, marginalRate, breakdown };
}

export interface CalcInput {
  jurisdiction: Jurisdiction;
  grossIncome: number;
  deductions?: number;
  taxWithheld?: number;
  superContribution?: number; // AU concessional super reduces taxable income (sacrificed)
}

export function calculateTax(input: CalcInput): TaxResult {
  const cfg = JURISDICTIONS[input.jurisdiction];
  const gross = Math.max(0, input.grossIncome || 0);
  const deductions = Math.max(0, input.deductions || 0);

  // Taxable income = gross − deductions − allowances/standard deduction
  const taxable = Math.max(
    0,
    gross - deductions - cfg.personalAllowance - cfg.standardDeduction
  );

  const { tax: incomeTax, marginalRate, breakdown } = taxFromBrackets(taxable, cfg.brackets);

  // Levy (Medicare / ACC)
  let levy = 0;
  if (cfg.levy) {
    if (cfg.levy.cap) {
      levy = Math.min(taxable, cfg.levy.cap) * cfg.levy.rate;
    } else if (cfg.levy.threshold) {
      levy = taxable > cfg.levy.threshold ? taxable * cfg.levy.rate : 0;
    } else {
      levy = taxable * cfg.levy.rate;
    }
  }

  const totalTax = Math.round(incomeTax + levy);
  const taxWithheld = Math.max(0, input.taxWithheld || 0);

  return {
    jurisdiction: input.jurisdiction,
    authority: cfg.authority,
    currency: cfg.currency,
    grossIncome: gross,
    deductions,
    taxableIncome: Math.round(taxable),
    incomeTax: Math.round(incomeTax),
    levy: Math.round(levy),
    levyName: cfg.levy?.name || "",
    totalTax,
    netIncome: Math.round(gross - totalTax),
    effectiveRate: gross > 0 ? totalTax / gross : 0,
    marginalRate,
    taxWithheld,
    refundOrOwing: Math.round(taxWithheld - totalTax),
    bracketBreakdown: breakdown,
  };
}
