/**
 * Document extraction — provider-aware
 *
 * PDFs (text layer) → pdf-parse → text model
 * PDFs (scanned)    → sips (macOS) or sharp → render to JPEG → vision model
 * Images            → vision model
 * CSV               → text model
 */

import { getProvider } from "@/lib/agents";

// Anthropic via raw fetch (no SDK) so this bundles on edge runtimes.
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const ANTHROPIC_MODEL = "claude-sonnet-4-6";

async function anthropicMessage(
  content: unknown,
  systemPrompt: string = EXTRACTION_PROMPT
): Promise<string> {
  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 4096,
      system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API error: ${await res.text()}`);
  const data = await res.json();
  return data?.content?.[0]?.type === "text" ? data.content[0].text : "";
}

// Node-only modules are imported dynamically inside renderPdfToImage so this
// file still bundles for edge runtimes (e.g. Cloudflare Workers) where they
// are unavailable. On those runtimes the sips path is simply skipped.

export type DocumentType =
  | "bank_statement" | "salary_slip" | "t4" | "t1" | "w2"
  | "1040" | "investment_statement" | "receipt" | "mortgage_statement" | "other";

export interface ExtractedDocument {
  documentType: DocumentType;
  institution?: string;
  periodStart?: string;
  periodEnd?: string;
  summary: string;
  data: Record<string, unknown>;
  transactions?: Array<{
    date: string; description: string; amount: number;
    type: "credit" | "debit"; category?: string;
  }>;
  incomeDetails?: {
    grossPay?: number; netPay?: number; taxDeducted?: number;
    rrspDeduction?: number; cppContribution?: number; eiPremium?: number;
    superContribution?: number; medicareLevy?: number;
    period?: string; employer?: string;
  };
  taxDetails?: {
    taxYear?: number; totalIncome?: number; taxableIncome?: number;
    taxOwing?: number; refundOwing?: number; rrspContributions?: number;
    employmentIncome?: number;
  };
  investmentDetails?: {
    accountType?: string; totalValue?: number;
    holdings?: Array<{ name: string; value: number; units?: number }>;
    deposits?: number; withdrawals?: number; gains?: number;
  };
}

const EXTRACTION_PROMPT = `You are a financial document parser. Extract ALL financial data accurately.

Return ONLY a valid JSON object (no markdown, no explanation):
{
  "documentType": "bank_statement|salary_slip|t4|t1|w2|1040|investment_statement|mortgage_statement|receipt|other",
  "institution": "string or null",
  "periodStart": "YYYY-MM-DD or null",
  "periodEnd": "YYYY-MM-DD or null",
  "summary": "2-3 sentence plain English summary",
  "data": {},
  "transactions": [{"date":"YYYY-MM-DD","description":"string","amount":number,"type":"credit|debit","category":"string"}],
  "incomeDetails": {"grossPay":number,"netPay":number,"taxDeducted":number,"superContribution":number,"medicareLevy":number,"eiPremium":number,"cppContribution":number,"period":"string","employer":"string"},
  "taxDetails": {"taxYear":number,"totalIncome":number,"taxableIncome":number,"taxOwing":number,"refundOwing":number,"rrspContributions":number},
  "investmentDetails": {"accountType":"string","totalValue":number,"holdings":[],"deposits":number,"withdrawals":number,"gains":number}
}

Rules: exact figures only, omit inapplicable keys, return ONLY the JSON object.`;

// ─── PDF text extraction (pdf-parse v2 — PDFParse class) ─────────────────────
async function extractPdfText(buffer: Buffer): Promise<string> {
  // unpdf works in Node AND edge runtimes (Cloudflare Workers) — bundles a
  // serverless build of pdf.js with no native dependencies.
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    const merged = Array.isArray(text) ? text.join("\n") : text;
    return (merged || "").slice(0, 12000);
  } catch (err) {
    console.warn("PDF text extraction failed:", err instanceof Error ? err.message : err);
    return "";
  }
}

// ─── Scanned PDF → JPEG via macOS sips (Node runtime only) ───────────────────
async function renderPdfToImage(buffer: Buffer): Promise<Buffer | null> {
  // Skip entirely on edge runtimes where Node modules are unavailable
  if (typeof process === "undefined" || !process.versions?.node) return null;
  try {
    const [{ execSync }, fs, os, path] = await Promise.all([
      import("child_process"),
      import("fs"),
      import("os"),
      import("path"),
    ]);
    const tmpDir = os.tmpdir();
    const pdfPath = path.join(tmpDir, `fw_${Date.now()}.pdf`);
    const imgPath = path.join(tmpDir, `fw_${Date.now()}.jpg`);
    try {
      fs.writeFileSync(pdfPath, buffer);
      execSync(
        `sips -s format jpeg -s dpiHeight 150 -s dpiWidth 150 "${pdfPath}" --out "${imgPath}"`,
        { timeout: 15000, stdio: "pipe" }
      );
      return fs.existsSync(imgPath) ? fs.readFileSync(imgPath) : null;
    } finally {
      if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
      if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    }
  } catch {
    return null;
  }
}

// ─── Text-based extraction (works for all providers) ─────────────────────────
async function extractWithText(text: string, fileName: string): Promise<ExtractedDocument> {
  const prompt = `File: ${fileName}\n\nDocument content:\n${text}\n\nExtract all financial data as JSON.`;
  const provider = getProvider();

  if (provider === "groq") {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
        max_tokens: 4096,
        messages: [
          { role: "system", content: EXTRACTION_PROMPT },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Groq text error: ${await res.text()}`);
    const d = await res.json();
    return parseJSON(d.choices?.[0]?.message?.content || "");
  }

  if (provider === "ollama") {
    const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL || "llama3.1:8b",
        stream: false,
        messages: [
          { role: "system", content: EXTRACTION_PROMPT },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
    const d = await res.json();
    return parseJSON(d.message?.content || "");
  }

  // Anthropic (fetch)
  return parseJSON(await anthropicMessage(prompt));
}

// ─── Image vision extraction ──────────────────────────────────────────────────
async function extractWithVision(buffer: Buffer, mimeType: string, fileName: string): Promise<ExtractedDocument> {
  const provider = getProvider();
  const base64 = buffer.toString("base64");

  if (provider === "groq") {
    // Use current Groq vision model
    const visionModel = process.env.GROQ_VISION_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct";
    const dataUrl = `data:${mimeType};base64,${base64}`;
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: visionModel,
        max_tokens: 4096,
        messages: [
          { role: "system", content: EXTRACTION_PROMPT },
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: dataUrl } },
              { type: "text", text: `File: ${fileName}\n\nExtract all financial data as JSON.` },
            ],
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Groq vision error: ${await res.text()}`);
    const d = await res.json();
    return parseJSON(d.choices?.[0]?.message?.content || "");
  }

  if (provider === "ollama") {
    const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OLLAMA_VISION_MODEL || "llava",
        stream: false,
        messages: [{
          role: "user",
          content: `File: ${fileName}\n\n${EXTRACTION_PROMPT}`,
          images: [base64],
        }],
      }),
    });
    if (!res.ok) throw new Error(`Ollama vision error: ${res.status}`);
    const d = await res.json();
    return parseJSON(d.message?.content || "");
  }

  // Anthropic vision (fetch)
  return parseJSON(await anthropicMessage([
    { type: "image", source: { type: "base64", media_type: mimeType, data: base64 } },
    { type: "text", text: `File: ${fileName}\n\nExtract all financial data as JSON.` },
  ]));
}

// ─── Anthropic native PDF (edge-safe, no renderer needed) ────────────────────
async function extractPdfWithAnthropic(buffer: Buffer, fileName: string): Promise<ExtractedDocument> {
  const base64 = buffer.toString("base64");
  return parseJSON(await anthropicMessage([
    { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
    { type: "text", text: `File: ${fileName}\n\nExtract all financial data as JSON.` },
  ]));
}

// ─── Public entry point ───────────────────────────────────────────────────────
export async function extractDocumentData(
  fileBuffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<ExtractedDocument> {
  const isCSV = mimeType === "text/csv" || fileName.toLowerCase().endsWith(".csv");
  const isPDF = mimeType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf");
  const isImage = mimeType.startsWith("image/");

  if (isCSV) {
    return extractWithText(fileBuffer.toString("utf-8").slice(0, 8000), fileName);
  }

  if (isPDF) {
    // Try text layer first (fast, accurate for digital PDFs)
    const pdfText = await extractPdfText(fileBuffer);
    if (pdfText.trim().length > 80) {
      return extractWithText(pdfText, fileName);
    }

    // Scanned PDF — render to image via sips (Node/macOS) then send to vision
    const imgBuffer = await renderPdfToImage(fileBuffer);
    if (imgBuffer) {
      return extractWithVision(imgBuffer, "image/jpeg", fileName);
    }

    // Edge runtime (no sips): if Anthropic is configured, it accepts PDFs natively
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        return await extractPdfWithAnthropic(fileBuffer, fileName);
      } catch (e) {
        console.warn("Anthropic PDF fallback failed:", e instanceof Error ? e.message : e);
      }
    }

    // Reached only for image-only (scanned) PDFs with no text layer on edge.
    return {
      documentType: "other",
      summary:
        "This looks like a scanned/image-only PDF, so there's no text to read. " +
        "Please upload a clear photo or screenshot (JPG/PNG) of the document instead — " +
        "that's read instantly. Digital PDFs (with selectable text) work directly.",
      data: { fileName, note: "scanned_pdf_no_text_layer" },
    };
  }

  if (isImage) {
    return extractWithVision(fileBuffer, mimeType, fileName);
  }

  throw new Error(`Unsupported file type: ${mimeType}`);
}

// ─── JSON parser ─────────────────────────────────────────────────────────────
function parseJSON(text: string): ExtractedDocument {
  const stripped = text.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
  const match = stripped.match(/\{[\s\S]*\}/);
  if (!match) {
    return { documentType: "other", summary: "Could not extract structured data.", data: { raw: text.slice(0, 300) } };
  }
  try {
    return JSON.parse(match[0]) as ExtractedDocument;
  } catch {
    return { documentType: "other", summary: "Parsed but could not structure data.", data: { raw: text.slice(0, 300) } };
  }
}
