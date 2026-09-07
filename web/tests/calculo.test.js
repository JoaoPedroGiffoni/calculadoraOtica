// Único lugar onde a conta da calculadora de margem realmente mora (não há
// mais round-trip no servidor pra calcular — ver lib/calculo.js), então é o
// único lugar que precisa de teste automatizado no front.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolverCmvLente, resolverCustoFinanceiro, resolverComissao, calcularMargem, classificarMargem,
  configuracaoCustosPadrao,
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
};

test('CMV lente simples usa o valor fixo do cadastro, não o percentual', () => {
  assert.equal(resolverCmvLente('Visão simples', 1000, config), 60);
});

test('CMV lente multifocal usa percentual do preço de venda', () => {
  assert.equal(resolverCmvLente('Multifocal', 1000, config), 250);
});

test('custo financeiro usa a taxa cadastrada para o número de parcelas', () => {
  assert.equal(resolverCustoFinanceiro(3, 1000, config), 45);
});

test('parcela sem taxa cadastrada não quebra — vira 0', () => {
  assert.equal(resolverCustoFinanceiro(7, 1000, config), 0);
});

test('comissão é o percentual do cadastro sobre o preço de venda', () => {
  assert.equal(resolverComissao(1000, config), 50);
});

test('margem soma os custos e divide pelo preço de venda', () => {
  const r = calcularMargem({
    precoVenda: 1000,
    custos: { cmvArmacao: 150, cmvLente: 250, custoTratamentos: 0, custoFinanceiro: 45, custoExameVista: 10, comissaoVendedor: 50, custoGarantia: 12, custoEmbalagem: 4 },
  });
  assert.equal(r.custosTotal, 521);
  assert.equal(r.margemRs, 479);
  assert.equal(r.margemPercentual, 47.9);
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
