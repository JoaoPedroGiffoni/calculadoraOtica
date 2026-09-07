// Ponto de entrada.
//
// FASE 1 (AUTH_MODO=mock): nada depende de banco — a porta abre e a
// aplicação já está pronta para receber tráfego.
//
// FASE 2 (AUTH_MODO=banco): mesma dança de boot do AtendimentoLocaPronto —
// o servidor HTTP abre a porta ANTES de o banco estar pronto. Plataformas de
// hospedagem gerenciada derrubam o processo que não chama `listen()` em
// poucos segundos (a Hostinger exige 3), e conectar, migrar e semear leva bem
// mais que isso num primeiro deploy. Enquanto a preparação roda em segundo
// plano, as rotas que dependem do banco respondem 503 com mensagem clara
// (ver middleware/prontidaoBanco.js).
import { criarApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { versao } from './lib/versao.js';

process.env.TZ = env.TZ;

/// Confere a conexão com o banco, com nova tentativa em intervalos crescentes.
/// Roda em segundo plano, então pode esperar o quanto for necessário.
async function conectarComRetentativa(prisma, tentativas = 6) {
  const { prepararConexao } = await import('./lib/conexaoBanco.js');
  const { diagnosticarConexao } = await import('./lib/diagnostico.js');

  for (let tentativa = 1; tentativa <= tentativas; tentativa += 1) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      logger.info('Conexão com o MySQL estabelecida');
      return true;
    } catch (erro) {
      const motivo =
        String(erro?.message ?? erro)
          .split('\n')
          .map((l) => l.trim())
          .find((l) => l.length > 0) ?? 'motivo desconhecido';

      // Na primeira falha, descobre a causa REAL. O erro que o Prisma entrega
      // quando nenhuma conexão sobe é sempre o mesmo "pool timeout", que não
      // distingue host errado de senha errada de banco inexistente.
      if (tentativa === 1) {
        try {
          await diagnosticarConexao(prepararConexao(env.DATABASE_URL).config);
        } catch {
          // Diagnóstico que falha não pode atrapalhar a retentativa.
        }
      }

      if (tentativa === tentativas) {
        logger.error(`Banco indisponível após ${tentativas} tentativas: ${motivo}`);
        return false;
      }

      const espera = Math.min(2000 * 2 ** (tentativa - 1), 20000);
      logger.warn(`Banco indisponível (tentativa ${tentativa}/${tentativas}): ${motivo}`);
      logger.info(`Nova tentativa em ${espera / 1000}s...`);
      await new Promise((resolver) => setTimeout(resolver, espera));
    }
  }
  return false;
}

/// Prepara o banco em segundo plano, sem bloquear o servidor HTTP.
async function prepararEmSegundoPlano() {
  const { preferirIpv4 } = await import('./lib/rede.js');
  const { prisma } = await import('./lib/prisma.js');
  const { prepararBanco } = await import('./lib/bootstrap.js');
  const { marcarBancoPronto, marcarFalha } = await import('./lib/estado.js');

  // Antes de qualquer conexão: o host do banco tem A e AAAA, e sair por IPv6
  // faz o MySQL recusar a origem com o mesmo erro de senha errada (ver
  // src/lib/rede.js).
  preferirIpv4();

  try {
    if (!(await conectarComRetentativa(prisma))) {
      marcarFalha(new Error('Não foi possível conectar ao banco. Confira DATABASE_URL.'));
      return;
    }

    await prepararBanco();
    marcarBancoPronto();
    logger.info('Aplicação pronta para receber requisições.');
  } catch (erro) {
    marcarFalha(erro);
    logger.error('Falha ao preparar o banco de dados.', erro?.message);
    logger.error('A aplicação segue no ar e responde 503 nas rotas de dados até isso ser resolvido.');
  }
}

function principal() {
  logger.info(`Build ${versao.commit} (AUTH_MODO=${env.AUTH_MODO})`);

  const app = criarApp();

  const servidor = app.listen(env.PORT, () => {
    logger.info(`Calculadora Ótica escutando na porta ${env.PORT} (${env.NODE_ENV})`);
    if (env.AUTH_MODO === 'mock') {
      logger.info('AUTH_MODO=mock — sem banco de dados. Ver src/lib/dadosMock.js para os logins de teste.');
    } else {
      logger.info('Preparando o banco em segundo plano...');
    }
  });

  servidor.on('error', (erro) => {
    if (erro.code === 'EADDRINUSE') {
      logger.error(`A porta ${env.PORT} já está em uso. Encerre o outro processo ou mude PORT.`);
    } else {
      logger.error('Falha ao abrir o servidor HTTP', erro?.message);
    }
    process.exit(1);
  });

  // Só depois de escutar é que o banco começa a ser preparado — e só quando
  // há banco (AUTH_MODO=banco) para preparar.
  if (env.AUTH_MODO === 'banco') prepararEmSegundoPlano();

  const encerrar = (sinal) => {
    logger.info(`Recebido ${sinal}, encerrando...`);
    servidor.close(async () => {
      if (env.AUTH_MODO === 'banco') {
        const { desconectarPrisma } = await import('./lib/prisma.js');
        await desconectarPrisma();
      }
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => encerrar('SIGTERM'));
  process.on('SIGINT', () => encerrar('SIGINT'));
  process.on('unhandledRejection', (motivo) => logger.error('Promise rejeitada sem tratamento', motivo));
}

principal();
