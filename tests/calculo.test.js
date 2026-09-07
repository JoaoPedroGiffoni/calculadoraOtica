import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularOrcamento } from '../src/modules/orcamentos/calculo.js';

const base = {
  armacao: { nome: 'Ray-Ban RB2132', valor: 350 },
  lente: { tipo: 'Multifocal', nome: 'Multifocal digital', valor: 600 },
};

test('soma armação, lente e tratamentos no subtotal', () => {
  const r = calcularOrcamento({
    ...base,
    tratamentos: [{ nome: 'Antirreflexo', valor: 80 }, { nome: 'Antirrisco', valor: 40 }],
    desconto: { tipo: 'valor', valor: 0 },
  });
  assert.equal(r.subtotal, 1070);
  assert.equal(r.totalTratamentos, 120);
  assert.equal(r.total, 1070);
});

test('desconto percentual aplica sobre o subtotal', () => {
  const r = calcularOrcamento({
    ...base,
    tratamentos: [],
    desconto: { tipo: 'percentual', valor: 10 },
  });
  assert.equal(r.subtotal, 950);
  assert.equal(r.valorDesconto, 95);
  assert.equal(r.total, 855);
});

test('desconto em valor fixo não passa do subtotal — total nunca fica negativo', () => {
  const r = calcularOrcamento({
    ...base,
    tratamentos: [],
    desconto: { tipo: 'valor', valor: 999999 },
  });
  assert.equal(r.total, 0);
});

test('parcelas divide o total, sem juros', () => {
  const r = calcularOrcamento({
    ...base,
    tratamentos: [],
    desconto: { tipo: 'valor', valor: 0 },
    parcelas: 4,
  });
  assert.equal(r.total, 950);
  assert.equal(r.valorParcela, 237.5);
});

test('sem desconto informado, não quebra (valor 0)', () => {
  const r = calcularOrcamento({ ...base, tratamentos: [] });
  assert.equal(r.valorDesconto, 0);
  assert.equal(r.total, 950);
});
