import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractDocumentData } from "@/lib/documents/extract";

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
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

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

    // ── Use admin client for storage (bypasses RLS) ──────────────────────────
    const admin = createAdminClient();
    let storageOk = false;
    const { error: storageError } = await admin.storage
      .from("financial-docs")
      .upload(storagePath, fileBuffer, { contentType: mimeType, upsert: false });

    if (storageError) {
      console.warn("Storage skipped (bucket may not exist yet):", storageError.message);
    } else {
      storageOk = true;
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
      extracted = await extractDocumentData(fileBuffer, mimeType, file.name);
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

    // ── Auto-fill financial profile from payslip ──────────────────────────────
    if (extracted?.incomeDetails && extracted.documentType === "salary_slip") {
      const inc = extracted.incomeDetails;
      if (inc.grossPay) {
        await supabase.from("financial_profiles").upsert(
          { user_id: user.id, annual_income: inc.grossPay * 12 },
          { onConflict: "user_id" }
        );
      }
    }

    // ── Auto-import transactions from bank statements ──────────────────────────
    if (extracted?.transactions?.length && extracted.documentType === "bank_statement") {
      const rows = extracted.transactions.slice(0, 500).map((t) => ({
        user_id: user.id,
        date: t.date,
        description: t.description,
        amount: t.type === "credit" ? Math.abs(t.amount) : -Math.abs(t.amount),
        category: t.category || (t.type === "credit" ? "Salary / PAYG" : "Uncategorized"),
        type: t.type === "credit" ? "income" : "expense",
        notes: `Imported from ${file.name}`,
      }));
      await supabase.from("transactions").insert(rows);
    }

    return NextResponse.json({
      success: true,
      storageOk,
      dbOk: !!docId,
      extracted,
      transactionsImported: extracted?.transactions?.length || 0,
      autoFilledProfile: !!(extracted?.incomeDetails?.grossPay),
      error: extractError,
    });

  } catch (error) {
    console.error("Upload API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
