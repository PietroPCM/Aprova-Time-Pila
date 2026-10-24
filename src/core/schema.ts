import { z } from "zod";

// Zod schemas for everything the AI returns. AI output is never trusted
// without passing through these and then through the deterministic validator.

export const fieldTypeSchema = z.enum(["text", "masked_text", "radio", "checkbox", "select", "file", "autofill"]);
export const requiredModeSchema = z.enum(["always", "never", "conditional"]);

export const conditionSchema = z.object({
  fieldKey: z.string().min(1),
  operator: z.literal("equals"),
  value: z.string().min(1),
});

// All properties optional on purpose: the validator decides what is missing.
export const fieldDraftSchema = z.object({
  key: z.string().optional(),
  label: z.string().optional(),
  type: fieldTypeSchema.optional(),
  required: requiredModeSchema.optional(),
  condition: conditionSchema.optional(),
  options: z.array(z.string()).optional(),
  mask: z.string().optional(),
  acceptedFileFormats: z.array(z.string()).optional(),
  helpText: z.string().optional(),
});

/** Tolerates harmless naming variants from the model (updateField, condition.field) — never adds content. */
function coerceOperation(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const o = { ...(raw as Record<string, unknown>) };
  if (typeof o.op === "string") o.op = o.op.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
  for (const k of ["field", "changes"]) {
    const d = o[k] as Record<string, unknown> | undefined;
    const c = d?.condition as Record<string, unknown> | undefined;
    if (c && c.fieldKey === undefined && typeof c.field === "string") {
      const { field, ...rest } = c;
      o[k] = { ...d, condition: { ...rest, fieldKey: field } };
    }
  }
  return o;
}

const operationUnion = z.discriminatedUnion("op", [
  z.object({ op: z.literal("add_field"), field: fieldDraftSchema }),
  z.object({ op: z.literal("update_field"), fieldKey: z.string(), changes: fieldDraftSchema }),
  z.object({ op: z.literal("remove_field"), fieldKey: z.string() }),
]);

export const operationSchema = z.preprocess(coerceOperation, operationUnion);

export const changeProposalSchema = z.object({
  summary: z.string(),
  operations: z.array(operationSchema),
  needsImplementer: z.object({ reason: z.string() }).optional(),
});

export const complementSchema = z.object({
  questions: z.array(
    z.object({
      property: z.string(),
      question: z.string(),
      options: z.array(z.string()).default([]),
    }),
  ),
});

export const doubtAnswerSchema = z.object({
  answer: z.string(),
  sufficientContext: z.boolean(),
  pendingReason: z.string().optional(),
});

export const meetingAnalysisSchema = z.object({
  agendaDecisions: z
    .array(z.object({ agendaItemId: z.string(), quote: z.string(), humanDecision: z.string() }))
    .default([]),
  detected: z.array(
    z.object({
      sectionId: z.string(),
      quote: z.string(),
      kind: z.enum(["keep_section", "change", "pending"]),
      proposal: changeProposalSchema.optional(),
    }),
  ),
});

export const meetingSummarySchema = z.object({
  decisions: z.array(z.string()),
  changes: z.array(z.string()),
  pending: z.array(z.string()),
  nextSteps: z.array(z.string()),
});

/** Strips nulls that some models emit for optional fields. */
export function dropNulls<T>(value: T): T {
  if (Array.isArray(value)) return value.map(dropNulls) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== null) out[k] = dropNulls(v);
    }
    return out as T;
  }
  return value;
}
