"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { DemoNotice } from "@/components/DemoViews";
import { Crumbs, StatusIcon, TopBar } from "@/components/Shell";
import { ClientAside } from "@/components/ClientAside";
import { Feed } from "@/components/Feed";
import { clientRows, mainClientProcesses, prefeituraFeed, procIcon, type ProcRow } from "@/components/live";
import { useSession } from "@/components/useSession";
import { MAIN_CLIENT_ID, STATUS_TEXT, clientProcesses, findClient } from "@/demo/fixtures";

const SIT: Record<string, string> = { validated: "sit ok", validated_changes: "sit ok", waiting: "sit warn", in_progress: "sit", not_started: "sit" };

function ProcessTable({ clientId, procs }: { clientId: string; procs: ProcRow[] }) {
  const router = useRouter();
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th scope="col">Processo</th>
            <th scope="col">Situação</th>
            <th scope="col">Alterações</th>
            <th scope="col">Pendências</th>
            <th scope="col">Última atividade</th>
          </tr>
        </thead>
        <tbody>
          {procs.map((p) => {
            const href = `/implantacao/${clientId}/processo/${p.id}`;
            return (
              <tr key={p.id} className="clickable" onClick={() => router.push(href)}>
                <td>
                  <span className="row nowrap">
                    <StatusIcon kind={procIcon(p.status)} />
                    <Link href={href} className="strong-link">
                      {p.name}
                    </Link>
                  </span>
                </td>
                <td data-label="Situação">
                  <span className={SIT[p.status]}>{STATUS_TEXT[p.status]}</span>
                  <span className="sub">
                    {p.sectionsDone}/{p.sectionsTotal} partes
                  </span>
                </td>
                <td data-label="Alterações">{p.changes ? `${p.changes} ${p.changes > 1 ? "alterações" : "alteração"}` : "—"}</td>
                <td data-label="Pendências">{p.pendings.length ? <span className="warn-text">{p.pendings.length}</span> : "—"}</td>
                <td data-label="Última atividade">{p.lastActivity}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Facts({ progress, last, deadline, owner, situation }: { progress: string; last: string; deadline: string; owner: string; situation?: string }) {
  return (
    <dl className="facts">
      <div>
        <dt>Progresso</dt>
        <dd>{progress}</dd>
      </div>
      <div>
        <dt>Última atividade</dt>
        <dd className="sm">{last}</dd>
      </div>
      <div>
        <dt>Próximo prazo</dt>
        <dd className="sm">{deadline}</dd>
      </div>
      <div>
        <dt>{situation ? "Situação" : "Responsável"}</dt>
        <dd className="sm">{situation ?? owner}</dd>
      </div>
    </dl>
  );
}

export default function Cliente() {
  const { cliente } = useParams<{ cliente: string }>();
  const { data, busy, error, act } = useSession();
  const router = useRouter();
  const demo = findClient(cliente);
  const shell = (body: React.ReactNode) => (
    <>
      <TopBar area="implantacao" who="Implantador Aprova" />
      <main className="page">{body}</main>
    </>
  );

  if (!demo) {
    return shell(
      <>
        <Crumbs items={[{ href: "/implantacao", label: "Carteira" }, { label: "Cliente não encontrado" }]} />
        <p className="muted">Cliente não encontrado.</p>
      </>,
    );
  }

  // ---------- illustrative client: read-only ----------
  if (cliente !== MAIN_CLIENT_ID) {
    const procs: ProcRow[] = clientProcesses(demo).map((p) => ({ ...p, live: false }));
    const pend = procs.reduce((n, p) => n + p.pendings.length, 0);
    return shell(
      <>
        <Crumbs items={[{ href: "/implantacao", label: "Carteira" }, { label: demo.name }]} />
        <header className="page-head">
          <h1>
            {demo.name}
          </h1>
          <p className="muted">
            {demo.processesDone} de {demo.processesTotal} processos validados · {pend} pendência{pend === 1 ? "" : "s"} em aberto
          </p>
        </header>
        <Facts progress={`${demo.processesDone}/${demo.processesTotal}`} last={demo.lastActivity} deadline={demo.nextDeadline} owner={demo.owner} situation={demo.situation} />
        <DemoNotice />
        <section className="stack-sm" aria-label="Processos">
          <h2>Processos</h2>
          <ProcessTable clientId={demo.id} procs={procs} />
        </section>
      </>,
    );
  }

  // ---------- main client: connected to the real session ----------
  if (!data) return shell(error ? <div className="msg err">{error}</div> : <p className="muted">Carregando…</p>);
  const client = clientRows(data).find((c) => c.id === MAIN_CLIENT_ID)!;
  const procs = mainClientProcesses(data);
  const meetingActive = data.session.meeting.active;
  const openPendings = procs.reduce((n, p) => n + p.pendings.length, 0);
  const startMeeting = async () => {
    if (meetingActive || (await act({ type: "meetingStart" }))) router.push(`/implantacao/${MAIN_CLIENT_ID}/reuniao`);
  };

  return shell(
    <>
      <Crumbs items={[{ href: "/implantacao", label: "Carteira" }, { label: client.name }]} />
      <header className="page-head row-head">
        <div className="stack-sm">
          <h1>
            {client.name}
          </h1>
          <p className="muted">
            {client.processesDone} de {client.processesTotal} processos validados · {openPendings} pendência{openPendings === 1 ? "" : "s"} em aberto
          </p>
        </div>
        <button className="primary big-btn" disabled={!!busy} onClick={startMeeting}>
          {meetingActive ? "Voltar para a reunião" : "Iniciar reunião"}
        </button>
      </header>
      {error && (
        <div className="msg err" role="alert">
          {error}
        </div>
      )}
      <Facts progress={`${client.processesDone}/${client.processesTotal}`} last={client.lastActivity} deadline={client.nextDeadline} owner={client.owner} />
      <div className="ws">
        <div className="ws-main">
          <section className="stack-sm" aria-label="Respostas da prefeitura">
            <h2>Respostas da prefeitura</h2>
            <Feed items={prefeituraFeed(data)} processName="Cartão PcD" href={`/implantacao/${MAIN_CLIENT_ID}/processo/${data.template.id}`} />
          </section>
          <section className="stack-sm" aria-label="Processos">
            <h2>Processos</h2>
            <ProcessTable clientId={MAIN_CLIENT_ID} procs={procs} />
          </section>
        </div>
        <ClientAside data={data} />
      </div>
    </>,
  );
}
