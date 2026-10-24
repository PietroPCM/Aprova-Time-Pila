# STATE — Hackathon Aprova 2026 (Time Pila)

Atualizado: 2026-10-24 15:45

## Decisão de produto (fechada)
Desafio: **Implantação**. Produto: camada de **decisão e validação** do template entre a cidade modelo e os agents configuradores existentes.
Dois acessos: **Prefeitura** (`/prefeitura`) e **Implantação** (`/implantacao`). Mesma IA, mesma sessão. Modo reunião = mesma sessão aberta pelo implantador.

## Stack
Next.js 15 (App Router) · TypeScript · Zod · OpenAI server-side (`OPENAI_MODEL`, padrão `gpt-5-mini`) · Vitest · persistência da demo no navegador (localStorage); API stateless.

## Status do CORE
| # | Item | Status |
|---|---|---|
| 1 | STATE.md | ✅ |
| 2 | Scaffold | ✅ (manual; create-next-app falhou por regra `allowScripts` do npm 11) |
| 3–4 | Modelo de dados + template DEMO | ✅ `src/core/types.ts`, `template-demo.ts` |
| 5 | Máquina de estados | ✅ `src/core/state.ts` |
| 6 | Validador determinístico | ✅ `src/core/validator.ts` (condições podem cruzar seções) |
| 7 | Partial Spec (PROVISÓRIO) | ✅ `src/core/spec.ts` |
| 8 | Testes do núcleo | ✅ 12/12 (`npm test`) |
| 9–12 | IA interpretar → complemento → diff → confirmação | ✅ **IA real (gpt-5-mini) verificada** + fallback rotulado |
| 13–14 | UI Prefeitura / Implantação | ✅ verificado no navegador |
| 15 | Retomada da sessão | ✅ abre no primeiro ponto não resolvido |
| 16 | INSTRUCTIONS observáveis | ✅ trilha na tela Implantação |
| 17–21 | Modo reunião + copiloto (notas) + detecção + confirmação + resumo | ✅ via API e UI (fallback offline) |
| 22 | Áudio | ❌ não implementado (decisão: proteger o core) |

## Verificado (comando/teste/demo)
- `npm test` → 12 testes passando (validador, estados, diff, spec).
- `npx tsc --noEmit` → sem erros.
- API end-to-end (offline): keep → requestChange → answer → confirm → pending → meetingStart (abre em `documentos`) → note → analyze → accept → confirm → accept keep → summary → spec `complete`.
- UI (Chrome, localhost:3000): fluxo Prefeitura completo até confirmar alteração; Implantação com tabela/handoff/spec; Modo reunião abre em Documentos; copiloto detecta 2 decisões.

## Fase de polish (13:12–13:38)
- UI redesenhada com referência no ambiente real (Inter, #212529, bordas #DEE2E6, raio 12, primária #10838A).
- IA real: normal / ambíguo / adversarial / legislação testados; ajustes: ambíguo → pergunta de esclarecimento; `helpText` e máscara não ditos são descartados por código; "não sei" → pendente; erros da API sanitizados; schema tolera `updateField`/`condition.field`.
- Regressão API com IA real: 13/13 PASS, nenhum fallback. Build de produção OK (`NEXT_DIST_DIR=.next-build npx next build`).
- Impeccable: 0 anti-patterns (exceção registrada: fonte Inter = fonte do produto Aprova).

## Fase UX (13:40–14:05)
- Nova arquitetura de navegação: Minha implantação → validação; Carteira → Cliente → Processo (handoff) → Reunião (página dedicada).
- Logo oficial (wordmark de aprova.com.br). Não existe versão vertical pública.
- Verificado: fluxo Prefeitura/Implantação/Reunião no Chrome com IA real; 390/768/1280 via Playwright sem overflow; Impeccable 0; testes 16/16; build OK.

## Fase UX v3 (14:10–14:40)
- Toda prefeitura e todo processo abrem (clientes/processos ilustrativos = páginas read-only coerentes). Crawl: 59 páginas, 0 links mortos, 0 elementos clicáveis falsos.
- Cliente = workspace: "Respostas da prefeitura" (feed humano), processos, painel lateral (pauta, prazo, o que a IA fez, contato).
- Reunião = sala ao vivo em 3 colunas com **transcrição real** (`/api/transcribe`, verificado com áudio pt-BR real) + copiloto automático + resumo.
- JSON só em "Dados técnicos" (fechado); "Auditoria da IA" fechada.

## Passe final (14:45–14:58)
- Copiloto cobre a pauta completa (`MAIN_CLIENT_AGENDA` + `agendaDecisions`): ART e prazo de 4 dias detectados com IA real; frase sem relação não gera decisão.
- Causa do bug relatado: transcrição ouvia "a ART" como "Elate"/"arte" → prompt de vocabulário na transcrição + instrução 03 tolerante a erro fonético. Verificado com áudio real (voz pt-BR do macOS).
- Último trecho do microfone não é descartado ao pausar/encerrar; estados "Ouvindo / Processando fala / Analisando decisões".
- Shell operacional com menu lateral funcional (Carteira, Pendências, Reuniões); um único aviso "Ambiente de demonstração" + rodapé.
- Campos com descrição humana; handoff sem termos internos.
- Apresentação em produção: `npm run build && npm start` (sem indicador do Next).

## Fechamento (15:20–15:45)
- API stateless + sessão no localStorage (compatível com Vercel). Sem `.data/`.
- Transcrição nunca mostra o prompt de vocabulário (eco descartado); só fala nova é evidência; dedupe semântico; contadores "confirmados · sugestões · pendentes".
- Logo no canto superior esquerdo.

## Bloqueios / riscos
- Latência da IA ~6–10 s por passo (spinner na UI). Se a API cair, fallback offline rotulado mantém a demo.
- Captura de microfone real só testada com dispositivo de áudio falso do Playwright; precisa de teste com microfone no Chrome do apresentador (permissão do navegador).

## Regras
- Sem commit/push/deploy sem autorização explícita do Pietro.
- Nunca registrar credenciais do ambiente Aprova.
- Congelar features ~15:40; entrega 17:00.
