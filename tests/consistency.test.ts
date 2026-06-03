import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { getActiveTaxYear } from "@/lib/utils";

describe("getActiveTaxYear", () => {
  it("returns the current calendar year", () => {
    expect(getActiveTaxYear()).toBe(new Date().getFullYear());
  });
});

/**
 * Regression guard: the tax-year mismatch bug (data written under year N,
 * read under year N-1) must never come back. Every module that touches
 * tax_profiles must use getActiveTaxYear(), never a raw getFullYear()-1.
 */
describe("tax_year consistency", () => {
  const files = [
    "app/(dashboard)/dashboard/tax/page.tsx",
    "app/api/documents/upload/route.ts",
    "components/onboarding/onboarding-wizard.tsx",
  ];

  for (const f of files) {
    it(`${f} does not hardcode getFullYear()-1 for tax year`, () => {
      const src = readFileSync(resolve(__dirname, "..", f), "utf-8");
      expect(src).not.toMatch(/getFullYear\(\)\s*-\s*1/);
    });
  }

  it("tax page and writers all reference getActiveTaxYear", () => {
    for (const f of files) {
      const src = readFileSync(resolve(__dirname, "..", f), "utf-8");
      expect(src).toContain("getActiveTaxYear");
    }
  });
});
