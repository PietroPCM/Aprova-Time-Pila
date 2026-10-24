import Link from "next/link";

export default function Home() {
  return (
    <main className="home">
      <div className="stack-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/aprova-wordmark-dark.svg" alt="Aprova" width={150} height={21} />
        <h1 style={{ marginTop: 18 }}>Implantação</h1>
        <p className="muted">A prefeitura valida os processos-modelo na linguagem dela. A implantação recebe as decisões prontas para configurar.</p>
      </div>
      <ul className="plist">
        <li className="prow">
          <div className="pmain">
            <span className="pname">Acesso da prefeitura</span>
            <span className="pmeta">Prefeitura de Londrina · validar os processos da implantação</span>
          </div>
          <div className="pact">
            <Link href="/prefeitura" className="btn primary">
              Entrar
            </Link>
          </div>
        </li>
        <li className="prow">
          <div className="pmain">
            <span className="pname">Acesso da implantação</span>
            <span className="pmeta">Equipe Aprova · carteira de clientes, reuniões e especificação</span>
          </div>
          <div className="pact">
            <Link href="/implantacao" className="btn">
              Entrar
            </Link>
          </div>
        </li>
      </ul>
      <p className="xs muted">Demonstração com dados fictícios. Sem integração com os sistemas da Aprova.</p>
    </main>
  );
}
