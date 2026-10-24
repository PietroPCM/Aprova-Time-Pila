"use client";

import { CLIENTS, MAIN_CLIENT_AGENDA, MAIN_CLIENT_ID, MAIN_CLIENT_PROCESSES, MAIN_PROCESS_DEADLINE, MAIN_PROCESS_ID, isDone, type DemoClient, type DemoProcess, type ProcStatus } from "@/demo/fixtures";
import { humanChanges } from "@/core/diff";
import { fmtTime, isResolved, type ViewData } from "./useSession";

export interface ProcRow extends Omit<DemoProcess, "live"> {
  live: boolean;
}

/** The main process, derived from the real validation session. */
export function liveProcess(data: ViewData): ProcRow {
  const { template, session } = data;
  const states = template.sections.map((s) => session.sections[s.id]);
  const done = states.filter(isResolved).length;
  const changes = states.filter((s) => s.status === "confirmed_changed").reduce((n, s) => n + (s.proposal?.operations.length ?? 0), 0);
  const pendings = template.sections
    .filter((s) => !isResolved(session.sections[s.id]) && session.sections[s.id].status !== "not_started")
    .map((s) => `${s.title}: ${session.sections[s.id].pendingReason ?? "decisão em andamento"}`);
  const touched = states.some((s) => s.status !== "not_started");
  const status: ProcStatus = done === states.length ? (changes ? "validated_changes" : "validated") : pendings.length ? "waiting" : touched ? "in_progress" : "not_started";
  const last = states.map((s) => s.updatedAt).filter(Boolean).sort().pop();
  return {
    id: MAIN_PROCESS_ID,
    name: template.processName,
    status,
    sectionsDone: done,
    sectionsTotal: states.length,
    changes,
    pendings,
    lastActivity: last ? fmtTime(last) : "—",
    deadline: MAIN_PROCESS_DEADLINE,
    live: true,
  };
}

/** Fixture processes of the main client, updated with agenda decisions confirmed in the meeting. */
export function mainClientProcesses(data: ViewData): ProcRow[] {
  const accepted = (data.session.meeting.agendaDecisions ?? []).filter((d) => d.status === "accepted");
  const fixtures = MAIN_CLIENT_PROCESSES.map((p) => {
    const decided = accepted.filter((d) => d.processId === p.id);
    if (!decided.length) return { ...p, live: false };
    const questions = MAIN_CLIENT_AGENDA.filter((a) => decided.some((d) => d.agendaItemId === a.agendaItemId)).map((a) => a.question);
    const pendings = p.pendings.filter((t) => !questions.includes(t));
    return {
      ...p,
      live: false,
      pendings,
      changes: p.changes + decided.length,
      sectionsDone: pendings.length ? p.sectionsDone : Math.min(p.sectionsTotal, p.sectionsDone + decided.length),
      status: (pendings.length ? p.status : "in_progress") as ProcStatus,
      lastActivity: fmtTime(decided[decided.length - 1].at),
    };
  });
  return [liveProcess(data), ...fixtures];
}

/** Portfolio rows; the main client aggregates the live process + its fixtures. */
export function clientRows(data: ViewData): (DemoClient & { inMeeting?: boolean })[] {
  const procs = mainClientProcesses(data);
  const live = procs[0];
  return CLIENTS.map((c) => {
    if (c.id !== MAIN_CLIENT_ID) return c;
    const done = procs.filter((p) => isDone(p.status)).length;
    const waiting = procs.some((p) => p.status === "waiting");
    return {
      ...c,
      processesDone: done,
      processesTotal: procs.length,
      lastActivity: live.lastActivity !== "—" ? live.lastActivity : c.lastActivity,
      situation: done === procs.length ? "Validado" : waiting ? "Aguardando prefeitura" : "Em andamento",
      inMeeting: data.session.meeting.active,
    };
  });
}

export function procIcon(s: ProcStatus): "done" | "pend" | "todo" {
  return isDone(s) ? "done" : s === "not_started" ? "todo" : "pend";
}

export interface FeedItem {
  at: string;
  kind: "change" | "keep" | "pending" | "doubt" | "progress";
  section: string;
  title: string;
  detail?: string;
  quote?: string;
  who: string;
  status: string;
  /** set when the item belongs to another process than the live one */
  process?: string;
}

/** What the prefeitura answered, newest first, in plain language (live process only). */
export function prefeituraFeed(data: ViewData): FeedItem[] {
  const { template, session } = data;
  const fields = template.sections.flatMap((s) => s.fields);
  const items: FeedItem[] = [];
  for (const s of template.sections) {
    const st = session.sections[s.id];
    const who = st.decision?.actor.name ?? "Prefeitura";
    if (st.status === "confirmed_unchanged" && st.decision) {
      items.push({ at: st.decision.at, kind: "keep", section: s.title, title: st.decision.source === "meeting" ? `Na reunião: manter “${s.title}” como no modelo` : `Manteve “${s.title}” como no modelo`, who, status: st.decision.source === "meeting" ? "Confirmado na reunião" : "Confirmado pela prefeitura" });
    }
    if ((st.status === "confirmed_changed" || st.status === "awaiting_confirmation" || st.status === "drafting_change") && st.proposal) {
      for (const c of humanChanges(s, st.proposal, fields)) {
        const [label, ...rest] = c.after.replace(/^\+ /, "").split(" — ");
        items.push({
          at: st.decision?.at ?? st.updatedAt ?? session.createdAt,
          kind: "change",
          section: s.title,
          title:
            st.decision?.source === "meeting"
              ? `Na reunião: ${c.kind === "added" ? "adicionar" : c.kind === "removed" ? "remover" : "alterar"} “${label}”`
              : `${c.kind === "added" ? "Pediu para adicionar" : c.kind === "removed" ? "Pediu para remover" : "Pediu para alterar"} “${label}”`,
          detail: rest.join(" — "),
          quote: st.request?.replace(/^Reunião: /, ""),
          who: st.decision ? who : "Prefeitura",
          status: st.status === "confirmed_changed" ? (st.decision?.source === "meeting" ? "Confirmado na reunião" : "Confirmado pela prefeitura") : "Aguardando confirmação",
        });
      }
    }
    if ((st.status === "pending" || st.status === "pending_requires_implementer") && st.pendingReason) {
      items.push({ at: st.updatedAt ?? session.createdAt, kind: "pending", section: s.title, title: `Deixou “${s.title}” pendente`, detail: st.pendingReason, who: "Prefeitura", status: st.status === "pending" ? "Aguardando prefeitura" : "Precisa da implantação" });
    }
    for (const d of st.doubts ?? []) {
      items.push({ at: d.at, kind: "doubt", section: s.title, title: `Perguntou sobre “${s.title}”`, quote: d.question, detail: d.answer, who: "Prefeitura", status: d.sufficientContext ? "Respondida pela IA" : "Encaminhada à implantação" });
    }
  }
  for (const d of (session.meeting.agendaDecisions ?? []).filter((x) => x.status === "accepted")) {
    items.push({ at: d.at, kind: "change", section: d.processTitle, title: `Na reunião: ${d.humanDecision}`, quote: d.quote, who: "Implantador Aprova", status: "Confirmado na reunião", process: d.processTitle });
  }
  return items.sort((a, b) => b.at.localeCompare(a.at));
}
