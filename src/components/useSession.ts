"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DiffRow } from "@/core/diff";
import type { PartialSpec } from "@/core/spec";
import type { Operation, Session, SectionState, Template, TraceEntry } from "@/core/types";

export interface ViewData {
  template: Template;
  session: Session;
  progress: { total: number; confirmedUnchanged: number; confirmedChanged: number; pending: number };
  firstUnresolved: string | null;
  diffs: Record<string, DiffRow[]>;
  spec: PartialSpec;
  ai: { available: boolean; model: string | null };
  lastAgent: TraceEntry | null;
}

// Demo persistence: the validation session lives in this browser (localStorage). Prefeitura and
// Implantação tabs of the same browser share it; the server is stateless.
const KEY = "aprova-valida-session-v1";

function readStored(): Session | undefined {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : undefined;
  } catch {
    return undefined;
  }
}

function store(session: Session) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    // storage unavailable (private mode): the demo still works for this page view
  }
}

async function call(action: Record<string, unknown>, session?: Session) {
  const res = await fetch("/api/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, session }) });
  const json = await res.json();
  return { ok: res.ok, json };
}

export function useSession() {
  const [data, setData] = useState<ViewData | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const current = useRef<Session | undefined>(undefined);

  const apply = useCallback((view: ViewData) => {
    current.current = view.session;
    store(view.session);
    setData(view);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const stored = readStored();
      const { ok, json } = await call(stored ? { type: "view" } : { type: "init" }, stored);
      if (ok) apply(json);
      else setError(json.error ?? "Não foi possível carregar a sessão.");
    } catch {
      setError("Não foi possível carregar a sessão. Verifique a conexão.");
    }
  }, [apply]);

  useEffect(() => {
    refresh();
    // keep tabs of the same browser in sync (e.g. Prefeitura and Implantação side by side)
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY && !inFlight.current) refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refresh]);

  /** Runs one action at a time (prevents double submit). */
  const act = useCallback(
    async (action: Record<string, unknown>) => {
      if (inFlight.current) return false;
      inFlight.current = true;
      setBusy(String(action.type));
      setError(null);
      try {
        const latest = readStored() ?? current.current;
        const { ok, json } = await call(action, latest);
        if (!ok) {
          setError(json.error ?? "Não foi possível concluir a ação.");
          return false;
        }
        apply(json);
        return true;
      } catch {
        setError("Falha de conexão com o servidor. Nada foi alterado; tente novamente.");
        return false;
      } finally {
        inFlight.current = false;
        setBusy(null);
      }
    },
    [apply],
  );

  return { data, busy, error, act, refresh };
}

export type Act = (a: Record<string, unknown>) => Promise<boolean>;

export const isResolved = (st: SectionState) => st.status === "confirmed_unchanged" || st.status === "confirmed_changed";

/** Short human status for a section (prefeitura and implantação). */
export function humanStatus(st: SectionState): { icon: "done" | "pend" | "todo"; text: string } {
  switch (st.status) {
    case "confirmed_unchanged":
      return { icon: "done", text: "Mantida como modelo" };
    case "confirmed_changed": {
      const n = st.proposal?.operations.length ?? 1;
      return { icon: "done", text: `${n} ${n > 1 ? "alterações confirmadas" : "alteração confirmada"}` };
    }
    case "pending":
      return { icon: "pend", text: "Pendente — decisão da prefeitura" };
    case "pending_requires_implementer":
      return { icon: "pend", text: "Pendente — precisa da implantação" };
    case "drafting_change":
      return { icon: "pend", text: "Em andamento — falta uma informação" };
    case "awaiting_confirmation":
      return { icon: "pend", text: "Em andamento — aguardando confirmação" };
    default:
      return { icon: "todo", text: "Não iniciada" };
  }
}

/** Compact technical line for the implantação view. */
export function techLine(op: Operation): string {
  if (op.op === "remove_field") return `remove_field ${op.fieldKey}`;
  const props = op.op === "add_field" ? op.field : op.changes;
  const key = op.op === "add_field" ? props.key : op.fieldKey;
  const parts = [`${op.op} ${key ?? "?"}`];
  if (props.type) parts.push(`type=${props.type}`);
  if (props.required) parts.push(`required=${props.required}`);
  if (props.condition) parts.push(`condition: ${props.condition.fieldKey} = ${props.condition.value}`);
  if (props.options) parts.push(`options=[${props.options.join(", ")}]`);
  if (props.mask) parts.push(`mask=${props.mask}`);
  if (props.acceptedFileFormats) parts.push(`formats=${props.acceptedFileFormats.join("/")}`);
  return parts.join(" · ");
}

export const fmtTime = (iso: string) => {
  const d = new Date(iso);
  const hm = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return d.toDateString() === new Date().toDateString() ? `Hoje, ${hm}` : `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}, ${hm}`;
};

export const cap = (t?: string) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : "");
