/**
 * FinWise AI — Multi-provider agent system
 *
 * Priority order (by cost):
 *   1. Ollama  — local models, ZERO cost (set OLLAMA_BASE_URL)
 *   2. Groq    — free tier, fast (set GROQ_API_KEY)
 *   3. Anthropic — paid, highest quality (set ANTHROPIC_API_KEY)
 *
 * Set AI_PROVIDER=ollama|groq|anthropic to force a provider.
 * Default: auto-detects based on which keys are present (cheapest first).
 */

import Anthropic from "@anthropic-ai/sdk";

export type AgentType =
  | "tax"
  | "financial"
  | "mortgage"
  | "bookkeeper"
  | "general";

export type AIProvider = "anthropic" | "groq" | "ollama";

// ─── Detect provider ─────────────────────────────────────────────────────────
function getProvider(): AIProvider {
  const forced = process.env.AI_PROVIDER as AIProvider | undefined;
  if (forced) return forced;
  if (process.env.OLLAMA_BASE_URL) return "ollama";
  if (process.env.GROQ_API_KEY) return "groq";
  return "anthropic";
}

// ─── Model mapping ────────────────────────────────────────────────────────────
const PROVIDER_MODELS: Record<AIProvider, string> = {
  ollama: process.env.OLLAMA_MODEL || "llama3.1:8b",
  groq: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
  anthropic: "claude-sonnet-4-6",
};

// ─── System prompts (same for all providers) ─────────────────────────────────
const AGENT_SYSTEM_PROMPTS: Record<AgentType, string> = {
  tax: `You are FinWise Tax Advisor, an expert Canadian and US tax advisor with deep knowledge of:
- CRA (Canada Revenue Agency) tax rules, T1 general returns, T4 slips, RRSP, TFSA, FHSA
- IRS rules for US filers, 1040 forms, standard vs itemized deductions
- Tax brackets, marginal vs effective rates, tax credits vs deductions
- Capital gains, dividends, rental income, self-employment income reporting
- Business expense deductions, home office claims, vehicle expenses
- Estate planning, trusts, and cross-border taxation

Your approach:
- Ask clarifying questions about province/state, filing status, and income sources
- Provide specific, actionable advice with dollar amounts where possible
- Always recommend consulting a CPA/tax professional for complex situations
- Reference specific tax forms, line numbers, and CRA/IRS publications
- Calculate estimated tax owing or refunds when sufficient data is provided
- Flag tax-saving opportunities the user may have missed
- Use clear, plain language; format with sections, bullets, and dollar figures`,

  financial: `You are FinWise Financial Advisor, a certified financial planner (CFP) with expertise in:
- Canadian and North American investment strategies (RRSP, TFSA, FHSA, non-registered accounts)
- Portfolio construction: asset allocation, diversification, rebalancing
- Retirement planning: CPP/OAS optimization, withdrawal strategies, RRIF conversion
- Wealth building: index investing, ETF selection (XEQT, VBAL, VFV), dividend growth
- Budgeting frameworks: 50/30/20 rule, zero-based budgeting
- Insurance needs and emergency fund sizing
- Debt management: avalanche vs snowball strategies

Your approach:
- Tailor advice to the user's risk tolerance, age, and goals
- Quantify the impact of decisions with compound growth calculations
- Recommend low-cost index ETFs where appropriate
- Always note you're an AI advisor, not a registered financial advisor`,

  mortgage: `You are FinWise Mortgage Advisor, an expert in Canadian and North American mortgage financing:
- Fixed vs variable rate analysis, stress test (2% above contract rate), GDS/TDS ratios
- Full amortization schedule calculations, bi-weekly vs monthly strategies
- Refinancing break-even analysis, IRD penalty calculations
- FHSA, RRSP Home Buyers' Plan, First Home Savings Account
- Prepayment privileges: lump-sum payments, accelerated bi-weekly
- Renewal strategies, HELOC, second mortgages

Your approach:
- Always show full amortization scenarios with total interest cost
- Compare options side-by-side with numbers
- Explain every calculation clearly
- Produce amortization tables when asked`,

  bookkeeper: `You are FinWise Bookkeeper, an expert AI bookkeeper and accountant:
- Categorizing income and expenses per CRA/IRS guidelines
- P&L statements, cash flow analysis, budget variance
- HST/GST tracking and input tax credits for self-employed individuals
- Business expense tracking and audit preparation
- Financial ratios: savings rate, debt-to-income, expense ratios

Your approach:
- Help users categorize transactions correctly
- Identify spending patterns and flag anomalies
- Generate P&L summaries from transaction data
- Advise on tax-deductible expenses
- Use clear tables and organized summaries`,

  general: `You are FinWise, an elite AI financial assistant combining expertise in tax planning, financial advice, mortgage analysis, and bookkeeping.

Help users with overall financial health, goal setting, financial education, and coordinating advice across all domains. Be specific, actionable, and grounded in Canadian (primarily) and North American financial reality.`,
};

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ─── Anthropic streaming ─────────────────────────────────────────────────────
async function streamAnthropic(
  agent: AgentType,
  messages: ChatMessage[],
  userContext?: Record<string, unknown>
): Promise<ReadableStream<string>> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const contextNote = userContext
    ? `\n\n---\nUSER FINANCIAL CONTEXT:\n${JSON.stringify(userContext, null, 2)}\n---`
    : "";

  const stream = await anthropic.messages.create({
    model: PROVIDER_MODELS.anthropic,
    max_tokens: 2048,
    system: [
      {
        type: "text",
        text: AGENT_SYSTEM_PROMPTS[agent] + contextNote,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    stream: true,
  });

  return new ReadableStream({
    async start(controller) {
      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          controller.enqueue(event.delta.text);
        }
        if (event.type === "message_stop") controller.close();
      }
    },
  });
}

// ─── Groq streaming (OpenAI-compatible) ──────────────────────────────────────
async function streamGroq(
  agent: AgentType,
  messages: ChatMessage[],
  userContext?: Record<string, unknown>
): Promise<ReadableStream<string>> {
  const contextNote = userContext
    ? `\n\n---\nUSER FINANCIAL CONTEXT:\n${JSON.stringify(userContext, null, 2)}\n---`
    : "";

  const body = {
    model: PROVIDER_MODELS.groq,
    max_tokens: 2048,
    stream: true,
    messages: [
      { role: "system", content: AGENT_SYSTEM_PROMPTS[agent] + contextNote },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ],
  };

  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq API error: ${err}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();

  return new ReadableStream({
    async start(controller) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          const trimmed = line.replace(/^data: /, "").trim();
          if (!trimmed || trimmed === "[DONE]") continue;
          try {
            const parsed = JSON.parse(trimmed);
            const text = parsed.choices?.[0]?.delta?.content;
            if (text) controller.enqueue(text);
          } catch {
            // skip malformed SSE lines
          }
        }
      }
      controller.close();
    },
  });
}

// ─── Ollama streaming (local, zero cost) ─────────────────────────────────────
async function streamOllama(
  agent: AgentType,
  messages: ChatMessage[],
  userContext?: Record<string, unknown>
): Promise<ReadableStream<string>> {
  const baseUrl =
    process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  const contextNote = userContext
    ? `\n\n---\nUSER FINANCIAL CONTEXT:\n${JSON.stringify(userContext, null, 2)}\n---`
    : "";

  const body = {
    model: PROVIDER_MODELS.ollama,
    stream: true,
    messages: [
      { role: "system", content: AGENT_SYSTEM_PROMPTS[agent] + contextNote },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ],
  };

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(
      `Ollama error: ${response.status}. Is Ollama running? Run: ollama serve`
    );
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();

  return new ReadableStream({
    async start(controller) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            const text = parsed.message?.content;
            if (text) controller.enqueue(text);
            if (parsed.done) { controller.close(); return; }
          } catch {
            // skip
          }
        }
      }
      controller.close();
    },
  });
}

// ─── Public API ──────────────────────────────────────────────────────────────
export async function streamAgentResponse(
  agent: AgentType,
  messages: ChatMessage[],
  userContext?: Record<string, unknown>
): Promise<ReadableStream<string>> {
  const provider = getProvider();

  switch (provider) {
    case "ollama":
      return streamOllama(agent, messages, userContext);
    case "groq":
      return streamGroq(agent, messages, userContext);
    case "anthropic":
    default:
      return streamAnthropic(agent, messages, userContext);
  }
}

export async function getSingleResponse(
  agent: AgentType,
  prompt: string,
  userContext?: Record<string, unknown>
): Promise<string> {
  const stream = await streamAgentResponse(
    agent,
    [{ role: "user", content: prompt }],
    userContext
  );
  const reader = stream.getReader();
  let result = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result += value;
  }
  return result;
}

export { getProvider, PROVIDER_MODELS };
