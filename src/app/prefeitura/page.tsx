"use client";

import Link from "next/link";
import { PrefAside } from "@/components/PrefAside";
import { Progress, StatusIcon, TopBar } from "@/components/Shell";
import { mainClientProcesses, procIcon } from "@/components/live";
import { useSession } from "@/components/useSession";
import { STATUS_TEXT, isDone } from "@/demo/fixtures";

// Prefeitura home: "Minha implantação" — every process the city has to validate.
export default function MinhaImplantacao() {
  const { data, error } = useSession();
  if (!data) {
    return (
      <>
        <TopBar area="prefeitura" who="Prefeitura de Londrina" />
        <main className="page split-page">{error ? <div className="msg err">{error}</div> : <p className="muted">Carregando…</p>}</main>
      </>
    );
  }
  const procs = mainClientProcesses(data);
  const live = procs.find((p) => p.live);
  const done = procs.filter((p) => isDone(p.status)).length;
  const order = (s: string) => ({ waiting: 0, in_progress: 1, not_started: 2, validated_changes: 3, validated: 4 })[s] ?? 5;
  // The connected process comes first while it still needs decisions.
  const sorted = [...procs].sort((a, b) => Number(b.live && !isDone(b.status)) - Number(a.live && !isDone(a.status)) || order(a.status) - order(b.status));

  return (
    <>
      <TopBar area="prefeitura" who="Prefeitura de Londrina" />
      <main className="page">
        <header className="page-head">
          <h1>Minha implantação</h1>
          <p className="muted">Revise os processos que a Aprova preparou para a sua prefeitura e diga, parte por parte, se eles servem como estão.</p>
          <Progress done={done} total={procs.length} label="processos validados" />
        </header>

        <dl className="facts">
          <div>
            <dt>Processos</dt>
            <dd>{procs.length}</dd>
          </div>
          <div>
            <dt>Concluídos</dt>
            <dd>{done}</dd>
          </div>
          <div>
            <dt>Pendentes</dt>
            <dd>{procs.length - done}</dd>
          </div>
          <div>
            <dt>Prazo geral</dt>
            <dd>30/10</dd>
          </div>
        </dl>

        <div className="ws">
          <section className="ws-main" aria-label="Processos para validar">
            <h2>Processos</h2>
          <ul className="plist">
            {sorted.map((p) => {
              const done = isDone(p.status);
              const action = !p.live ? "Ver processo" : done ? "Ver processo" : p.status === "not_started" ? "Começar" : "Continuar validação";
              return (
                <li key={p.id} className="prow">
                  <StatusIcon kind={procIcon(p.status)} />
                  <div className="pmain">
                    <span className="pname">{p.name}</span>
                    <span className="pmeta">
                      {done ? "Validado" : p.status === "not_started" ? "Não iniciado" : `${p.sectionsDone} de ${p.sectionsTotal} partes validadas`}
                      {!done && p.deadline !== "—" && ` · prazo ${p.deadline}`}
                            </span>
                  </div>
                  <div className="pact">
                    {done && <span className="ok-text small">✓ {STATUS_TEXT[p.status]}</span>}
                    <Link className="btn" href={`/prefeitura/processo/${p.id}`}>
                      {action}
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
          </section>
          <PrefAside
            deadline="30/10"
            next={
              live && !isDone(live.status)
                ? { title: live.name, detail: `${live.sectionsTotal - live.sectionsDone} de ${live.sectionsTotal} partes ainda sem decisão`, href: `/prefeitura/processo/${live.id}`, cta: live.status === "not_started" ? "Começar agora" : "Continuar de onde parei" }
                : undefined
            }
          />
        </div>
      </main>
    </>
  );
}
