// Espelha src/modules/orcamentos/calculo.js no servidor — mesma conta, só
// para dar pré-visualização ao vivo no formulário sem round-trip na API. O
// valor que conta de verdade é sempre o que a API devolve depois do submit.
export function calcularOrcamento({ armacao, lente, tratamentos = [], desconto, parcelas = 1 }) {
  const totalTratamentos = tratamentos.reduce((soma, t) => soma + (Number(t.valor) || 0), 0);
  const subtotal = (Number(armacao.valor) || 0) + (Number(lente.valor) || 0) + totalTratamentos;

  const valorDesconto =
    desconto?.tipo === 'percentual'
      ? Math.round(subtotal * ((Number(desconto.valor) || 0) / 100) * 100) / 100
      : Number(desconto?.valor) || 0;

  const total = Math.max(0, Math.round((subtotal - valorDesconto) * 100) / 100);
  const valorParcela = parcelas > 0 ? Math.round((total / parcelas) * 100) / 100 : total;

  return { subtotal, totalTratamentos, valorDesconto, total, parcelas, valorParcela };
}

/// CMV da lente resolvido: fixo para "visão simples", percentual do ticket
/// (venda total) para os demais tipos — mesmo critério do back
/// (ver orcamentos.rotas.js/calculo.js).
export function resolverCmvLente(tipoLente, vendaTotal, config) {
  const ehSimples = /simples/i.test(tipoLente || '');
  if (ehSimples) return Number(config.cmvLenteSimples) || 0;
  return Math.round(vendaTotal * ((Number(config.cmvLentePercentual) || 0) / 100) * 100) / 100;
}

/// Taxa da maquininha para o número de parcelas escolhido, já convertida em R$.
export function resolverCustoFinanceiro(parcelas, vendaTotal, config) {
  const taxa = config.taxaMaquininhaPorParcela?.find((t) => t.parcelas === parcelas)?.percentual ?? 0;
  return Math.round(vendaTotal * (taxa / 100) * 100) / 100;
}

export function resolverComissao(vendaTotal, config) {
  return Math.round(vendaTotal * ((Number(config.comissaoPercentual) || 0) / 100) * 100) / 100;
}

/// Mesma forma do que GET /configuracoes/custos devolve — usado como valor
/// inicial enquanto a chamada real não volta, para o modal nunca renderizar
/// contra `undefined`.
export function configuracaoCustosPadrao() {
  return {
    cmvLenteSimples: 0,
    cmvLentePercentual: 0,
    taxaMaquininhaPorParcela: Array.from({ length: 12 }, (_, i) => ({ parcelas: i + 1, percentual: 0 })),
    custoExameVista: 0,
    custoGarantia: 0,
    custoEmbalagem: 0,
    comissaoPercentual: 0,
  };
}

/// Soma os custos e calcula a margem — mesma conta de calcularMargem no
/// backend (que é quem manda de verdade; isto é só preview).
export function calcularMargem({ vendaTotal, custos }) {
  const custosTotal =
    Math.round(Object.values(custos).reduce((soma, v) => soma + (Number(v) || 0), 0) * 100) / 100;
  const margemRs = Math.round((vendaTotal - custosTotal) * 100) / 100;
  const margemPercentual = vendaTotal > 0 ? Math.round((margemRs / vendaTotal) * 10000) / 100 : 0;
  return { custosTotal, margemRs, margemPercentual };
}

/// Faixas de leitura da margem de contribuição — a régua que decide se uma
/// venda está saudável ou insustentável para uma loja física. Ordem
/// decrescente de propósito: a primeira faixa que a margem alcança é a que
/// vale (>= 70% já cai em "Excelente" antes de checar as faixas menores).
const FAIXAS_MARGEM = [
  { minimo: 70, emoji: '🟢', rotulo: 'EXCELENTE', classe: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' },
  { minimo: 60, emoji: '🟢', rotulo: 'SAUDÁVEL', classe: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' },
  { minimo: 50, emoji: '🟡', rotulo: 'INTERMEDIÁRIA - MERECE ATENÇÃO', classe: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
  { minimo: 40, emoji: '🟠', rotulo: 'ATENÇÃO', classe: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300' },
  { minimo: 30, emoji: '🔴', rotulo: 'PERIGOSA', classe: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' },
  { minimo: 20, emoji: '🔴', rotulo: 'ALTÍSSIMO RISCO', classe: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' },
];
const FAIXA_INSUSTENTAVEL = {
  emoji: '☠️', rotulo: 'RISCO MUITO ALTO DE PREJUÍZO',
  classe: 'bg-slate-900 text-red-200 dark:bg-black dark:text-red-300',
};

export function classificarMargem(percentual) {
  return FAIXAS_MARGEM.find((f) => percentual >= f.minimo) ?? FAIXA_INSUSTENTAVEL;
}
