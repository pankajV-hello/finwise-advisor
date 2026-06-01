import { NextRequest, NextResponse } from "next/server";
import { streamAgentResponse, type AgentType } from "@/lib/agents";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { agent, messages, userContext } = body as {
      agent: AgentType;
      messages: Array<{ role: "user" | "assistant"; content: string }>;
      userContext?: Record<string, unknown>;
    };

    if (!agent || !messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const validAgents: AgentType[] = [
      "tax",
      "financial",
      "mortgage",
      "bookkeeper",
      "general",
    ];
    if (!validAgents.includes(agent)) {
      return NextResponse.json({ error: "Invalid agent" }, { status: 400 });
    }

    const stream = await streamAgentResponse(agent, messages, userContext);

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
