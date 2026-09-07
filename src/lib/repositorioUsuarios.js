// Acesso a usuários. Hoje só o modo "mock" existe de verdade (ver
// dadosMock.js); o modo "banco" fica reservado para a Fase 2 — trocar
// AUTH_MODO no .env e implementar as mesmas três funções contra o Prisma,
// sem mexer em quem as chama (auth.rotas.js).
import { env } from '../config/env.js';
import { usuariosMock, empresasMock } from './dadosMock.js';

async function buscarPorEmailMock(email) {
  return usuariosMock.find((u) => u.email === email) ?? null;
}

async function buscarPorIdMock(id) {
  return usuariosMock.find((u) => u.id === id) ?? null;
}

async function buscarEmpresaMock(id) {
  return empresasMock.find((e) => e.id === id) ?? null;
}

async function buscarPorEmailBanco() {
  throw new Error('AUTH_MODO=banco ainda não implementado — ver README, seção "Próximas fases".');
}

export const repositorioUsuarios =
  env.AUTH_MODO === 'banco'
    ? { buscarPorEmail: buscarPorEmailBanco, buscarPorId: buscarPorEmailBanco, buscarEmpresa: buscarPorEmailBanco }
    : { buscarPorEmail: buscarPorEmailMock, buscarPorId: buscarPorIdMock, buscarEmpresa: buscarEmpresaMock };
