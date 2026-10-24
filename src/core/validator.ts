import type { ChangeProposal, Field, FieldDraft, MissingProperty, Operation, Section, SimpleCondition } from "./types";

// Deterministic validator. It — not the AI — decides which properties are missing
// before a change can be configured.

const OPTION_TYPES = new Set(["radio", "select"]);

export function slugify(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

/** Deterministic normalization: derive keys from labels, trim strings. */
export function normalizeProposal(proposal: ChangeProposal): ChangeProposal {
  return {
    ...proposal,
    operations: proposal.operations.map((op): Operation => {
      if (op.op === "add_field") {
        const field = { ...op.field };
        if (field.label) field.label = field.label.trim();
        if (!field.key && field.label) field.key = slugify(field.label);
        if (field.required !== "conditional") delete field.condition;
        return { op: "add_field", field };
      }
      if (op.op === "update_field") {
        const changes = { ...op.changes };
        if (changes.required && changes.required !== "conditional") delete changes.condition;
        return { op: "update_field", fieldKey: op.fieldKey, changes };
      }
      return op;
    }),
  };
}

function checkCondition(
  condition: SimpleCondition | undefined,
  scope: Field[],
  index: number,
  missing: MissingProperty[],
) {
  if (!condition) {
    missing.push({ operationIndex: index, property: "condition", reason: "Obrigatoriedade condicional exige uma condição." });
    return;
  }
  const controller = scope.find((f) => f.key === condition.fieldKey);
  if (!controller) {
    missing.push({
      operationIndex: index,
      property: "condition",
      reason: `A condição referencia um campo inexistente no formulário (${condition.fieldKey}).`,
    });
    return;
  }
  if (controller.options && !controller.options.includes(condition.value)) {
    missing.push({
      operationIndex: index,
      property: "condition",
      reason: `O valor "${condition.value}" não é uma opção de "${controller.label}".`,
    });
  }
}

function checkFieldShape(draft: FieldDraft, base: Field | undefined, scope: Field[], index: number, missing: MissingProperty[]) {
  const merged = { ...base, ...draft };
  if (merged.required === "conditional") checkCondition(merged.condition, scope, index, missing);
  if (merged.type && OPTION_TYPES.has(merged.type) && !(merged.options && merged.options.length > 0)) {
    missing.push({ operationIndex: index, property: "options", reason: "Campos de escolha precisam das opções." });
  }
  if (merged.type === "masked_text" && !merged.mask) {
    missing.push({ operationIndex: index, property: "mask", reason: "Texto com máscara precisa do formato." });
  }
  if (merged.type === "file" && !(merged.acceptedFileFormats && merged.acceptedFileFormats.length > 0)) {
    missing.push({ operationIndex: index, property: "acceptedFileFormats", reason: "Anexos precisam dos formatos aceitos." });
  }
}

/**
 * @param formFields all fields of the form (conditions may reference a field of another section).
 *                   Defaults to the section's own fields.
 */
export function validateProposal(proposal: ChangeProposal, section: Section, formFields?: Field[]): MissingProperty[] {
  const scope = formFields ?? section.fields;
  const missing: MissingProperty[] = [];
  if (proposal.operations.length === 0 && !proposal.needsImplementer) {
    missing.push({ operationIndex: -1, property: "operation", reason: "Nenhuma alteração estruturada foi identificada." });
  }
  proposal.operations.forEach((op, index) => {
    if (op.op === "add_field") {
      const f = op.field;
      if (!f.label) missing.push({ operationIndex: index, property: "label", reason: "Novo campo precisa de um nome." });
      if (!f.type) missing.push({ operationIndex: index, property: "type", reason: "Novo campo precisa de um tipo." });
      if (!f.required) missing.push({ operationIndex: index, property: "required", reason: "Defina se o campo é obrigatório." });
      if (f.key && section.fields.some((x) => x.key === f.key)) {
        missing.push({ operationIndex: index, property: "label", reason: "Já existe um campo com esse nome na seção." });
      }
      checkFieldShape(f, undefined, scope, index, missing);
    } else if (op.op === "update_field") {
      const base = section.fields.find((x) => x.key === op.fieldKey);
      if (!base) {
        missing.push({ operationIndex: index, property: "fieldKey", reason: `Campo "${op.fieldKey}" não existe nesta seção.` });
        return;
      }
      const changed = Object.keys(op.changes).filter((k) => k !== "key");
      if (changed.length === 0) {
        missing.push({ operationIndex: index, property: "changes", reason: "Nenhuma propriedade alterada foi informada." });
      }
      checkFieldShape(op.changes, base, scope, index, missing);
    } else if (op.op === "remove_field") {
      if (!section.fields.some((x) => x.key === op.fieldKey)) {
        missing.push({ operationIndex: index, property: "fieldKey", reason: `Campo "${op.fieldKey}" não existe nesta seção.` });
      }
    }
  });
  return missing;
}

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * Deterministic alignment of AI output to the real form: fixes the casing/accents of a
 * condition value and resolves a condition that names a field by its label instead of its key.
 * It never invents values: if nothing matches, the proposal is left as is for the validator to flag.
 */
export function alignToForm(proposal: ChangeProposal, formFields: Field[]): ChangeProposal {
  const fixCondition = (c?: SimpleCondition): SimpleCondition | undefined => {
    if (!c) return c;
    const controller =
      formFields.find((f) => f.key === c.fieldKey) ?? formFields.find((f) => fold(f.label) === fold(c.fieldKey) || f.key === slugify(c.fieldKey));
    if (!controller) return c;
    const value = controller.options?.find((o) => fold(o) === fold(c.value)) ?? c.value;
    return { ...c, fieldKey: controller.key, value };
  };
  return {
    ...proposal,
    operations: proposal.operations.map((op) => {
      if (op.op === "add_field" && op.field.condition) return { ...op, field: { ...op.field, condition: fixCondition(op.field.condition) } };
      if (op.op === "update_field" && op.changes.condition) return { ...op, changes: { ...op.changes, condition: fixCondition(op.changes.condition) } };
      return op;
    }),
  };
}

const MASK_HINT = /(mascara|formato|padrao|[09A#]{3,})/;

/**
 * Deterministic guard against invented properties: helpText is never accepted from the AI
 * (the prefeitura did not write it), and mask only when the prefeitura's own words mention one.
 */
export function stripUngrounded(proposal: ChangeProposal, prefeituraTexts: string[]): ChangeProposal {
  const said = fold(prefeituraTexts.join(" "));
  const clean = (d: FieldDraft): FieldDraft => {
    const out = { ...d };
    delete out.helpText;
    if (out.mask && !MASK_HINT.test(said)) delete out.mask;
    return out;
  };
  return {
    ...proposal,
    operations: proposal.operations.map((op) => {
      if (op.op === "add_field") return { ...op, field: clean(op.field) };
      if (op.op === "update_field") return { ...op, changes: clean(op.changes) };
      return op;
    }),
  };
}

/** "Não sei" style answers mean: leave the decision pending (never guess). */
export function isDontKnow(answer: string): boolean {
  return /^(nao sei|nao tenho certeza|deixar (pendente|para depois))/.test(fold(answer));
}
