import fs from "fs/promises";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Single server-side service wrapping the Anthropic API (PRD §7).
 * No API keys in the browser; prompt templates live in /prompts;
 * model names configurable via environment variables.
 */

export const MODELS = {
  /// per-para drafting and card suggestions (Sonnet class per PRD)
  drafting: process.env.MODEL_DRAFTING || "claude-sonnet-5",
  /// full brief generation (Opus class per PRD)
  brief: process.env.MODEL_BRIEF || "claude-opus-4-8",
};

export function aiAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

const PROMPTS_DIR = process.env.PROMPTS_DIR || path.resolve(process.cwd(), "prompts");

/** Load a versioned prompt template from /prompts and fill {{placeholders}}. */
export async function loadPrompt(
  name: string,
  vars: Record<string, string>
): Promise<string> {
  let template: string;
  try {
    template = await fs.readFile(path.join(PROMPTS_DIR, `${name}.md`), "utf-8");
  } catch {
    throw new Error(
      `Prompt template "${name}" not found. This deployment does not ship prompt ` +
        `templates — create prompts/${name}.md (see README) to enable AI drafting.`
    );
  }
  for (const [key, value] of Object.entries(vars)) {
    template = template.replaceAll(`{{${key}}}`, value);
  }
  return template;
}

export interface GenerateResult {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

/**
 * Run a generation. Streams under the hood so long brief generations don't
 * hit HTTP timeouts. Logs token/latency metadata only (PRD §7: completion
 * content is stored solely in the resulting artefact).
 */
export async function generate(opts: {
  model: string;
  system?: string;
  prompt: string;
  maxTokens?: number;
}): Promise<GenerateResult> {
  const started = Date.now();
  const stream = getClient().messages.stream({
    model: opts.model,
    max_tokens: opts.maxTokens ?? 16000,
    ...(opts.system ? { system: opts.system } : {}),
    messages: [{ role: "user", content: opts.prompt }],
  });
  const message = await stream.finalMessage();
  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  const result: GenerateResult = {
    text,
    model: opts.model,
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
    latencyMs: Date.now() - started,
  };
  console.log(
    `[ai] model=${result.model} in=${result.inputTokens} out=${result.outputTokens} ms=${result.latencyMs}`
  );
  return result;
}

/** Standard 503 payload when AI is unavailable or disabled for the matter. */
export function aiUnavailableReason(matterAiEnabled: boolean): string | null {
  if (!matterAiEnabled) return "AI features are disabled for this matter.";
  if (!aiAvailable())
    return "AI is not configured. Set ANTHROPIC_API_KEY in the server environment.";
  return null;
}
