/**
 * Document extraction — provider-aware
 *
 * PDFs (text layer) → pdf-parse → text model
 * PDFs (scanned)    → sips (macOS) or sharp → render to JPEG → vision model
 * Images            → vision model
 * CSV               → text model
 */

import Anthropic from "@anthropic-ai/sdk";
import { execSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { getProvider } from "@/lib/agents";

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
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const result = await parser.getText();
    await parser.destroy();
    return result.text?.slice(0, 10000) || "";
  } catch (err) {
    console.warn("PDF text extraction failed:", err instanceof Error ? err.message : err);
    return "";
  }
}

// ─── Scanned PDF → JPEG via macOS sips ───────────────────────────────────────
function renderPdfToImage(buffer: Buffer): Buffer | null {
  const tmpDir = os.tmpdir();
  const pdfPath = path.join(tmpDir, `fw_${Date.now()}.pdf`);
  const imgPath = path.join(tmpDir, `fw_${Date.now()}.jpg`);
  try {
    fs.writeFileSync(pdfPath, buffer);
    // sips is macOS built-in — renders first page of PDF to JPEG
    execSync(
      `sips -s format jpeg -s dpiHeight 150 -s dpiWidth 150 "${pdfPath}" --out "${imgPath}"`,
      { timeout: 15000, stdio: "pipe" }
    );
    if (fs.existsSync(imgPath)) {
      const img = fs.readFileSync(imgPath);
      return img;
    }
    return null;
  } catch {
    return null;
  } finally {
    if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
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

  // Anthropic
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: [{ type: "text", text: EXTRACTION_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: prompt }],
  });
  const text2 = response.content[0].type === "text" ? response.content[0].text : "";
  return parseJSON(text2);
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

  // Anthropic vision
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: [{ type: "text", text: EXTRACTION_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: mimeType as "image/jpeg" | "image/png" | "image/webp" | "image/gif", data: base64 } },
        { type: "text", text: `File: ${fileName}\n\nExtract all financial data as JSON.` },
      ],
    }],
  });
  const t = response.content[0].type === "text" ? response.content[0].text : "";
  return parseJSON(t);
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

    // Scanned PDF — render to image via sips (macOS) then send to vision
    console.log("Scanned PDF detected — rendering to image via sips...");
    const imgBuffer = renderPdfToImage(fileBuffer);
    if (imgBuffer) {
      return extractWithVision(imgBuffer, "image/jpeg", fileName);
    }

    // Final fallback — ask the model to guess from filename only
    return extractWithText(
      `Scanned PDF document named: ${fileName}. ` +
      `Based on the filename, extract what financial data you can infer and set documentType appropriately. ` +
      `Set summary to explain this is a scanned document that could not be rendered.`,
      fileName
    );
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
