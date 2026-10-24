import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";
import type { z } from "zod";
import { dropNulls } from "@/core/schema";

// Server-side only. Loads INSTRUCTIONS/*.md at runtime and calls OpenAI with JSON output.

const INSTRUCTIONS_DIR = path.join(process.cwd(), "INSTRUCTIONS");
export const ORCHESTRATOR = "00-orquestrador-validacao.md";

export function readInstruction(file: string): string {
  return fs.readFileSync(path.join(INSTRUCTIONS_DIR, file), "utf8");
}

export function aiAvailable(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function modelName(): string {
  return process.env.OPENAI_MODEL || "gpt-5-mini";
}

/** Reasoning models (gpt-5*, o*) accept reasoning_effort; lower effort = lower latency for the demo. */
function reasoningParams(): { reasoning_effort?: "minimal" | "low" | "medium" | "high" } {
  const m = modelName();
  if (!/^(gpt-5|o\d)/.test(m)) return {};
  const e = process.env.OPENAI_REASONING_EFFORT as "minimal" | "low" | "medium" | "high" | undefined;
  return { reasoning_effort: e ?? "low" };
}

let client: OpenAI | null = null;
function getClient() {
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

/** Calls the model with orchestrator + specific instruction as system prompt; validates with Zod. */
export async function callJSON<S extends z.ZodTypeAny>(instructionFile: string, input: unknown, schema: S): Promise<z.infer<S>> {
  const system = `${readInstruction(ORCHESTRATOR)}\n\n---\n\n${readInstruction(instructionFile)}`;
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await getClient().chat.completions.create({
        model: modelName(),
        messages: [
          { role: "system", content: system },
          { role: "user", content: JSON.stringify(input) },
        ],
        response_format: { type: "json_object" },
        ...reasoningParams(),
      });
      const text = res.choices[0]?.message?.content ?? "";
      return schema.parse(dropNulls(JSON.parse(text)));
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
