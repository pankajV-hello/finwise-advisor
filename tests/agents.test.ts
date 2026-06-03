import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getProvider } from "@/lib/agents";

describe("getProvider", () => {
  const saved = { ...process.env };
  beforeEach(() => {
    delete process.env.AI_PROVIDER;
    delete process.env.GROQ_API_KEY;
    delete process.env.OLLAMA_BASE_URL;
    delete process.env.ANTHROPIC_API_KEY;
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it("honours an explicit AI_PROVIDER override", () => {
    process.env.AI_PROVIDER = "ollama";
    process.env.GROQ_API_KEY = "gsk_x";
    expect(getProvider()).toBe("ollama");
  });

  it("defaults to groq when GROQ_API_KEY is present", () => {
    process.env.GROQ_API_KEY = "gsk_x";
    expect(getProvider()).toBe("groq");
  });

  it("uses ollama when only OLLAMA_BASE_URL is set", () => {
    process.env.OLLAMA_BASE_URL = "http://localhost:11434";
    expect(getProvider()).toBe("ollama");
  });

  it("falls back to anthropic when nothing else is configured", () => {
    expect(getProvider()).toBe("anthropic");
  });

  it("prefers groq over ollama when both are present (cheapest cloud default)", () => {
    process.env.GROQ_API_KEY = "gsk_x";
    process.env.OLLAMA_BASE_URL = "http://localhost:11434";
    expect(getProvider()).toBe("groq");
  });
});
