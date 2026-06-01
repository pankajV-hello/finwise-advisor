import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large (max 20MB)" },
        { status: 400 }
      );
    }

    const mimeType = file.type || "application/octet-stream";
    if (!ALLOWED_TYPES.includes(mimeType) && !file.name.endsWith(".csv")) {
      return NextResponse.json(
        {
          error:
            "Unsupported file type. Upload PDF, image (JPG/PNG), or CSV files.",
        },
        { status: 400 }
      );
    }

    // Store file in Supabase Storage
    const storagePath = `${user.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const { error: storageError } = await supabase.storage
      .from("financial-docs")
      .upload(storagePath, fileBuffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (storageError) {
      console.error("Storage error:", storageError);
      return NextResponse.json(
        { error: "Failed to store file" },
        { status: 500 }
      );
    }

    // Create document record with pending status
    const { data: doc, error: dbError } = await supabase
      .from("documents")
      .insert({
        user_id: user.id,
        file_name: file.name,
        file_type: mimeType.includes("pdf")
          ? "pdf"
          : mimeType.includes("image")
            ? "image"
            : "csv",
        file_size: file.size,
        storage_path: storagePath,
        status: "processing",
      })
      .select()
      .single();

    if (dbError || !doc) {
      return NextResponse.json(
        { error: "Failed to create document record" },
        { status: 500 }
      );
    }

    // Extract data using Claude
    let extracted;
    let status = "done";
    let errorMessage = null;

    try {
      extracted = await extractDocumentData(fileBuffer, mimeType, file.name);
    } catch (err) {
      console.error("Extraction error:", err);
      status = "failed";
      errorMessage = err instanceof Error ? err.message : "Extraction failed";
    }

    // Update document with extracted data
    const { data: updatedDoc } = await supabase
      .from("documents")
      .update({
        status,
        error_message: errorMessage,
        document_type: extracted?.documentType,
        institution: extracted?.institution,
        period_start: extracted?.periodStart,
        period_end: extracted?.periodEnd,
        extracted_data: extracted ? JSON.parse(JSON.stringify(extracted)) : null,
        analysis_summary: extracted?.summary,
      })
      .eq("id", doc.id)
      .select()
      .single();

    // Auto-import transactions if it's a bank statement
    if (
      extracted?.transactions &&
      extracted.transactions.length > 0 &&
      extracted.documentType === "bank_statement"
    ) {
      const transactionsToInsert = extracted.transactions
        .slice(0, 500)
        .map((t) => ({
          user_id: user.id,
          date: t.date,
          description: t.description,
          amount: t.type === "credit" ? Math.abs(t.amount) : -Math.abs(t.amount),
          category: t.category || (t.type === "credit" ? "Income" : "Uncategorized"),
          type: t.type === "credit" ? "income" : "expense",
          notes: `Imported from ${file.name}`,
        }));

      await supabase.from("transactions").insert(transactionsToInsert);
    }

    return NextResponse.json({
      success: true,
      document: updatedDoc || doc,
      extracted,
      transactionsImported:
        extracted?.transactions?.length || 0,
    });
  } catch (error) {
    console.error("Upload API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
