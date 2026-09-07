// Acesso a usuários e ao provisionamento de conta nova (webhook de
// pagamento). AUTH_MODO=mock usa dadosMock.js (em memória); AUTH_MODO=banco
// usa Prisma contra o MySQL — mesmas funções nos dois modos, então quem
// chama (auth.rotas.js, pagamentos.rotas.js, middleware/autenticacao.js)
// nunca precisa saber qual está ativo.
import { randomUUID } from 'node:crypto';
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

async function buscarEmpresaPorAssinaturaMock(mercadoPagoAssinaturaId) {
  return empresasMock.find((e) => e.mercadoPagoAssinaturaId === mercadoPagoAssinaturaId) ?? null;
}

async function criarContaPagaMock({ empresaNome, email, senhaHash, mercadoPagoAssinaturaId }) {
  const empresa = {
    id: randomUUID(),
    nome: empresaNome,
    status: 'ativo',
    mercadoPagoAssinaturaId,
  };
  const usuario = {
    id: randomUUID(),
    empresaId: empresa.id,
    nome: empresaNome,
    email,
    senhaHash,
    ativo: true,
  };
  empresasMock.push(empresa);
  usuariosMock.push(usuario);
  return { empresa, usuario };
}

async function atualizarStatusEmpresaPorAssinaturaMock(mercadoPagoAssinaturaId, status) {
  const empresa = await buscarEmpresaPorAssinaturaMock(mercadoPagoAssinaturaId);
  if (empresa) empresa.status = status;
  return empresa;
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

async function buscarEmpresaPorAssinaturaBanco(mercadoPagoAssinaturaId) {
  const { prisma } = await import('./prisma.js');
  return prisma.empresa.findUnique({ where: { mercadoPagoAssinaturaId } });
}

async function criarContaPagaBanco({ empresaNome, email, senhaHash, mercadoPagoAssinaturaId }) {
  const { prisma } = await import('./prisma.js');
  const empresa = await prisma.empresa.create({
    data: {
      nome: empresaNome,
      status: 'ativo',
      mercadoPagoAssinaturaId,
      usuarios: { create: { nome: empresaNome, email, senhaHash } },
    },
    include: { usuarios: true },
  });
  return { empresa, usuario: empresa.usuarios[0] };
}

async function atualizarStatusEmpresaPorAssinaturaBanco(mercadoPagoAssinaturaId, status) {
  const { prisma } = await import('./prisma.js');
  return prisma.empresa.update({ where: { mercadoPagoAssinaturaId }, data: { status } }).catch(() => null);
}

export const repositorioUsuarios =
  env.AUTH_MODO === 'banco'
    ? {
        buscarPorEmail: buscarPorEmailBanco,
        buscarPorId: buscarPorIdBanco,
        buscarEmpresa: buscarEmpresaBanco,
        buscarEmpresaPorAssinatura: buscarEmpresaPorAssinaturaBanco,
        criarContaPaga: criarContaPagaBanco,
        atualizarStatusEmpresaPorAssinatura: atualizarStatusEmpresaPorAssinaturaBanco,
      }
    : {
        buscarPorEmail: buscarPorEmailMock,
        buscarPorId: buscarPorIdMock,
        buscarEmpresa: buscarEmpresaMock,
        buscarEmpresaPorAssinatura: buscarEmpresaPorAssinaturaMock,
        criarContaPaga: criarContaPagaMock,
        atualizarStatusEmpresaPorAssinatura: atualizarStatusEmpresaPorAssinaturaMock,
      };
