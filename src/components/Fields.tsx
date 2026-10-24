"use client";

import { describeRequired, explainInput, type HumanChange } from "@/core/diff";
import type { Field } from "@/core/types";

/** "Como está no modelo hoje" — template properties translated into plain language. */
export function FieldList({ fields, lookup }: { fields: Field[]; lookup: Field[] }) {
  return (
    <ul className="fields">
      {fields.map((f) => {
        const req = describeRequired(f, lookup);
        return (
          <li key={f.key} className="f">
            <span className="l">{f.label}</span>
            {f.description && <span className="field-desc">{f.description}</span>}
            <span className="d">
              <span className={req === "Opcional" ? "opt-tag" : "req-tag"}>{req}</span>
              <span aria-hidden="true"> · </span>
              {explainInput(f)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** "Label — details" rendered as a title line and a detail line. */
function Two({ text, strong }: { text: string; strong?: boolean }) {
  const i = text.indexOf(" — ");
  if (i < 0) return <div>{strong ? <b>{text}</b> : text}</div>;
  return (
    <div className="stack-sm" style={{ gap: 2 }}>
      <span style={{ fontWeight: strong ? 600 : 500 }}>{text.slice(0, i)}</span>
      <span className="small">{text.slice(i + 3).replace(/ · /g, " · ")}</span>
    </div>
  );
}

/** ANTES → DEPOIS, built deterministically from the structure. */
export function BeforeAfter({ changes, unchangedCount }: { changes: HumanChange[]; unchangedCount: number }) {
  return (
    <div className="stack-sm">
      {changes.map((c, i) => (
        <div key={i} className="ba">
          <div className="side">
            <div className="k">Antes</div>
            <Two text={c.before} />
          </div>
          <div className="arrow" aria-hidden="true">
            →
          </div>
          <div className={`side after ${c.kind === "removed" ? "removed" : ""}`}>
            <div className="k">Depois</div>
            <Two text={c.after} strong />
          </div>
        </div>
      ))}
      {unchangedCount > 0 && <p className="small muted">Os outros {unchangedCount} campos desta seção continuam iguais ao modelo.</p>}
    </div>
  );
}
