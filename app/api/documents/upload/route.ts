import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractDocumentData } from "@/lib/documents/extract";
import { classifyDocument, annualisePayslip } from "@/lib/documents/mapping";
import { getActiveTaxYear } from "@/lib/utils";

const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/csv",
  "application/vnd.ms-excel",
];

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    // Browser may pre-extract PDF text (reliable on edge runtimes)
    const clientPdfText = (formData.get("pdfText") as string | null) || "";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large (max 20MB)" }, { status: 400 });
    }

    const mimeType = file.type || "application/pdf";
    if (!ALLOWED_TYPES.includes(mimeType) && !file.name.endsWith(".csv")) {
      return NextResponse.json(
        { error: "Unsupported file type. Upload PDF, image (JPG/PNG), or CSV." },
        { status: 400 }
      );
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const storagePath = `${user.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

    // ── Storage (optional) — never let it crash the upload/extraction ─────────
    // Uses the service-role client; if the key isn't configured or the bucket
    // is missing, we skip storage and still extract + save the document.
    let storageOk = false;
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const admin = createAdminClient();
        const { error: storageError } = await admin.storage
          .from("financial-docs")
          .upload(storagePath, fileBuffer, { contentType: mimeType, upsert: false });
        if (storageError) {
          console.warn("Storage skipped:", storageError.message);
        } else {
          storageOk = true;
        }
      } catch (e) {
        console.warn("Storage unavailable:", e instanceof Error ? e.message : e);
      }
    }

    // ── Try saving to documents table — skip gracefully if schema not run ───
    let docId: string | null = null;
    const { data: doc } = await supabase
      .from("documents")
      .insert({
        user_id: user.id,
        file_name: file.name,
        file_type: mimeType.includes("pdf") ? "pdf" : mimeType.includes("image") ? "image" : "csv",
        file_size: file.size,
        storage_path: storageOk ? storagePath : "local-only",
        status: "processing",
      })
      .select()
      .single();

    docId = doc?.id ?? null;

    // ── Extract data — this always runs regardless of DB/storage state ──────
    let extracted;
    let extractError: string | null = null;

    try {
      extracted = await extractDocumentData(fileBuffer, mimeType, file.name, clientPdfText);
    } catch (err) {
      console.error("Extraction error:", err);
      extractError = err instanceof Error ? err.message : "Extraction failed";
    }

    // ── Update document record if it was created ─────────────────────────────
    if (docId) {
      await supabase.from("documents").update({
        status: extracted ? "done" : "failed",
        error_message: extractError,
        document_type: extracted?.documentType,
        institution: extracted?.institution,
        period_start: extracted?.periodStart,
        period_end: extracted?.periodEnd,
        extracted_data: extracted ? JSON.parse(JSON.stringify(extracted)) : null,
        analysis_summary: extracted?.summary,
      }).eq("id", docId);
    }

    // ── Map extracted data into the right fields ──────────────────────────────
    const docClass = classifyDocument(extracted?.documentType);
    const isPayslip = docClass === "payslip";
    const isTaxForm = docClass === "tax_form";
    const isBank = docClass === "bank";
    const isInvestment = docClass === "investment";
    const taxYear = getActiveTaxYear();
    const fieldsUpdated: string[] = [];

    // ── Payslip → financial_profiles + tax_profiles ──────────────────────────
    if (isPayslip && extracted?.incomeDetails) {
      // Use the user's country for financial-year-aware YTD projection
      const { data: prof } = await supabase
        .from("profiles").select("country").eq("id", user.id).single();
      const { annualIncome, annualTax, annualSuper } = annualisePayslip(
        extracted.incomeDetails,
        prof?.country
      );

      if (annualIncome > 0) {
        await supabase.from("financial_profiles").upsert(
          { user_id: user.id, annual_income: annualIncome, employment_type: "employed" },
          { onConflict: "user_id" }
        );
        fieldsUpdated.push("financial_profile.annual_income");

        // Tax profile (current year) — feeds the Tax Advisor
        await supabase.from("tax_profiles").upsert(
          {
            user_id: user.id,
            tax_year: taxYear,
            employment_income: annualIncome,
            tax_paid: annualTax,
            super_concessional_contributions: annualSuper,
          },
          { onConflict: "user_id,tax_year" }
        );
        fieldsUpdated.push("tax_profile.employment_income", "tax_profile.tax_paid");
      }
    }

    // ── Tax form (T4/W2/etc) → tax_profiles ──────────────────────────────────
    if (isTaxForm && extracted?.taxDetails) {
      const t = extracted.taxDetails;
      await supabase.from("tax_profiles").upsert(
        {
          user_id: user.id,
          tax_year: t.taxYear || taxYear,
          employment_income: t.employmentIncome || t.totalIncome || 0,
          tax_paid: t.taxOwing && t.taxOwing > 0 ? t.taxOwing : 0,
          expected_refund: t.refundOwing && t.refundOwing > 0 ? t.refundOwing : null,
          rrsp_contributions: t.rrspContributions || 0,
        },
        { onConflict: "user_id,tax_year" }
      );
      fieldsUpdated.push("tax_profile");
    }

    // ── Mortgage statement → mortgages + liability account ───────────────────
    if (docClass === "mortgage" && extracted?.mortgageDetails) {
      const m = extracted.mortgageDetails;
      if (m.balance && m.balance > 0) {
        // Normalise rate: accept either 5.25 (percent) or 0.0525 (decimal)
        const rate = m.interestRate
          ? m.interestRate > 1 ? m.interestRate / 100 : m.interestRate
          : null;
        await supabase.from("mortgages").insert({
          user_id: user.id,
          property_name: extracted.institution ? `${extracted.institution} Mortgage` : "Mortgage",
          loan_amount: m.balance,
          interest_rate: rate || 0,
          amortization_years: m.amortizationYears || 25,
          payment_frequency: m.repaymentFrequency || "monthly",
          lender: m.lender || extracted.institution || null,
          purchase_price: m.propertyValue || null,
        });
        // Also reflect as a liability account for net-worth
        await supabase.from("accounts").insert({
          user_id: user.id,
          name: `${m.lender || extracted.institution || "Home"} Mortgage`,
          type: "mortgage",
          institution: m.lender || extracted.institution || null,
          balance: m.balance,
          is_asset: false,
          interest_rate: rate,
          notes: `Imported from ${file.name}`,
        });
        fieldsUpdated.push("mortgage", "liability account");
      }
    }

    // ── Investment statement → accounts ──────────────────────────────────────
    if (isInvestment && extracted?.investmentDetails?.totalValue) {
      await supabase.from("accounts").insert({
        user_id: user.id,
        name: `${extracted.institution || "Investment"} (${extracted.investmentDetails.accountType || "Investment"})`,
        type: "investment",
        institution: extracted.institution || null,
        balance: extracted.investmentDetails.totalValue,
        is_asset: true,
        notes: `Imported from ${file.name}`,
      });
      fieldsUpdated.push("accounts");
    }

    // ── Bank statement → transactions ────────────────────────────────────────
    let txImported = 0;
    if (extracted?.transactions?.length && (isBank || extracted.transactions.length > 2)) {
      const rows = extracted.transactions.slice(0, 500).map((tx) => ({
        user_id: user.id,
        date: tx.date,
        description: tx.description,
        amount: tx.type === "credit" ? Math.abs(tx.amount) : -Math.abs(tx.amount),
        category: tx.category || (tx.type === "credit" ? "Salary / PAYG" : "Uncategorized"),
        type: tx.type === "credit" ? "income" : "expense",
        notes: `Imported from ${file.name}`,
      }));
      const { data: inserted } = await supabase.from("transactions").insert(rows).select("id");
      txImported = inserted?.length || rows.length;
      fieldsUpdated.push(`${txImported} transactions`);
    }

    return NextResponse.json({
      success: true,
      storageOk,
      dbOk: !!docId,
      extracted,
      transactionsImported: txImported,
      fieldsUpdated,
      error: extractError,
    });

  } catch (error) {
    console.error("Upload API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
