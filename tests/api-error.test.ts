import { describe, expect, it } from "vitest";

// Opt-in: makes a real network call with an INVALID key to prove the API-error path
// never breaks the flow and is labeled as fallback. Run: RUN_API_ERROR_TEST=1 npx vitest run tests/api-error.test.ts
const run = process.env.RUN_API_ERROR_TEST === "1";

describe.runIf(run)("API error handling", () => {
  it("falls back, labels the provider and keeps a short error message", async () => {
    process.env.OPENAI_API_KEY = "invalid-key-for-test";
    const { interpretChange } = await import("@/ai/agent");
    const { DEMO_TEMPLATE } = await import("@/core/template-demo");
    const section = DEMO_TEMPLATE.sections[1];
    const r = await interpretChange({ section, formFields: DEMO_TEMPLATE.sections.flatMap((s) => s.fields), request: "Precisa pedir a placa do carro.", qa: [] });
    expect(r.provider).toBe("offline-fallback");
    expect(r.error).toBeTruthy();
    expect(r.error).toBe("IA indisponível: chave inválida (401)");
    expect(r.error).not.toMatch(/sk-/);
    expect(r.result.operations.length).toBeGreaterThan(0);
  }, 60000);
});
