// Custos padrão da empresa, usados para pré-preencher a seção de margem de
// contribuição (só ADMIN vê/edita — ver orcamentos.rotas.js). FASE 1: em
// memória, igual aos outros repositórios (ver dadosMock.js) — vira coluna
// JSON em Empresa quando a Fase 2 plugar o banco.
//
// Tudo nasce zerado de propósito: taxa de maquininha, CMV de lente e comissão
// variam demais entre óticas para vir com valor "de fábrica" — inventar um
// número pareceria orientação de negócio que não é.
const porEmpresa = new Map();

function padrao() {
  return {
    // CMV da lente: fixo para "visão simples", percentual do ticket (preço de
    // venda) para os demais tipos — o custo de multifocal varia demais para
    // um valor fixo fazer sentido.
    cmvLenteSimples: 0,
    cmvLentePercentual: 0,
    // Taxa da maquininha por número de parcelas — cada parcela tem sua
    // própria taxa (parcelamento custa mais que à vista).
    taxaMaquininhaPorParcela: Array.from({ length: 12 }, (_, i) => ({ parcelas: i + 1, percentual: 0 })),
    custoExameVista: 0,
    custoGarantia: 0,
    custoEmbalagem: 0,
    comissaoPercentual: 0,
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
