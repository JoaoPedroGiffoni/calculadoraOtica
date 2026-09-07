import test from 'node:test';
import assert from 'node:assert/strict';
import { criarOrcamentoSchema } from '../src/modules/orcamentos/orcamentos.schema.js';

const valido = {
  cliente: 'Maria Silva',
  armacao: { nome: 'Ray-Ban RB2132', valor: 350 },
  lente: { tipo: 'Multifocal', nome: 'Multifocal digital', valor: 600 },
  tratamentos: [{ nome: 'Antirreflexo', valor: 80 }],
  desconto: { tipo: 'percentual', valor: 10 },
  parcelas: 3,
};

test('aceita um orçamento válido', () => {
  assert.equal(criarOrcamentoSchema.safeParse(valido).success, true);
});

test('recusa cliente vazio', () => {
  const r = criarOrcamentoSchema.safeParse({ ...valido, cliente: '' });
  assert.equal(r.success, false);
});

test('recusa valor negativo na armação', () => {
  const r = criarOrcamentoSchema.safeParse({ ...valido, armacao: { nome: 'X', valor: -10 } });
  assert.equal(r.success, false);
});

test('recusa desconto percentual acima de 100', () => {
  const r = criarOrcamentoSchema.safeParse({ ...valido, desconto: { tipo: 'percentual', valor: 150 } });
  assert.equal(r.success, false);
});

test('aceita desconto em valor fixo acima de 100 (não é percentual)', () => {
  const r = criarOrcamentoSchema.safeParse({ ...valido, desconto: { tipo: 'valor', valor: 500 } });
  assert.equal(r.success, true);
});

test('parcelas fora de 1-12 é recusado', () => {
  assert.equal(criarOrcamentoSchema.safeParse({ ...valido, parcelas: 13 }).success, false);
  assert.equal(criarOrcamentoSchema.safeParse({ ...valido, parcelas: 0 }).success, false);
});

test('sem tratamentos e sem desconto, usa os padrões', () => {
  const { tratamentos, cliente, armacao, lente } = valido;
  const dados = criarOrcamentoSchema.parse({ cliente, armacao, lente });
  assert.deepEqual(dados.tratamentos, []);
  assert.equal(dados.desconto.valor, 0);
  assert.equal(dados.parcelas, 1);
  assert.ok(tratamentos);
});
