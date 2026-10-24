"use client";

import { useEffect, useState } from "react";
import { humanChanges, typeLabel } from "@/core/diff";
import { allFields } from "@/core/template-utils";
import type { Operation, Section } from "@/core/types";
import { BeforeAfter, FieldList } from "./Fields";
import { cap, fmtTime, isResolved, techLine, type Act, type ViewData } from "./useSession";

type Mode = "idle" | "keep" | "change" | "doubt";

const GAP_LABEL: Record<string, string> = {
  required: "obrigatoriedade",
  condition: "em quais casos vale",
  type: "tipo de informação",
  label: "nome do campo",
  options: "opções",
  acceptedFileFormats: "formatos de arquivo",
  mask: "formato",
  fieldKey: "qual campo",
  changes: "o que muda",
  operation: "o que deve mudar",
};

/** Plain-language description of what was understood, built from the structure. */
function understood(op: Operation, section: Section): string {
  const label = (key: string) => section.fields.find((f) => f.key === key)?.label ?? key;
  if (op.op === "add_field") return `Incluir um novo campo: “${op.field.label ?? "sem nome"}”${op.field.type ? ` (${typeLabel(op.field.type).toLowerCase()})` : ""}.`;
  if (op.op === "remove_field") return `Retirar o campo “${label(op.fieldKey)}”.`;
  return `Mudar o campo “${label(op.fieldKey)}”.`;
}

export function Spinner({ text }: { text: string }) {
  return (
    <span className="row small" role="status">
      <span className="spin" aria-hidden="true" /> {text}
    </span>
  );
}

// Shared validation flow. Prefeitura access and the meeting mode (implantação) use the same
// component, the same session and the same agent — only the actor and the technical detail change.
export function SectionValidator({
  data,
  sectionId,
  role,
  busy,
  act,
  onNext,
}: {
  data: ViewData;
  sectionId: string;
  role: "prefeitura" | "implantacao";
  busy: string | null;
  act: Act;
  onNext?: () => void;
}) {
  const section = data.template.sections.find((s) => s.id === sectionId)!;
  const st = data.session.sections[sectionId];
  const formFields = allFields(data.template);
  const [mode, setMode] = useState<Mode>("idle");
  const [text, setText] = useState("");
  const [free, setFree] = useState<Record<string, string>>({});
  const tech = role === "implantacao";

  useEffect(() => {
    setMode("idle");
    setText("");
    setFree({});
  }, [sectionId]);

  const resolved = isResolved(st);
  const inChange = st.status === "drafting_change" || st.status === "awaiting_confirmation";
  const changes = st.proposal ? humanChanges(section, st.proposal, formFields) : [];
  const unchangedCount = section.fields.length - changes.filter((c) => c.kind !== "added").length;
  const lastDoubt = st.doubts?.[st.doubts.length - 1];

  return (
    <section className="card stack" aria-labelledby={`sec-${sectionId}`}>
      <div className="stack-sm">
        <span className="eyebrow">
          Seção {section.number} de {data.template.sections.length}
        </span>
        <h2 id={`sec-${sectionId}`}>{section.title}</h2>
        {section.purpose && (
          <div className="stack-sm" style={{ gap: 2, marginTop: 6 }}>
            <span className="intro-label">O que você está decidindo aqui</span>
            <p className="purpose">{section.purpose}</p>
          </div>
        )}
      </div>

      {/* ---------- resolved ---------- */}
      {resolved && st.decision && (
        <div className="stack">
          <div className="msg ok stack-sm">
            <span className="h">{st.status === "confirmed_unchanged" ? "Seção aprovada como modelo." : "Alteração confirmada."}</span>
            <span className="small muted">
              {st.decision.actor.name} · {fmtTime(st.decision.at)} · {st.decision.source === "meeting" ? "na reunião" : "validação online"}
            </span>
          </div>
          {st.status === "confirmed_changed" && <BeforeAfter changes={changes} unchangedCount={unchangedCount} />}
          {onNext && (
            <div className="row">
              <button className="primary" onClick={onNext}>
                Continuar para a próxima seção →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ---------- pending notice ---------- */}
      {!resolved && !inChange && st.pendingReason && (
        <div className="msg warn stack-sm">
          <span className="h">Esta seção ficou pendente.</span>
          <span className="small">{cap(st.pendingReason)}</span>
          <span className="small muted">Você pode decidir agora, se quiser.</span>
        </div>
      )}

      {/* ---------- decide ---------- */}
      {!resolved && !inChange && (
        <>
          <div className="stack-sm">
            <h3>Como funciona no modelo atual</h3>
            <FieldList fields={section.fields} lookup={formFields} />
          </div>
          {section.guidance.length > 0 && (
            <div className="guidance">
              <span className="small muted">Orientações que o cidadão vê nesta parte:</span>
              <ul>
                {section.guidance.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
            </div>
          )}

          {mode === "idle" && (
            <div className="stack-sm">
              <h3>Isso funciona assim para a sua prefeitura?</h3>
              <div className="choices">
                <button className="choice primary" disabled={!!busy} onClick={() => setMode("keep")}>
                  <b>Manter como está</b>
                  <span>A seção fica igual ao modelo</span>
                </button>
                <button className="choice" disabled={!!busy} onClick={() => setMode("change")}>
                  <b>Quero alterar</b>
                  <span>Descreva a mudança do seu jeito</span>
                </button>
                <button className="choice" disabled={!!busy} onClick={() => setMode("doubt")}>
                  <b>Tenho uma dúvida</b>
                  <span>Pergunte sobre esta parte</span>
                </button>
              </div>
            </div>
          )}

          {mode === "keep" && (
            <div className="msg info stack">
              <span>
                Você confirma que a seção <b>{section.title}</b> fica <b>exatamente como no modelo</b>, com os {section.fields.length} campos listados acima?
              </span>
              <div className="row">
                <button className="primary" disabled={!!busy} onClick={() => act({ type: "keep", sectionId, role, confirm: true })}>
                  {busy === "keep" ? <Spinner text="Registrando…" /> : "Sim, manter como está"}
                </button>
                <button disabled={!!busy} onClick={() => setMode("idle")}>
                  Voltar
                </button>
              </div>
            </div>
          )}

          {mode === "change" && (
            <div className="stack-sm">
              <label className="q" htmlFor={`req-${sectionId}`}>
                O que você gostaria de mudar?
              </label>
              <span className="small muted">Escreva do seu jeito. Ex.: “Precisa pedir a placa do carro.”</span>
              <textarea id={`req-${sectionId}`} value={text} onChange={(e) => setText(e.target.value)} disabled={!!busy} />
              <div className="row">
                <button className="primary" disabled={!!busy || !text.trim()} onClick={() => act({ type: "requestChange", sectionId, text: text.trim() })}>
                  {busy === "requestChange" ? <Spinner text="Entendendo seu pedido…" /> : "Continuar"}
                </button>
                <button disabled={!!busy} onClick={() => setMode("idle")}>
                  Voltar
                </button>
              </div>
            </div>
          )}

          {mode === "doubt" && (
            <div className="stack-sm">
              <label className="q" htmlFor={`dbt-${sectionId}`}>
                Qual é a sua dúvida sobre esta seção?
              </label>
              <input
                id={`dbt-${sectionId}`}
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Ex.: O laudo do DETRAN é obrigatório?"
                disabled={!!busy}
              />
              <div className="row">
                <button
                  className="primary"
                  disabled={!!busy || !text.trim()}
                  onClick={async () => {
                    if (await act({ type: "doubt", sectionId, question: text.trim() })) setText("");
                  }}
                >
                  {busy === "doubt" ? <Spinner text="Consultando o modelo…" /> : "Perguntar"}
                </button>
                <button disabled={!!busy} onClick={() => setMode("idle")}>
                  Voltar
                </button>
              </div>
            </div>
          )}

          {lastDoubt && (
            <div className={`msg ${lastDoubt.sufficientContext ? "info" : "warn"} stack-sm`}>
              <span className="small muted">Sua dúvida: “{lastDoubt.question}”</span>
              <span>{lastDoubt.answer}</span>
              {!lastDoubt.sufficientContext && <span className="h small">Vou deixar esta dúvida registrada para a equipe de implantação.</span>}
            </div>
          )}
        </>
      )}

      {/* ---------- change in progress ---------- */}
      {inChange && st.proposal && (
        <div className="stack">
          <div className="msg info stack-sm">
            <span className="small muted">Seu pedido: “{st.request}”</span>
            <span className="h">Entendi esta alteração:</span>
            {st.proposal.operations.length ? (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {st.proposal.operations.map((op, i) => (
                  <li key={i}>{understood(op, section)}</li>
                ))}
              </ul>
            ) : (
              <span>{st.proposal.summary}</span>
            )}
          </div>

          {st.status === "drafting_change" && (
            <div className="stack">
              {(st.questions ?? []).map((q) => (
                <div key={q.property} className="stack-sm">
                  <span className="small muted">Para configurar, falta uma informação:</span>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>{q.question}</span>
                  {q.options.length > 0 && (
                    <div className="row">
                      {q.options.map((o) => (
                        <button key={o} className="opt" disabled={!!busy} onClick={() => act({ type: "answer", sectionId, property: q.property, question: q.question, answer: o })}>
                          {o}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="row">
                    <input
                      type="text"
                      aria-label="Responder com suas palavras"
                      placeholder={q.options.length ? "Ou responda com suas palavras" : "Responda com suas palavras"}
                      value={free[q.property] ?? ""}
                      onChange={(e) => setFree({ ...free, [q.property]: e.target.value })}
                      disabled={!!busy}
                      style={{ flex: 1, minWidth: 200 }}
                    />
                    <button
                      disabled={!!busy || !(free[q.property] ?? "").trim()}
                      onClick={() => act({ type: "answer", sectionId, property: q.property, question: q.question, answer: free[q.property].trim() })}
                    >
                      Responder
                    </button>
                  </div>
                </div>
              ))}
              {(st.questions ?? []).length === 0 && <div className="msg warn">Não consegui formular a pergunta. Corrija o pedido ou deixe a seção para depois.</div>}
              {busy === "answer" && <Spinner text="Atualizando a alteração…" />}
              {tech && <p className="xs muted">Falta definir: {st.missing?.map((m) => GAP_LABEL[m.property] ?? m.property).join(", ")}.</p>}
            </div>
          )}

          {st.status === "awaiting_confirmation" && (
            <div className="stack">
              <h3>Confira como vai ficar</h3>
              <BeforeAfter changes={changes} unchangedCount={unchangedCount} />
              <p className="small muted">Nada muda sem a sua confirmação.</p>
              <div className="row">
                <button className="primary" disabled={!!busy} onClick={() => act({ type: "confirm", sectionId, role })}>
                  {busy === "confirm" ? <Spinner text="Confirmando…" /> : "Confirmar alteração"}
                </button>
                <button disabled={!!busy} onClick={() => act({ type: "cancel", sectionId })}>
                  Corrigir pedido
                </button>
              </div>
            </div>
          )}

          {st.status === "drafting_change" && (
            <div className="row">
              <button className="link" disabled={!!busy} onClick={() => act({ type: "cancel", sectionId })}>
                Descartar e descrever de novo
              </button>
            </div>
          )}

          {tech && (
            <details className="small">
              <summary>Dados técnicos</summary>
              <div className="tech">{st.proposal.operations.map(techLine).join("\n") || "(sem operações)"}</div>
            </details>
          )}
        </div>
      )}

      {!resolved && (
        <div className="row">
          <button
            className="link small"
            disabled={!!busy}
            onClick={() => act({ type: "pending", sectionId, reason: role === "prefeitura" ? "A prefeitura deixou para decidir depois." : "Deixada para depois na reunião." })}
          >
            Deixar esta seção para depois
          </button>
        </div>
      )}
    </section>
  );
}
