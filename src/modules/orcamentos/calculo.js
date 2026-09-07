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
