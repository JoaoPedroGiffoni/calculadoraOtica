// Toda a conta da calculadora de margem — puramente local, nada disto
// depende do servidor: não há orçamento pra montar nem resultado pra salvar
// (ver README), então o cálculo em si nunca precisa de round-trip na API. O
// que vem da API é só o cadastro de custos padrão (ver
// ConfiguracaoCustosModal.jsx e GET/PUT /configuracoes/custos), pra
// pré-preencher.

/// CMV da lente resolvido: fixo para "visão simples", percentual do preço de
/// venda para os demais tipos.
export function resolverCmvLente(tipoLente, precoVenda, config) {
  const ehSimples = /simples/i.test(tipoLente || '');
  if (ehSimples) return Number(config.cmvLenteSimples) || 0;
  return Math.round(precoVenda * ((Number(config.cmvLentePercentual) || 0) / 100) * 100) / 100;
}

/// Taxa da maquininha para o número de parcelas escolhido, já convertida em R$.
export function resolverCustoFinanceiro(parcelas, precoVenda, config) {
  const taxa = config.taxaMaquininhaPorParcela?.find((t) => t.parcelas === parcelas)?.percentual ?? 0;
  return Math.round(precoVenda * (taxa / 100) * 100) / 100;
}

export function resolverComissao(precoVenda, config) {
  return Math.round(precoVenda * ((Number(config.comissaoPercentual) || 0) / 100) * 100) / 100;
}

// Taxa de referência de maquininha (crédito à vista/parcelado) — mesma
// origem e mesmo aviso do backend, ver TAXA_MAQUININHA_REFERENCIA em
// src/lib/repositorioConfiguracoes.js. Só existe aqui como placeholder pro
// primeiro instante, antes do GET /configuracoes/custos voltar; quem manda
// de verdade é sempre a resposta da API.
const TAXA_MAQUININHA_REFERENCIA = [
  3.69, 4.99, 5.99, 6.89, 7.69, 8.09, 9.09, 9.19, 9.49, 9.49, 10.47, 10.49,
];

/// Mesma forma do que GET /configuracoes/custos devolve — usado como valor
/// inicial enquanto a chamada real não volta, para o modal nunca renderizar
/// contra `undefined`.
export function configuracaoCustosPadrao() {
  return {
    cmvLenteSimples: 0,
    cmvLentePercentual: 0,
    taxaMaquininhaPorParcela: TAXA_MAQUININHA_REFERENCIA.map((percentual, i) => ({ parcelas: i + 1, percentual })),
    custoExameVista: 0,
    custoGarantia: 0,
    custoEmbalagem: 0,
    comissaoPercentual: 0,
  };
}

/// Soma os custos e calcula a margem de contribuição.
///
/// Não entra aqui: aluguel, folha fixa, pró-labore, contador, sistemas,
/// energia, marketing — isso é custo fixo/CAC, fora do escopo de uma venda
/// individual.
export function calcularMargem({ precoVenda, custos }) {
  const custosTotal =
    Math.round(Object.values(custos).reduce((soma, v) => soma + (Number(v) || 0), 0) * 100) / 100;
  const margemRs = Math.round((precoVenda - custosTotal) * 100) / 100;
  const margemPercentual = precoVenda > 0 ? Math.round((margemRs / precoVenda) * 10000) / 100 : 0;
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
