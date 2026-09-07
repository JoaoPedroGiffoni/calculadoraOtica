// Preparação do banco no boot da aplicação — só roda com AUTH_MODO=banco.
//
// Plataformas de deploy gerenciado (Hostinger, Railway, Render...) normalmente
// só executam "build" e "start" — não há shell para rodar `prisma migrate
// deploy` na mão. Sem isso, o primeiro deploy sobe com o banco vazio e a tela
// de login rejeitaria até a senha certa, porque não existiria conta nenhuma.
//
// Então a própria aplicação garante o estado do banco antes de aceitar
// tráfego: aplica as migrations pendentes e, se não houver conta nenhuma,
// cria a primeira a partir do .env. As duas etapas são idempotentes — em
// deploy sem novidade, não fazem nada.
//
// As migrations são aplicadas em processo (ver lib/migrador.js), sem criar
// subprocesso: em hospedagem compartilhada há teto de processos por usuário e
// o spawn do CLI falha com EAGAIN.
//
// Em VPS com acesso a shell, dá para desligar com MIGRAR_NO_BOOT=false e
// seguir rodando as migrations na mão.
import { prisma } from './prisma.js';
import { logger } from './logger.js';
import { aplicarMigrationsPendentes } from './migrador.js';

/// Aplica as migrations pendentes. Não gera migration nova — só aplica o que
/// já está versionado em prisma/migrations.
async function aplicarMigrations() {
  logger.info('Verificando migrations do banco...');
  const { aplicadas, jaEstavam } = await aplicarMigrationsPendentes();

  if (aplicadas.length === 0) {
    logger.info(`Banco já está atualizado (${jaEstavam} migration(s)).`);
  } else {
    logger.info(`Migrations aplicadas: ${aplicadas.length} (${aplicadas.join(', ')})`);
  }
}

/// Cria a primeira conta quando não existe nenhuma. O seed é idempotente e só
/// cria o que falta, então no deploy do dia a dia ele nem chega a rodar.
async function semearSeVazio() {
  const usuarios = await prisma.usuario.count();
  if (usuarios > 0) return false;

  logger.info('Nenhuma conta cadastrada: executando o seed inicial...');
  const { seedInicial } = await import('../../prisma/seed.js');
  await seedInicial({ silencioso: true, client: prisma });
  logger.info('Seed inicial concluído.');
  return true;
}

/**
 * O banco já está utilizável? Serve para decidir, depois de uma falha na
 * migration, se dá para seguir servindo ou se é caso de derrubar o processo.
 */
async function bancoUtilizavel() {
  try {
    await prisma.usuario.count();
    return true;
  } catch {
    return false;
  }
}

/**
 * Confere se a DATABASE_URL é mesmo de MySQL.
 *
 * O erro que isto evita é bobo e caro: uma URL colada errada faz o driver
 * falhar com mensagem de rede genérica, que manda procurar problema de
 * firewall em vez de problema de configuração.
 */
function avisarSeUrlNaoForMysql() {
  const url = process.env.DATABASE_URL ?? '';
  if (url.startsWith('mysql://') || url.startsWith('mariadb://')) return;

  const esquema = url.split('://')[0] || '(vazio)';
  logger.warn('');
  logger.warn(`  ATENÇÃO: a DATABASE_URL começa com "${esquema}", e este sistema usa MySQL.`);
  logger.warn('  O endereço precisa começar com mysql:// — confira se não colou a de outro projeto.');
  logger.warn('');
}

export async function prepararBanco() {
  if (!process.env.MIGRAR_NO_BOOT || process.env.MIGRAR_NO_BOOT === 'false') {
    logger.info('MIGRAR_NO_BOOT=false — pulando migrations e seed automáticos.');
    return;
  }

  avisarSeUrlNaoForMysql();

  try {
    await aplicarMigrations();
    await semearSeVazio();
  } catch (erro) {
    if (await bancoUtilizavel()) {
      logger.error('');
      logger.error(`  Falha ao preparar o banco: ${erro.message}`);
      logger.error('  O schema existente responde, então a aplicação vai subir mesmo assim.');
      logger.error('  ATENÇÃO: pode haver migration pendente — verifique assim que possível.');
      logger.error('');
      return;
    }
    throw erro;
  }
}
