"use client";

import Link from "next/link";

/** Side panel for the prefeitura: next step, deadline, how it works, who to talk to. */
export function PrefAside({ next, deadline }: { next?: { title: string; detail: string; href: string; cta: string }; deadline: string }) {
  return (
    <aside className="ws-aside" aria-label="Ajuda">
      {next && (
        <section>
          <h3>Próximo passo</h3>
          <p className="strong" style={{ margin: "0 0 2px" }}>
            {next.title}
          </p>
          <p className="small muted" style={{ margin: "0 0 10px" }}>
            {next.detail}
          </p>
          <Link className="btn primary" href={next.href}>
            {next.cta}
          </Link>
        </section>
      )}
      <section>
        <h3>Prazo</h3>
        <p className="big-num">{deadline}</p>
        <p className="small muted">Responder até o prazo evita que o assunto vá para a reunião semanal.</p>
      </section>
      <section>
        <h3>Como funciona</h3>
        <ol className="how">
          <li>Veja como cada parte está no modelo da Aprova.</li>
          <li>Mantenha ou descreva a mudança com suas palavras.</li>
          <li>Confira o antes e depois e confirme. Pronto.</li>
        </ol>
      </section>
      <section>
        <h3>Sua equipe de implantação</h3>
        <p className="small">
          <b>Implantador Aprova</b>
          <br />
          Dúvidas que a IA não souber responder vão direto para a equipe.
        </p>
      </section>
    </aside>
  );
}
