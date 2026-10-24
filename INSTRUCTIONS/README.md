# INSTRUCTIONS — comportamento do agente

Estes arquivos **não são documentação decorativa**: são lidos do disco em runtime e enviados ao modelo como prompt de sistema em toda chamada de IA do produto.

## Como são usados

```text
prompt de sistema = 00-orquestrador-validacao.md  +  instrução da capacidade (01…04)
```

1. `src/ai/llm.ts` → `readInstruction()` lê o arquivo deste diretório; `callJSON()` monta o prompt (`00` + capacidade) e chama o modelo pedindo **somente JSON**.
2. A resposta é validada com Zod (`src/core/schema.ts`) antes de qualquer uso. Saída fora do formato não altera estado.
3. `src/ai/agent.ts` expõe uma função por capacidade; cada uma usa **uma** instrução.
4. O código determinístico decide o que falta e controla os estados; **a confirmação final é sempre um clique humano**.
5. Cada execução é registrada na **Auditoria da IA** (tela do processo, área Implantação): instrução · ação · resultado · horário · origem (IA, código ou fallback offline).

| Arquivo | Capacidade | Função no código |
|---|---|---|
| `00-orquestrador-validacao.md` | Princípios globais | prefixo de todas (`callJSON`) |
| `01-interpretar-alteracao.md` | Interpretar alteração | `interpretChange()` |
| `02-formular-complemento.md` | Formular complemento | `formulateComplement()` |
| `03-acompanhar-reuniao.md` | Acompanhar reunião | `analyzeMeeting()`, `summarizeMeeting()` |
| `04-explicar-duvida.md` | Explicar dúvida | `explainDoubt()` |

---

## 00 — Orquestrador da validação

- **Responsabilidade:** princípios inegociáveis de toda chamada.
- **Quando:** sempre, como prefixo das instruções 01–04.
- **Entrada:** o JSON enviado pela capacidade em execução.
- **Ação:** define limites; não executa nada sozinho.
- **Saída:** garante que a capacidade responda apenas JSON válido.
- **Limites:** a IA nunca decide pela prefeitura · silêncio nunca é aprovação · template não é verdade local · não inventar regra nem interpretar legislação como autoridade · lacunas são definidas pelo código · em reunião, só fala real é evidência.
- **Escalonamento:** na dúvida entre supor e perguntar, pergunta; entre perguntar e escalar (lei, cálculo, regra só em texto), escala para a implantação.

## 01 — Interpretar alteração

- **Responsabilidade:** transformar o pedido da prefeitura em proposta estruturada.
- **Quando:** “Quero alterar” e a cada resposta de complemento.
- **Entrada:** seção do template (campos, orientações), campos de escolha do formulário, pedido original, respostas já dadas, proposta anterior.
- **Ação:** gera operações `add_field` / `update_field` / `remove_field`, preenchendo só o que foi dito.
- **Saída:** `{ summary, operations[], needsImplementer? }`.
- **Exemplo:** “Precisa pedir a placa do carro.” → adicionar “Placa do veículo” (texto), **sem** obrigatoriedade inventada.
- **Limites:** não cria ajuda, máscara ou opções não ditas (o código também descarta). Pedido ambíguo → nenhuma operação (o sistema pergunta).
- **Escalonamento:** legislação, cálculo ou taxa → `needsImplementer` (pendência para a implantação).

## 02 — Formular complemento

- **Responsabilidade:** transformar a lacuna técnica em pergunta humana.
- **Quando:** apenas quando o validador determinístico (`src/core/validator.ts`) aponta propriedade faltante.
- **Entrada:** seção, pedido original, proposta atual, lista de lacunas **produzida pelo código**.
- **Ação:** uma pergunta curta e fechada por lacuna, com opções clicáveis.
- **Saída:** `{ questions: [{ property, question, options[] }] }`.
- **Exemplo:** lacuna `required` → “O preenchimento da placa do veículo será obrigatório?” [Sim, sempre] [Só quando o portador for motorista] [Não, opcional].
- **Limites:** não pergunta nada fora das lacunas; não sugere a resposta “certa”; sem jargão técnico.
- **Escalonamento:** resposta “não sei” → seção fica pendente (nada é suposto).

## 03 — Acompanhar reunião

- **Responsabilidade:** identificar possíveis decisões na conversa e resumir a reunião.
- **Quando:** a cada novo trecho de fala transcrita ou anotação; e ao encerrar (resumo).
- **Entrada:** partes não resolvidas do processo em validação, pauta dos demais processos do cliente (com `agendaItemId`), trechos novos e trechos anteriores apenas como contexto.
- **Ação:** associa cada fala ao item correto da pauta e propõe a decisão.
- **Saída:** `{ detected[], agendaDecisions[] }` ou, no resumo, `{ decisions, changes, pending, nextSteps }`.
- **Limites:** **nunca confirma**; toda detecção fica como sugestão até o implantador confirmar. Frase sem relação com a pauta não gera decisão. Contexto da pauta ajuda a interpretar, mas não é evidência. Tolera erros fonéticos da transcrição (“arte” → ART).
- **Escalonamento:** fala que depende de lei ou regra pouco clara → pendência, não alteração.

## 04 — Explicar dúvida

- **Responsabilidade:** explicar o template em linguagem simples.
- **Quando:** “Tenho uma dúvida”.
- **Entrada:** seção do template e a pergunta da prefeitura.
- **Ação:** explica o que o campo pede e como está configurado no modelo.
- **Saída:** `{ answer, sufficientContext, pendingReason? }`.
- **Limites:** não decide regra municipal, não inventa obrigação, não interpreta legislação, sem termos técnicos.
- **Escalonamento:** contexto insuficiente → `pending_requires_implementer` (“vou deixar esta dúvida registrada para a equipe de implantação”).

---

## O que **não** é responsabilidade da IA

| Componente | Arquivo | Responsabilidade |
|---|---|---|
| Validador | `src/core/validator.ts` | decide quais propriedades faltam; descarta propriedades não ditas |
| Máquina de estados | `src/core/state.ts` | só ação humana leva a `confirmed_unchanged` / `confirmed_changed` |
| Diff | `src/core/diff.ts` | antes → depois a partir da estrutura |
| Especificação | `src/core/spec.ts` | parcial enquanto houver pendência |
| Schemas | `src/core/schema.ts` | toda saída da IA validada antes do uso |

## Fallback offline

Sem `OPENAI_API_KEY`, ou se a API falhar ou responder fora do formato, `src/ai/offline.ts` executa regras simples para a demo não parar. Essas execuções aparecem na auditoria como **fallback offline** — não são IA.
