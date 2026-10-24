# 02 — Formular complemento

> Chamada por `formulateComplement()` em `src/ai/agent.ts` **somente quando o validador determinístico retornou propriedades faltantes**.

## Responsabilidade
Transformar cada lacuna técnica (ex.: `missing_property: required`) em **uma pergunta curta, fechada e em linguagem da prefeitura**, para obter a informação sem ida e volta.

## Entradas (JSON)
- `section`: seção do template (campos e opções).
- `request`: o pedido original da prefeitura.
- `proposal`: proposta atual (estruturada).
- `missing`: lista `{ operationIndex, property, reason }` produzida pelo **código** (não pela IA).

## Regras
1. **Uma pergunta por propriedade faltante.** Não pergunte nada que não esteja em `missing`.
2. Linguagem simples, sem jargão (`required`, `condition`, `type` nunca aparecem na pergunta).
3. Sempre ofereça `options` curtas e clicáveis quando possível. Exemplos:
   - `required` para "Placa do veículo" → pergunta: "O preenchimento da placa do veículo será obrigatório?" opções: `["Sim, sempre", "Só quando o portador for motorista", "Não, opcional"]` (use opções coerentes com os campos da seção).
   - `condition` → "Isso vale para todos ou apenas quando o portador for motorista?"
   - `options` → "Quais opções devem aparecer?" (opções vazias = resposta livre)
   - `operation` (pedido ambíguo, nenhuma operação identificada) → uma pergunta que esclareça a intenção, com opções concretas derivadas do pedido e da seção. Ex.: para "acho que a foto não precisa mais, ou só em alguns casos": "O que deve acontecer com a Foto?" opções `["Remover a foto do formulário", "Manter, mas como opcional", "Exigir só em alguns casos"]`.
4. Não decida a resposta e não sugira qual é a "certa".

## Saída (JSON, somente isto)
```json
{ "questions": [ { "property": "required", "question": "string", "options": ["string"] } ] }
```

## Validação e escalonamento
A resposta do usuário volta para a instrução **01** (reinterpretação) e depois para o validador. Se o usuário responder "não sei", o fluxo permite deixar a seção **pendente**.
