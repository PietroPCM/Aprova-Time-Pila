"use client";

import { describeRequired, humanChanges } from "@/core/diff";
import { allFields } from "@/core/template-utils";
import type { DetectedDecision } from "@/core/types";
import { useState } from "react";
import type { Act, ViewData } from "./useSession";

// Copilot decisions: identified from the conversation, applied only after the implantador confirms.
export function Decisions({ data, busy, act, onEdit }: { data: ViewData; busy: string | null; act: Act; onEdit: (sectionId: string) => void }) {
  const { meeting } = data.session;
  const formFields = allFields(data.template);
  const section = (id: string) => data.template.sections.find((s) => s.id === id);
  const open = meeting.detected.filter((d) => d.status === "detected_in_meeting");
  const closed = meeting.detected.filter((d) => d.status !== "detected_in_meeting");
  const agenda = meeting.agendaDecisions ?? [];
  const agendaOpen = agenda.filter((d) => d.status === "detected");
  const agendaClosed = agenda.filter((d) => d.status !== "detected");
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);

  const interpret = (d: DetectedDecision): string => {
    const sec = section(d.sectionId);
    if (d.kind === "keep_section") return `Manter “${sec?.title}” como no modelo`;
    if (d.kind === "pending") return `Deixar “${sec?.title}” pendente`;
    if (!sec || !d.proposal) return "Alteração";
    const op = d.proposal.operations[0];
    if (op?.op === "update_field") {
      const f = sec.fields.find((x) => x.key === op.fieldKey);
      return `${f?.label ?? op.fieldKey} — ${describeRequired({ ...f!, ...op.changes }, formFields)}`;
    }
    return humanChanges(sec, d.proposal, formFields).map((c) => c.after.replace(/^\+ /, "")).join(" · ") || d.proposal.summary;
  };

  const nothingNew = data.lastAgent?.action === "detectar decisões na reunião" && data.lastAgent.result.startsWith("0 ") && open.length === 0 && agendaOpen.length === 0;

  return (
    <div className="decisions">
      {open.length === 0 && closed.length === 0 && agenda.length === 0 && (
        <p className="empty small">Quando alguém disser algo como “o laudo será obrigatório só para motorista”, a decisão aparece aqui para você confirmar.</p>
      )}
      {nothingNew && (closed.length > 0 || agendaClosed.length > 0) && <p className="small muted">Nenhuma decisão nova no último trecho.</p>}
      {agendaOpen.map((d) => (
        <article key={d.id} className="decision">
          <span className="label">Decisão identificada · {d.processTitle}</span>
          {editing?.id === d.id ? (
            <input type="text" aria-label="Ajustar decisão" value={editing.text} onChange={(e) => setEditing({ id: d.id, text: e.target.value })} />
          ) : (
            <p className="strong">{d.humanDecision}</p>
          )}
          <p className="quote">“{d.quote}”</p>
          <div className="row">
            <button
              className="primary"
              disabled={!!busy}
              onClick={async () => {
                if (await act({ type: "agendaAccept", id: d.id, humanDecision: editing?.id === d.id ? editing.text : undefined })) setEditing(null);
              }}
            >
              Confirmar
            </button>
            {editing?.id !== d.id && (
              <button disabled={!!busy} onClick={() => setEditing({ id: d.id, text: d.humanDecision })}>
                Editar
              </button>
            )}
            <button className="link" disabled={!!busy} onClick={() => act({ type: "agendaIgnore", id: d.id })}>
              Ignorar
            </button>
          </div>
        </article>
      ))}
      {open.map((d) => (
        <article key={d.id} className="decision">
          <span className="label">Decisão identificada · {section(d.sectionId)?.title}</span>
          <p className="strong">{interpret(d)}</p>
          <p className="quote">“{d.quote}”</p>
          <div className="row">
            <button className="primary" disabled={!!busy} onClick={() => act({ type: "meetingAccept", id: d.id, confirmNow: true })}>
              Confirmar
            </button>
            {d.kind === "change" && (
              <button
                disabled={!!busy}
                onClick={async () => {
                  if (await act({ type: "meetingAccept", id: d.id })) onEdit(d.sectionId);
                }}
              >
                Editar
              </button>
            )}
            <button className="link" disabled={!!busy} onClick={() => act({ type: "meetingReject", id: d.id })}>
              Ignorar
            </button>
          </div>
        </article>
      ))}
      {(closed.length > 0 || agendaClosed.length > 0) && (
        <div className="stack-sm">
          <span className="label">Registradas nesta reunião</span>
          <ul className="closed">
            {agendaClosed.map((d) => (
              <li key={d.id}>
                <span className={d.status === "accepted" ? "ok-text" : "muted"}>{d.status === "accepted" ? "✓" : "—"}</span> {d.processTitle}: {d.humanDecision}
                {d.status === "ignored" && <span className="muted"> (ignorada)</span>}
              </li>
            ))}
            {closed.map((d) => (
              <li key={d.id}>
                <span className={d.status === "accepted" ? "ok-text" : "muted"}>{d.status === "accepted" ? "✓" : "—"}</span> {interpret(d)}
                {d.status === "rejected" && <span className="muted"> (ignorada)</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
