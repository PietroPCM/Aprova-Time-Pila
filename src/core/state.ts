import { validateProposal } from "./validator";
import { allFields } from "./template-utils";
import type {
  Actor,
  ChangeProposal,
  ComplementQuestion,
  DecisionSource,
  MissingProperty,
  QAEntry,
  Session,
  SectionState,
  SectionStatus,
  Template,
  TraceEntry,
} from "./types";

// Deterministic state machine for the validation session.
// Rules: the AI never moves a section to a confirmed state; only explicit human actions do.

export class TransitionError extends Error {}

const now = () => new Date().toISOString();

export const RESOLVED: SectionStatus[] = ["confirmed_unchanged", "confirmed_changed"];

export function createSession(template: Template): Session {
  const sections: Record<string, SectionState> = {};
  for (const s of template.sections) sections[s.id] = { sectionId: s.id, status: "not_started", qa: [] };
  return {
    id: `sessao-${template.id}`,
    templateId: template.id,
    templateVersion: template.version,
    createdAt: now(),
    sections,
    trace: [],
    specVersion: 0,
    meeting: { active: false, notes: [], detected: [] },
  };
}

function getSection(template: Template, sectionId: string) {
  const section = template.sections.find((s) => s.id === sectionId);
  if (!section) throw new TransitionError(`Seção desconhecida: ${sectionId}`);
  return section;
}

function getState(session: Session, sectionId: string): SectionState {
  const st = session.sections[sectionId];
  if (!st) throw new TransitionError(`Seção desconhecida: ${sectionId}`);
  return st;
}

function assertNotResolved(st: SectionState) {
  if (RESOLVED.includes(st.status)) throw new TransitionError("Seção já validada. Reabra antes de alterar.");
}

export function addTrace(session: Session, entry: Omit<TraceEntry, "at">): Session {
  return { ...session, trace: [...session.trace, { ...entry, at: now() }] };
}

function bumpSpec(session: Session): Session {
  return { ...session, specVersion: session.specVersion + 1 };
}

function put(session: Session, st: SectionState): Session {
  return { ...session, sections: { ...session.sections, [st.sectionId]: { ...st, updatedAt: now() } } };
}

/** Explicit human approval that the section stays as in the model. */
export function keepSection(
  session: Session,
  template: Template,
  sectionId: string,
  actor: Actor,
  source: DecisionSource,
  explicitConfirmation: boolean,
): Session {
  getSection(template, sectionId);
  const st = getState(session, sectionId);
  assertNotResolved(st);
  if (!explicitConfirmation) throw new TransitionError("Manter como está exige confirmação explícita.");
  const next: SectionState = {
    ...st,
    status: "confirmed_unchanged",
    proposal: undefined,
    missing: undefined,
    questions: undefined,
    pendingReason: undefined,
    decision: { status: "confirmed_unchanged", actor, source, at: now(), templateVersion: template.version },
  };
  return bumpSpec(put(session, next));
}

/** Stores the latest (AI-produced, code-validated) proposal and derives the status. */
export function setChangeDraft(
  session: Session,
  template: Template,
  sectionId: string,
  request: string,
  proposal: ChangeProposal,
  questions: ComplementQuestion[],
): Session {
  const section = getSection(template, sectionId);
  const st = getState(session, sectionId);
  assertNotResolved(st);
  const missing: MissingProperty[] = validateProposal(proposal, section, allFields(template));
  let status: SectionStatus;
  let pendingReason: string | undefined;
  if (proposal.needsImplementer) {
    status = "pending_requires_implementer";
    pendingReason = proposal.needsImplementer.reason;
  } else {
    status = missing.length === 0 ? "awaiting_confirmation" : "drafting_change";
  }
  const next: SectionState = {
    ...st,
    status,
    request,
    proposal,
    missing,
    questions: missing.length ? questions : [],
    pendingReason,
  };
  return put(session, next);
}

export function recordAnswer(session: Session, sectionId: string, qa: Omit<QAEntry, "at">): Session {
  const st = getState(session, sectionId);
  assertNotResolved(st);
  return put(session, { ...st, qa: [...st.qa, { ...qa, at: now() }] });
}

/** Explicit human confirmation of a complete proposal. Re-validates before accepting. */
export function confirmChange(
  session: Session,
  template: Template,
  sectionId: string,
  actor: Actor,
  source: DecisionSource,
): Session {
  const section = getSection(template, sectionId);
  const st = getState(session, sectionId);
  if (st.status !== "awaiting_confirmation" || !st.proposal) {
    throw new TransitionError("Não há alteração completa aguardando confirmação.");
  }
  const missing = validateProposal(st.proposal, section, allFields(template));
  if (missing.length) throw new TransitionError("A alteração ainda tem informações faltantes.");
  const next: SectionState = {
    ...st,
    status: "confirmed_changed",
    missing: [],
    questions: [],
    decision: { status: "confirmed_changed", actor, source, at: now(), templateVersion: template.version },
  };
  return bumpSpec(put(session, next));
}

export function markPending(session: Session, sectionId: string, reason: string, requiresImplementer: boolean): Session {
  const st = getState(session, sectionId);
  assertNotResolved(st);
  const next: SectionState = {
    ...st,
    status: requiresImplementer ? "pending_requires_implementer" : "pending",
    pendingReason: reason,
  };
  return put(session, next);
}

export function cancelChange(session: Session, sectionId: string): Session {
  const st = getState(session, sectionId);
  assertNotResolved(st);
  return put(session, { ...st, status: "not_started", request: undefined, proposal: undefined, missing: undefined, questions: undefined, qa: [] });
}

export function isResolved(st: SectionState) {
  return RESOLVED.includes(st.status);
}

/** First section that still needs a decision, in template order. Used to resume (async or meeting). */
export function firstUnresolved(session: Session, template: Template): string | undefined {
  return template.sections.find((s) => !isResolved(session.sections[s.id]))?.id;
}

export function progress(session: Session, template: Template) {
  const states = template.sections.map((s) => session.sections[s.id]);
  return {
    total: states.length,
    confirmedUnchanged: states.filter((s) => s.status === "confirmed_unchanged").length,
    confirmedChanged: states.filter((s) => s.status === "confirmed_changed").length,
    pending: states.filter((s) => !isResolved(s)).length,
  };
}
