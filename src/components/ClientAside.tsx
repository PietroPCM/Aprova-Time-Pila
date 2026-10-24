"use client";

import type { ViewData } from "./useSession";
import { cap, isResolved } from "./useSession";
import { mainClientProcesses } from "./live";

/** Side panel of the client workspace: what to take to the meeting, deadline, AI work, contact. */
export function ClientAside({ data }: { data: ViewData }) {
  const { template, session } = data;
  const pend = template.sections.filter((s) => !isResolved(session.sections[s.id]));
  const count = (file: string) => session.trace.filter((t) => t.instruction === file && t.provider === "openai").length;
  const ai = [
    { n: count("01-interpretar-alteracao.md"), t: "pedidos em linguagem natural interpretados" },
    { n: count("02-formular-complemento.md"), t: "perguntas de complemento feitas na hora" },
    { n: count("04-explicar-duvida.md"), t: "dúvidas respondidas sem abrir ticket" },
    { n: count("03-acompanhar-reuniao.md"), t: "análises de reunião" },
  ];
  const daysLeft = Math.max(0, Math.ceil((new Date("2026-10-30T23:59:00-03:00").getTime() - Date.now()) / 86400000));
  return (
    <aside className="ws-aside" aria-label="Resumo do cliente">
      <section>
        <h3>Para a próxima reunião</h3>
        <ul className="mini">
          {pend.map((s) => (
            <li key={s.id}>
              <b>Cartão PcD · {s.title}</b>
              <span>{cap(session.sections[s.id].pendingReason) || "Ainda sem decisão"}</span>
            </li>
          ))}
          {mainClientProcesses(data).filter((p) => !p.live).flatMap((p) => p.pendings.map((t) => ({ p: p.name, t }))).map((x) => (
            <li key={x.t}>
              <b>{x.p}</b>
              <span>{x.t}</span>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h3>Prazo da implantação</h3>
        <p className="big-num">{daysLeft} dias</p>
        <p className="small muted">Meta de validação completa até 30/10.</p>
      </section>
      <section>
        <h3>O que a IA já fez</h3>
        <ul className="ai-stats">
          {ai.map((a) => (
            <li key={a.t}>
              <b>{a.n}</b> <span>{a.t}</span>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h3>Contato na prefeitura</h3>
        <p className="small">
          <b>Analista da Prefeitura</b>
          <br />
          Secretaria de Trânsito e Transporte
        </p>
      </section>
    </aside>
  );
}
