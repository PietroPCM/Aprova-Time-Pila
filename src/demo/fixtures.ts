// DEMO fixtures for the portfolio view. Only the main process of the main client is connected to
// the real validation session; everything else here is static demonstration data.
import { DEMO_TEMPLATE } from "@/core/template-demo";
import type { AgendaItem } from "@/core/types";

export type ProcStatus = "validated" | "validated_changes" | "waiting" | "in_progress" | "not_started";

export interface DemoProcess {
  id: string;
  name: string;
  status: ProcStatus;
  sectionsDone: number;
  sectionsTotal: number;
  changes: number;
  pendings: string[];
  lastActivity: string;
  deadline: string;
  live?: false;
}

export interface DemoClient {
  id: string;
  name: string;
  owner: string;
  processesDone: number;
  processesTotal: number;
  nextDeadline: string;
  lastActivity: string;
  situation: "Aguardando prefeitura" | "Validado" | "Próximo do prazo" | "Em andamento" | "Precisa de reunião";
  main?: true;
}

export const MAIN_CLIENT_ID = "londrina";
export const MAIN_PROCESS_ID = DEMO_TEMPLATE.id;
export const MAIN_PROCESS_DEADLINE = "26/10";

/** Static processes of the main client (besides the live one). */
export const MAIN_CLIENT_PROCESSES: DemoProcess[] = [
  { id: "cartao-idoso", name: "Cartão de estacionamento para Idosos", status: "validated", sectionsDone: 4, sectionsTotal: 4, changes: 0, pendings: [], lastActivity: "Hoje, 10:12", deadline: "26/10" },
  {
    id: "alvara-obras",
    name: "Alvará de Obras",
    status: "waiting",
    sectionsDone: 3,
    sectionsTotal: 5,
    changes: 1,
    pendings: ["Decidir se a ART é obrigatória para reformas sem ampliação"],
    lastActivity: "Ontem, 17:40",
    deadline: "28/10",
  },
  { id: "licenca-ambiental", name: "Licença Ambiental de Operação", status: "validated_changes", sectionsDone: 6, sectionsTotal: 6, changes: 2, pendings: [], lastActivity: "22/10", deadline: "—" },
  { id: "alvara-sanitario", name: "Alvará Sanitário", status: "not_started", sectionsDone: 0, sectionsTotal: 4, changes: 0, pendings: [], lastActivity: "—", deadline: "30/10" },
  {
    id: "alvara-eventos",
    name: "Alvará para Realização de Eventos",
    status: "in_progress",
    sectionsDone: 1,
    sectionsTotal: 3,
    changes: 0,
    pendings: ["Confirmar prazo mínimo de antecedência do pedido"],
    lastActivity: "Hoje, 09:05",
    deadline: "29/10",
  },
];

export const CLIENTS: DemoClient[] = [
  { id: MAIN_CLIENT_ID, name: "Prefeitura de Londrina", owner: "Implantador Aprova", processesDone: 0, processesTotal: 0, nextDeadline: "Hoje", lastActivity: "Hoje", situation: "Aguardando prefeitura", main: true },
  { id: "cascavel", name: "Prefeitura de Cascavel", owner: "Implantador Aprova", processesDone: 10, processesTotal: 10, nextDeadline: "—", lastActivity: "Hoje, 09:30", situation: "Validado" },
  { id: "toledo", name: "Prefeitura de Toledo", owner: "Implantador Aprova", processesDone: 5, processesTotal: 9, nextDeadline: "Amanhã", lastActivity: "Ontem, 16:02", situation: "Próximo do prazo" },
  { id: "maringa", name: "Prefeitura de Maringá", owner: "Implantador Aprova", processesDone: 4, processesTotal: 12, nextDeadline: "27/10", lastActivity: "Hoje, 11:20", situation: "Em andamento" },
  { id: "chapeco", name: "Prefeitura de Chapecó", owner: "Implantador Aprova", processesDone: 2, processesTotal: 8, nextDeadline: "25/10", lastActivity: "20/10", situation: "Precisa de reunião" },
];

export const STATUS_TEXT: Record<ProcStatus, string> = {
  validated: "Mantido como modelo",
  validated_changes: "Validado com alterações",
  waiting: "Aguardando decisão",
  in_progress: "Em andamento",
  not_started: "Não iniciado",
};

export const isDone = (s: ProcStatus) => s === "validated" || s === "validated_changes";

// ---------------------------------------------------------------------------
// Read-only detail for illustrative clients/processes (no AI, no session).
// ---------------------------------------------------------------------------

export type PartStatus = "kept" | "changed" | "pending" | "todo";

export interface DemoPart {
  title: string;
  status: PartStatus;
}

export interface DemoRequest {
  said: string;
  field: string;
  type: string;
  rule: string;
  status: string;
  source: string;
}

const PART_TITLES = ["Declaração", "Dados do requerente", "Dados do imóvel ou atividade", "Documentos obrigatórios", "Taxas e prazos", "Documentos complementares"];

const REQUEST_CATALOG: Omit<DemoRequest, "status" | "source">[] = [
  { said: "Precisa pedir o número da matrícula do imóvel.", field: "Matrícula do imóvel", type: "Texto", rule: "Obrigatório" },
  { said: "O CNPJ só é necessário quando o pedido for de empresa.", field: "CNPJ", type: "Texto no formato 00.000.000/0000-00", rule: "Obrigatório quando o requerente for empresa" },
  { said: "Aceitar também o projeto em PDF.", field: "Projeto arquitetônico", type: "Anexo (PDF, DWG)", rule: "Obrigatório" },
];

export function demoParts(p: DemoProcess): DemoPart[] {
  const titles = PART_TITLES.slice(0, Math.max(p.sectionsTotal, 1));
  return titles.map((title, i) => {
    if (i < p.sectionsDone) return { title, status: i >= p.sectionsDone - p.changes ? "changed" : "kept" };
    if (i < p.sectionsDone + p.pendings.length) return { title, status: "pending" };
    return { title, status: "todo" };
  });
}

export function demoRequests(p: DemoProcess): DemoRequest[] {
  return REQUEST_CATALOG.slice(0, p.changes).map((r, i) => ({
    ...r,
    status: "Confirmado pela prefeitura",
    source: i % 2 === 0 ? "Validação online" : "Reunião",
  }));
}

const CATALOG = [
  "Alvará de Construção",
  "Alvará de Funcionamento",
  "Alvará Sanitário",
  "Habite-se",
  "Licença Ambiental Prévia",
  "Certidão de Uso do Solo",
  "Cartão de estacionamento para Idosos",
  "Poda de Árvores",
  "Alvará para Eventos",
  "Aprovação de Loteamento",
  "Ocupação de Via Pública",
  "Certidão de Numeração Predial",
];

const PENDING_TEXT = ["Confirmar documentos exigidos para reformas", "Definir prazo de análise", "Decidir se a taxa é cobrada na abertura"];

/** Deterministic illustrative processes for a non-main client, consistent with its counters. */
export function clientProcesses(c: DemoClient): DemoProcess[] {
  if (c.id === MAIN_CLIENT_ID) return MAIN_CLIENT_PROCESSES;
  return CATALOG.slice(0, c.processesTotal).map((name, i) => {
    const total = 4 + (i % 3);
    const done = i < c.processesDone;
    const waiting = !done && i === c.processesDone && c.situation !== "Em andamento";
    const inProgress = !done && !waiting && i === c.processesDone;
    const changes = done ? i % 3 === 0 ? 1 : 0 : waiting ? 1 : 0;
    return {
      id: `${c.id}-${i + 1}`,
      name,
      status: done ? (changes ? "validated_changes" : "validated") : waiting ? "waiting" : inProgress ? "in_progress" : "not_started",
      sectionsDone: done ? total : waiting || inProgress ? Math.min(2, total - 1) : 0,
      sectionsTotal: total,
      changes,
      pendings: waiting ? [PENDING_TEXT[i % PENDING_TEXT.length]] : [],
      lastActivity: done ? c.lastActivity : waiting || inProgress ? c.lastActivity : "—",
      deadline: done ? "—" : c.nextDeadline,
    };
  });
}

export function findClient(id: string) {
  return CLIENTS.find((c) => c.id === id);
}

/** Meeting agenda items of the main client's other processes (fed to the meeting copilot). */
export const MAIN_CLIENT_AGENDA: AgendaItem[] = [
  {
    clientId: MAIN_CLIENT_ID,
    processId: "alvara-obras",
    processTitle: "Alvará de Obras",
    agendaItemId: "art-reforma",
    question: "Decidir se a ART é obrigatória para reformas sem ampliação",
    context: "Hoje o modelo exige a ART (Anotação de Responsabilidade Técnica) apenas para obras com ampliação de área.",
  },
  {
    clientId: MAIN_CLIENT_ID,
    processId: "alvara-eventos",
    processTitle: "Alvará para Realização de Eventos",
    agendaItemId: "prazo-antecedencia",
    question: "Confirmar prazo mínimo de antecedência do pedido",
    context: "O modelo não define quantos dias antes do evento o pedido precisa ser feito.",
  },
];
