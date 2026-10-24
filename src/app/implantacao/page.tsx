"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/Shell";
import { clientRows, prefeituraFeed } from "@/components/live";
import { useSession } from "@/components/useSession";

const SIT_CLASS: Record<string, string> = {
  Validado: "sit ok",
  "Aguardando prefeitura": "sit warn",
  "Próximo do prazo": "sit warn",
  "Precisa de reunião": "sit risk",
  "Em andamento": "sit",
};

// Implantação home: the client portfolio, not forms.
export default function Carteira() {
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
  const latest = prefeituraFeed(data)[0]?.title;
  const rows = clientRows(data).map((r) => ({ ...r, latest: r.main ? latest : undefined }));
  const kpi = {
    inValidation: rows.filter((r) => r.situation !== "Validado").length,
    waiting: rows.filter((r) => r.situation === "Aguardando prefeitura").length,
    nearDeadline: rows.filter((r) => ["Hoje", "Amanhã"].includes(r.nextDeadline) && r.situation !== "Validado").length,
    meeting: rows.filter((r) => r.situation === "Precisa de reunião").length,
  };

  return (
    <>
      <TopBar
        area="implantacao"
        who="Implantador Aprova"
        extra={
          <button className="link xs" disabled={!!busy} onClick={() => act({ type: "reset" })} title="Volta a demo ao estado inicial">
            Reiniciar demo
          </button>
        }
      />
      <main className="page">
        <header className="page-head">
          <h1>Carteira de implantação</h1>
          <p className="muted">Prefeituras validando os processos-modelo.</p>
        </header>

        <dl className="facts">
          <div>
            <dt>Clientes em validação</dt>
            <dd>{kpi.inValidation}</dd>
          </div>
          <div>
            <dt>Aguardando prefeitura</dt>
            <dd>{kpi.waiting}</dd>
          </div>
          <div>
            <dt>Próximos do prazo</dt>
            <dd>{kpi.nearDeadline}</dd>
          </div>
          <div>
            <dt>Precisam de reunião</dt>
            <dd>{kpi.meeting}</dd>
          </div>
        </dl>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Prefeitura</th>
                <th scope="col">Progresso</th>
                <th scope="col">Próximo prazo</th>
                <th scope="col">Última atividade</th>
                <th scope="col">Situação</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="clickable" onClick={() => router.push(`/implantacao/${r.id}`)}>
                  <td>
                    <Link href={`/implantacao/${r.id}`} className="strong-link">
                      {r.name}
                    </Link>
                    {r.latest && <span className="sub">Nova resposta: {r.latest}</span>}
                  </td>
                  <td data-label="Progresso">
                    {r.processesDone}/{r.processesTotal} processos
                    <span className="mini-bar" aria-hidden="true">
                      <span style={{ width: `${(r.processesDone / r.processesTotal) * 100}%` }} />
                    </span>
                  </td>
                  <td data-label="Próximo prazo">{r.nextDeadline}</td>
                  <td data-label="Última atividade">{r.lastActivity}</td>
                  <td data-label="Situação">
                    <span className={SIT_CLASS[r.situation] ?? "sit"}>{r.inMeeting ? "Em reunião" : r.situation}</span>
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
