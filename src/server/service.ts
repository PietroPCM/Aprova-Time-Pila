import { analyzeMeeting, explainDoubt, formulateComplement, interpretChange, summarizeMeeting, type AgentResult } from "@/ai/agent";
import { aiAvailable, modelName } from "@/ai/llm";
import { diffSection, humanChanges } from "@/core/diff";
import { buildPartialSpec } from "@/core/spec";
import {
  addTrace,
  createSession,
  cancelChange,
  confirmChange,
  firstUnresolved,
  isResolved,
  keepSection,
  markPending,
  progress,
  recordAnswer,
  setChangeDraft,
  TransitionError,
} from "@/core/state";
import { DEMO_TEMPLATE } from "@/core/template-demo";
import { allFields } from "@/core/template-utils";
import { MAIN_CLIENT_AGENDA } from "@/demo/fixtures";
import { alignToForm, isDontKnow, normalizeProposal, stripUngrounded, validateProposal } from "@/core/validator";
import type { Actor, ChangeProposal, DecisionSource, Session } from "@/core/types";

const T = DEMO_TEMPLATE;
const CODE_VALIDATOR = "validador determinístico (código)";
const CODE_STATE = "máquina de estados (código)";

export const ACTORS: Record<"prefeitura" | "implantacao", Actor> = {
  prefeitura: { role: "prefeitura", name: "Analista da Prefeitura" },
  implantacao: { role: "implantacao", name: "Implantador Aprova" },
};

function section(id: string) {
  const s = T.sections.find((x) => x.id === id);
  if (!s) throw new TransitionError(`Seção desconhecida: ${id}`);
  return s;
}

function traceAgent(session: Session, r: AgentResult<unknown>, action: string, result: string) {
  return addTrace(session, {
    instruction: r.instruction,
    action,
    result: r.error ? `${result} [fallback offline: ${r.error}]` : result,
    provider: r.provider,
  });
}

export function view(session: Session) {
  const diffs: Record<string, ReturnType<typeof diffSection>> = {};
  for (const s of T.sections) {
    const st = session.sections[s.id];
    if (st.proposal && st.proposal.operations.length) diffs[s.id] = diffSection(s, st.proposal);
  }
  return {
    template: T,
    session,
    progress: progress(session, T),
    firstUnresolved: firstUnresolved(session, T) ?? null,
    diffs,
    spec: buildPartialSpec(session, T),
    ai: { available: aiAvailable(), model: aiAvailable() ? modelName() : null },
    // Last AI-step outcome, so the UI can say when the fallback (demo mode) was used.
    lastAgent: [...session.trace].reverse().find((t) => t.provider !== "deterministic") ?? null,
  };
}

/** Runs interpretation → deterministic validation → complement questions. Shared by async and meeting. */
async function interpretAndValidate(session: Session, sectionId: string, request: string, previous?: ChangeProposal) {
  const sec = section(sectionId);
  const st = session.sections[sectionId];
  const interp = await interpretChange({ section: sec, formFields: allFields(T), request, qa: st.qa, previousProposal: previous });
  session = traceAgent(session, interp, "interpretar alteração", interp.result.needsImplementer ? `requer implantador: ${interp.result.needsImplementer.reason}` : interp.result.summary);
  const proposal = alignToForm(stripUngrounded(interp.result, [request, ...st.qa.map((q) => q.answer)]), allFields(T));
  const missing = validateProposal(proposal, sec, allFields(T));
  session = addTrace(session, {
    instruction: CODE_VALIDATOR,
    action: "validar schema da proposta",
    result: proposal.needsImplementer ? "não validado: requer implantador" : missing.length ? `faltando: ${missing.map((m) => m.property).join(", ")}` : "proposta completa",
    provider: "deterministic",
  });
  let questions: Awaited<ReturnType<typeof formulateComplement>>["result"] = [];
  if (missing.length && !proposal.needsImplementer) {
    const comp = await formulateComplement({ section: sec, formFields: allFields(T), request, proposal, missing });
    questions = comp.result;
    session = traceAgent(session, comp, "formular complemento", questions.map((q) => q.question).join(" | "));
  }
  session = setChangeDraft(session, T, sectionId, request, proposal, questions);
  session = addTrace(session, { instruction: CODE_STATE, action: "atualizar estado", result: `${sectionId} → ${session.sections[sectionId].status}`, provider: "deterministic" });
  return session;
}

/** Human-language state for the meeting summary (built by code, no internal keys). */
function digest(session: Session) {
  const agenda = (session.meeting.agendaDecisions ?? []).filter((d) => d.status === "accepted").map((d) => ({ process: d.processTitle, decision: d.humanDecision }));
  const open = MAIN_CLIENT_AGENDA.filter((a) => !agenda.some((x) => x.process === a.processTitle)).map((a) => ({ process: a.processTitle, pending: a.question }));
  return { cartaoPcd: digestSections(session), otherProcessesDecided: agenda, otherProcessesPending: open };
}

function digestSections(session: Session) {
  const fields = allFields(T);
  const STATUS: Record<string, string> = {
    confirmed_unchanged: "mantida como no modelo",
    confirmed_changed: "alteração confirmada",
    pending: "pendente",
    pending_requires_implementer: "pendente (precisa da implantação)",
    drafting_change: "alteração em andamento",
    awaiting_confirmation: "alteração aguardando confirmação",
    not_started: "sem decisão",
  };
  return T.sections.map((s) => {
    const st = session.sections[s.id];
    return {
      section: s.title,
      status: STATUS[st.status] ?? st.status,
      changes: st.status === "confirmed_changed" && st.proposal ? humanChanges(s, st.proposal, fields).map((c) => c.after) : [],
      pendingReason: isResolved(st) ? undefined : st.pendingReason,
    };
  });
}

function offlineSummary(session: Session) {
  const decisions: string[] = [];
  const changes: string[] = [];
  const pending: string[] = [];
  for (const s of T.sections) {
    const st = session.sections[s.id];
    if (st.status === "confirmed_unchanged") decisions.push(`${s.title}: mantida como no modelo (${st.decision?.source === "meeting" ? "na reunião" : "assíncrono"}).`);
    else if (st.status === "confirmed_changed") {
      decisions.push(`${s.title}: alteração confirmada.`);
      changes.push(`${s.title}: ${st.proposal?.summary ?? "alteração"}`);
    } else pending.push(`${s.title}: ${st.pendingReason ?? "sem decisão"}`);
  }
  for (const d of session.meeting.detected.filter((x) => x.status === "detected_in_meeting")) pending.push(`Detecção não confirmada: “${d.quote}”`);
  for (const d of session.meeting.agendaDecisions ?? []) {
    if (d.status === "accepted") {
      decisions.push(`${d.processTitle}: ${d.humanDecision}.`);
      changes.push(`${d.processTitle}: ${d.humanDecision}`);
    }
  }
  for (const a of MAIN_CLIENT_AGENDA) if (!(session.meeting.agendaDecisions ?? []).some((d) => d.agendaItemId === a.agendaItemId && d.status === "accepted")) pending.push(`${a.processTitle}: ${a.question}`);
  const nextSteps = pending.length ? ["Resolver as pendências listadas com a prefeitura.", "Enviar as alterações confirmadas para configuração."] : ["Enviar as alterações confirmadas para configuração."];
  return { decisions, changes, pending, nextSteps };
}

export type Action =
  | { type: "init" }
  | { type: "view" }
  | { type: "reset" }
  | { type: "keep"; sectionId: string; role: "prefeitura" | "implantacao"; confirm: boolean }
  | { type: "requestChange"; sectionId: string; text: string }
  | { type: "answer"; sectionId: string; property: string; question: string; answer: string }
  | { type: "confirm"; sectionId: string; role: "prefeitura" | "implantacao" }
  | { type: "pending"; sectionId: string; reason: string; requiresImplementer?: boolean }
  | { type: "cancel"; sectionId: string }
  | { type: "doubt"; sectionId: string; question: string }
  | { type: "meetingStart" }
  | { type: "meetingNote"; text: string }
  | { type: "meetingAnalyze" }
  | { type: "meetingAccept"; id: string; confirmNow?: boolean }
  | { type: "meetingReject"; id: string }
  | { type: "agendaAccept"; id: string; humanDecision?: string }
  | { type: "agendaIgnore"; id: string }
  | { type: "meetingSummary" }
  | { type: "meetingEnd" };

function sourceOf(session: Session): DecisionSource {
  return session.meeting.active ? "meeting" : "prefeitura_async";
}

export function initialSession(): Session {
  return createSession(T);
}

/**
 * Stateless: receives the browser-held session, applies one action and returns the new session.
 * The server keeps no state between requests (works on serverless/Vercel).
 */
export async function handle(action: Action, current?: Session): Promise<Session> {
  if (action.type === "reset" || action.type === "init" || !current) return createSession(T);
  if (action.type === "view") return current;
  let s = current;

  switch (action.type) {
    case "keep": {
      const actor = ACTORS[action.role];
      s = keepSection(s, T, action.sectionId, actor, sourceOf(s), action.confirm);
      s = addTrace(s, { instruction: CODE_STATE, action: "manter como está (confirmação humana)", result: `${action.sectionId} → confirmed_unchanged por ${actor.name}`, provider: "deterministic" });
      break;
    }
    case "requestChange": {
      s = cancelChange(s, action.sectionId); // a new request restarts the draft for this section
      s = await interpretAndValidate(s, action.sectionId, action.text);
      break;
    }
    case "answer": {
      const st = s.sections[action.sectionId];
      if (!st.request) throw new TransitionError("Não há alteração em andamento nesta seção.");
      s = recordAnswer(s, action.sectionId, { property: action.property, question: action.question, answer: action.answer });
      if (isDontKnow(action.answer)) {
        s = markPending(s, action.sectionId, `Sem resposta para: “${action.question}”`, false);
        s = addTrace(s, { instruction: CODE_STATE, action: "resposta “não sei”", result: `${action.sectionId} → pending (nada foi suposto)`, provider: "deterministic" });
        break;
      }
      s = await interpretAndValidate(s, action.sectionId, st.request, st.proposal);
      break;
    }
    case "confirm": {
      const actor = ACTORS[action.role];
      s = confirmChange(s, T, action.sectionId, actor, sourceOf(s));
      s = addTrace(s, { instruction: CODE_STATE, action: "confirmar alteração (clique humano)", result: `${action.sectionId} → confirmed_changed por ${actor.name}`, provider: "deterministic" });
      break;
    }
    case "pending": {
      s = markPending(s, action.sectionId, action.reason, Boolean(action.requiresImplementer));
      s = addTrace(s, { instruction: CODE_STATE, action: "deixar pendente", result: `${action.sectionId} → ${s.sections[action.sectionId].status}`, provider: "deterministic" });
      break;
    }
    case "cancel": {
      s = cancelChange(s, action.sectionId);
      break;
    }
    case "doubt": {
      const r = await explainDoubt({ section: section(action.sectionId), question: action.question });
      s = traceAgent(s, r, "explicar dúvida", r.result.sufficientContext ? "respondida com o contexto do template" : `contexto insuficiente: ${r.result.pendingReason ?? ""}`);
      const st = s.sections[action.sectionId];
      s = { ...s, sections: { ...s.sections, [action.sectionId]: { ...st, doubts: [...(st.doubts ?? []), { question: action.question, answer: r.result.answer, sufficientContext: r.result.sufficientContext, at: new Date().toISOString() }] } } };
      if (!r.result.sufficientContext && !isResolved(st)) {
        s = markPending(s, action.sectionId, r.result.pendingReason ?? `Dúvida: ${action.question}`, true);
        s = addTrace(s, { instruction: CODE_STATE, action: "escalar dúvida", result: `${action.sectionId} → pending_requires_implementer`, provider: "deterministic" });
      }
      break;
    }
    case "meetingStart": {
      // A new meeting starts with a clean agenda log; the validation session itself is the same.
      s = { ...s, meeting: { active: true, startedAt: new Date().toISOString(), notes: [], detected: [] } };
      s = addTrace(s, { instruction: CODE_STATE, action: "iniciar reunião (mesma sessão)", result: `retomando em: ${firstUnresolved(s, T) ?? "nada pendente"}`, provider: "deterministic" });
      break;
    }
    case "meetingNote": {
      s = { ...s, meeting: { ...s.meeting, notes: [...s.meeting.notes, { at: new Date().toISOString(), text: action.text }] } };
      break;
    }
    case "meetingAnalyze": {
      const unresolved = T.sections.filter((x) => !isResolved(s.sections[x.id])).map((x) => x.id);
      const agendaDone = new Set((s.meeting.agendaDecisions ?? []).filter((d) => d.status !== "ignored").map((d) => d.agendaItemId));
      const openAgenda = MAIN_CLIENT_AGENDA.filter((a) => !agendaDone.has(a.agendaItemId));
      const allNotes = s.meeting.notes.map((n) => n.text);
      const from = Math.min(s.meeting.analyzedNotes ?? 0, allNotes.length);
      const newNotes = allNotes.slice(from);
      if (newNotes.length === 0) {
        s = addTrace(s, { instruction: CODE_STATE, action: "detectar decisões na reunião", result: "0 possível(is) decisão(ões) — nenhuma fala nova", provider: "deterministic" });
        break;
      }
      // Only new speech is evidence; earlier notes are context. A quote already used by a decided /
      // ignored suggestion can never produce another one.
      const fold = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
      const used = [
        ...s.meeting.detected.filter((d) => d.status !== "detected_in_meeting").map((d) => fold(d.quote)),
        ...(s.meeting.agendaDecisions ?? []).filter((d) => d.status !== "detected").map((d) => fold(d.quote)),
      ].filter(Boolean);
      const isUsed = (q: string) => {
        const f = fold(q);
        return !f || used.some((u) => u === f || u.includes(f) || f.includes(u));
      };
      const r = await analyzeMeeting({ template: T, notes: newNotes, previousNotes: allNotes.slice(Math.max(0, from - 3), from), unresolvedSectionIds: unresolved, agenda: openAgenda });
      // Dedupe by meaning (section + kind + target field), not by literal quote: a newer phrasing of an
      // open suggestion replaces it; a target already confirmed is not suggested again.
      const target = (d: { sectionId: string; kind: string; proposal?: ChangeProposal }) => {
        const op = d.proposal?.operations[0];
        const t = !op ? "" : op.op === "add_field" ? `add:${(op.field.key ?? op.field.label ?? "").toLowerCase()}` : `${op.op}:${op.fieldKey}`;
        return `${d.sectionId}|${d.kind}|${t}`;
      };
      let detected = [...s.meeting.detected];
      let freshCount = 0;
      const seenNow = new Set<string>();
      r.result.detected
        .filter((d) => unresolved.includes(d.sectionId) && !isUsed(d.quote))
        .forEach((d, i) => {
          const item = {
            id: `det-${Date.now()}-${i}`,
            sectionId: d.sectionId,
            quote: d.quote,
            kind: d.kind,
            proposal: d.proposal ? alignToForm(normalizeProposal(d.proposal as ChangeProposal), allFields(T)) : undefined,
            status: "detected_in_meeting" as const,
            at: new Date().toISOString(),
          };
          const key = target(item);
          if (seenNow.has(key)) return;
          seenNow.add(key);
          if (detected.some((x) => x.status === "accepted" && target(x) === key)) return;
          if (detected.some((x) => x.status === "rejected" && x.quote === item.quote)) return;
          const openIdx = detected.findIndex((x) => x.status === "detected_in_meeting" && target(x) === key);
          if (openIdx >= 0) {
            if (detected[openIdx].quote !== item.quote) detected[openIdx] = { ...item, id: detected[openIdx].id };
            return;
          }
          detected = [...detected, item];
          freshCount++;
        });
      const ignoredQuotes = new Set((s.meeting.agendaDecisions ?? []).filter((d) => d.status === "ignored").map((d) => `${d.agendaItemId}|${d.quote}`));
      const seenAgenda = new Set<string>();
      const freshAgenda = (r.result.agendaDecisions ?? [])
        .filter((d) => openAgenda.some((a) => a.agendaItemId === d.agendaItemId) && !ignoredQuotes.has(`${d.agendaItemId}|${d.quote}`) && !isUsed(d.quote))
        .filter((d) => (seenAgenda.has(d.agendaItemId) ? false : (seenAgenda.add(d.agendaItemId), true)))
        .map((d, i) => {
          const a = openAgenda.find((x) => x.agendaItemId === d.agendaItemId)!;
          return { id: `ag-${Date.now()}-${i}`, clientId: a.clientId, processId: a.processId, processTitle: a.processTitle, agendaItemId: a.agendaItemId, quote: d.quote, humanDecision: d.humanDecision, status: "detected" as const, at: new Date().toISOString() };
        });
      s = { ...s, meeting: { ...s.meeting, detected, agendaDecisions: [...(s.meeting.agendaDecisions ?? []), ...freshAgenda], analyzedNotes: allNotes.length } };
      s = traceAgent(s, r, "detectar decisões na reunião", `${freshCount + freshAgenda.length} possível(is) decisão(ões) — nenhuma confirmada`);
      break;
    }
    case "meetingAccept": {
      const d = s.meeting.detected.find((x) => x.id === action.id);
      if (!d || d.status !== "detected_in_meeting") throw new TransitionError("Detecção não encontrada.");
      const impl = ACTORS.implantacao;
      if (d.kind === "keep_section") {
        s = keepSection(s, T, d.sectionId, impl, "meeting", true);
      } else if (d.kind === "pending") {
        s = markPending(s, d.sectionId, `Reunião: “${d.quote}”`, true);
      } else if (d.proposal) {
        // Loads the proposal into the same validation flow; implantador still confirms the diff explicitly.
        const sec = section(d.sectionId);
        s = cancelChange(s, d.sectionId);
        const missing = validateProposal(d.proposal, sec, allFields(T));
        let questions: Awaited<ReturnType<typeof formulateComplement>>["result"] = [];
        if (missing.length) {
          const comp = await formulateComplement({ section: sec, formFields: allFields(T), request: d.quote, proposal: d.proposal, missing });
          questions = comp.result;
          s = traceAgent(s, comp, "formular complemento", questions.map((q) => q.question).join(" | "));
        }
        s = setChangeDraft(s, T, d.sectionId, `Reunião: ${d.quote}`, d.proposal, questions);
        // "Confirmar" on a detection is the implantador's explicit confirmation; it only applies if the
        // proposal is complete. Otherwise the section stays in the validation flow ("Editar").
        if (action.confirmNow && s.sections[d.sectionId].status === "awaiting_confirmation") {
          s = confirmChange(s, T, d.sectionId, impl, "meeting");
        }
      }
      s = { ...s, meeting: { ...s.meeting, detected: s.meeting.detected.map((x) => (x.id === d.id ? { ...x, status: "accepted" } : x)) } };
      s = addTrace(s, { instruction: CODE_STATE, action: "implantador aceitou detecção", result: `${d.sectionId} → ${s.sections[d.sectionId].status}`, provider: "deterministic" });
      break;
    }
    case "meetingReject": {
      s = { ...s, meeting: { ...s.meeting, detected: s.meeting.detected.map((x) => (x.id === action.id ? { ...x, status: "rejected" } : x)) } };
      break;
    }
    case "agendaAccept":
    case "agendaIgnore": {
      const list = s.meeting.agendaDecisions ?? [];
      const d = list.find((x) => x.id === action.id);
      if (!d || d.status !== "detected") throw new TransitionError("Decisão não encontrada.");
      const next = action.type === "agendaAccept"
        ? { ...d, status: "accepted" as const, humanDecision: action.humanDecision?.trim() || d.humanDecision, at: new Date().toISOString() }
        : { ...d, status: "ignored" as const };
      s = { ...s, meeting: { ...s.meeting, agendaDecisions: list.map((x) => (x.id === d.id ? next : x)) } };
      s = addTrace(s, { instruction: CODE_STATE, action: action.type === "agendaAccept" ? "implantador confirmou decisão da pauta" : "implantador ignorou decisão da pauta", result: `${d.processTitle}: ${next.humanDecision}`, provider: "deterministic" });
      break;
    }
    case "meetingSummary": {
      const r = await summarizeMeeting({ notes: s.meeting.notes.map((n) => n.text), sessionDigest: digest(s) }, () => offlineSummary(s));
      s = { ...s, meeting: { ...s.meeting, summary: { ...r.result, at: new Date().toISOString() } } };
      s = traceAgent(s, r, "resumir reunião", `${r.result.decisions.length} decisões, ${r.result.pending.length} pendências`);
      break;
    }
    case "meetingEnd": {
      s = { ...s, meeting: { ...s.meeting, active: false, endedAt: new Date().toISOString() } };
      s = addTrace(s, { instruction: CODE_STATE, action: "encerrar reunião", result: "sessão continua salva", provider: "deterministic" });
      break;
    }
  }
  return s;
}
