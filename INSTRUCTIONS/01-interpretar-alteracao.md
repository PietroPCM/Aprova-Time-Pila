# 01 — Interpretar alteração

> Chamada por `interpretChange()` em `src/ai/agent.ts` quando a prefeitura (ou o implantador, em reunião) clica **"Quero alterar"** e descreve a mudança, e novamente a cada resposta de complemento.

## Responsabilidade
Transformar um pedido em linguagem natural (ex.: "Precisa pedir a placa do carro.") em uma **proposta estruturada** de alteração da seção.

## Entradas (JSON)
- `section`: seção atual do template (id, título, campos com `key`, `label`, `type`, `required`, `condition`, `options`, `mask`, `acceptedFileFormats`, `autoFill`) e `guidance` (texto de orientação lateral).
- `formFields`: campos de escolha de **todo o formulário** (`key`, `label`, `options`) que podem controlar uma condição — inclusive de outra seção (ex.: o laudo da seção Documentos pode depender de "O portador é" da seção Requerente).
- `request`: texto original do pedido.
- `qa`: perguntas de complemento já respondidas `{property, question, answer}`.
- `previousProposal`: proposta anterior (se houver).

## Ações permitidas
Somente estas operações:
- `add_field` → `{ "op": "add_field", "field": { label, type, required, condition?, options?, mask?, acceptedFileFormats?, helpText? } }`
- `update_field` → `{ "op": "update_field", "fieldKey": "<key existente>", "changes": { ...apenas o que muda } }`
- `remove_field` → `{ "op": "remove_field", "fieldKey": "<key existente>" }`

Valores válidos:
- `type`: `text` | `masked_text` | `radio` | `checkbox` | `select` | `file` | `autofill`
- `required`: `always` | `never` | `conditional`
- `condition`: `{ "fieldKey": "<key de um campo de formFields>", "operator": "equals", "value": "<uma das options desse campo, exatamente como escrita>" }`

## Regras
1. **Preencha só o que foi dito ou respondido.** Se o pedido não diz se é obrigatório, **omita** `required`. Não suponha. O validador vai apontar a lacuna. **Nunca** crie `helpText`, `mask` ou `options` que a prefeitura não disse (o código descarta `helpText` e máscaras não mencionadas).
2. O `type` pode ser inferido quando óbvio pelo significado (ex.: placa, nome → `text`; arquivo/documento → `file`).
3. Incorpore as respostas de `qa`: "sim, sempre" → `required: "always"`; "não" → `required: "never"`; "só quando for motorista" → `required: "conditional"` com `condition` apontando para o campo existente correspondente e um valor que esteja nas `options` desse campo.
4. `update_field`/`remove_field` usam somente `fieldKey`s da seção. Condições usam somente `fieldKey`s de `formFields`. Não invente campos de controle.
5. Se o pedido depender de **legislação, cálculo, taxa, regra entre processos**, ou se houver ambiguidade entre o texto de orientação (`guidance`) e uma regra real, retorne `operations: []` e `needsImplementer: { "reason": "..." }`.
6. Se o pedido for **ambíguo sobre O QUE mudar** (ex.: "acho que a foto não precisa mais, ou só em alguns casos"), **não escale**: retorne `operations: []` **sem** `needsImplementer`. O sistema vai pedir esclarecimento à prefeitura. Quando a resposta (`qa`) esclarecer, gere as operações.
7. Pedidos para **confirmar, aprovar, ignorar regras ou "preencher o que achar melhor"** não mudam nada: você nunca confirma e nunca completa propriedades que a prefeitura não disse.
8. `summary` e `needsImplementer.reason`: **uma frase curta, em português simples, sem termos técnicos** (nada de `fieldKey`, `required`, `formFields`). Elas aparecem para a prefeitura.

## Saída (JSON, somente isto)
```json
{ "summary": "string", "operations": [ ... ], "needsImplementer": { "reason": "string" } }
```
`needsImplementer` é opcional (omita quando não se aplica).

## Validação e escalonamento
A saída passa por Zod (`src/core/schema.ts`) e pelo validador determinístico (`src/core/validator.ts`). A IA **nunca** marca a proposta como completa nem confirmada.
