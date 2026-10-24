"use client";

import Link from "next/link";
import { StatusIcon } from "./Shell";
import type { FeedItem } from "./live";
import { fmtTime } from "./useSession";

const ICON: Record<FeedItem["kind"], "done" | "pend" | "todo"> = { change: "done", keep: "done", pending: "pend", doubt: "pend", progress: "todo" };

export function Feed({ items, processName, href }: { items: FeedItem[]; processName: string; href: string }) {
  if (items.length === 0) return <p className="muted">A prefeitura ainda não respondeu nenhuma parte.</p>;
  return (
    <ol className="feed">
      {items.map((it, i) => (
        <li key={i} className={`feed-item ${it.kind}`}>
          <StatusIcon kind={it.kind === "change" && it.status === "Aguardando confirmação" ? "pend" : ICON[it.kind]} />
          <div className="feed-main">
            <div className="feed-top">
              <span className="feed-title">{it.title}</span>
              <span className="feed-time">{fmtTime(it.at)}</span>
            </div>
            {it.quote && <p className="feed-quote">“{it.quote}”</p>}
            {it.detail && <p className="feed-detail">{it.detail}</p>}
            <div className="feed-meta">
              <span>{it.process ?? `${processName} · ${it.section}`}</span>
              <span className={it.status.startsWith("Confirmado") || it.status.startsWith("Respondida") ? "ok-text" : "warn-text"}>{it.status}</span>
              <Link href={href}>Ver no processo</Link>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
