"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/Shell";
import { clientRows, mainClientProcesses } from "@/components/live";
import { useSession } from "@/components/useSession";
import { MAIN_CLIENT_ID, clientProcesses, findClient } from "@/demo/fixtures";

// Clients that need a meeting or have one running. Only the connected client opens a live room.
export default function Reunioes() {
  const { data, busy, error, act } = useSession();
  const router = useRouter();
  if (!data) {
    return (
      <>
        <TopBar area="implantacao" who="Implantador Aprova" />
        <main className="page">{error ? <div className="msg err">{error}</div> : <p className="muted">Carregando…</p>}</main>
      </>
    );
  }
  const rows = clientRows(data)
    .filter((c) => c.main || c.situation === "Precisa de reunião" || c.situation === "Próximo do prazo")
    .map((c) => {
      const procs = c.main ? mainClientProcesses(data) : clientProcesses(findClient(c.id)!);
      return { ...c, agenda: procs.reduce((n, p) => n + p.pendings.length, 0) };
    });
  const live = data.session.meeting.active;
  const open = async () => {
    if (live || (await act({ type: "meetingStart" }))) router.push(`/implantacao/${MAIN_CLIENT_ID}/reuniao`);
  };
  return (
    <>
      <TopBar area="implantacao" who="Implantador Aprova" />
      <main className="page">
        <header className="page-head">
          <h1>Reuniões</h1>
          <p className="muted">Clientes com pauta para reunião de validação.</p>
        </header>
        {error && <div className="msg err">{error}</div>}
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Prefeitura</th>
                <th scope="col">Itens na pauta</th>
                <th scope="col">Próximo prazo</th>
                <th scope="col">Situação</th>
                <th scope="col">
                  <span className="sr-only">Ação</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="clickable" onClick={() => router.push(`/implantacao/${r.id}`)}>
                  <td>
                    <Link href={`/implantacao/${r.id}`} className="strong-link">
                      {r.name}
                    </Link>
                  </td>
                  <td data-label="Itens na pauta">{r.agenda}</td>
                  <td data-label="Próximo prazo">{r.nextDeadline}</td>
                  <td data-label="Situação">{r.main && live ? <span className="sit risk">Em reunião agora</span> : r.situation}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {r.main && (
                      <button className="primary" disabled={!!busy} onClick={open}>
                        {live ? "Entrar na reunião" : "Iniciar reunião"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
