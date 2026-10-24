import type { Template } from "./types";

// DEMO template. Fictitious, inspired by the STRUCTURE of the
// "Cartão de estacionamento para Pessoas com Deficiência" process seen in the
// Aprova model environment. No real municipality data.
export const DEMO_TEMPLATE: Template = {
  id: "cartao-estacionamento-pcd-demo",
  version: "modelo-demo-v1",
  category: "Trânsito e Transporte",
  processName: "Cartão de estacionamento para Pessoas com Deficiência",
  demo: true,
  sections: [
    {
      id: "declaracao",
      number: 1,
      title: "Declaração de Veracidade",
      purpose: "Aqui você confirma como o cidadão declara que as informações são verdadeiras e para qual setor da prefeitura o pedido vai.",
      guidance: [
        "Siga as dicas e instruções contidas nos textos laterais para o correto preenchimento do processo.",
      ],
      fields: [
        { description: "Quem está fazendo a solicitação. O sistema identifica essa pessoa automaticamente.", key: "remetente", label: "Remetente", type: "autofill", required: "always", autoFill: "usuário logado" },
        {
          description: "A pessoa confirma que as informações fornecidas são verdadeiras.",
          key: "declaro",
          label: "Declaro a veracidade das informações prestadas (art. 299 do Código Penal)",
          type: "checkbox",
          required: "always",
        },
        { description: "Define para qual setor da prefeitura o pedido será enviado.", key: "destinatario", label: "Destinatário", type: "select", required: "always", options: ["Setor de Trânsito"] },
      ],
    },
    {
      id: "requerente",
      number: 2,
      title: "Dados do Requerente",
      purpose: "Aqui você confirma quais informações serão pedidas à pessoa que solicitar este serviço.",
      guidance: [
        "Se o requerente for o usuário logado, os dados são preenchidos automaticamente.",
        "O cartão só é válido após a conclusão de todo o processo.",
      ],
      fields: [
        {
          description: "Se quem pede é o próprio usuário logado ou outra pessoa.",
          key: "requerente_tipo",
          label: "Requerente do processo é",
          type: "radio",
          required: "always",
          options: ["Usuário logado no sistema", "Outro"],
        },
        { description: "Nome completo de quem pede o cartão.", key: "nome", label: "Nome", type: "text", required: "always" },
        { description: "Documento de identificação do requerente.", key: "cpf", label: "CPF", type: "masked_text", required: "always", mask: "000.000.000-00" },
        { description: "Contato para a prefeitura falar com o requerente.", key: "telefone", label: "Telefone", type: "masked_text", required: "always", mask: "(00) 00000-0000" },
        {
          description: "Se a pessoa com deficiência dirige o veículo ou é passageira.",
          key: "portador_tipo",
          label: "O portador de necessidades especiais é",
          type: "radio",
          required: "always",
          options: ["Motorista", "Passageiro"],
        },
        { description: "Carteira de motorista, hoje opcional no modelo.", key: "cnh", label: "Número da CNH", type: "text", required: "never" },
        { description: "Endereço do requerente; o sistema completa a rua a partir do CEP.", key: "cep", label: "CEP", type: "masked_text", required: "always", mask: "00000-000", autoFill: "busca de endereço por CEP" },
      ],
    },
    {
      id: "documentos",
      number: 3,
      title: "Documentos Obrigatórios",
      purpose: "Aqui você define quais documentos o cidadão precisa enviar e em quais situações eles são obrigatórios.",
      guidance: [
        "Comprovante de residência emitido nos últimos 60 dias.",
        "Atestado médico deve indicar o CID correspondente.",
        "Foto colorida e recente, fundo neutro, rosto totalmente visível.",
      ],
      fields: [
        { description: "Comprova que a pessoa mora no município.", key: "comprovante_residencia", label: "Comprovante de residência", type: "file", required: "always", acceptedFileFormats: ["PDF", "PNG", "JPG"] },
        { description: "Identidade de quem vai usar o cartão.", key: "documento_portador", label: "Documento do portador", type: "file", required: "always", acceptedFileFormats: ["PDF", "PNG", "JPG"] },
        { description: "Comprova a deficiência, com o CID.", key: "atestado_medico", label: "Atestado médico", type: "file", required: "always", acceptedFileFormats: ["PDF", "PNG", "JPG"] },
        { description: "Documento adicional que, no modelo atual, é opcional.", key: "laudo_detran", label: "Laudo do DETRAN", type: "file", required: "never", acceptedFileFormats: ["PDF", "PNG", "JPG"] },
        { description: "Foto do portador para o cartão.", key: "foto", label: "Foto", type: "file", required: "always", acceptedFileFormats: ["PNG", "JPG"] },
      ],
    },
    {
      id: "complementares",
      number: 4,
      title: "Documentos Complementares",
      purpose: "Aqui você decide se o cidadão pode enviar documentos extras, além dos obrigatórios.",
      guidance: ["Caso necessário, adicione documentos complementares."],
      fields: [
        { description: "Qualquer outro documento que ajude na análise.", key: "docs_complementares", label: "Documentos complementares", type: "file", required: "never", acceptedFileFormats: ["PDF", "PNG", "JPG"] },
      ],
    },
  ],
};
