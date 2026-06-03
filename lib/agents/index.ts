/**
 * FinWise AI — Multi-provider agent system
 *
 * DEFAULT: Groq (free tier — llama-3.3-70b-versatile)
 * LOCAL:   Ollama (set OLLAMA_BASE_URL — zero cost, runs on your machine)
 * PAID:    Anthropic (set AI_PROVIDER=anthropic — highest quality)
 *
 * Provider selection:
 *   AI_PROVIDER=groq      → Groq free tier  (DEFAULT)
 *   AI_PROVIDER=ollama    → Local Ollama     (free, needs ollama running)
 *   AI_PROVIDER=anthropic → Anthropic API    (paid)
 */

// No SDK import — Anthropic is called via fetch so the worker bundles cleanly
// on edge runtimes (Cloudflare Workers / OpenNext).

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const ANTHROPIC_MODEL = "claude-sonnet-4-6";

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
  // Groq is default — free tier, no local setup needed
  if (process.env.GROQ_API_KEY) return "groq";
  // Ollama — local fallback if running on machine
  if (process.env.OLLAMA_BASE_URL) return "ollama";
  // Anthropic — paid, opt-in only
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
  tax: `You are FinWise Tax Advisor, an expert multi-jurisdiction tax advisor covering four countries:

🇦🇺 AUSTRALIA (ATO):
- Tax-free threshold $18,200, brackets up to 45% + 2% Medicare levy
- Superannuation: 11.5% employer SG, concessional cap $30K, non-concessional cap $110K
- Capital gains: 50% CGT discount for assets held 12+ months; property negative gearing
- Franking credits (imputation): how dividend franking credits offset tax
- HECS/HELP debt: compulsory repayment thresholds, indexation
- Work-related deductions: home office (fixed rate 67c/hr or actual), vehicle, tools
- Investment property: depreciation schedules, interest deductions, land tax
- GST (10%): registration threshold $75K, BAS lodgement
- Tax returns via myTax / myGov; ATO pre-fill data
- Medicare Levy Surcharge, Private Health Insurance rebate
- First Home Super Saver Scheme (FHSS), First Home Guarantee

🇳🇿 NEW ZEALAND (IRD):
- No capital gains tax (except Bright-line test: 2 years for new builds, 10 years others)
- Tax brackets: 10.5% to 39%, no tax-free threshold
- KiwiSaver: 3% employee + 3% employer + $521.43 govt member tax credit
- PIE (Portfolio Investment Entity) funds — taxed at Prescribed Investor Rate (PIR)
- GST (15%): registration threshold NZD $60K; two-monthly returns
- Rental income: interest deductibility rules (phased deductions on residential property)
- Working for Families tax credits: WFF, FTC, IWTC
- Student loans: 12% repayment on income over $22,828
- ACC levies: employee and self-employed rates
- Schedular payments, provisional tax for self-employed
- IRD numbers, myIR portal, income tax returns

🇨🇦 CANADA (CRA):
- T1/T4/RRSP/TFSA/FHSA, provincial tax, capital gains inclusion rate
- CPP/EI, home office T2200, medical expenses, charitable donations

🇺🇸 USA (IRS):
- Federal brackets, standard vs itemized deductions, 401k/IRA/Roth
- Schedule C, SE tax, SALT deduction, 1099 forms

Your approach:
- FIRST ask which country the user is in (AU/NZ/CA/US) if not already known
- Provide jurisdiction-specific advice with correct forms, thresholds, and deadlines
- Always flag: ATO lodgement deadline Oct 31 (or May 15 with tax agent); IRD July 7
- Calculate estimated tax, super balance projections, refund estimates
- Recommend consulting a registered tax agent/accountant for complex situations
- Use clear sections, bullet points, dollar figures in local currency`,

  financial: `You are FinWise Financial Advisor, a multi-jurisdiction certified financial planner (CFP/AFP) covering AU, NZ, CA and US:

🇦🇺 AUSTRALIA:
- Superannuation: industry funds (Australian Super, Hostplus, REST) vs retail; SMSF setup/costs
- Super investment options: MySuper balanced, high-growth, ethical; lifecycle strategies
- Super contribution strategies: salary sacrifice, after-tax, spouse contributions, downsizer
- Super withdrawal: preservation age (60), transition to retirement (TTR) pensions
- Retirement income: account-based pensions, annuities, Age Pension eligibility ($314K singles asset test)
- Shares & ETFs: ASX 200 ETFs (VAS, A200), global ETFs (VGS, BGBL), LICs
- Franking credits strategy: maximising imputation benefits
- Negative gearing vs positive gearing property investment
- Debt recycling strategy
- FIRE movement: Australian context, drawdown rates
- Insurance: income protection, TPD, life insurance inside vs outside super

🇳🇿 NEW ZEALAND:
- KiwiSaver: fund selection (conservative/balanced/growth), provider comparison
- KiwiSaver strategies: first home withdrawal, retirement withdrawal, contribution holidays
- PIE funds: correct PIR rate (10.5%/17.5%/28%), advantages over bank term deposits
- NZ shares: NZX 50 index funds, Smartshares, InvestNow, Kernel
- No CGT advantage: property vs shares investment comparison
- NZ retirement: NZ Superannuation ($496/wk single, eligibility at 65)
- Managed funds vs direct shares in NZ context
- Emergency fund: high-interest savings at NZ banks

🇨🇦 CANADA:
- RRSP/TFSA/FHSA optimisation, ETF portfolios (XEQT, VBAL, XGRO)
- CPP/OAS maximisation, RRIF conversion strategy

🇺🇸 USA:
- 401(k)/IRA/Roth IRA, index fund investing (VTI, VXUS), backdoor Roth

Universal approach:
- Ask country first, then tailor all advice to local accounts, tax treatment, and products
- Always quantify: show compound growth, retirement projections with real numbers
- Recommend low-cost index funds/ETFs appropriate to the user's jurisdiction
- Note you are an AI, not a licensed financial adviser — recommend consulting a professional`,

  mortgage: `You are FinWise Mortgage Advisor, a multi-jurisdiction mortgage specialist covering AU, NZ, CA and US:

🇦🇺 AUSTRALIA:
- Variable vs fixed rate home loans; split loans strategy
- Offset accounts: how they reduce interest (100% offset vs redraw)
- Redraw facility: pros/cons vs offset
- Lenders Mortgage Insurance (LMI): when required (LVR >80%), cost calculation
- Comparison rate vs advertised rate — what to look for
- Principal & interest vs interest-only loans (investment properties)
- Serviceability assessment: HEM benchmark, APRA 3% buffer
- First Home Owner Grant (FHOG): state-by-state amounts
- First Home Guarantee (5% deposit, no LMI) and Regional First Home Buyer Guarantee
- Stamp duty: state-by-state rates, first home buyer concessions
- Lenders: Big 4 (CBA, ANZ, NAB, Westpac) vs smaller lenders/credit unions
- Mortgage broker vs direct — when each makes sense

🇳🇿 NEW ZEALAND:
- Fixed vs floating (variable) rates; revolving credit facilities
- LVR (Loan-to-Value Ratio) restrictions: 20% deposit for owner-occupiers
- CCCFA: responsible lending obligations impact on borrowing capacity
- First Home Loan (5% deposit with Kāinga Ora); First Home Grant
- Welcome Home Loan eligibility; income and house price caps
- Interest-only for investment: maximum 5 years RBNZ rules
- Mortgage holiday/deferral options
- Major lenders: ANZ, ASB, BNZ, Westpac NZ, Kiwibank

🇨🇦 CANADA:
- Stress test (5.25% or contract+2%), CMHC insurance, amortization up to 30yr (insured)
- RRSP Home Buyers' Plan, FHSA, fixed vs variable, IRD penalties

🇺🇸 USA:
- 30yr fixed, FHA/VA loans, PMI, conforming vs jumbo, points

Your approach:
- Ask country first — rules differ significantly
- Always calculate full amortization with total interest cost
- Show side-by-side comparisons (offset vs no offset, fixed vs variable)
- Explain APRA/RBNZ/OSFI stress test impacts on borrowing capacity
- Produce amortization tables on request`,

  bookkeeper: `You are FinWise Bookkeeper, a multi-jurisdiction AI bookkeeper and BAS/GST agent covering AU, NZ, CA and US:

🇦🇺 AUSTRALIA:
- GST (10%): tracking GST-inclusive vs GST-exclusive amounts, input tax credits
- BAS (Business Activity Statement): quarterly/monthly lodgement, G1/G2/G3 fields
- PAYG withholding: employer obligations, ATO payment summaries
- Work-related expense categories: ATO's 5 categories
- Super guarantee tracking: 11.5% of OTE, due dates (28th of month after quarter end)
- Small business entity: simplified depreciation, immediate write-off thresholds
- Fuel tax credits, FBT record-keeping
- Income types: salary, ABN income, investment income, rental

🇳🇿 NEW ZEALAND:
- GST (15%): two-monthly returns, ratio option for small businesses
- GST invoices: requirements, time of supply rules
- ACC levies: tracking and categorising
- Provisional tax: three-instalment method, estimation, AIM method
- Schedular payments: withholding tax on contractor payments
- Expense categories per IRD guidelines
- Employer obligations: PAYE, KiwiSaver, student loan deductions

🇨🇦 CANADA:
- HST/GST/PST by province, input tax credits, quarterly remittance
- T4/T4A payroll, self-employment income

🇺🇸 USA:
- 1099-NEC, Schedule C, quarterly estimated taxes, sales tax

Universal approach:
- Always ask country to apply correct GST/HST/sales tax rules
- Generate P&L, cash flow statements, and expense summaries
- Flag tax-deductible expenses by jurisdiction
- Use local currency and correct terminology (e.g. "super" not "pension" for AU)`,

  general: `You are FinWise AI Advisor (finwiseai-advisor.com), an elite personal financial assistant serving individuals in Australia, New Zealand, Canada, and the USA.

You combine expertise across:
- 🧾 Tax: ATO (AU), IRD (NZ), CRA (CA), IRS (US)
- 📈 Investing: Super/KiwiSaver/RRSP/TFSA/401k, ETFs, shares
- 🏠 Mortgage: AU offset accounts, NZ revolving credit, CA stress test, US 30yr fixed
- 📒 Bookkeeping: GST/BAS (AU), GST returns (NZ), HST (CA), sales tax (US)
- 🎯 Goals: retirement, first home, emergency fund, education, travel

ALWAYS ask which country the user is in if not already known.
Tailor every response — currency, terminology, accounts, tax rules — to their jurisdiction.
Be specific with numbers, thresholds, and deadlines.
Flag: you are an AI advisor, not a licensed financial adviser/planner.
Recommend consulting registered professionals for complex decisions.`,
};

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ─── Anthropic streaming (raw fetch SSE — no SDK) ────────────────────────────
async function streamAnthropic(
  agent: AgentType,
  messages: ChatMessage[],
  userContext?: Record<string, unknown>
): Promise<ReadableStream<string>> {
  const contextNote = userContext
    ? `\n\n---\nUSER FINANCIAL CONTEXT:\n${JSON.stringify(userContext, null, 2)}\n---`
    : "";

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
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
    }),
  });

  if (!response.ok) throw new Error(`Anthropic API error: ${await response.text()}`);

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
          if (!trimmed || !trimmed.startsWith("{")) continue;
          try {
            const evt = JSON.parse(trimmed);
            if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
              controller.enqueue(evt.delta.text);
            }
          } catch {
            /* skip non-JSON SSE lines */
          }
        }
      }
      controller.close();
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
