import { applyProposal } from "./diff";
import { isResolved } from "./state";
import type { Operation, Session, Template } from "./types";

// Partial SPEC handed to the existing configuration agents.
// FORMAT IS PROVISIONAL: we do not have the real contract of Aprova's configurator agents.

export interface SpecChange {
  operation: Operation["op"];
  section: string;
  field: string;
  properties: Record<string, unknown>;
  source: string;
  actor: string;
  timestamp: string;
  templateVersion: string;
  originalRequest?: string;
}

export interface PartialSpec {
  format: "PROVISORIO-v0";
  formatNotice: string;
  status: "partial" | "complete";
  specVersion: number;
  process: { templateId: string; templateVersion: string; name: string; demo: true };
  generatedAt: string;
  confirmed_unchanged: { section: string; title: string; actor: string; timestamp: string; source: string; templateVersion: string }[];
  confirmed_changed: SpecChange[];
  pending: { section: string; title: string; status: string; reason?: string; openRequest?: string }[];
}

export function buildPartialSpec(session: Session, template: Template): PartialSpec {
  const unchanged: PartialSpec["confirmed_unchanged"] = [];
  const changed: SpecChange[] = [];
  const pending: PartialSpec["pending"] = [];

  for (const section of template.sections) {
    const st = session.sections[section.id];
    if (st.status === "confirmed_unchanged" && st.decision) {
      unchanged.push({
        section: section.id,
        title: section.title,
        actor: st.decision.actor.name,
        timestamp: st.decision.at,
        source: st.decision.source,
        templateVersion: st.decision.templateVersion,
      });
    } else if (st.status === "confirmed_changed" && st.decision && st.proposal) {
      const after = applyProposal(section, st.proposal);
      for (const op of st.proposal.operations) {
        const fieldKey = op.op === "add_field" ? op.field.key ?? "" : op.fieldKey;
        const finalField = after.find((f) => f.key === fieldKey);
        changed.push({
          operation: op.op,
          section: section.id,
          field: fieldKey,
          properties: op.op === "remove_field" ? {} : { ...(finalField ?? {}) },
          source: st.decision.source,
          actor: st.decision.actor.name,
          timestamp: st.decision.at,
          templateVersion: st.decision.templateVersion,
          originalRequest: st.request,
        });
      }
    } else if (!isResolved(st)) {
      pending.push({ section: section.id, title: section.title, status: st.status, reason: st.pendingReason, openRequest: st.request });
    }
  }

  return {
    format: "PROVISORIO-v0",
    formatNotice:
      "Formato provisório: o contrato real dos agents configuradores da Aprova não é conhecido. Adaptar antes de integrar.",
    status: pending.length ? "partial" : "complete",
    specVersion: session.specVersion,
    process: { templateId: template.id, templateVersion: template.version, name: template.processName, demo: true },
    generatedAt: new Date().toISOString(),
    confirmed_unchanged: unchanged,
    confirmed_changed: changed,
    pending,
  };
}
