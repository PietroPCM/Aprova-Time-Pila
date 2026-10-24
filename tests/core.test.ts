import { describe, expect, it } from "vitest";
import { DEMO_TEMPLATE } from "@/core/template-demo";
import { alignToForm, isDontKnow, normalizeProposal, stripUngrounded, validateProposal } from "@/core/validator";
import {
  confirmChange,
  createSession,
  firstUnresolved,
  keepSection,
  progress,
  setChangeDraft,
  TransitionError,
} from "@/core/state";
import { buildPartialSpec } from "@/core/spec";
import { diffSection } from "@/core/diff";
import type { Actor, ChangeProposal } from "@/core/types";

const T = DEMO_TEMPLATE;
const requerente = T.sections.find((s) => s.id === "requerente")!;
const prefeitura: Actor = { role: "prefeitura", name: "Analista da Prefeitura" };

const placaIncomplete: ChangeProposal = normalizeProposal({
  summary: "Adicionar campo placa do veículo",
  operations: [{ op: "add_field", field: { label: "Placa do veículo", type: "text" } }],
});

const placaComplete: ChangeProposal = normalizeProposal({
  summary: "Adicionar campo placa do veículo, obrigatório só para motorista",
  operations: [
    {
      op: "add_field",
      field: {
        label: "Placa do veículo",
        type: "text",
        required: "conditional",
        condition: { fieldKey: "portador_tipo", operator: "equals", value: "Motorista" },
      },
    },
  ],
});

describe("validator", () => {
  it("flags missing required on a new field", () => {
    const missing = validateProposal(placaIncomplete, requerente);
    expect(missing.map((m) => m.property)).toEqual(["required"]);
  });

  it("requires a condition when required is conditional", () => {
    const p = normalizeProposal({
      summary: "",
      operations: [{ op: "add_field", field: { label: "Placa do veículo", type: "text", required: "conditional" } }],
    });
    expect(validateProposal(p, requerente).map((m) => m.property)).toEqual(["condition"]);
  });

  it("rejects a condition with a value that is not an option of the controller", () => {
    const p = normalizeProposal({
      summary: "",
      operations: [
        {
          op: "add_field",
          field: {
            label: "Placa",
            type: "text",
            required: "conditional",
            condition: { fieldKey: "portador_tipo", operator: "equals", value: "Condutor" },
          },
        },
      ],
    });
    expect(validateProposal(p, requerente)[0].property).toBe("condition");
  });

  it("accepts a complete conditional field and derives its key", () => {
    expect(validateProposal(placaComplete, requerente)).toEqual([]);
    const op = placaComplete.operations[0];
    expect(op.op === "add_field" && op.field.key).toBe("placa_do_veiculo");
  });

  it("accepts a condition controlled by a field of another section only when form fields are given", () => {
    const documentos = T.sections.find((s) => s.id === "documentos")!;
    const p: ChangeProposal = {
      summary: "",
      operations: [
        {
          op: "update_field",
          fieldKey: "laudo_detran",
          changes: { required: "conditional", condition: { fieldKey: "portador_tipo", operator: "equals", value: "Motorista" } },
        },
      ],
    };
    expect(validateProposal(p, documentos).map((m) => m.property)).toEqual(["condition"]);
    expect(validateProposal(p, documentos, T.sections.flatMap((s) => s.fields))).toEqual([]);
  });

  it("flags update on unknown field and choice field without options", () => {
    const p: ChangeProposal = {
      summary: "",
      operations: [
        { op: "update_field", fieldKey: "nao_existe", changes: { required: "always" } },
        { op: "add_field", field: { label: "Tipo de veículo", type: "radio", required: "always" } },
      ],
    };
    expect(validateProposal(p, requerente).map((m) => m.property)).toEqual(["fieldKey", "options"]);
  });
});

describe("alignToForm", () => {
  it("fixes condition value casing and label-as-key without inventing values", () => {
    const fields = T.sections.flatMap((s) => s.fields);
    const p = alignToForm(
      {
        summary: "",
        operations: [
          {
            op: "add_field",
            field: { label: "Placa", type: "text", required: "conditional", condition: { fieldKey: "O portador de necessidades especiais é", operator: "equals", value: "motorista" } },
          },
        ],
      },
      fields,
    );
    const op = p.operations[0];
    expect(op.op === "add_field" && op.field.condition).toEqual({ fieldKey: "portador_tipo", operator: "equals", value: "Motorista" });
    const q = alignToForm(
      { summary: "", operations: [{ op: "add_field", field: { label: "X", condition: { fieldKey: "portador_tipo", operator: "equals", value: "Ciclista" } } }] },
      fields,
    );
    const op2 = q.operations[0];
    expect(op2.op === "add_field" && op2.field.condition?.value).toBe("Ciclista");
  });
});

describe("schema tolerance", () => {
  it("accepts camelCase op names and condition.field from the model without adding content", async () => {
    const { changeProposalSchema } = await import("@/core/schema");
    const parsed = changeProposalSchema.parse({
      summary: "x",
      operations: [{ op: "updateField", fieldKey: "laudo_detran", changes: { required: "conditional", condition: { field: "portador_tipo", operator: "equals", value: "Motorista" } } }],
    });
    expect(parsed.operations[0]).toEqual({
      op: "update_field",
      fieldKey: "laudo_detran",
      changes: { required: "conditional", condition: { fieldKey: "portador_tipo", operator: "equals", value: "Motorista" } },
    });
  });
});

describe("guards against invented properties", () => {
  it("drops helpText always and mask unless the prefeitura mentioned it", () => {
    const p: ChangeProposal = {
      summary: "",
      operations: [{ op: "add_field", field: { label: "Matrícula", type: "masked_text", mask: "000.000", helpText: "inventado" } }],
    };
    const a = stripUngrounded(p, ["Adicione um campo Matrícula do imóvel"]).operations[0];
    expect(a.op === "add_field" && a.field).toEqual({ label: "Matrícula", type: "masked_text" });
    const b = stripUngrounded(p, ["Matrícula com máscara 000.000"]).operations[0];
    expect(b.op === "add_field" && b.field.mask).toBe("000.000");
  });

  it("recognizes 'não sei' answers", () => {
    expect(isDontKnow("Não sei / deixar pendente")).toBe(true);
    expect(isDontKnow("Sim, sempre")).toBe(false);
  });
});

describe("state machine", () => {
  it("keep requires explicit confirmation and records actor/version", () => {
    const s0 = createSession(T);
    expect(() => keepSection(s0, T, "declaracao", prefeitura, "prefeitura_async", false)).toThrow(TransitionError);
    const s1 = keepSection(s0, T, "declaracao", prefeitura, "prefeitura_async", true);
    const d = s1.sections.declaracao.decision!;
    expect(s1.sections.declaracao.status).toBe("confirmed_unchanged");
    expect(d.actor.name).toBe(prefeitura.name);
    expect(d.templateVersion).toBe(T.version);
  });

  it("incomplete proposal cannot be confirmed; complete one can", () => {
    let s = createSession(T);
    s = setChangeDraft(s, T, "requerente", "Precisa pedir a placa do carro.", placaIncomplete, []);
    expect(s.sections.requerente.status).toBe("drafting_change");
    expect(() => confirmChange(s, T, "requerente", prefeitura, "prefeitura_async")).toThrow(TransitionError);
    s = setChangeDraft(s, T, "requerente", "Precisa pedir a placa do carro.", placaComplete, []);
    expect(s.sections.requerente.status).toBe("awaiting_confirmation");
    s = confirmChange(s, T, "requerente", prefeitura, "prefeitura_async");
    expect(s.sections.requerente.status).toBe("confirmed_changed");
  });

  it("needsImplementer goes to pending_requires_implementer", () => {
    let s = createSession(T);
    s = setChangeDraft(s, T, "documentos", "laudo conforme a lei", { summary: "", operations: [], needsImplementer: { reason: "Depende de legislação" } }, []);
    expect(s.sections.documentos.status).toBe("pending_requires_implementer");
  });

  it("resumes at the first unresolved section and computes progress", () => {
    let s = createSession(T);
    s = keepSection(s, T, "declaracao", prefeitura, "prefeitura_async", true);
    s = setChangeDraft(s, T, "requerente", "placa", placaComplete, []);
    s = confirmChange(s, T, "requerente", prefeitura, "prefeitura_async");
    expect(firstUnresolved(s, T)).toBe("documentos");
    expect(progress(s, T)).toEqual({ total: 4, confirmedUnchanged: 1, confirmedChanged: 1, pending: 2 });
  });
});

describe("diff and partial spec", () => {
  it("shows the added field in the diff", () => {
    const rows = diffSection(requerente, placaComplete);
    const added = rows.filter((r) => r.kind === "added");
    expect(added).toHaveLength(1);
    expect(added[0].after?.label).toBe("Placa do veículo");
    expect(rows.filter((r) => r.kind === "unchanged")).toHaveLength(requerente.fields.length);
  });

  it("spec is partial while there are pending sections", () => {
    let s = createSession(T);
    s = keepSection(s, T, "declaracao", prefeitura, "prefeitura_async", true);
    s = setChangeDraft(s, T, "requerente", "Precisa pedir a placa do carro.", placaComplete, []);
    s = confirmChange(s, T, "requerente", prefeitura, "prefeitura_async");
    const spec = buildPartialSpec(s, T);
    expect(spec.status).toBe("partial");
    expect(spec.format).toBe("PROVISORIO-v0");
    expect(spec.confirmed_unchanged.map((x) => x.section)).toEqual(["declaracao"]);
    expect(spec.confirmed_changed[0]).toMatchObject({
      operation: "add_field",
      section: "requerente",
      field: "placa_do_veiculo",
      properties: { type: "text", required: "conditional", condition: { fieldKey: "portador_tipo", value: "Motorista" } },
      source: "prefeitura_async",
    });
    expect(spec.pending.map((p) => p.section)).toEqual(["documentos", "complementares"]);
  });
});
