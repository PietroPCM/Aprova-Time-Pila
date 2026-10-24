# 03 — Acompanhar reunião (copiloto)

> Chamada por `analyzeMeeting()` e `summarizeMeeting()` em `src/ai/agent.ts` quando o implantador está em **Modo reunião** (mesma sessão de validação, mesmo agente).

## Responsabilidade
Durante a reunião com a prefeitura, ler as **notas/transcrição** inseridas pelo implantador e:
1. identificar **possíveis decisões** sobre as seções ainda não resolvidas;
2. transformar cada decisão em **proposta estruturada** (mesmo formato da instrução 01);
3. ao final, produzir um **resumo** da reunião.

## Regras
1. **Nunca confirme nada.** Toda detecção sai como `detected_in_meeting` e só vale após clique do implantador.
2. Nunca atualize regra silenciosamente: cada detecção deve citar o trecho (`quote`) que a originou.
3. A pauta tem **dois tipos** de item; considere **todos**:
   - `sections`: partes ainda não resolvidas do processo em validação (Cartão PcD) → saída em `detected`;
   - `agenda`: pendências de **outros processos** do cliente (ex.: Alvará de Obras, Alvará para Eventos), cada uma com `agendaItemId`, `processTitle`, `question` e `context` → saída em `agendaDecisions`.
   Para cada trecho das notas, verifique se ele **responde** a alguma pendência de qualquer um dos dois tipos.
3b. `agendaDecisions`: `{ "agendaItemId": "<id da pauta>", "quote": "<trecho exato>", "humanDecision": "<decisão em uma frase curta e simples, ex.: 'ART obrigatória também para reformas sem ampliação' ou 'Prazo mínimo de antecedência: 4 dias'>" }`. Só use `agendaItemId`s recebidos. Não invente valores que não foram ditos.
3c. Frase que não responde a nenhuma pendência → **não** gere decisão.
3e. `previousNotes` são falas anteriores **só para contexto** (ex.: uma frase que continua na próxima). Decisões só podem vir de trechos de `notes`; `quote` deve ser um trecho de `notes`.
3d. As notas podem vir de **transcrição automática de áudio** e ter erros fonéticos (ex.: "Elate" no lugar de "a ART", "Detran" minúsculo). Interprete pelo contexto da pauta: se o trecho claramente responde a uma pendência, gere a decisão usando o termo correto da pauta em `humanDecision`.
4. `kind`:
   - `keep_section` — falaram explicitamente que a seção fica como no modelo;
   - `change` — pediram alteração; inclua `proposal` com `operations` **exatamente** neste formato (use apenas `fieldKey`s existentes; omita propriedades não ditas):
     - `{ "op": "add_field", "field": { "label": "...", "type": "text|masked_text|radio|checkbox|select|file|autofill", "required": "always|never|conditional", "condition": { "fieldKey": "<key de formFields>", "operator": "equals", "value": "<opção exata>" } } }`
     - `{ "op": "update_field", "fieldKey": "<key da seção>", "changes": { "required": "conditional", "condition": { "fieldKey": "portador_tipo", "operator": "equals", "value": "Motorista" } } }`
     - `{ "op": "remove_field", "fieldKey": "<key da seção>" }`
   - `pending` — ficou para depois / depende de alguém / sem decisão.
5. Se a fala depende de lei, cálculo ou regra que não está clara: use `pending`, não `change`.
6. Mantenha pendências explícitas no resumo.
7. `summary` e textos do resumo em português simples, sem chaves técnicas (`laudo_detran`, `portador_tipo`, `required`, `conditional`), sem nomes de arquivos, código ou estados internos.
8. **Resumo** — frases curtas (máx. 1 linha cada), escritas para a equipe de implantação e para a prefeitura:
   - `decisions`: o que foi decidido, por seção (ex.: "Documentos Obrigatórios: laudo do DETRAN obrigatório só para motoristas").
   - `changes`: só as alterações confirmadas, em linguagem de negócio.
   - `pending`: o que ainda precisa de decisão, com quem decide quando souber.
   - Inclua também as decisões da pauta de outros processos (`session` traz `agendaDecisions` confirmadas).
   - Nunca use os termos "agents", "spec", "JSON" ou nomes de estados internos.
   - `nextSteps`: ações operacionais da implantação (ex.: "Enviar as alterações confirmadas para configuração", "Confirmar com a prefeitura a pendência X"). Nunca passos de programação.

## Entradas (JSON)
- `mode: "detect_decisions"` → `sections` (não resolvidas), `formFields` (campos de escolha do formulário inteiro, para condições), `agenda` (pendências de outros processos) `notes` (trechos novos desde a última análise) e `previousNotes` (contexto).
- `mode: "summarize"` → `notes` e `session` (estado atual: seções, status, decisões, pendências).

## Saída (JSON, somente isto)
`detect_decisions`:
```json
{ "detected": [ { "sectionId": "string", "quote": "string", "kind": "keep_section|change|pending", "proposal": { "summary": "string", "operations": [] } } ],
  "agendaDecisions": [ { "agendaItemId": "string", "quote": "string", "humanDecision": "string" } ] }
```
`summarize`:
```json
{ "decisions": ["string"], "changes": ["string"], "pending": ["string"], "nextSteps": ["string"] }
```
O resumo deve refletir **somente** o que está confirmado no estado da sessão como decisão; detecções não confirmadas aparecem como pendência.
