"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { SectionValidator } from "@/components/SectionValidator";
import { AiNotice, Crumbs, Progress, TopBar } from "@/components/Shell";
import { humanStatus, isResolved, useSession } from "@/components/useSession";
import { DemoProcessBody } from "@/components/DemoViews";
import { PrefAside } from "@/components/PrefAside";
import { MAIN_CLIENT_PROCESSES, MAIN_PROCESS_ID } from "@/demo/fixtures";

export default function ValidarProcesso() {
  const { id } = useParams<{ id: string }>();
  const { data, busy, error, act } = useSession();
  const [current, setCurrent] = useState<string | null>(null);

  // Open exactly at the next part that still needs a decision.
  useEffect(() => {
    if (data && current === null) setCurrent(data.firstUnresolved ?? data.template.sections[0].id);
  }, [data, current]);

  const crumbs = (name: string) => <Crumbs items={[{ href: "/prefeitura", label: "Minha implantação" }, { label: name }]} />;

  if (id !== MAIN_PROCESS_ID) {
    const p = MAIN_CLIENT_PROCESSES.find((x) => x.id === id);
    return (
      <>
        <TopBar area="prefeitura" who="Prefeitura de Londrina" />
        <main className="page narrow">
          {crumbs(p?.name ?? "Processo")}
          {p ? (
            <>
              <header className="page-head">
                <h1>{p.name}</h1>
                <Progress done={p.sectionsDone} total={p.sectionsTotal} label="partes validadas" />
              </header>
              <DemoProcessBody p={p} audience="prefeitura" />
            </>
          ) : (
            <p className="muted">Processo não encontrado.</p>
          )}
          <Link className="btn" href="/prefeitura" style={{ alignSelf: "flex-start" }}>
            ← Voltar para Minha implantação
          </Link>
        </main>
      </>
    );
  }

  if (!data || !current) {
    return (
      <>
        <TopBar area="prefeitura" who="Prefeitura de Londrina" />
        <main className="page narrow">{error ? <div className="msg err">{error}</div> : <p className="muted">Abrindo a próxima parte para validar…</p>}</main>
      </>
    );
  }
  const { template, session, progress } = data;
  const done = progress.confirmedUnchanged + progress.confirmedChanged;
  const idx = template.sections.findIndex((s) => s.id === current);
  const nextUnresolved =
    template.sections.slice(idx + 1).find((s) => !isResolved(session.sections[s.id])) ?? template.sections.find((s) => s.id !== current && !isResolved(session.sections[s.id]));

  return (
    <>
      <TopBar area="prefeitura" who="Prefeitura de Londrina" />
      <main className="page split-page">
        {crumbs(template.processName)}
        <header className="page-head">
          <h1>{template.processName}</h1>
          <Progress done={done} total={progress.total} label="partes validadas" />
        </header>

        <ol className="stepper" aria-label="Partes do processo">
          {template.sections.map((s) => {
            const h = humanStatus(session.sections[s.id]);
            return (
              <li key={s.id}>
                <button className={`stp ${h.icon}`} aria-current={s.id === current ? "step" : undefined} onClick={() => setCurrent(s.id)} title={`${s.title} — ${h.text}`}>
                  <span className="dot" aria-hidden="true">
                    {h.icon === "done" ? "✓" : s.number}
                  </span>
                  <span className="stp-t">{s.title}</span>
                </button>
              </li>
            );
          })}
        </ol>

        {error && (
          <div className="msg err" role="alert">
            {error}
          </div>
        )}
        <AiNotice data={data} />
        {session.meeting.active && <div className="msg info small">A equipe de implantação está em reunião com esta validação aberta.</div>}

        {!data.firstUnresolved && (
          <div className="msg ok stack-sm">
            <span className="h">Processo validado.</span>
            <span className="small">Todas as partes têm uma decisão. A equipe de implantação já recebeu as informações.</span>
            <Link href="/prefeitura" className="btn" style={{ alignSelf: "flex-start" }}>
              Voltar para Minha implantação
            </Link>
          </div>
        )}

        <div className="ws">
          <div className="ws-main">
            <SectionValidator
              data={data}
              sectionId={current}
              role="prefeitura"
              busy={busy}
              act={act}
              onNext={nextUnresolved ? () => setCurrent(nextUnresolved.id) : undefined}
            />
            <p className="xs muted">Seu progresso fica salvo. Você pode sair e continuar depois de onde parou.</p>
          </div>
          <PrefAside deadline="26/10" />
        </div>
      </main>
    </>
  );
}
