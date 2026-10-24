"use client";

import { StatusIcon } from "./Shell";
import { procIcon } from "./live";
import { STATUS_TEXT, demoParts, demoRequests, type DemoProcess, type PartStatus } from "@/demo/fixtures";

const PART_TEXT: Record<PartStatus, { icon: "done" | "pend" | "todo"; text: string }> = {
  kept: { icon: "done", text: "Mantida como modelo" },
  changed: { icon: "done", text: "Alteração confirmada" },
  pending: { icon: "pend", text: "Pendente — decisão da prefeitura" },
  todo: { icon: "todo", text: "Não iniciada" },
};

export function DemoNotice() {
  return <p className="xs muted">Dados de demonstração (somente leitura).</p>;
}

/** Read-only process detail for illustrative data (implantação or prefeitura view). */
export function DemoProcessBody({ p, audience }: { p: DemoProcess; audience: "implantacao" | "prefeitura" }) {
  const parts = demoParts(p);
  const requests = demoRequests(p);
  return (
    <>
      <dl className="facts">
        <div>
          <dt>Situação</dt>
          <dd className="sm">{STATUS_TEXT[p.status]}</dd>
        </div>
        <div>
          <dt>Progresso</dt>
          <dd className="sm">
            {p.sectionsDone} de {p.sectionsTotal} partes
          </dd>
        </div>
        <div>
          <dt>Última atividade</dt>
          <dd className="sm">{p.lastActivity}</dd>
        </div>
        <div>
          <dt>Prazo</dt>
          <dd className="sm">{p.deadline}</dd>
        </div>
      </dl>
      <DemoNotice />

      {audience === "implantacao" && (
        <section className="stack" aria-label="Solicitações da prefeitura">
          <h2>Solicitações da prefeitura</h2>
          {requests.length === 0 ? (
            <p className="muted">Nenhuma alteração solicitada.</p>
          ) : (
            requests.map((r) => (
              <article key={r.field} className="request">
                <div className="request-head">
                  <StatusIcon kind="done" />
                  <h3>Configurar “{r.field}”</h3>
                </div>
                <div className="request-body">
                  <div className="said">
                    <span className="label">O que a prefeitura disse</span>
                    <p>“{r.said}”</p>
                  </div>
                  <dl className="kv">
                    <dt>Campo</dt>
                    <dd>{r.field}</dd>
                    <dt>Tipo</dt>
                    <dd>{r.type}</dd>
                    <dt>Obrigatoriedade</dt>
                    <dd>{r.rule}</dd>
                    <dt>Status</dt>
                    <dd className="ok-text">{r.status}</dd>
                    <dt>Fonte</dt>
                    <dd>{r.source}</dd>
                  </dl>
                </div>
              </article>
            ))
          )}
        </section>
      )}

      {audience === "prefeitura" && requests.length > 0 && (
        <section className="stack-sm" aria-label="Alterações pedidas">
          <h2>Alterações que vocês pediram</h2>
          <ul className="plist">
            {requests.map((r) => (
              <li key={r.field} className="prow">
                <StatusIcon kind="done" />
                <div className="pmain">
                  <span className="pname">{r.field}</span>
                  <span className="pmeta">
                    “{r.said}” · {r.rule}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="stack-sm" aria-label="Partes do processo">
        <h2>{audience === "prefeitura" ? "Partes do processo" : "O que já foi validado"}</h2>
        <ul className="plist">
          {parts.map((part, i) => (
            <li key={part.title} className="prow">
              <StatusIcon kind={PART_TEXT[part.status].icon} />
              <div className="pmain">
                <span className="pname">
                  {i + 1}. {part.title}
                </span>
                <span className="pmeta">
                  {PART_TEXT[part.status].text}
                  {part.status === "pending" && p.pendings[i - p.sectionsDone] ? ` — ${p.pendings[i - p.sectionsDone]}` : ""}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

export function procStatusIcon(p: DemoProcess) {
  return <StatusIcon kind={procIcon(p.status)} />;
}
