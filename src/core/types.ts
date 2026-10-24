// Domain model for the validation/decision layer.
// The template mirrors the hierarchy observed in the Aprova model environment:
// Categoria → Processo → Formulário → Seções → Campos.

export type FieldType =
  | "text"
  | "masked_text"
  | "radio"
  | "checkbox"
  | "select"
  | "file"
  | "autofill";

/** How a field's obligation works. `conditional` requires a `condition`. */
export type RequiredMode = "always" | "never" | "conditional";

export interface SimpleCondition {
  /** key of the field whose value controls this one */
  fieldKey: string;
  operator: "equals";
  value: string;
}

export interface Field {
  key: string;
  label: string;
  type: FieldType;
  required: RequiredMode;
  condition?: SimpleCondition;
  options?: string[];
  mask?: string;
  acceptedFileFormats?: string[];
  autoFill?: string;
  helpText?: string;
  /** Plain-language meaning of the field, shown to the prefeitura. */
  description?: string;
}

export interface Section {
  id: string;
  number: number;
  title: string;
  /** Plain-language explanation of what this part of the form defines (shown to the prefeitura). */
  purpose?: string;
  /** Side-panel guidance text. May contain rules that are NOT enforced by the form. */
  guidance: string[];
  fields: Field[];
}

export interface Template {
  id: string;
  version: string;
  category: string;
  processName: string;
  demo: true;
  sections: Section[];
}

// ---------- Change proposals (structured, produced by AI, validated by code) ----------

export type FieldDraft = Partial<Omit<Field, "key">> & { key?: string };

export type Operation =
  | { op: "add_field"; field: FieldDraft }
  | { op: "update_field"; fieldKey: string; changes: FieldDraft }
  | { op: "remove_field"; fieldKey: string };

export interface ChangeProposal {
  operations: Operation[];
  /** Set by the AI when the request cannot be represented safely (calc, legislation, helpText vs rule…) */
  needsImplementer?: { reason: string };
  /** Short plain-language summary of what was understood */
  summary: string;
}

export interface MissingProperty {
  operationIndex: number;
  property: string;
  reason: string;
}

export interface ComplementQuestion {
  property: string;
  question: string;
  options: string[];
}

// ---------- Session / decisions ----------

export type SectionStatus =
  | "not_started"
  | "drafting_change" // prefeitura described a change; proposal incomplete
  | "awaiting_confirmation" // proposal complete; before/after shown; waiting explicit click
  | "confirmed_unchanged"
  | "confirmed_changed"
  | "pending" // left for later by a human
  | "pending_requires_implementer";

export type Actor = { role: "prefeitura" | "implantacao"; name: string };
export type DecisionSource = "prefeitura_async" | "meeting";

export interface QAEntry {
  question: string;
  property: string;
  answer: string;
  at: string;
}

export interface SectionState {
  sectionId: string;
  status: SectionStatus;
  request?: string;
  proposal?: ChangeProposal;
  missing?: MissingProperty[];
  questions?: ComplementQuestion[];
  qa: QAEntry[];
  pendingReason?: string;
  doubts?: { question: string; answer: string; sufficientContext: boolean; at: string }[];
  decision?: {
    status: "confirmed_unchanged" | "confirmed_changed";
    actor: Actor;
    source: DecisionSource;
    at: string;
    templateVersion: string;
  };
  updatedAt?: string;
}

export interface TraceEntry {
  at: string;
  instruction: string;
  action: string;
  result: string;
  provider: "openai" | "offline-fallback" | "deterministic";
}

export interface MeetingState {
  active: boolean;
  startedAt?: string;
  endedAt?: string;
  notes: { at: string; text: string }[];
  detected: DetectedDecision[];
  /** Decisions about agenda items of processes outside the live validation (simple representation). */
  agendaDecisions?: AgendaDecision[];
  /** how many notes were already analyzed (only newer notes count as evidence) */
  analyzedNotes?: number;
  summary?: MeetingSummary;
}

export interface AgendaItem {
  clientId: string;
  processId: string;
  processTitle: string;
  agendaItemId: string;
  question: string;
  context: string;
}

export interface AgendaDecision {
  id: string;
  clientId: string;
  processId: string;
  processTitle: string;
  agendaItemId: string;
  quote: string;
  humanDecision: string;
  status: "detected" | "accepted" | "ignored";
  at: string;
}

export interface DetectedDecision {
  id: string;
  sectionId: string;
  quote: string;
  kind: "keep_section" | "change" | "pending";
  proposal?: ChangeProposal;
  status: "detected_in_meeting" | "accepted" | "rejected";
  at: string;
}

export interface MeetingSummary {
  decisions: string[];
  changes: string[];
  pending: string[];
  nextSteps: string[];
  at: string;
}

export interface Session {
  id: string;
  templateId: string;
  templateVersion: string;
  createdAt: string;
  sections: Record<string, SectionState>;
  trace: TraceEntry[];
  specVersion: number;
  meeting: MeetingState;
}
