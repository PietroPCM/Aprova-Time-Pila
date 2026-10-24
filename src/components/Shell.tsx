"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ViewData } from "./useSession";

/** Official Aprova wordmark (downloaded from aprova.com.br, /images/site/svg/aprova-wordmark-dark.svg). */
export function Logo() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/brand/aprova-wordmark-dark.svg" alt="Aprova" className="logo" width={110} height={15} />
  );
}

const SIDE = [
  { href: "/implantacao", label: "Carteira", match: (p: string) => p === "/implantacao" || (/^\/implantacao\/[^/]+/.test(p) && !/\/(pendencias|reunioes)$/.test(p) && !/\/reuniao$/.test(p)) },
  { href: "/implantacao/pendencias", label: "Pendências", match: (p: string) => p === "/implantacao/pendencias" },
  { href: "/implantacao/reunioes", label: "Reuniões", match: (p: string) => p === "/implantacao/reunioes" || /\/reuniao$/.test(p) },
];

export function TopBar({ area, who, extra }: { area: "prefeitura" | "implantacao"; who: string; extra?: React.ReactNode }) {
  const path = usePathname() ?? "";
  return (
    <>
      <header className="topbar">
        <div className="topbar-in">
          <Link href={area === "prefeitura" ? "/prefeitura" : "/implantacao"} aria-label="Aprova — início" className="logo-link">
            <Logo />
          </Link>
          <Link href={area === "prefeitura" ? "/prefeitura" : "/implantacao"} className="area">
            {area === "prefeitura" ? "Implantação · Prefeitura" : "Implantação"}
          </Link>
          <span className="env">Ambiente de demonstração</span>
          <span className="spacer" />
          {extra}
          <span className="who">{who}</span>
          <Link href="/" className="switch">
            Trocar acesso
          </Link>
        </div>
      </header>
      {area === "implantacao" && (
        <nav className="side" aria-label="Implantação">
          {SIDE.map((it) => (
            <Link key={it.href} href={it.href} aria-current={it.match(path) ? "page" : undefined}>
              {it.label}
            </Link>
          ))}
        </nav>
      )}
    </>
  );
}

export function FooterNote() {
  return <footer className="foot">Os dados utilizados nesta demonstração são fictícios.</footer>;
}

export function Crumbs({ items }: { items: { href?: string; label: string }[] }) {
  return (
    <nav aria-label="Você está em" className="crumbs">
      {items.map((it, i) => (
        <span key={i}>
          {i > 0 && <span aria-hidden="true"> / </span>}
          {it.href ? <Link href={it.href}>{it.label}</Link> : <span aria-current="page">{it.label}</span>}
        </span>
      ))}
    </nav>
  );
}

export function Progress({ done, total, label }: { done: number; total: number; label: string }) {
  return (
    <div className="progress-wrap">
      <span className="progress-label">
        <b>
          {done} de {total}
        </b>{" "}
        {label}
      </span>
      <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-label={label}>
        <span style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
      </div>
    </div>
  );
}

/** Tells the user when the last AI step used the fallback instead of the real model. */
export function AiNotice({ data, technical }: { data: ViewData; technical?: boolean }) {
  const last = data.lastAgent;
  if (!last || last.provider !== "offline-fallback") return null;
  return (
    <div className="msg warn small" role="status">
      {technical
        ? `Último passo de IA executado pelo fallback offline (simulação, não é IA). ${last.result.match(/\[fallback offline: (.*)\]/)?.[1] ?? ""}`
        : "A interpretação automática está indisponível no momento. Seguimos em modo de demonstração — revise com atenção antes de confirmar."}
    </div>
  );
}

export function StatusIcon({ kind }: { kind: "done" | "pend" | "todo" }) {
  return (
    <span className={`ico ${kind}`} aria-hidden="true">
      {kind === "done" ? "✓" : kind === "pend" ? "!" : "○"}
    </span>
  );
}
