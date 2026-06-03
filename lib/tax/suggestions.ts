/**
 * Rule-based tax-saving suggestions per authority. Deterministic and free
 * (no AI call). Each suggestion is general guidance allowed by the relevant
 * tax authority — not personal advice.
 */
import type { Jurisdiction, TaxResult } from "./calculator";

export interface TaxTip {
  title: string;
  detail: string;
  estimatedSaving?: string;
  category: "super" | "deduction" | "credit" | "structure" | "timing" | "investment";
}

interface TipContext {
  jurisdiction: Jurisdiction;
  grossIncome: number;
  superContribution?: number; // annual, for AU
  result: TaxResult;
}

// AU concessional super cap (2024-25)
const AU_CONCESSIONAL_CAP = 30000;

export function getTaxSuggestions(ctx: TipContext): TaxTip[] {
  const tips: TaxTip[] = [];
  const { grossIncome: income, result } = ctx;
  const marginal = result.marginalRate;

  switch (ctx.jurisdiction) {
    case "AU": {
      // Salary sacrifice to super — top up to the concessional cap
      const currentSuper = ctx.superContribution || Math.round(income * 0.115);
      const room = Math.max(0, AU_CONCESSIONAL_CAP - currentSuper);
      if (room > 1000 && marginal > 0.16) {
        const saving = Math.round(room * (marginal - 0.15)); // super taxed at 15%
        tips.push({
          title: "Salary sacrifice into super",
          detail: `You have ~${room.toLocaleString()} of concessional cap left ($30,000 total). Contributions are taxed at 15% inside super vs your ${Math.round(marginal * 100)}% marginal rate.`,
          estimatedSaving: `~$${saving.toLocaleString()}/yr`,
          category: "super",
        });
      }
      tips.push({
        title: "Claim work-related deductions",
        detail: "Home office (67c/hr fixed method or actual costs), self-education, tools, professional memberships, and work-related travel. Keep receipts and a logbook.",
        category: "deduction",
      });
      if (income > 97000) {
        tips.push({
          title: "Check private health cover",
          detail: "Above the Medicare Levy Surcharge threshold ($97k single / $194k family), appropriate private hospital cover can be cheaper than the 1–1.5% surcharge.",
          category: "structure",
        });
      }
      tips.push({
        title: "Prepay & time deductions",
        detail: "Prepay deductible expenses (income protection insurance, investment loan interest) before 30 June to bring the deduction forward.",
        category: "timing",
      });
      tips.push({
        title: "Deductible donations",
        detail: "Gifts of $2+ to registered DGR charities are fully deductible. Donating before 30 June reduces this year's taxable income.",
        category: "deduction",
      });
      break;
    }

    case "NZ": {
      tips.push({
        title: "Maximise KiwiSaver",
        detail: "Contribute at least enough to get the full employer match and the $521.43 annual government member tax credit (contribute ≥ $1,042/yr).",
        estimatedSaving: "up to $521/yr",
        category: "super",
      });
      tips.push({
        title: "Use the correct PIR",
        detail: "Check your Prescribed Investor Rate on PIE funds — an incorrect (too high) PIR means you overpay. Max PIE rate is 28% vs up to 39% personal.",
        category: "investment",
      });
      tips.push({
        title: "Claim donation rebate",
        detail: "Donations to approved donee organisations give a 33.33% tax credit (up to your taxable income). File an IR526.",
        estimatedSaving: "33% of donations",
        category: "credit",
      });
      tips.push({
        title: "Working for Families",
        detail: "If you have dependent children, check eligibility for Working for Families tax credits.",
        category: "credit",
      });
      break;
    }

    case "CA": {
      tips.push({
        title: "Maximise RRSP contributions",
        detail: `RRSP contributions are deductible at your ${Math.round(marginal * 100)}% marginal rate. Contribution room is 18% of prior-year income (to the annual max).`,
        estimatedSaving: `~${Math.round(marginal * 100)}% of contribution`,
        category: "deduction",
      });
      tips.push({
        title: "Use your TFSA",
        detail: "While not deductible, TFSA growth and withdrawals are tax-free — ideal for investments after RRSP optimisation.",
        category: "investment",
      });
      tips.push({
        title: "Claim eligible credits",
        detail: "Medical expenses, charitable donations, tuition, and the Canada Workers Benefit can reduce tax payable.",
        category: "credit",
      });
      if (income > 0) {
        tips.push({
          title: "First Home Savings Account (FHSA)",
          detail: "If saving for a first home, the FHSA combines RRSP-style deductions with TFSA-style tax-free withdrawals.",
          category: "structure",
        });
      }
      break;
    }

    case "US": {
      tips.push({
        title: "Max out 401(k) contributions",
        detail: `Pre-tax 401(k) contributions reduce taxable income at your ${Math.round(marginal * 100)}% marginal rate (2024 limit $23,000, +$7,500 if 50+).`,
        estimatedSaving: `~${Math.round(marginal * 100)}% of contribution`,
        category: "deduction",
      });
      tips.push({
        title: "Traditional or Roth IRA",
        detail: "Traditional IRA may be deductible; Roth grows tax-free. Choose based on current vs expected future tax rate.",
        category: "investment",
      });
      tips.push({
        title: "HSA triple tax advantage",
        detail: "With a high-deductible health plan, HSA contributions are deductible, grow tax-free, and are tax-free for medical expenses.",
        category: "deduction",
      });
      tips.push({
        title: "Itemize vs standard deduction",
        detail: "Compare itemized deductions (mortgage interest, SALT up to $10k, charitable gifts) against the $14,600 standard deduction.",
        category: "deduction",
      });
      break;
    }
  }

  // Universal closing tip
  tips.push({
    title: "See a registered tax professional",
    detail: "These are general strategies. A registered tax agent / CPA can tailor them to your full situation and ensure compliance.",
    category: "structure",
  });

  return tips;
}
