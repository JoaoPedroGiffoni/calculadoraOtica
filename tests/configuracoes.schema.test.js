import test from 'node:test';
import assert from 'node:assert/strict';
import { configuracaoCustosSchema } from '../src/modules/configuracoes/configuracoes.schema.js';

test('aceita atualizar um campo só', () => {
  const r = configuracaoCustosSchema.safeParse({ comissaoPercentual: 5 });
  assert.equal(r.success, true);
});

test('recusa corpo vazio', () => {
  assert.equal(configuracaoCustosSchema.safeParse({}).success, false);
});

test('recusa comissão acima de 100%', () => {
  assert.equal(configuracaoCustosSchema.safeParse({ comissaoPercentual: 150 }).success, false);
});

test('recusa impostos acima de 100%', () => {
  assert.equal(configuracaoCustosSchema.safeParse({ impostosPercentual: 101 }).success, false);
});

test('aceita atualizar só os impostos', () => {
  assert.equal(configuracaoCustosSchema.safeParse({ impostosPercentual: 8.5 }).success, true);
});

test('recusa taxa de maquininha com parcela fora de 1-12', () => {
  const r = configuracaoCustosSchema.safeParse({
    taxaMaquininhaPorParcela: [{ parcelas: 13, percentual: 5 }],
  });
  assert.equal(r.success, false);
});

test('aceita a tabela completa de 1 a 12 parcelas', () => {
  const tabela = Array.from({ length: 12 }, (_, i) => ({ parcelas: i + 1, percentual: i }));
  const r = configuracaoCustosSchema.safeParse({ taxaMaquininhaPorParcela: tabela });
  assert.equal(r.success, true);
});
