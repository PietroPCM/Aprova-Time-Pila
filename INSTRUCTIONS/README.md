# Agent Instructions

Esta pasta contém as instruções **usadas em runtime** pelo agente de validação guiada (desafio **Implantação**, Hackathon Aprova 2026).

Cada chamada de IA monta o prompt de sistema assim:

```
00-orquestrador-validacao.md   (sempre, princípios inegociáveis)
+ 0X-<instrução específica>.md  (a capacidade sendo executada)
```

O carregamento acontece em `src/ai/llm.ts` (`readInstruction`) e cada execução é registrada na **Trilha de INSTRUCTIONS** (visível na tela *Implantação*), com: `instruction · action · result · timestamp · provider`.

## Mapa das instruções

| Arquivo | Responsabilidade | Quando é invocada | Função no código | Saída |
|---|---|---|---|---|
| `00-orquestrador-validacao.md` | Princípios: IA não decide, silêncio ≠ aprovação, template ≠ verdade local, não inventar regra | Prefixo de **todas** as chamadas | `callJSON()` | — |
| `01-interpretar-alteracao.md` | Pedido em linguagem natural → proposta estruturada (`add_field` / `update_field` / `remove_field`) | "Quero alterar" e a cada resposta de complemento | `interpretChange()` | `ChangeProposal` |
| `02-formular-complemento.md` | Lacunas detectadas **pelo código** → perguntas leigas e fechadas | Só quando o validador retorna propriedades faltantes | `formulateComplement()` | `questions[]` |
| `03-acompanhar-reuniao.md` | Notas/transcrição da reunião → possíveis decisões (`detected_in_meeting`) e resumo | Modo reunião: "Detectar decisões" / "Gerar resumo" | `analyzeMeeting()`, `summarizeMeeting()` | detecções / resumo |
| `04-explicar-duvida.md` | Explicar campo/regra usando só o template; sem contexto → pendência para o implantador | "Tenho dúvida" | `explainDoubt()` | resposta + `sufficientContext` |

## O que NÃO é responsabilidade da IA (código determinístico)

| Componente | Arquivo | Responsabilidade |
|---|---|---|
| Validador | `src/core/validator.ts` | Decide **quais propriedades faltam** (`required`, `condition`, `options`, `acceptedFileFormats`, `type`, `label`…) |
| Máquina de estados | `src/core/state.ts` | Únicas transições para `confirmed_unchanged` / `confirmed_changed` exigem ação humana explícita |
| Diff | `src/core/diff.ts` | ANTES → DEPOIS a partir da estrutura (não do texto da IA) |
| Partial Spec | `src/core/spec.ts` | Spec versionada, `partial` enquanto houver pendência, formato **PROVISÓRIO** |
| Schemas | `src/core/schema.ts` | Zod: toda saída da IA é validada antes de ser usada |

## Regras de validação e escalonamento (resumo)
- A IA nunca confirma, mantém ou altera seção. Só clique humano.
- Lacunas são decididas pelo código; a IA só pergunta.
- Lei, cálculo, taxa, ou ambiguidade entre texto de orientação e regra real → `pending_requires_implementer`.
- No modo reunião, detecções ficam `detected_in_meeting` até o implantador confirmar.

## Fallback offline
Sem `OPENAI_API_KEY` (ou se a API falhar), `src/ai/offline.ts` executa uma simulação baseada em regras simples para a demo não quebrar. Toda execução dessas aparece na trilha como **`fallback offline (simulação)`** — não é IA.
