// Acesso a usuários. AUTH_MODO=mock usa dadosMock.js (em memória);
// AUTH_MODO=banco usa Prisma contra o MySQL — mesmas três funções nos dois
// modos, então quem chama (auth.rotas.js, middleware/autenticacao.js) nunca
// precisa saber qual está ativo.
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

// `prisma.js` só é importado aqui dentro (não no topo do arquivo): em modo
// mock, `src/lib/prisma.js` nunca chega a carregar, então DATABASE_URL nem
// precisa existir — ver comentário no topo daquele arquivo.
async function buscarPorEmailBanco(email) {
  const { prisma } = await import('./prisma.js');
  return prisma.usuario.findUnique({ where: { email } });
}

async function buscarPorIdBanco(id) {
  const { prisma } = await import('./prisma.js');
  return prisma.usuario.findUnique({ where: { id } });
}

async function buscarEmpresaBanco(id) {
  const { prisma } = await import('./prisma.js');
  return prisma.empresa.findUnique({ where: { id } });
}

export const repositorioUsuarios =
  env.AUTH_MODO === 'banco'
    ? { buscarPorEmail: buscarPorEmailBanco, buscarPorId: buscarPorIdBanco, buscarEmpresa: buscarEmpresaBanco }
    : { buscarPorEmail: buscarPorEmailMock, buscarPorId: buscarPorIdMock, buscarEmpresa: buscarEmpresaMock };
