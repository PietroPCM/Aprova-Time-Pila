import { changeProposalSchema, complementSchema, doubtAnswerSchema, meetingAnalysisSchema, meetingSummarySchema } from "@/core/schema";
import { normalizeProposal } from "@/core/validator";
import type { AgendaItem, ChangeProposal, ComplementQuestion, Field, MissingProperty, QAEntry, Section, Template, TraceEntry } from "@/core/types";
import { aiAvailable, callJSON } from "./llm";
import { complementOffline, doubtOffline, interpretOffline, meetingOffline } from "./offline";

// The single validation agent. Each capability maps to one runtime INSTRUCTION file.

export type Provider = TraceEntry["provider"];
export interface AgentResult<T> {
  result: T;
  provider: Provider;
  instruction: string;
  error?: string;
}

/** Never surface raw provider messages (they can echo parts of the key or request). */
function describeError(err: unknown): string {
  const status = (err as { status?: number })?.status;
  if (status === 401) return "IA indisponível: chave inválida (401)";
  if (status === 429) return "IA indisponível: limite de uso (429)";
  if (status && status >= 500) return `IA indisponível: erro do provedor (${status})`;
  if (status) return `IA indisponível: requisição recusada (${status})`;
  if (err instanceof SyntaxError || (err as { name?: string })?.name === "ZodError") return "IA respondeu fora do formato esperado";
  return "IA indisponível: falha de conexão";
}

async function run<T>(instruction: string, online: () => Promise<T>, offline: () => T): Promise<AgentResult<T>> {
  if (!aiAvailable()) return { result: offline(), provider: "offline-fallback", instruction, error: "OPENAI_API_KEY ausente" };
  try {
    return { result: await online(), provider: "openai", instruction };
  } catch (err) {
    return { result: offline(), provider: "offline-fallback", instruction, error: describeError(err) };
  }
}

/** Fields of the whole form that can control a condition (choice fields). */
function controllers(fields: Field[]) {
  return fields.filter((f) => f.options && f.options.length).map((f) => ({ key: f.key, label: f.label, options: f.options }));
}

function sectionContext(section: Section) {
  return { id: section.id, title: section.title, guidance: section.guidance, fields: section.fields };
}

export async function interpretChange(input: {
  section: Section;
  formFields: Field[];
  request: string;
  qa: QAEntry[];
  previousProposal?: ChangeProposal;
}): Promise<AgentResult<ChangeProposal>> {
  const r = await run(
    "01-interpretar-alteracao.md",
    () =>
      callJSON(
        "01-interpretar-alteracao.md",
        {
          section: sectionContext(input.section),
          formFields: controllers(input.formFields),
          request: input.request,
          qa: input.qa,
          previousProposal: input.previousProposal ?? null,
        },
        changeProposalSchema,
      ),
    () => interpretOffline(input),
  );
  return { ...r, result: normalizeProposal(r.result as ChangeProposal) };
}

export async function formulateComplement(input: {
  section: Section;
  formFields: Field[];
  request?: string;
  proposal: ChangeProposal;
  missing: MissingProperty[];
}): Promise<AgentResult<ComplementQuestion[]>> {
  return run(
    "02-formular-complemento.md",
    async () => {
      const out = await callJSON(
        "02-formular-complemento.md",
        {
          section: sectionContext(input.section),
          formFields: controllers(input.formFields),
          request: input.request ?? null,
          proposal: input.proposal,
          missing: input.missing,
        },
        complementSchema,
      );
      return out.questions as ComplementQuestion[];
    },
    () => complementOffline(input),
  );
}

export async function explainDoubt(input: { section: Section; question: string }) {
  return run(
    "04-explicar-duvida.md",
    () => callJSON("04-explicar-duvida.md", { section: sectionContext(input.section), question: input.question }, doubtAnswerSchema),
    () => doubtOffline(input),
  );
}

export async function analyzeMeeting(input: { template: Template; notes: string[]; previousNotes?: string[]; unresolvedSectionIds: string[]; agenda: AgendaItem[] }) {
  return run(
    "03-acompanhar-reuniao.md",
    () =>
      callJSON(
        "03-acompanhar-reuniao.md",
        {
          mode: "detect_decisions",
          sections: input.template.sections.filter((s) => input.unresolvedSectionIds.includes(s.id)).map(sectionContext),
          formFields: controllers(input.template.sections.flatMap((s) => s.fields)),
          agenda: input.agenda.map((a) => ({ agendaItemId: a.agendaItemId, processTitle: a.processTitle, question: a.question, context: a.context })),
          notes: input.notes,
          previousNotes: input.previousNotes ?? [],
        },
        meetingAnalysisSchema,
      ),
    () => meetingOffline(input),
  );
}

export async function summarizeMeeting(input: { notes: string[]; sessionDigest: unknown }, offline: () => { decisions: string[]; changes: string[]; pending: string[]; nextSteps: string[] }) {
  return run(
    "03-acompanhar-reuniao.md",
    () => callJSON("03-acompanhar-reuniao.md", { mode: "summarize", notes: input.notes, session: input.sessionDigest }, meetingSummarySchema),
    offline,
  );
}
