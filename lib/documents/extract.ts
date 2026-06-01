/**
 * Document extraction — provider-aware
 *
 * Groq  (default): llama-3.2-11b-vision-preview — free, handles images/PDFs
 * Ollama (local):  llava or llama3.2-vision — free, runs on your machine
 * Anthropic:       claude-sonnet-4-6 — paid, best accuracy for complex docs
 *
 * CSV files are text-only so any provider works (no vision needed).
 */

import Anthropic from "@anthropic-ai/sdk";
import { getProvider } from "@/lib/agents";

export type DocumentType =
  | "bank_statement"
  | "salary_slip"
  | "t4"
  | "t1"
  | "w2"
  | "1040"
  | "investment_statement"
  | "receipt"
  | "mortgage_statement"
  | "other";

export interface ExtractedDocument {
  documentType: DocumentType;
  institution?: string;
  periodStart?: string;
  periodEnd?: string;
  summary: string;
  data: Record<string, unknown>;
  transactions?: Array<{
    date: string;
    description: string;
    amount: number;
    type: "credit" | "debit";
    category?: string;
  }>;
  incomeDetails?: {
    grossPay?: number;
    netPay?: number;
    taxDeducted?: number;
    rrspDeduction?: number;
    cppContribution?: number;
    eiPremium?: number;
    period?: string;
    employer?: string;
  };
  taxDetails?: {
    taxYear?: number;
    totalIncome?: number;
    taxableIncome?: number;
    taxOwing?: number;
    refundOwing?: number;
    rrspContributions?: number;
    employmentIncome?: number;
    otherIncome?: number;
  };
  investmentDetails?: {
    accountType?: string;
    totalValue?: number;
    holdings?: Array<{ name: string; value: number; units?: number }>;
    deposits?: number;
    withdrawals?: number;
    gains?: number;
  };
}

const EXTRACTION_PROMPT = `You are a financial document parser. Extract ALL financial data from this document with maximum accuracy.

Return ONLY a JSON object with this exact structure (no markdown, no explanation, just JSON):
{
  "documentType": "bank_statement|salary_slip|t4|t1|w2|1040|investment_statement|mortgage_statement|receipt|other",
  "institution": "bank or employer name or null",
  "periodStart": "YYYY-MM-DD or null",
  "periodEnd": "YYYY-MM-DD or null",
  "summary": "2-3 sentence plain English summary",
  "data": {},
  "transactions": [{ "date": "YYYY-MM-DD", "description": "string", "amount": number, "type": "credit|debit", "category": "string" }],
  "incomeDetails": { "grossPay": number, "netPay": number, "taxDeducted": number, "rrspDeduction": number, "cppContribution": number, "eiPremium": number, "period": "string", "employer": "string" },
  "taxDetails": { "taxYear": number, "totalIncome": number, "taxableIncome": number, "taxOwing": number, "refundOwing": number, "rrspContributions": number, "employmentIncome": number },
  "investmentDetails": { "accountType": "string", "totalValue": number, "holdings": [], "deposits": number, "withdrawals": number, "gains": number }
}

Rules:
- Use exact figures from the document
- Omit keys that don't apply (don't include empty arrays or null fields)
- For bank statements, extract every transaction
- Return ONLY the JSON object, nothing else`;

// ─── Provider: Anthropic ─────────────────────────────────────────────────────
async function extractWithAnthropic(
  fileBuffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<ExtractedDocument> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const base64 = fileBuffer.toString("base64");
  const mediaType =
    mimeType === "application/pdf"
      ? "application/pdf"
      : (mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp");

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: [{ type: "text", text: EXTRACTION_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{
      role: "user",
      content: [
        mimeType === "application/pdf"
          ? { type: "document", source: { type: "base64", media_type: mediaType, data: base64 } } as Anthropic.DocumentBlockParam
          : { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } } as Anthropic.ImageBlockParam,
        { type: "text", text: `File: ${fileName}\n\nExtract all financial data as JSON.` },
      ],
    }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  return parseJSON(text);
}

// ─── Provider: Groq (vision) ─────────────────────────────────────────────────
async function extractWithGroq(
  fileBuffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<ExtractedDocument> {
  const isImage = mimeType.startsWith("image/");
  const isPdf = mimeType === "application/pdf";

  // Groq vision only supports images directly — for PDFs, send as base64 image
  // if the PDF is actually an image-based PDF
  const messages: Array<{ role: string; content: unknown }> = [];

  if (isImage) {
    const base64 = fileBuffer.toString("base64");
    const dataUrl = `data:${mimeType};base64,${base64}`;
    messages.push({
      role: "user",
      content: [
        { type: "image_url", image_url: { url: dataUrl } },
        { type: "text", text: `File: ${fileName}\n\n${EXTRACTION_PROMPT}` },
      ],
    });
  } else {
    // PDF or CSV — send text content with extraction prompt
    const textContent =
      isPdf
        ? `[PDF document: ${fileName}. Extract financial data based on the filename and any detectable structure]`
        : fileBuffer.toString("utf-8").slice(0, 8000);

    messages.push({
      role: "user",
      content: `File: ${fileName}\n\nDocument content:\n${textContent}\n\n${EXTRACTION_PROMPT}`,
    });
  }

  const body = {
    model: process.env.GROQ_VISION_MODEL || "llama-3.2-11b-vision-preview",
    max_tokens: 4096,
    messages: [
      { role: "system", content: EXTRACTION_PROMPT },
      ...messages,
    ],
  };

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq vision error: ${err}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || "";
  return parseJSON(text);
}

// ─── Provider: Ollama (local vision) ─────────────────────────────────────────
async function extractWithOllama(
  fileBuffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<ExtractedDocument> {
  const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  const visionModel = process.env.OLLAMA_VISION_MODEL || "llava";
  const isImage = mimeType.startsWith("image/");

  let body: Record<string, unknown>;

  if (isImage) {
    // Ollama supports base64 images in the images array
    const base64 = fileBuffer.toString("base64");
    body = {
      model: visionModel,
      stream: false,
      messages: [
        { role: "system", content: EXTRACTION_PROMPT },
        {
          role: "user",
          content: `File: ${fileName}\n\nExtract all financial data as JSON.`,
          images: [base64],
        },
      ],
    };
  } else {
    // Text-based (CSV or PDF text layer)
    const textContent = mimeType === "text/csv"
      ? fileBuffer.toString("utf-8").slice(0, 8000)
      : `[PDF: ${fileName}]`;

    body = {
      model: process.env.OLLAMA_MODEL || "llama3.1:8b",
      stream: false,
      messages: [
        { role: "system", content: EXTRACTION_PROMPT },
        { role: "user", content: `File: ${fileName}\n\nContent:\n${textContent}\n\nExtract all financial data as JSON.` },
      ],
    };
  }

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Ollama error: ${response.status}. Is Ollama running? Run: ollama serve`);
  }

  const data = await response.json();
  const text = data.message?.content || "";
  return parseJSON(text);
}

// ─── CSV extraction (text-only, any provider) ─────────────────────────────────
async function extractFromCSV(csvText: string, fileName: string): Promise<ExtractedDocument> {
  const preview = csvText.slice(0, 7000);
  const prompt = `File: ${fileName}\n\nCSV content:\n\`\`\`\n${preview}\n\`\`\`\n\nExtract all financial data as JSON.`;
  const provider = getProvider();

  if (provider === "groq") {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
        max_tokens: 4096,
        messages: [{ role: "system", content: EXTRACTION_PROMPT }, { role: "user", content: prompt }],
      }),
    });
    const data = await res.json();
    return parseJSON(data.choices?.[0]?.message?.content || "");
  }

  if (provider === "ollama") {
    const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL || "llama3.1:8b",
        stream: false,
        messages: [{ role: "system", content: EXTRACTION_PROMPT }, { role: "user", content: prompt }],
      }),
    });
    const data = await res.json();
    return parseJSON(data.message?.content || "");
  }

  // Anthropic fallback
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: [{ type: "text", text: EXTRACTION_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: prompt }],
  });
  const text = response.content[0].type === "text" ? response.content[0].text : "";
  return parseJSON(text);
}

// ─── Public entry point ───────────────────────────────────────────────────────
export async function extractDocumentData(
  fileBuffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<ExtractedDocument> {
  const isCSV = mimeType === "text/csv" || fileName.toLowerCase().endsWith(".csv");
  if (isCSV) return extractFromCSV(fileBuffer.toString("utf-8"), fileName);

  const provider = getProvider();
  switch (provider) {
    case "groq":      return extractWithGroq(fileBuffer, mimeType, fileName);
    case "ollama":    return extractWithOllama(fileBuffer, mimeType, fileName);
    case "anthropic": return extractWithAnthropic(fileBuffer, mimeType, fileName);
    default:          return extractWithGroq(fileBuffer, mimeType, fileName);
  }
}

// ─── JSON parser ─────────────────────────────────────────────────────────────
function parseJSON(text: string): ExtractedDocument {
  // Strip markdown code fences if present
  const stripped = text.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
  const jsonMatch = stripped.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      documentType: "other",
      summary: "Could not extract structured data from this document.",
      data: { rawText: text.slice(0, 500) },
    };
  }
  try {
    return JSON.parse(jsonMatch[0]) as ExtractedDocument;
  } catch {
    return {
      documentType: "other",
      summary: "Document parsed but data could not be structured.",
      data: { rawText: text.slice(0, 500) },
    };
  }
}
