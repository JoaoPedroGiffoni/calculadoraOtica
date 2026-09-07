// Histórico de orçamentos. FASE 1: em memória, isolado por empresa (cada
// ótica só vê o próprio histórico) — zerado a cada restart, igual ao
// repositório de usuários (ver dadosMock.js). Vira tabela no Prisma
// (model Orcamento) assim que a Fase 2 plugar o banco de verdade.
import { randomUUID } from 'node:crypto';

/// Map<empresaId, Orcamento[]>, mais novo primeiro.
const porEmpresa = new Map();

function listaDe(empresaId) {
  if (!porEmpresa.has(empresaId)) porEmpresa.set(empresaId, []);
  return porEmpresa.get(empresaId);
}

export const repositorioOrcamentos = {
  async criar(empresaId, dados, autor) {
    const orcamento = {
      id: randomUUID(),
      empresaId,
      criadoPorId: autor.id,
      criadoPorNome: autor.nome,
      criadoEm: new Date().toISOString(),
      ...dados,
    };
    listaDe(empresaId).unshift(orcamento);
    return orcamento;
  },

  async listarPorEmpresa(empresaId) {
    return listaDe(empresaId);
  },

  async buscarPorId(empresaId, id) {
    return listaDe(empresaId).find((o) => o.id === id) ?? null;
  },
};
