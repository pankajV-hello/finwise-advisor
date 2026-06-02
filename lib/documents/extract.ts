/**
 * Document extraction — provider-aware
 *
 * PDFs   → pdf-parse (text) → Groq/Ollama/Anthropic text model (most reliable)
 * Images → Groq vision / Ollama llava / Anthropic vision
 * CSV    → text model on any provider
 */

import Anthropic from "@anthropic-ai/sdk";
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

// ─── PDF text extraction ──────────────────────────────────────────────────────
async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    // Dynamic import to avoid edge runtime issues
    const pdfParse = (await import("pdf-parse")).default;
    const data = await pdfParse(buffer);
    return data.text?.slice(0, 10000) || "";
  } catch {
    return "";
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
    // Always extract PDF as text — more reliable than vision for payslips/statements
    const pdfText = await extractPdfText(fileBuffer);
    if (pdfText.trim().length > 50) {
      return extractWithText(pdfText, fileName);
    }
    // If text extraction yields nothing (scanned PDF), fall through to vision
    if (isImage || mimeType === "application/pdf") {
      return extractWithText(
        `[Scanned PDF: ${fileName} — could not extract text. Please describe the document type and any visible figures.]`,
        fileName
      );
    }
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
