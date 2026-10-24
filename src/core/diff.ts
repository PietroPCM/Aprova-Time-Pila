import type { ChangeProposal, Field, Section } from "./types";

export type DiffKind = "unchanged" | "added" | "changed" | "removed";

export interface DiffRow {
  kind: DiffKind;
  key: string;
  before?: Field;
  after?: Field;
  changedProps: string[];
}

/** Applies a (validated) proposal to a section's fields. Pure and deterministic. */
export function applyProposal(section: Section, proposal: ChangeProposal): Field[] {
  let fields: Field[] = section.fields.map((f) => ({ ...f }));
  for (const op of proposal.operations) {
    if (op.op === "add_field") {
      const f = op.field;
      fields.push({
        key: f.key ?? "novo_campo",
        label: f.label ?? "(sem nome)",
        type: f.type ?? "text",
        required: f.required ?? "never",
        ...(f.condition ? { condition: f.condition } : {}),
        ...(f.options ? { options: f.options } : {}),
        ...(f.mask ? { mask: f.mask } : {}),
        ...(f.acceptedFileFormats ? { acceptedFileFormats: f.acceptedFileFormats } : {}),
        ...(f.helpText ? { helpText: f.helpText } : {}),
      });
    } else if (op.op === "update_field") {
      fields = fields.map((f) => {
        if (f.key !== op.fieldKey) return f;
        const next: Field = { ...f, ...op.changes, key: f.key } as Field;
        if (next.required !== "conditional") delete next.condition;
        return next;
      });
    } else if (op.op === "remove_field") {
      fields = fields.filter((f) => f.key !== op.fieldKey);
    }
  }
  return fields;
}

const COMPARED: (keyof Field)[] = ["label", "type", "required", "condition", "options", "mask", "acceptedFileFormats", "autoFill", "helpText"];

export function diffSection(section: Section, proposal: ChangeProposal): DiffRow[] {
  const after = applyProposal(section, proposal);
  const rows: DiffRow[] = [];
  for (const before of section.fields) {
    const a = after.find((f) => f.key === before.key);
    if (!a) {
      rows.push({ kind: "removed", key: before.key, before, changedProps: [] });
      continue;
    }
    const changedProps = COMPARED.filter((p) => JSON.stringify(before[p]) !== JSON.stringify(a[p]));
    rows.push({ kind: changedProps.length ? "changed" : "unchanged", key: before.key, before, after: a, changedProps });
  }
  for (const a of after) {
    if (!section.fields.some((f) => f.key === a.key)) rows.push({ kind: "added", key: a.key, after: a, changedProps: [] });
  }
  return rows;
}

const TYPE_LABEL: Record<string, string> = {
  text: "Texto",
  masked_text: "Texto com formato",
  radio: "Escolha entre opções",
  checkbox: "Caixa de confirmação",
  select: "Lista de seleção",
  file: "Anexo",
  autofill: "Preenchido automaticamente",
};

export function typeLabel(t: string): string {
  return TYPE_LABEL[t] ?? t;
}

function subject(label: string) {
  const l = label.replace(/\s+(é|e)$/i, "");
  return l.charAt(0).toLowerCase() + l.slice(1);
}

/** Human-readable obligation, e.g. "Obrigatório quando o portador de necessidades especiais for Motorista". */
export function describeRequired(field: Pick<Field, "required" | "condition">, fields: Field[]): string {
  if (field.required === "always") return "Obrigatório";
  if (field.required === "never") return "Opcional";
  const c = field.condition;
  if (!c) return "Obrigatório em alguns casos (condição não definida)";
  const controller = fields.find((f) => f.key === c.fieldKey);
  return `Obrigatório quando ${controller ? subject(controller.label) : c.fieldKey} for ${c.value}`;
}

/** One-line human description of a field's configuration (no technical vocabulary). */
export function describeField(f: Field, fields: Field[]): string {
  const parts = [typeLabel(f.type), describeRequired(f, fields)];
  if (f.options) parts.push(`opções: ${f.options.join(", ")}`);
  if (f.mask) parts.push(`formato ${f.mask}`);
  if (f.acceptedFileFormats) parts.push(f.acceptedFileFormats.join(", "));
  return parts.join(" · ");
}

export interface HumanChange {
  kind: "added" | "changed" | "removed";
  label: string;
  before: string;
  after: string;
}

/** Deterministic, human before/after built from the structure (never from AI text). */
export function humanChanges(section: Section, proposal: ChangeProposal, formFields: Field[]): HumanChange[] {
  return diffSection(section, proposal)
    .filter((r) => r.kind !== "unchanged")
    .map((r) => {
      if (r.kind === "added") return { kind: "added", label: r.after!.label, before: `Não existe o campo “${r.after!.label}”`, after: `+ ${r.after!.label} — ${describeField(r.after!, formFields)}` };
      if (r.kind === "removed") return { kind: "removed", label: r.before!.label, before: `${r.before!.label} — ${describeField(r.before!, formFields)}`, after: `Campo “${r.before!.label}” removido` };
      return { kind: "changed", label: r.after!.label, before: `${r.before!.label} — ${describeField(r.before!, formFields)}`, after: `${r.after!.label} — ${describeField(r.after!, formFields)}` };
    });
}

/** Plain-language explanation of what a field asks for (no technical vocabulary). */
export function explainInput(f: Pick<Field, "type" | "options" | "mask" | "acceptedFileFormats" | "autoFill">): string {
  switch (f.type) {
    case "text":
      return "Texto livre";
    case "masked_text":
      return f.mask ? `Preenchido no formato ${f.mask}` : "Texto com formato definido";
    case "radio":
    case "select":
      return f.options?.length ? `Escolha entre: ${f.options.join(" ou ")}` : "Escolha entre opções";
    case "checkbox":
      return "Caixa para marcar";
    case "file":
      return `Anexo${f.acceptedFileFormats?.length ? ` (${f.acceptedFileFormats.join(", ")})` : ""}`;
    case "autofill":
      return `Preenchido automaticamente${f.autoFill ? ` (${f.autoFill})` : ""}`;
    default:
      return typeLabel(f.type);
  }
}
