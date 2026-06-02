import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CURRENCY_LOCALES: Record<string, string> = {
  AUD: "en-AU",
  NZD: "en-NZ",
  CAD: "en-CA",
  USD: "en-US",
  GBP: "en-GB",
};

export function formatCurrency(
  amount: number,
  currency = "AUD",
  locale?: string
): string {
  const resolvedLocale = locale ?? CURRENCY_LOCALES[currency] ?? "en-AU";
  return new Intl.NumberFormat(resolvedLocale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

export function calculateMortgagePayment(
  principal: number,
  annualRate: number,
  amortizationYears: number,
  frequency: "monthly" | "bi-weekly" | "weekly" = "monthly"
): { payment: number; totalInterest: number; totalPaid: number } {
  const paymentsPerYear =
    frequency === "monthly" ? 12 : frequency === "bi-weekly" ? 26 : 52;
  const periodicRate = annualRate / paymentsPerYear;
  const totalPayments = amortizationYears * paymentsPerYear;

  if (periodicRate === 0) {
    const payment = principal / totalPayments;
    return { payment, totalInterest: 0, totalPaid: principal };
  }

  const payment =
    (principal * (periodicRate * Math.pow(1 + periodicRate, totalPayments))) /
    (Math.pow(1 + periodicRate, totalPayments) - 1);

  const totalPaid = payment * totalPayments;
  const totalInterest = totalPaid - principal;

  return { payment, totalInterest, totalPaid };
}

export function generateAmortizationSchedule(
  principal: number,
  annualRate: number,
  amortizationYears: number
): Array<{
  year: number;
  payment: number;
  principal: number;
  interest: number;
  balance: number;
}> {
  const { payment } = calculateMortgagePayment(
    principal,
    annualRate,
    amortizationYears
  );
  const monthlyRate = annualRate / 12;
  let balance = principal;
  const schedule = [];

  for (let year = 1; year <= amortizationYears; year++) {
    let yearlyInterest = 0;
    let yearlyPrincipal = 0;

    for (let month = 0; month < 12; month++) {
      const interestPayment = balance * monthlyRate;
      const principalPayment = payment - interestPayment;
      yearlyInterest += interestPayment;
      yearlyPrincipal += principalPayment;
      balance = Math.max(0, balance - principalPayment);
    }

    schedule.push({
      year,
      payment: payment * 12,
      principal: yearlyPrincipal,
      interest: yearlyInterest,
      balance,
    });

    if (balance <= 0) break;
  }

  return schedule;
}

export function calculateNetWorth(
  assets: Array<{ balance: number; is_asset: boolean }>
): { assets: number; liabilities: number; netWorth: number } {
  const totalAssets = assets
    .filter((a) => a.is_asset)
    .reduce((sum, a) => sum + a.balance, 0);
  const totalLiabilities = assets
    .filter((a) => !a.is_asset)
    .reduce((sum, a) => sum + Math.abs(a.balance), 0);
  return {
    assets: totalAssets,
    liabilities: totalLiabilities,
    netWorth: totalAssets - totalLiabilities,
  };
}

export function getFinancialHealthScore(data: {
  emergencyFundMonths: number;
  debtToIncome: number;
  savingsRate: number;
  hasInsurance: boolean;
  hasWill: boolean;
  investmentDiversified: boolean;
}): { score: number; grade: string; color: string } {
  let score = 0;

  if (data.emergencyFundMonths >= 6) score += 20;
  else if (data.emergencyFundMonths >= 3) score += 12;
  else if (data.emergencyFundMonths >= 1) score += 6;

  if (data.debtToIncome <= 0.15) score += 20;
  else if (data.debtToIncome <= 0.3) score += 12;
  else if (data.debtToIncome <= 0.43) score += 6;

  if (data.savingsRate >= 0.2) score += 20;
  else if (data.savingsRate >= 0.1) score += 12;
  else if (data.savingsRate >= 0.05) score += 6;

  if (data.hasInsurance) score += 15;
  if (data.hasWill) score += 10;
  if (data.investmentDiversified) score += 15;

  const grade =
    score >= 85
      ? "A+"
      : score >= 75
        ? "A"
        : score >= 65
          ? "B"
          : score >= 55
            ? "C"
            : score >= 40
              ? "D"
              : "F";

  const color =
    score >= 75
      ? "#22c55e"
      : score >= 55
        ? "#eab308"
        : score >= 40
          ? "#f97316"
          : "#ef4444";

  return { score, grade, color };
}
