import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularMargem } from '../src/modules/orcamentos/calculo.js';

test('soma todos os custos e subtrai da venda', () => {
  const r = calcularMargem({
    vendaTotal: 1000,
    custos: {
      cmvArmacao: 150,
      cmvLente: 200,
      custoTratamentos: 40,
      custoFinanceiro: 30,
      custoExameVista: 0,
      comissaoVendedor: 50,
      custoGarantia: 15,
      custoEmbalagem: 5,
    },
  });
  assert.equal(r.custosTotal, 490);
  assert.equal(r.margemRs, 510);
  assert.equal(r.margemPercentual, 51);
});

test('sem custo nenhum lançado (tudo zero), margem é a venda inteira', () => {
  const r = calcularMargem({
    vendaTotal: 800,
    custos: {
      cmvArmacao: 0, cmvLente: 0, custoTratamentos: 0, custoFinanceiro: 0,
      custoExameVista: 0, comissaoVendedor: 0, custoGarantia: 0, custoEmbalagem: 0,
    },
  });
  assert.equal(r.margemRs, 800);
  assert.equal(r.margemPercentual, 100);
});

test('custos maiores que a venda dão margem negativa (venda com prejuízo é um alerta, não um erro)', () => {
  const r = calcularMargem({
    vendaTotal: 100,
    custos: { cmvArmacao: 80, cmvLente: 50, custoTratamentos: 0, custoFinanceiro: 0, custoExameVista: 0, comissaoVendedor: 0, custoGarantia: 0, custoEmbalagem: 0 },
  });
  assert.equal(r.margemRs, -30);
  assert.equal(r.margemPercentual, -30);
});

test('venda zero não quebra a divisão (percentual fica 0, não Infinity/NaN)', () => {
  const r = calcularMargem({
    vendaTotal: 0,
    custos: { cmvArmacao: 0, cmvLente: 0, custoTratamentos: 0, custoFinanceiro: 0, custoExameVista: 0, comissaoVendedor: 0, custoGarantia: 0, custoEmbalagem: 0 },
  });
  assert.equal(r.margemPercentual, 0);
});
