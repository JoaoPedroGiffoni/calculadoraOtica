// Custos padrão da conta, usados para pré-preencher a calculadora de margem
// de contribuição a cada cálculo novo. FASE 1: em memória, igual aos outros
// repositórios (ver dadosMock.js) — vira coluna JSON em Empresa quando a
// Fase 2 plugar o banco.
//
// CMV de lente, comissão, garantia e embalagem nascem zerados de propósito:
// variam demais entre óticas para vir com valor "de fábrica" — inventar um
// número pareceria orientação de negócio que não é.
const porEmpresa = new Map();

// Taxa de maquininha por parcela NÃO nasce zerada: ao contrário do resto do
// cadastro, é um número público — taxa de cartão de crédito parcelado de uma
// maquininha comum, uma referência real de mercado (ficha "Taxas e Prazos"
// de um app de maquininha, crédito à vista/parcelado, setembro de 2026).
// Ainda assim é só ponto de partida: cada operadora/negociação tem a sua
// própria taxa, e o valor certo é o que o ADMIN vê no extrato da própria
// maquininha — por isso o aviso "valor de referência" no modal (ver
// web/src/componentes/ConfiguracaoCustosModal.jsx) e por isso continua 100%
// editável.
const TAXA_MAQUININHA_REFERENCIA = [
  3.69, 4.99, 5.99, 6.89, 7.69, 8.09, 9.09, 9.19, 9.49, 9.49, 10.47, 10.49,
];

function padrao() {
  return {
    // CMV da lente: fixo para "visão simples", percentual do ticket (preço de
    // venda) para os demais tipos — o custo de multifocal varia demais para
    // um valor fixo fazer sentido.
    cmvLenteSimples: 0,
    cmvLentePercentual: 0,
    // Taxa da maquininha por número de parcelas — cada parcela tem sua
    // própria taxa (parcelamento custa mais que à vista). Ver
    // TAXA_MAQUININHA_REFERENCIA acima sobre a origem dos valores.
    taxaMaquininhaPorParcela: TAXA_MAQUININHA_REFERENCIA.map((percentual, i) => ({ parcelas: i + 1, percentual })),
    custoExameVista: 0,
    custoGarantia: 0,
    custoEmbalagem: 0,
    comissaoPercentual: 0,
    // Imposto sobre a venda (Simples Nacional, ICMS-ST etc.) — varia demais
    // por regime tributário e faturamento pra vir com um número "de
    // fábrica", mesmo critério da comissão logo acima.
    impostosPercentual: 0,
  };
}

export const repositorioConfiguracoes = {
  async buscarCustos(empresaId) {
    if (!porEmpresa.has(empresaId)) porEmpresa.set(empresaId, padrao());
    return porEmpresa.get(empresaId);
  },

  async atualizarCustos(empresaId, dados) {
    const atual = await this.buscarCustos(empresaId);
    const novo = { ...atual, ...dados };
    porEmpresa.set(empresaId, novo);
    return novo;
  },
};
