// Custos padrão da conta, usados para pré-preencher a calculadora de margem
// de contribuição a cada cálculo novo. AUTH_MODO=mock guarda em memória
// (zera a cada restart); AUTH_MODO=banco guarda na coluna JSON
// `Empresa.configuracaoCustos`.
import { env } from '../config/env.js';

// Taxa de maquininha por parcela NÃO nasce zerada: ao contrário do resto do
// cadastro, é um número público — taxa de cartão de crédito parcelado de uma
// maquininha comum, uma referência real de mercado (ficha "Taxas e Prazos"
// de um app de maquininha, crédito à vista/parcelado, setembro de 2026).
// Ainda assim é só ponto de partida: cada operadora/negociação tem a sua
// própria taxa, e o valor certo é o que a pessoa vê no extrato da própria
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

// --- mock: em memória ---
const porEmpresaMock = new Map();

async function buscarCustosMock(empresaId) {
  if (!porEmpresaMock.has(empresaId)) porEmpresaMock.set(empresaId, padrao());
  return porEmpresaMock.get(empresaId);
}

async function atualizarCustosMock(empresaId, dados) {
  const atual = await buscarCustosMock(empresaId);
  const novo = { ...atual, ...dados };
  porEmpresaMock.set(empresaId, novo);
  return novo;
}

// --- banco: coluna JSON em Empresa ---
// Sempre mescla com `padrao()` por cima do que está salvo (não o contrário):
// um campo novo adicionado depois que a conta já existia (como
// `impostosPercentual`, que não existia nas primeiras contas criadas) precisa
// aparecer com o valor padrão em vez de undefined, sem exigir migração de
// dado nenhuma.
async function buscarCustosBanco(empresaId) {
  const { prisma } = await import('./prisma.js');
  const empresa = await prisma.empresa.findUniqueOrThrow({ where: { id: empresaId }, select: { configuracaoCustos: true } });
  return { ...padrao(), ...(empresa.configuracaoCustos ?? {}) };
}

async function atualizarCustosBanco(empresaId, dados) {
  const { prisma } = await import('./prisma.js');
  const atual = await buscarCustosBanco(empresaId);
  const novo = { ...atual, ...dados };
  await prisma.empresa.update({ where: { id: empresaId }, data: { configuracaoCustos: novo } });
  return novo;
}

export const repositorioConfiguracoes =
  env.AUTH_MODO === 'banco'
    ? { buscarCustos: buscarCustosBanco, atualizarCustos: atualizarCustosBanco }
    : { buscarCustos: buscarCustosMock, atualizarCustos: atualizarCustosMock };
