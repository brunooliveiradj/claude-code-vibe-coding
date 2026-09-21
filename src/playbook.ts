// ─────────────────────────────────────────────────────────────────────────────
// PLAYBOOK DE MÍDIA — base de conhecimento que a IA usa para estruturar o briefing
//
// ⚠️  ATENÇÃO — VALORES DE REFERÊNCIA, NÃO SÃO DADOS REAIS DE MERCADO
//
// Os CPMs, CPCs e faixas de verba abaixo são PLACEHOLDERS para o mockup
// funcionar de ponta a ponta. Eles NÃO vieram de nenhuma base da Pixel Roads
// nem de estudo de mercado.
//
// Antes de qualquer uso que influencie decisão de investimento de cliente,
// o time precisa substituir estes números por dados reais da plataforma
// (histórico de entrega, CPM médio por vertical, benchmarks internos).
//
// Toda estimativa exibida na UI carrega um aviso de origem por causa disso.
// ─────────────────────────────────────────────────────────────────────────────

export type Vertical = "moda" | "food" | "financeiro" | "app" | "generico";
export type Goal = "AWARENESS" | "ENGAJAMENTO" | "CONVERSAO" | "MISTO";

export interface PlaybookEntry {
  id: Vertical;
  label: string;
  icon: string;
  /** PLACEHOLDER — substituir por CPM real da Pixel Roads por vertical */
  refCpm: number;
  /** PLACEHOLDER — substituir por CPC real da Pixel Roads por vertical */
  refCpc: number;
  defaultGoal: Goal;
  audiences: string[];
  creativeHint: string;
  /** Sinais de sazonalidade que a IA usa para alertar sobre período */
  seasonality: { months: number[]; note: string }[];
  /** Movimentos estratégicos que a IA sugere além do que o cliente pediu */
  plays: { icon: string; title: string; text: string }[];
}

export const PLAYBOOKS: Record<Vertical, PlaybookEntry> = {
  moda: {
    id: "moda",
    label: "Moda & Vestuário",
    icon: "👗",
    refCpm: 12,
    refCpc: 1.8,
    defaultGoal: "CONVERSAO",
    audiences: ["Interessados em moda", "Jovens adultos (18–34)", "Compradores recentes"],
    creativeHint: "Display em formatos grandes converte melhor para moda — o produto precisa aparecer.",
    seasonality: [
      { months: [10, 11], note: "Black Friday e Natal concentram a maior disputa do ano. Comece a aquecer público 3 semanas antes." },
      { months: [4, 5], note: "Dia das Mães costuma puxar demanda em presente e moda feminina." },
      { months: [0, 1], note: "Janeiro e fevereiro são meses de liquidação — CPM tende a ficar mais barato." },
    ],
    plays: [
      { icon: "🎯", title: "Separe prospecção de retargeting", text: "Rodar tudo num grupo só faz o retargeting comer a verba. Vale dividir para medir o que realmente traz cliente novo." },
      { icon: "🛒", title: "Abandono de carrinho é a fruta baixa", text: "Quem já colocou no carrinho converte muito mais barato que público frio. Costuma ser o primeiro público a ativar." },
      { icon: "📐", title: "Varie os formatos", text: "300×250 e 728×90 cobrem inventários diferentes. Usar só um formato limita onde o anúncio pode aparecer." },
    ],
  },
  food: {
    id: "food",
    label: "Food & Delivery",
    icon: "🍔",
    refCpm: 9,
    refCpc: 1.2,
    defaultGoal: "ENGAJAMENTO",
    audiences: ["Todos os usuários", "Jovens adultos (18–34)", "Classe média"],
    creativeHint: "Vídeo curto funciona bem para comida — o apelo é visual e imediato.",
    seasonality: [
      { months: [5, 6], note: "Festas juninas e férias escolares mexem com o padrão de pedido." },
      { months: [11], note: "Dezembro tem pico de pedido em datas específicas (Natal, Ano Novo)." },
    ],
    plays: [
      { icon: "📍", title: "Geo apertado vale mais que geo amplo", text: "Delivery só entrega onde entrega. Rodar no estado inteiro queima verba em quem não pode pedir." },
      { icon: "⏰", title: "Horário importa mais que na média", text: "Concentrar entrega perto do horário de refeição costuma render mais que espalhar no dia todo." },
      { icon: "🎬", title: "Vídeo de 15s costuma bater display", text: "Comida vende no apetite. Vídeo curto entrega isso melhor que banner estático." },
    ],
  },
  financeiro: {
    id: "financeiro",
    label: "Financeiro & Fintech",
    icon: "🏦",
    refCpm: 18,
    refCpc: 3.2,
    defaultGoal: "CONVERSAO",
    audiences: ["Alta renda", "Adultos (35–54)", "Classe média"],
    creativeHint: "Financeiro exige mensagem clara de confiança — criativo institucional performa melhor que promocional.",
    seasonality: [
      { months: [0, 1, 2], note: "Início de ano e período de IR aquecem busca por produto financeiro." },
      { months: [8, 9], note: "Segundo semestre costuma ter push de crédito e investimento." },
    ],
    plays: [
      { icon: "🛡️", title: "Vertical regulada — criativo precisa de cuidado", text: "Promessa de rendimento e linguagem de urgência costumam ser barradas. Mensagem institucional passa mais fácil." },
      { icon: "📊", title: "CPM mais alto é esperado aqui", text: "A disputa por público de alta renda é cara. Verba pequena espalhada rende pouco — melhor concentrar." },
      { icon: "🔄", title: "Ciclo de decisão é longo", text: "Conta e crédito não se decidem no primeiro clique. Retargeting com janela maior costuma ser necessário." },
    ],
  },
  app: {
    id: "app",
    label: "App & Tecnologia",
    icon: "📱",
    refCpm: 14,
    refCpc: 2.1,
    defaultGoal: "AWARENESS",
    audiences: ["Jovens adultos (18–34)", "Todos os usuários", "Interessados em moda"],
    creativeHint: "Vídeo mostrando a tela do app converte melhor que banner descrevendo o app.",
    seasonality: [
      { months: [0], note: "Janeiro tem pico de download — resolução de ano novo puxa instalação de app." },
      { months: [11], note: "Dezembro: aparelho novo de presente significa app novo instalado." },
    ],
    plays: [
      { icon: "🎬", title: "Mostre o produto funcionando", text: "App é difícil de explicar em texto. Vídeo com a interface real costuma render mais que criativo conceitual." },
      { icon: "📈", title: "Awareness primeiro, conversão depois", text: "Ninguém instala app que nunca viu. Vale construir reconhecimento antes de empurrar instalação." },
      { icon: "🔁", title: "Frequência baixa demais não fixa", text: "Marca nova precisa de repetição. Cap muito apertado no começo atrapalha a lembrança." },
    ],
  },
  generico: {
    id: "generico",
    label: "Negócio",
    icon: "🎯",
    refCpm: 13,
    refCpc: 2.0,
    defaultGoal: "MISTO",
    audiences: ["Todos os usuários", "Classe média", "Adultos (35–54)"],
    creativeHint: "Comece com display em formatos padrão e varie conforme o resultado aparecer.",
    seasonality: [
      { months: [10, 11], note: "Black Friday e Natal encarecem a mídia de forma geral." },
    ],
    plays: [
      { icon: "🎯", title: "Comece focado, abra depois", text: "Verba espalhada em muito público não gera aprendizado. Melhor concentrar e expandir com dado na mão." },
      { icon: "📊", title: "Deixe rodar antes de mexer", text: "Mudar lance e público todo dia impede a campanha de estabilizar." },
      { icon: "🔍", title: "Pixel instalado muda o jogo", text: "Sem pixel não dá para fazer retargeting nem medir conversão. É o primeiro item da lista." },
    ],
  },
};

/** Palavras-chave que apontam para cada vertical no texto do briefing */
export const VERTICAL_SIGNALS: Record<Vertical, string[]> = {
  moda: ["roupa", "moda", "vestuário", "vestuario", "loja", "boutique", "calçado", "calcado", "sapato", "bolsa", "acessório", "acessorio", "coleção", "colecao", "feminina", "masculina", "jeans", "camiseta", "vestido"],
  food: ["comida", "delivery", "restaurante", "food", "lanche", "pizza", "hambúrguer", "hamburguer", "refeição", "refeicao", "gastronomia", "bebida", "cardápio", "cardapio", "ifood"],
  financeiro: ["banco", "financeiro", "fintech", "crédito", "credito", "empréstimo", "emprestimo", "investimento", "cartão", "cartao", "conta digital", "seguro", "consórcio", "consorcio", "financiamento"],
  app: ["app", "aplicativo", "download", "instalação", "instalacao", "plataforma", "software", "saas", "tecnologia", "startup", "digital"],
  generico: [],
};

/** Sinais de objetivo no texto livre */
export const GOAL_SIGNALS: Record<Goal, string[]> = {
  CONVERSAO: ["vender", "venda", "vendas", "converter", "conversão", "conversao", "faturamento", "receita", "comprar", "compra", "pedido", "lead"],
  AWARENESS: ["conhecer", "conhecimento", "marca", "reconhecimento", "awareness", "divulgar", "divulgação", "divulgacao", "lançamento", "lancamento", "visibilidade", "alcance"],
  ENGAJAMENTO: ["engajamento", "engajar", "interação", "interacao", "clique", "cliques", "tráfego", "trafego", "visita", "acesso"],
  MISTO: [],
};

export const GOAL_META: Record<Goal, { label: string; desc: string; icon: string }> = {
  AWARENESS: { label: "Reconhecimento", desc: "Fazer mais gente conhecer a marca", icon: "📢" },
  ENGAJAMENTO: { label: "Engajamento", desc: "Levar gente para o site e gerar interação", icon: "💬" },
  CONVERSAO: { label: "Conversão", desc: "Gerar venda ou ação direta", icon: "🛒" },
  MISTO: { label: "Misto", desc: "Combinar reconhecimento e conversão", icon: "🎯" },
};

const MONTHS_PT = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export function monthName(i: number) { return MONTHS_PT[i] ?? ""; }
