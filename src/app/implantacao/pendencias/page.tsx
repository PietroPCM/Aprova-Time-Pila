"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/Shell";
import { mainClientProcesses } from "@/components/live";
import { useSession } from "@/components/useSession";
import { CLIENTS, MAIN_CLIENT_ID, clientProcesses } from "@/demo/fixtures";

// All open pending items across the portfolio (live client + fixtures).
export default function Pendencias() {
  const { data, error } = useSession();
  const router = useRouter();
  if (!data) {
    return (
      <>
        <TopBar area="implantacao" who="Implantador Aprova" />
        <main className="page">{error ? <div className="msg err">{error}</div> : <p className="muted">Carregando…</p>}</main>
      </>
    );
  }
  const rows = CLIENTS.flatMap((c) => {
    const procs = c.id === MAIN_CLIENT_ID ? mainClientProcesses(data) : clientProcesses(c);
    return procs.flatMap((p) =>
      p.pendings.map((t) => ({ client: c.name, clientId: c.id, process: p.name, processId: p.id, text: t, deadline: p.deadline, last: p.lastActivity })),
    );
  });
  return (
    <>
      <TopBar area="implantacao" who="Implantador Aprova" />
      <main className="page">
        <header className="page-head">
          <h1>Pendências</h1>
          <p className="muted">{rows.length} decisões aguardando, em todos os clientes.</p>
        </header>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Pendência</th>
                <th scope="col">Processo</th>
                <th scope="col">Prefeitura</th>
                <th scope="col">Prazo</th>
                <th scope="col">Última atividade</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const href = `/implantacao/${r.clientId}/processo/${r.processId}`;
                return (
                  <tr key={i} className="clickable" onClick={() => router.push(href)}>
                    <td>
                      <Link href={href} className="strong-link">
                        {r.text}
                      </Link>
                    </td>
                    <td data-label="Processo">{r.process}</td>
                    <td data-label="Prefeitura">{r.client}</td>
                    <td data-label="Prazo">{r.deadline}</td>
                    <td data-label="Última atividade">{r.last}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
