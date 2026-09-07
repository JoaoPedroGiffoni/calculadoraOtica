// Único lugar onde a conta da calculadora de margem realmente mora (não há
// mais round-trip no servidor pra calcular — ver lib/calculo.js), então é o
// único lugar que precisa de teste automatizado no front.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolverCmvLente, resolverTaxaFinanceira, resolverCustoFinanceiro, percentualParaReais, calcularMargem,
  classificarMargem, configuracaoCustosPadrao,
} from '../src/lib/calculo.js';

const config = {
  cmvLenteSimples: 60,
  cmvLentePercentual: 25,
  taxaMaquininhaPorParcela: [
    { parcelas: 1, percentual: 2.5 },
    { parcelas: 3, percentual: 4.5 },
  ],
  custoExameVista: 10,
  custoGarantia: 12,
  custoEmbalagem: 4,
  comissaoPercentual: 5,
  impostosPercentual: 6,
};

test('CMV lente simples usa o valor fixo do cadastro, não o percentual', () => {
  assert.equal(resolverCmvLente('Visão simples', 1000, config), 60);
});

test('CMV lente multifocal usa percentual do preço de venda', () => {
  assert.equal(resolverCmvLente('Multifocal', 1000, config), 250);
});

test('taxa financeira é só a % cadastrada pra parcela, sem multiplicar pelo preço', () => {
  assert.equal(resolverTaxaFinanceira(3, config), 4.5);
});

test('parcela sem taxa cadastrada não quebra — vira 0', () => {
  assert.equal(resolverTaxaFinanceira(7, config), 0);
});

test('custo financeiro em R$ ainda existe pra quem precisa do valor já convertido', () => {
  assert.equal(resolverCustoFinanceiro(3, 1000, config), 45);
});

test('percentualParaReais converte % em R$ sobre o preço de venda', () => {
  assert.equal(percentualParaReais(config.comissaoPercentual, 1000), 50);
  assert.equal(percentualParaReais(config.impostosPercentual, 1000), 60);
});

test('percentual ausente/indefinido não quebra — vira 0', () => {
  assert.equal(percentualParaReais(undefined, 1000), 0);
});

test('margem soma os custos (incluindo impostos) e divide pelo preço de venda', () => {
  const r = calcularMargem({
    precoVenda: 1000,
    custos: {
      cmvArmacao: 150, cmvLente: 250, custoTratamentos: 0, custoFinanceiro: 45, custoExameVista: 10,
      comissaoVendedor: 50, custoGarantia: 12, custoEmbalagem: 4, impostos: 60,
    },
  });
  assert.equal(r.custosTotal, 581);
  assert.equal(r.margemRs, 419);
  assert.equal(r.margemPercentual, 41.9);
});

test('classifica a margem nas faixas certas, nos limites exatos', () => {
  assert.equal(classificarMargem(70).rotulo, 'EXCELENTE');
  assert.equal(classificarMargem(69.9).rotulo, 'SAUDÁVEL');
  assert.equal(classificarMargem(60).rotulo, 'SAUDÁVEL');
  assert.equal(classificarMargem(59.9).rotulo, 'INTERMEDIÁRIA - MERECE ATENÇÃO');
  assert.equal(classificarMargem(40).rotulo, 'ATENÇÃO');
  assert.equal(classificarMargem(30).rotulo, 'PERIGOSA');
  assert.equal(classificarMargem(20).rotulo, 'ALTÍSSIMO RISCO');
  assert.equal(classificarMargem(19.9).rotulo, 'RISCO MUITO ALTO DE PREJUÍZO');
  assert.equal(classificarMargem(-50).rotulo, 'RISCO MUITO ALTO DE PREJUÍZO');
});

test('configuração padrão nasce zerada, com as 12 parcelas', () => {
  const padrao = configuracaoCustosPadrao();
  assert.equal(padrao.cmvLenteSimples, 0);
  assert.equal(padrao.taxaMaquininhaPorParcela.length, 12);
});
