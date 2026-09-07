// Cálculo do orçamento — função pura, sem tocar em banco/rede, para dar para
// testar isolada (ver tests/calculo.test.js) e para o dia em que o front
// quiser mostrar o total ao vivo sem round-trip no servidor.
//
// Regra: subtotal = armação + lente + soma dos tratamentos; desconto entra
// depois, em % ou em R$ fixo; total nunca fica negativo (desconto maior que
// o subtotal trava em zero, não vira orçamento "de graça e sobra").

export function calcularOrcamento({ armacao, lente, tratamentos = [], desconto, parcelas = 1 }) {
  const totalTratamentos = tratamentos.reduce((soma, t) => soma + t.valor, 0);
  const subtotal = armacao.valor + lente.valor + totalTratamentos;

  const valorDesconto =
    desconto?.tipo === 'percentual'
      ? Math.round(subtotal * (desconto.valor / 100) * 100) / 100
      : (desconto?.valor ?? 0);

  const total = Math.max(0, Math.round((subtotal - valorDesconto) * 100) / 100);
  const valorParcela = Math.round((total / parcelas) * 100) / 100;

  return { subtotal, totalTratamentos, valorDesconto, total, parcelas, valorParcela };
}

/**
 * Margem de contribuição de uma venda já fechada — visão gerencial, restrita
 * a ADMIN (ver orcamentos.rotas.js). `custos` já vem com os valores
 * resolvidos pelo front (CMV da lente já decidido entre fixo/percentual,
 * custo financeiro já calculado pela taxa da parcela escolhida etc. — ver
 * web/src/lib/calculo.js, que espelha esta mesma conta para a pré-visualização
 * ao vivo); aqui só soma e divide.
 *
 * Não entra: aluguel, folha fixa, pró-labore, contador, sistemas, energia,
 * marketing — isso é custo fixo/CAC, fora do escopo de uma venda individual.
 */
export function calcularMargem({ vendaTotal, custos }) {
  const custosTotal =
    Math.round(
      Object.values(custos).reduce((soma, valor) => soma + (Number(valor) || 0), 0) * 100,
    ) / 100;

  const margemRs = Math.round((vendaTotal - custosTotal) * 100) / 100;
  const margemPercentual = vendaTotal > 0 ? Math.round((margemRs / vendaTotal) * 10000) / 100 : 0;

  return { custosTotal, margemRs, margemPercentual };
}
