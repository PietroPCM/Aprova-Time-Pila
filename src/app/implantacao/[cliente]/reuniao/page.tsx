"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Decisions } from "@/components/MeetingPanel";
import { SectionValidator, Spinner } from "@/components/SectionValidator";
import { AiNotice, Crumbs, TopBar } from "@/components/Shell";
import { useLiveCapture, type CaptureSource } from "@/components/useLiveCapture";
import { cap, isResolved, useSession } from "@/components/useSession";
import { MAIN_CLIENT_AGENDA, MAIN_CLIENT_ID } from "@/demo/fixtures";

function elapsed(fromIso?: string) {
  if (!fromIso) return "00:00";
  const s = Math.max(0, Math.floor((Date.now() - new Date(fromIso).getTime()) / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export default function Reuniao() {
  const { cliente } = useParams<{ cliente: string }>();
  const { data, busy, error, act } = useSession();
  const [selected, setSelected] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [source, setSource] = useState<CaptureSource>("mic");
  const [transcribing, setTranscribing] = useState(0);
  const [captureErr, setCaptureErr] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const inflight = useRef<Set<Promise<void>>>(new Set());
  const busyRef = useRef<string | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  busyRef.current = busy;

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Each new piece of conversation → note → copilot analysis (serialized; never auto-confirms).
  const lastText = useRef("");
  const ingest = useCallback(
    (text: string) => {
      const norm = text.trim().toLowerCase();
      if (!norm || norm === lastText.current) return;
      lastText.current = norm;
      chain.current = chain.current.then(async () => {
        for (let i = 0; i < 80 && busyRef.current; i++) await new Promise((r) => setTimeout(r, 250));
        if (await act({ type: "meetingNote", text })) await act({ type: "meetingAnalyze" });
      });
    },
    [act],
  );

  const transcribe = useCallback(
    async (blob: Blob) => {
      setTranscribing((n) => n + 1);
      try {
        const fd = new FormData();
        fd.append("audio", blob, "trecho.webm");
        const res = await fetch("/api/transcribe", { method: "POST", body: fd });
        const json = await res.json();
        if (!res.ok) setCaptureErr(json.error ?? "Falha na transcrição.");
        else if (json.text) {
          setCaptureErr(null);
          ingest(json.text);
        }
      } catch {
        setCaptureErr("Falha de conexão ao transcrever.");
      } finally {
        setTranscribing((n) => n - 1);
      }
    },
    [ingest],
  );
  // Every chunk (including the last one after "Pausar") is tracked so nothing is lost on finish.
  const onChunk = useCallback(
    (blob: Blob) => {
      const p = transcribe(blob).finally(() => inflight.current.delete(p));
      inflight.current.add(p);
      return p;
    },
    [transcribe],
  );
  const capture = useLiveCapture(onChunk);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [data?.session.meeting.notes.length, transcribing]);

  const shell = (body: React.ReactNode) => (
    <>
      <TopBar area="implantacao" who="Implantador Aprova" />
      <main className="page wide">{body}</main>
    </>
  );
  if (cliente !== MAIN_CLIENT_ID) return shell(<p className="muted">Reunião disponível para a Prefeitura de Londrina.</p>);
  if (!data) return shell(error ? <div className="msg err">{error}</div> : <p className="muted">Carregando…</p>);

  const { template, session } = data;
  const meeting = session.meeting;
  const crumbs = (
    <Crumbs
      items={[
        { href: "/implantacao", label: "Carteira" },
        { href: `/implantacao/${MAIN_CLIENT_ID}`, label: "Prefeitura de Londrina" },
        { label: "Reunião de validação" },
      ]}
    />
  );
  const sections = template.sections;
  const agendaDecided = (id: string) => (meeting.agendaDecisions ?? []).find((d) => d.agendaItemId === id && d.status === "accepted");
  const resolvedCount =
    sections.filter((s) => isResolved(session.sections[s.id])).length +
    MAIN_CLIENT_AGENDA.filter((a) => (meeting.agendaDecisions ?? []).some((d) => d.agendaItemId === a.agendaItemId && d.status === "accepted")).length;
  const totalItems = sections.length + MAIN_CLIENT_AGENDA.length;
  const suggestions = meeting.detected.filter((d) => d.status === "detected_in_meeting").length + (meeting.agendaDecisions ?? []).filter((d) => d.status === "detected").length;

  // ---------- after the meeting: summary ----------
  if (!meeting.active) {
    return shell(
      <>
        {crumbs}
        <header className="page-head">
          <h1>Resumo da reunião</h1>
          <p className="muted">Reunião de validação · Prefeitura de Londrina · as decisões confirmadas já estão nos processos.</p>
        </header>
        {meeting.summary ? (
          <section className="summary-grid" aria-label="Resumo da reunião">
            {(
              [
                ["Decisões confirmadas", meeting.summary.decisions],
                ["Alterações para configurar", meeting.summary.changes],
                ["Pendências", meeting.summary.pending],
                ["Próximos passos", meeting.summary.nextSteps],
              ] as const
            ).map(([t, items]) => (
              <div key={t} className="summary-col">
                <h2>{t}</h2>
                <ul>{items.length ? items.map((i) => <li key={i}>{i}</li>) : <li className="muted">Nenhuma.</li>}</ul>
              </div>
            ))}
          </section>
        ) : (
          <p className="muted">Nenhuma reunião em andamento.</p>
        )}
        <div className="row">
          <Link className="btn primary" href={`/implantacao/${MAIN_CLIENT_ID}`}>
            Voltar ao cliente
          </Link>
        </div>
      </>,
    );
  }

  const listening = capture.state === "listening";
  const finish = async () => {
    capture.stop();
    await new Promise((r) => setTimeout(r, 700)); // let the recorder emit its last chunk
    await Promise.all([...inflight.current]);
    await chain.current;
    if (await act({ type: "meetingSummary" })) await act({ type: "meetingEnd" });
  };

  return shell(
    <>
      {crumbs}
      <header className="meet-bar">
        <div className="meet-title">
          <span className={`live ${listening ? "on" : ""}`}>{listening ? "Ao vivo · transcrevendo" : "Reunião aberta"}</span>
          <h1>Reunião de validação · Prefeitura de Londrina</h1>
          <span className="muted small">
            {elapsed(meeting.startedAt)} · {resolvedCount} confirmado{resolvedCount === 1 ? "" : "s"} · {suggestions} sugest{suggestions === 1 ? "ão" : "ões"} da IA · {totalItems - resolvedCount} pendente{totalItems - resolvedCount === 1 ? "" : "s"}
          </span>
        </div>
        <div className="meet-actions">
          {!listening ? (
            <>
              <select aria-label="Fonte do áudio" value={source} onChange={(e) => setSource(e.target.value as CaptureSource)}>
                <option value="mic">Microfone</option>
                <option value="tab">Áudio de uma aba (Meet, Teams, Zoom web)</option>
              </select>
              <button className="primary" disabled={capture.state === "starting"} onClick={() => capture.start(source)}>
                {capture.state === "starting" ? <Spinner text="Conectando…" /> : "● Começar a ouvir"}
              </button>
            </>
          ) : (
            <button onClick={capture.stop}>Pausar transcrição</button>
          )}
          <button disabled={!!busy} onClick={finish}>
            {busy === "meetingSummary" || busy === "meetingEnd" ? <Spinner text="Gerando resumo…" /> : "Encerrar e gerar resumo"}
          </button>
        </div>
      </header>
      {(capture.error || captureErr || error) && <div className="msg err small">{capture.error ?? captureErr ?? error}</div>}
      <AiNotice data={data} technical />

      <div className="meet-grid">
        {/* ---------- agenda ---------- */}
        <aside className="meet-col agenda-col" aria-label="Pauta">
          <h2>Pauta</h2>
          <div className="agenda-group">
            <h3>{template.processName}</h3>
            <ul className="checklist">
              {sections.map((s) => {
                const st = session.sections[s.id];
                const done = isResolved(st);
                return (
                  <li key={s.id} className={`${done ? "done" : ""} ${selected === s.id ? "on" : ""}`}>
                    <span className="check" aria-hidden="true">
                      {done ? "✓" : ""}
                    </span>
                    <span className="ck-text">
                      <b>{s.title}</b>
                      <span className="small muted">
                        {done
                          ? st.status === "confirmed_changed"
                            ? "Alteração confirmada"
                            : "Mantida como no modelo"
                          : cap(st.pendingReason) || (st.status === "not_started" ? "Sem decisão" : "Em andamento")}
                      </span>
                    </span>
                    {!done && (
                      <button className="link small" onClick={() => setSelected(s.id)}>
                        Abrir
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
          {MAIN_CLIENT_AGENDA.map((a) => {
            const dec = agendaDecided(a.agendaItemId);
            return (
              <div key={a.agendaItemId} className="agenda-group">
                <h3>{a.processTitle}</h3>
                <ul className="checklist">
                  <li className={dec ? "done" : ""}>
                    <span className="check" aria-hidden="true">
                      {dec ? "✓" : ""}
                    </span>
                    <span className="ck-text">
                      <b>{a.question}</b>
                      <span className="small muted">{dec ? dec.humanDecision : a.context}</span>
                    </span>
                  </li>
                </ul>
              </div>
            );
          })}
        </aside>

        {/* ---------- live transcript ---------- */}
        <section className="meet-col transcript-col" aria-label="Transcrição">
          <div className="col-head">
            <h2>Transcrição</h2>
            <span className="status-line small">
              {transcribing > 0 ? (
                <Spinner text="Processando fala…" />
              ) : busy === "meetingAnalyze" ? (
                <Spinner text="Analisando decisões…" />
              ) : listening ? (
                <>
                  <span className={capture.voice === "pause" ? "warn-text" : "ok-text"}>
                    {capture.voice === "pause" ? "Pausa detectada… pode continuar falando" : capture.voice === "speaking" ? "Ouvindo…" : "Ouvindo — pode falar"}
                  </span>
                  <span className="meter" aria-label="Nível do áudio">
                    <span style={{ width: `${Math.round(capture.level * 100)}%` }} />
                  </span>
                </>
              ) : (
                <span className="muted">Microfone desligado</span>
              )}
            </span>
          </div>
          <ol className="transcript" ref={listRef}>
            {meeting.notes.length === 0 && transcribing === 0 && (
              <li className="empty">
                {listening ? "Ouvindo… a fala aparece aqui a cada poucos segundos." : "Clique em “Começar a ouvir” para transcrever a reunião, ou registre uma anotação abaixo."}
              </li>
            )}
            {meeting.notes.map((n) => (
              <li key={n.at}>
                <time>{new Date(n.at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</time>
                <p>{n.text}</p>
              </li>
            ))}
            {transcribing > 0 && (
              <li className="pending-line">
                <Spinner text="Transcrevendo trecho…" />
              </li>
            )}
          </ol>
          <form
            className="manual"
            onSubmit={(e) => {
              e.preventDefault();
              if (manual.trim()) {
                ingest(manual.trim());
                setManual("");
              }
            }}
          >
            <input type="text" value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Anotação manual (Enter para registrar)" aria-label="Anotação manual" />
            <button type="submit" disabled={!manual.trim()}>
              Registrar
            </button>
          </form>
        </section>

        {/* ---------- copilot ---------- */}
        <aside className="meet-col copilot-col" aria-label="Copiloto">
          <div className="col-head">
            <h2>Copiloto</h2>
            <span className="small muted">{busy === "meetingAnalyze" ? <Spinner text="Analisando a conversa…" /> : "Propõe decisões; você confirma"}</span>
          </div>
          <Decisions data={data} busy={busy} act={act} onEdit={(id) => setSelected(id)} />
        </aside>
      </div>

      {selected && (
        <section className="stack-sm" aria-label="Parte em discussão">
          <div className="row">
            <h2>Em discussão agora</h2>
            <button className="link small" onClick={() => setSelected(null)}>
              Fechar
            </button>
          </div>
          <SectionValidator data={data} sectionId={selected} role="implantacao" busy={busy} act={act} onNext={() => setSelected(null)} />
        </section>
      )}
    </>,
  );
}
