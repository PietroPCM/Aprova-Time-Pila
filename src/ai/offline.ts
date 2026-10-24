import type { AgendaItem, ChangeProposal, ComplementQuestion, Field, FieldDraft, MissingProperty, Operation, QAEntry, Section, Template } from "@/core/types";

// OFFLINE FALLBACK — used only when OPENAI_API_KEY is absent or the API call fails.
// It is a small rule-based stand-in so the demo flow can run without network.
// Every use is recorded in the trace with provider "offline-fallback". It is NOT the AI.

const lower = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const NEEDS_IMPLEMENTER = /\b(lei|legisla|decreto|calculo|taxa|valor da|formula)\b/;

/** Finds the field whose (significant) label word appears earliest in the text; ties → longer word. */
function bestFieldMatch(fields: Field[], text: string): Field | undefined {
  const t = lower(text);
  let best: { f: Field; pos: number; len: number } | undefined;
  for (const f of fields) {
    for (const w of lower(f.label).split(/[^a-z0-9]+/)) {
      if (w.length <= 4) continue;
      const pos = t.indexOf(w);
      if (pos < 0) continue;
      if (!best || pos < best.pos || (pos === best.pos && w.length > best.len)) best = { f, pos, len: w.length };
    }
  }
  return best?.f;
}

function requiredFromText(text: string, formFields: Field[]): FieldDraft | null {
  const a = lower(text);
  const controller = formFields.find((f) => f.options?.some((o) => a.includes(lower(o))));
  if (controller && /\b(so|somente|apenas|quando)\b/.test(a)) {
    const value = controller.options!.find((o) => a.includes(lower(o)))!;
    return { required: "conditional", condition: { fieldKey: controller.key, operator: "equals", value } };
  }
  if (/\b(nao|opcional)\b/.test(a)) return { required: "never" };
  if (/\b(sim|sempre|obrigatori[oa])\b/.test(a)) return { required: "always" };
  return null;
}

export function interpretOffline(input: {
  section: Section;
  formFields: Field[];
  request: string;
  qa: QAEntry[];
  previousProposal?: ChangeProposal;
}): ChangeProposal {
  const { section, request, qa, formFields } = input;
  const r = lower(request);
  if (NEEDS_IMPLEMENTER.test(r)) {
    return {
      summary: "Pedido depende de regra/legislação/cálculo.",
      operations: [],
      needsImplementer: { reason: "Pedido envolve legislação, taxa ou cálculo; precisa do implantador." },
    };
  }
  let operations: Operation[] = input.previousProposal?.operations.map((o) => JSON.parse(JSON.stringify(o))) ?? [];
  if (operations.length === 0) {
    const existing = bestFieldMatch(section.fields, request);
    if (r.includes("placa")) {
      operations = [{ op: "add_field", field: { label: "Placa do veículo", type: "text" } }];
    } else if (existing && /(remov|tirar|retirar)/.test(r)) {
      operations = [{ op: "remove_field", fieldKey: existing.key }];
    } else if (existing && /obrigat|opcional/.test(r)) {
      operations = [{ op: "update_field", fieldKey: existing.key, changes: {} }];
    } else {
      const m = request.match(/campo\s+(?:de\s+|do\s+|da\s+)?(.+?)[.!]?$/i);
      if (m) operations = [{ op: "add_field", field: { label: m[1].charAt(0).toUpperCase() + m[1].slice(1), type: "text" } }];
    }
  }
  // Apply obligation info stated in the request (only for updates) and in the complement answers.
  const texts = [...(operations[0]?.op === "update_field" ? [request] : []), ...qa.map((q) => q.answer)];
  for (const text of texts) {
    const patch = requiredFromText(text, formFields);
    if (!patch) continue;
    operations = operations.map((op) => {
      if (op.op === "add_field") return { ...op, field: { ...op.field, ...patch } };
      if (op.op === "update_field") return { ...op, changes: { ...op.changes, ...patch } };
      return op;
    });
  }
  const first = operations[0];
  const summary = !first
    ? "Não foi possível identificar a alteração."
    : first.op === "add_field"
      ? `Adicionar o campo "${first.field.label}".`
      : first.op === "update_field"
        ? `Alterar o campo "${section.fields.find((f) => f.key === first.fieldKey)?.label ?? first.fieldKey}".`
        : `Remover o campo "${section.fields.find((f) => f.key === first.fieldKey)?.label ?? first.fieldKey}".`;
  return { summary, operations };
}

function controllerPhrase(f: Field) {
  const l = f.label.replace(/\s+(é|e)$/i, "");
  return l.charAt(0).toLowerCase() + l.slice(1);
}

export function complementOffline(input: {
  section: Section;
  formFields: Field[];
  proposal: ChangeProposal;
  missing: MissingProperty[];
}): ComplementQuestion[] {
  const { section, proposal, missing, formFields } = input;
  const controller = formFields.find((f) => f.key === "portador_tipo") ?? formFields.find((f) => f.type === "radio");
  return missing.map((m) => {
    const op = proposal.operations[m.operationIndex];
    const label =
      op?.op === "add_field"
        ? op.field.label ?? "o novo campo"
        : op && "fieldKey" in op
          ? section.fields.find((f) => f.key === op.fieldKey)?.label ?? op.fieldKey
          : "a alteração";
    switch (m.property) {
      case "required":
        return {
          property: m.property,
          question: `O preenchimento de “${label}” será obrigatório?`,
          options: controller
            ? ["Sim, sempre", `Só quando ${controllerPhrase(controller)} for ${controller.options![0]}`, "Não, opcional"]
            : ["Sim, sempre", "Não, opcional"],
        };
      case "condition":
        return {
          property: m.property,
          question: `Isso vale para todos ou apenas em algum caso?`,
          options: controller ? controller.options!.map((o) => `Só quando ${controllerPhrase(controller)} for ${o}`) : [],
        };
      case "options":
        return { property: m.property, question: `Quais opções devem aparecer em “${label}”?`, options: [] };
      case "acceptedFileFormats":
        return { property: m.property, question: `Quais formatos de arquivo devem ser aceitos?`, options: ["PDF", "PDF, PNG ou JPG"] };
      case "type":
        return { property: m.property, question: `“${label}” é um texto, uma escolha entre opções ou um anexo?`, options: ["Texto", "Escolha entre opções", "Anexo"] };
      default:
        return { property: m.property, question: `Pode detalhar melhor o que deve mudar nesta seção?`, options: [] };
    }
  });
}

export function doubtOffline(input: { section: Section; question: string }): { answer: string; sufficientContext: boolean; pendingReason?: string } {
  const field = bestFieldMatch(input.section.fields, input.question);
  const q = lower(input.question);
  if (!field) {
    return {
      answer: "Não encontrei nesta seção um campo que corresponda à dúvida.",
      sufficientContext: false,
      pendingReason: "Dúvida sem correspondência no template; precisa do implantador.",
    };
  }
  const req = field.required === "always" ? "obrigatório" : field.required === "never" ? "opcional" : "condicional";
  const fmt = field.acceptedFileFormats ? ` Formatos aceitos: ${field.acceptedFileFormats.join(", ")}.` : "";
  const answer = `No modelo, “${field.label}” está configurado como ${req}.${fmt}`;
  if (/(obrigat|precisa|exig|lei)/.test(q)) {
    return {
      answer: `${answer} Se a prefeitura deve exigir isso é uma decisão local que o modelo não define.`,
      sufficientContext: false,
      pendingReason: `Definir com o implantador se “${field.label}” deve ser exigido pela prefeitura.`,
    };
  }
  return { answer, sufficientContext: true };
}

export function meetingOffline(input: { template: Template; notes: string[]; unresolvedSectionIds: string[]; agenda: AgendaItem[] }) {
  const detected: { sectionId: string; quote: string; kind: "keep_section" | "change" | "pending"; proposal?: ChangeProposal }[] = [];
  const formFields = input.template.sections.flatMap((s) => s.fields);
  const candidates = input.template.sections.filter((s) => input.unresolvedSectionIds.includes(s.id));
  const sentences = input.notes
    .flatMap((n) => n.split(/(?<=[.!?])\s+/))
    .map((s) => s.trim())
    .filter(Boolean);
  for (const s of sentences) {
    const t = lower(s);
    const field = bestFieldMatch(candidates.flatMap((c) => c.fields), s);
    const section = field ? candidates.find((c) => c.fields.includes(field)) : undefined;
    if (!section || !field) continue;
    if (/(pode manter|podem manter|mantem|manter como|fica igual|esta ok)/.test(t)) {
      detected.push({ sectionId: section.id, quote: s, kind: "keep_section" });
    } else if (/(obrigat|exigir|opcional)/.test(t)) {
      const patch = requiredFromText(s, formFields) ?? { required: "always" as const };
      detected.push({
        sectionId: section.id,
        quote: s,
        kind: "change",
        proposal: { summary: `Alterar a obrigatoriedade de “${field.label}”.`, operations: [{ op: "update_field", fieldKey: field.key, changes: patch }] },
      });
    } else if (/(depois|verificar|pendente|confirmar com)/.test(t)) {
      detected.push({ sectionId: section.id, quote: s, kind: "pending" });
    }
  }
  // agenda items of other processes: minimal keyword rules (fallback only)
  const agendaDecisions: { agendaItemId: string; quote: string; humanDecision: string }[] = [];
  for (const s of sentences) {
    const t = lower(s);
    for (const a of input.agenda) {
      if (a.agendaItemId === "art-reforma" && /\bart\b/.test(t) && /obrigat/.test(t)) {
        agendaDecisions.push({ agendaItemId: a.agendaItemId, quote: s, humanDecision: /reforma/.test(t) ? "ART obrigatória também para reformas sem ampliação" : "ART obrigatória" });
      }
      const n = t.match(/(\d+|um|dois|tres|quatro|cinco|seis|sete|dez|quinze|trinta)\s+dias/);
      if (a.agendaItemId === "prazo-antecedencia" && /(prazo|antecedencia)/.test(t) && n) {
        agendaDecisions.push({ agendaItemId: a.agendaItemId, quote: s, humanDecision: `Prazo mínimo de antecedência: ${n[1]} dias` });
      }
    }
  }
  return { detected, agendaDecisions };
}
