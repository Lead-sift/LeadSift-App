import Anthropic from "@anthropic-ai/sdk";

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  throw new Error("Falta ANTHROPIC_API_KEY en el entorno");
}

export const anthropic = new Anthropic({ apiKey });

export const MODELOS = {
  clasificador: "claude-haiku-4-5-20251001",
  cualificador: "claude-sonnet-5",
} as const;
