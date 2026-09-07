// Ponto de entrada.
//
// FASE 1 (AUTH_MODO=mock): nada aqui depende de banco — a porta abre e a
// aplicação já está pronta para receber tráfego. Quando a Fase 2 plugar
// Prisma + MySQL, este arquivo ganha a mesma dança de boot do
// AtendimentoLocaPronto (porta aberta ANTES do banco pronto, com 503
// explicado enquanto prepara) — ver README desse projeto, seção "Ordem do
// boot", para não repetir o mesmo problema (Hostinger derruba processo que
// não chama listen() em poucos segundos).
import { criarApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { versao } from './lib/versao.js';

process.env.TZ = env.TZ;

function principal() {
  logger.info(`Build ${versao.commit} (AUTH_MODO=${env.AUTH_MODO})`);

  const app = criarApp();

  const servidor = app.listen(env.PORT, () => {
    logger.info(`Calculadora Ótica escutando na porta ${env.PORT} (${env.NODE_ENV})`);
    if (env.AUTH_MODO === 'mock') {
      logger.info('AUTH_MODO=mock — sem banco de dados. Ver src/lib/dadosMock.js para os logins de teste.');
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

  const encerrar = (sinal) => {
    logger.info(`Recebido ${sinal}, encerrando...`);
    servidor.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => encerrar('SIGTERM'));
  process.on('SIGINT', () => encerrar('SIGINT'));
  process.on('unhandledRejection', (motivo) => logger.error('Promise rejeitada sem tratamento', motivo));
}

principal();
