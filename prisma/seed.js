// Seed idempotente: pode rodar quantas vezes quiser sem duplicar nada.
//
// Cria a PRIMEIRA conta — uma Empresa e o Usuario dela — a partir do .env.
// É o mínimo para a tela de login ter em quem acreditar. Contas seguintes
// (outros acessos vendidos) entram por fora, direto no banco — não existe
// tela de "criar conta" no produto ainda (ver README, Fase 3).
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import 'dotenv/config';
import { prepararConexao } from '../src/lib/conexaoBanco.js';
import { preferirIpv4 } from '../src/lib/rede.js';

// Client em uso. Quando o seed roda pela linha de comando, cria o seu; quando
// é chamado pelo boot da aplicação, reaproveita a conexão que já existe.
let db;

/**
 * @param {object} opcoes
 * @param {boolean} [opcoes.silencioso] Não imprime no console (uso no boot).
 * @param {import('@prisma/client').PrismaClient} [opcoes.client] Conexão a reaproveitar.
 */
export async function seedInicial({ silencioso = false, client } = {}) {
  const log = (...args) => !silencioso && console.log(...args);

  if (client) {
    db = client;
  } else {
    // Rodando pela linha de comando, este é o ponto de entrada — a preferência
    // por IPv4 precisa valer aqui também (ver src/lib/rede.js).
    preferirIpv4();
    const { config, database } = prepararConexao(process.env.DATABASE_URL ?? '', 2);
    const adapter = new PrismaMariaDb(config, { database });
    db = new PrismaClient({ adapter });
  }

  log('\nSemeando a calculadora ótica...\n');

  const emailBruto = process.env.ADMIN_EMAIL;
  const senha = process.env.ADMIN_SENHA;
  const nome = process.env.ADMIN_NOME ?? 'Administrador';
  const empresaNome = process.env.EMPRESA_NOME ?? 'Minha Ótica';

  if (!emailBruto || !senha) {
    throw new Error(
      'ADMIN_EMAIL e ADMIN_SENHA precisam estar preenchidas no .env para criar a primeira conta — ' +
        'sem elas o banco fica vazio e a tela de login não tem em quem acreditar.',
    );
  }

  const email = emailBruto.trim().toLowerCase();

  // Em produção, recusa CRIAR (não afeta quem já existe) uma conta cuja senha
  // veio óbvia demais — mesmo cuidado do AtendimentoLocaPronto: sem isto,
  // esquecer de trocar ADMIN_SENHA no primeiro deploy deixaria a conta com
  // controle total acessível por uma senha previsível.
  if (process.env.NODE_ENV === 'production' && senha === 'mudar123') {
    const usuarioExistente = await db.usuario.findUnique({ where: { email } });
    if (!usuarioExistente) {
      throw new Error(
        'ADMIN_SENHA está com o valor padrão de exemplo — defina uma senha forte antes do ' +
          'primeiro boot em produção. Sem isso, a conta não é criada.',
      );
    }
  }

  const usuarioExistente = await db.usuario.findUnique({ where: { email } });

  if (usuarioExistente) {
    // `update` só mexe no nome: trocar ADMIN_SENHA no .env depois do primeiro
    // boot NÃO deve redefinir a senha de quem já está usando o sistema.
    const usuario = await db.usuario.update({ where: { email }, data: { nome } });
    log(`  ✓ Conta já existia: ${usuario.email}`);
  } else {
    const empresa = await db.empresa.create({ data: { nome: empresaNome, status: 'ativo' } });
    const usuario = await db.usuario.create({
      data: { empresaId: empresa.id, nome, email, senhaHash: await bcrypt.hash(senha, 10) },
    });
    log(`  ✓ Conta criada: ${usuario.email} (${empresa.nome})`);
  }

  log('\n✔ Seed concluído.');

  if (senha === 'mudar123') {
    console.warn('\n  ATENÇÃO: senha padrão em uso. Defina ADMIN_SENHA e troque no primeiro acesso.\n');
  }

  return { email };
}

// Executa apenas quando chamado direto pela linha de comando (`npm run seed`).
// Quando importado pelo boot da aplicação, só exporta a função.
const chamadoDireto = process.argv[1] && process.argv[1].endsWith('seed.js');

if (chamadoDireto) {
  seedInicial()
    .catch((erro) => {
      console.error('✖ Falha no seed:', erro);
      process.exit(1);
    })
    .finally(() => db?.$disconnect());
}
