import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

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

Return a JSON object with this structure:
{
  "documentType": one of: bank_statement | salary_slip | t4 | t1 | w2 | 1040 | investment_statement | mortgage_statement | receipt | other,
  "institution": "bank or employer name",
  "periodStart": "YYYY-MM-DD or null",
  "periodEnd": "YYYY-MM-DD or null",
  "summary": "2-3 sentence plain English summary of the document",
  "data": { any additional key-value pairs specific to this doc type },
  "transactions": [ for bank statements: { date, description, amount (positive=credit, negative=debit), type: credit|debit, category } ],
  "incomeDetails": { for pay stubs: grossPay, netPay, taxDeducted, rrspDeduction, cppContribution, eiPremium, period, employer },
  "taxDetails": { for T4/T1/W2/1040: taxYear, totalIncome, taxableIncome, taxOwing, refundOwing, rrspContributions, employmentIncome },
  "investmentDetails": { for investment statements: accountType, totalValue, holdings, deposits, withdrawals, gains }
}

Be precise with numbers — use the exact figures from the document. Omit keys that don't apply.`;

export async function extractDocumentData(
  fileBuffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<ExtractedDocument> {
  const isImage =
    mimeType.startsWith("image/") || mimeType === "application/pdf";

  if (isImage) {
    // Use Claude's vision for PDFs and images
    const base64 = fileBuffer.toString("base64");

    const mediaType =
      mimeType === "application/pdf"
        ? "application/pdf"
        : (mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp");

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: [
        {
          type: "text",
          text: EXTRACTION_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: [
            {
              type:
                mimeType === "application/pdf" ? "document" : "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64,
              },
            } as Anthropic.DocumentBlockParam | Anthropic.ImageBlockParam,
            {
              type: "text",
              text: `File name: ${fileName}\n\nExtract all financial data from this document as JSON.`,
            },
          ],
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    return parseExtractedJSON(text);
  }

  if (mimeType === "text/csv" || fileName.endsWith(".csv")) {
    const csvText = fileBuffer.toString("utf-8");
    return extractFromCSV(csvText, fileName);
  }

  throw new Error(`Unsupported file type: ${mimeType}`);
}

async function extractFromCSV(
  csvText: string,
  fileName: string
): Promise<ExtractedDocument> {
  const preview = csvText.slice(0, 6000); // first 6k chars

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: [
      {
        type: "text",
        text: EXTRACTION_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: `File name: ${fileName}\n\nCSV content:\n\`\`\`\n${preview}\n\`\`\`\n\nExtract all financial data as JSON.`,
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  return parseExtractedJSON(text);
}

function parseExtractedJSON(text: string): ExtractedDocument {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
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
