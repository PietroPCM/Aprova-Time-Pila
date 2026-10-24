"use client";

import type { TraceEntry } from "@/core/types";

const WHO: Record<TraceEntry["provider"], string> = { openai: "IA", deterministic: "Código", "offline-fallback": "Fallback" };

export function TracePanel({ trace }: { trace: TraceEntry[] }) {
  const items = [...trace].reverse();
  return (
    <details className="audit">
      <summary>
        <b>Auditoria da IA</b> <span className="small muted">— INSTRUCTIONS executadas, ações e resultados ({trace.length})</span>
      </summary>
      <p className="xs muted" style={{ margin: "10px 0 4px" }}>
        IA = chamada ao modelo com a instrução indicada · Código = regra determinística · Fallback = simulação offline (não é IA)
      </p>
      {items.length === 0 ? (
        <p className="small muted">Nenhuma ação ainda.</p>
      ) : (
        <ul className="trace">
          {items.map((t, i) => (
            <li key={`${t.at}-${i}`}>
              <span>
                <span className={`who ${t.provider}`}>{WHO[t.provider]}</span>
                <span className="xs muted" style={{ display: "block" }}>
                  {new Date(t.at).toLocaleTimeString("pt-BR")}
                </span>
              </span>
              <span>
                <code>{t.instruction}</code> — <b>{t.action}</b>
                <span className="muted" style={{ display: "block" }}>
                  {t.result}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
