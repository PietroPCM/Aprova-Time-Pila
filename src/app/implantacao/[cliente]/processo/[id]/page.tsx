"use client";

import { useParams } from "next/navigation";
import { AiNotice, Crumbs, Progress, StatusIcon, TopBar } from "@/components/Shell";
import { TracePanel } from "@/components/TracePanel";
import { cap, fmtTime, humanStatus, isResolved, techLine, useSession } from "@/components/useSession";
import { describeRequired, explainInput } from "@/core/diff";
import { allFields } from "@/core/template-utils";
import type { Field, FieldDraft, Operation, Section, SectionState } from "@/core/types";
import { DemoProcessBody } from "@/components/DemoViews";
import { MAIN_CLIENT_ID, MAIN_PROCESS_ID, clientProcesses, findClient } from "@/demo/fixtures";

const ACTION: Record<Operation["op"], string> = { add_field: "Adicionar campo", update_field: "Alterar campo", remove_field: "Remover campo" };

function requestTitle(op: Operation, section: Section) {
  const label = op.op === "add_field" ? op.field.label : section.fields.find((f) => f.key === op.fieldKey)?.label ?? op.fieldKey;
  return `${op.op === "add_field" ? "Adicionar" : op.op === "remove_field" ? "Remover" : "Alterar"} “${label}”`;
}

function statusText(st: SectionState) {
  if (st.status === "confirmed_changed") return `Confirmado ${st.decision?.actor.role === "prefeitura" ? "pela prefeitura" : "pela implantação"}`;
  if (st.status === "awaiting_confirmation") return "Aguardando confirmação";
  if (st.status === "drafting_change") return "Falta informação da prefeitura";
  return cap(humanStatus(st).text);
}

/** "Obrigatório quando o portador … for Motorista" → "Quando o portador … for Motorista". */
function whenRequired(t: string) {
  if (t === "Obrigatório") return "Sempre";
  if (t === "Opcional") return "Nunca (opcional)";
  return t.replace(/^Obrigatório quando /, "Quando ");
}

/** One request, in the prefeitura's words and in configuration language. */
function RequestItem({ section, st, op, formFields }: { section: Section; st: SectionState; op: Operation; formFields: Field[] }) {
  const base = op.op === "add_field" ? undefined : section.fields.find((f) => f.key === op.fieldKey);
  const props: FieldDraft = op.op === "add_field" ? op.field : op.op === "update_field" ? { ...base, ...op.changes } : {};
  const key = op.op === "add_field" ? op.field.key : op.fieldKey;
  const confirmed = st.status === "confirmed_changed";
  return (
    <article className="request">
      <div className="request-head">
        <StatusIcon kind={confirmed ? "done" : "pend"} />
        <h3>{requestTitle(op, section)}</h3>
        <span className="muted small">{section.title}</span>
      </div>
      <div className="request-body">
        <div className="said">
          <span className="label">O que a prefeitura disse</span>
          <p>“{st.request?.replace(/^Reunião: /, "")}”</p>
          {st.qa.map((q) => (
            <p key={q.at} className="small muted">
              {q.question} → <b>{q.answer}</b>
            </p>
          ))}
        </div>
        <div className="stack-sm">
        <span className="label">Como deve ser configurado</span>
        <dl className="kv">
          <dt>{op.op === "add_field" ? "Adicionar" : op.op === "remove_field" ? "Remover" : "Alterar"}</dt>
          <dd className="strong">{props.label ?? base?.label}</dd>
          {op.op !== "remove_field" && (
            <>
              <dt>Formato</dt>
              <dd>{props.type ? explainInput({ ...props, type: props.type }) : "—"}</dd>
              <dt>Quando exigir</dt>
              <dd>{props.required ? whenRequired(describeRequired({ required: props.required, condition: props.condition }, formFields)) : "—"}</dd>
            </>
          )}
          <dt>Status</dt>
          <dd className={confirmed ? "ok-text" : "warn-text"}>{statusText(st)}</dd>
          <dt>Fonte</dt>
          <dd>{st.decision ? (st.decision.source === "meeting" ? "Reunião" : "Validação online") : st.request?.startsWith("Reunião:") ? "Reunião" : "Validação online"}</dd>
          {st.decision && (
            <>
              <dt>Registrado</dt>
              <dd>
                {st.decision.actor.name} · {fmtTime(st.decision.at)}
              </dd>
            </>
          )}
        </dl>
        </div>
      </div>
    </article>
  );
}

export default function DetalheProcesso() {
  const { cliente, id } = useParams<{ cliente: string; id: string }>();
  const { data, error } = useSession();

  if (cliente !== MAIN_CLIENT_ID || id !== MAIN_PROCESS_ID) {
    const client = findClient(cliente);
    const proc = client ? clientProcesses(client).find((x) => x.id === id) : undefined;
    return (
      <>
        <TopBar area="implantacao" who="Implantador Aprova" />
        <main className="page">
          <Crumbs
            items={[
              { href: "/implantacao", label: "Carteira" },
              ...(client ? [{ href: `/implantacao/${client.id}`, label: client.name }] : []),
              { label: proc?.name ?? "Processo não encontrado" },
            ]}
          />
          {proc ? (
            <>
              <header className="page-head">
                <h1>{proc.name}</h1>
                <Progress done={proc.sectionsDone} total={proc.sectionsTotal} label="partes validadas" />
              </header>
              <DemoProcessBody p={proc} audience="implantacao" />
            </>
          ) : (
            <p className="muted">Processo não encontrado.</p>
          )}
        </main>
      </>
    );
  }
  if (!data) {
    return (
      <>
        <TopBar area="implantacao" who="Implantador Aprova" />
        <main className="page">{error ? <div className="msg err">{error}</div> : <p className="muted">Carregando…</p>}</main>
      </>
    );
  }
  const { template, session, spec, progress } = data;
  const formFields = allFields(template);
  const requests = template.sections.flatMap((s) => {
    const st = session.sections[s.id];
    return st.proposal && st.proposal.operations.length && (st.status === "confirmed_changed" || st.status === "awaiting_confirmation" || st.status === "drafting_change")
      ? st.proposal.operations.map((op, i) => ({ s, st, op, k: `${s.id}-${i}` }))
      : [];
  });
  const pendings = template.sections.filter((s) => !isResolved(session.sections[s.id]));

  const exportSpec = () => {
    const blob = new Blob([JSON.stringify(spec, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `especificacao-${spec.status === "complete" ? "completa" : "parcial"}-v${spec.specVersion}.json`;
    a.click();
  };

  return (
    <>
      <TopBar area="implantacao" who="Implantador Aprova" />
      <main className="page">
        <Crumbs
          items={[
            { href: "/implantacao", label: "Carteira" },
            { href: `/implantacao/${MAIN_CLIENT_ID}`, label: "Prefeitura de Londrina" },
            { label: template.processName },
          ]}
        />
        <header className="page-head">
          <h1>{template.processName}</h1>
          <Progress done={progress.confirmedUnchanged + progress.confirmedChanged} total={progress.total} label="partes validadas" />
        </header>
        <AiNotice data={data} technical />

        <section className="stack" aria-label="Solicitações da prefeitura">
          <h2>Solicitações da prefeitura</h2>
          {requests.length === 0 ? (
            <p className="muted">Nenhuma alteração solicitada até agora.</p>
          ) : (
            requests.map((r) => <RequestItem key={r.k} section={r.s} st={r.st} op={r.op} formFields={formFields} />)
          )}
        </section>

        <section className="stack-sm" aria-label="Partes do processo">
          <h2>Partes do processo</h2>
          <ul className="plist">
            {template.sections.map((s) => {
              const st = session.sections[s.id];
              const h = humanStatus(st);
              return (
                <li key={s.id} className="prow">
                  <StatusIcon kind={h.icon} />
                  <div className="pmain">
                    <span className="pname">
                      {s.number}. {s.title}
                    </span>
                    <span className="pmeta">
                      {h.text}
                      {st.pendingReason && !isResolved(st) ? ` — ${cap(st.pendingReason)}` : ""}
                    </span>
                  </div>
                  <span className="pact small muted">{st.decision ? `${st.decision.actor.name} · ${fmtTime(st.decision.at)}` : ""}</span>
                </li>
              );
            })}
          </ul>
        </section>

        {pendings.some((s) => session.sections[s.id].doubts?.length) && (
          <section className="stack-sm" aria-label="Dúvidas registradas">
            <h2>Dúvidas registradas</h2>
            {pendings.flatMap((s) =>
              (session.sections[s.id].doubts ?? []).map((d) => (
                <p key={d.at} className="small">
                  <b>{s.title}:</b> “{d.question}” — {d.answer}
                </p>
              )),
            )}
          </section>
        )}

        <section className="stack-sm" aria-label="Especificação para configuração">
          <div className="row">
            <h2>Pronto para configuração</h2>
            <span className={`sit ${spec.status === "complete" ? "ok" : "warn"}`}>
              {spec.status === "complete" ? "Completa" : `Parcial · ${spec.pending.length} pendência${spec.pending.length === 1 ? "" : "s"}`}
            </span>
          </div>
          <p className="small muted">
            Alterações confirmadas prontas para configuração · versão {spec.specVersion}.
          </p>
          <div className="row">
            <button onClick={exportSpec}>Exportar especificação</button>
          </div>
          <details className="tech-area">
            <summary>Dados técnicos</summary>
            <p className="xs muted">Estrutura técnica para integração e auditoria (formato provisório).</p>
            {requests.length > 0 && <div className="tech">{requests.map((r) => techLine(r.op)).join("\n")}</div>}
            <pre className="json">{JSON.stringify(spec, null, 2)}</pre>
          </details>
        </section>

        <TracePanel trace={session.trace} />
      </main>
    </>
  );
}
