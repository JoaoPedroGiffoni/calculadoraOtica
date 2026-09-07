// Instância única do Prisma Client. Só é importada quando AUTH_MODO=banco
// (ver repositorioUsuarios.js / repositorioConfiguracoes.js) — em modo mock
// este arquivo nunca carrega, então DATABASE_URL nem precisa existir.
//
// POR QUE O DRIVER ADAPTER, E NÃO O PADRÃO
//
// O Prisma, por padrão, executa as consultas num motor escrito em Rust,
// carregado como biblioteca nativa. Esse motor usa o runtime tokio, que cria
// threads ao iniciar. Em hospedagem compartilhada com teto de threads e de
// processos por usuário (CloudLinux/LVE, o caso da Hostinger), ele falha em
// ~50ms com
//
//   PANIC: timer has gone away
//
// antes mesmo de tentar conectar no banco — sintoma de runtime assíncrono que
// não conseguiu montar seu próprio temporizador. Não é problema de rede, de
// credencial nem de pool: o motor não sobe.
//
// Com o driver adapter, as consultas são compiladas em WebAssembly e
// executadas pelo driver `mariadb`, em JavaScript puro. Sem binário nativo,
// sem tokio, sem threads — a classe inteira de falha desaparece.
//
// O tamanho do pool passa a ser configurado no próprio driver, não mais por
// parâmetro na URL.
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { env, ehProducao } from '../config/env.js';
import { logger } from './logger.js';
import { prepararConexao } from './conexaoBanco.js';

/// Um login por conta (sem equipe): 3 conexões sobram, e o número baixo é o
/// que mantém o consumo dentro da cota da hospedagem compartilhada.
const MAX_CONEXOES = Number(process.env.DB_MAX_CONEXOES ?? 3);

function criarCliente() {
  const { config, database } = prepararConexao(env.DATABASE_URL, MAX_CONEXOES);

  const adapter = new PrismaMariaDb(config, { database });

  logger.info(`Banco via driver adapter (mariadb), até ${MAX_CONEXOES} conexões, base ${database}`);

  return new PrismaClient({
    adapter,
    log: ['warn', 'error'],
  });
}

const globalParaPrisma = globalThis;

export const prisma = globalParaPrisma.__prisma ?? criarCliente();

if (!ehProducao) globalParaPrisma.__prisma = prisma;

export async function desconectarPrisma() {
  await prisma.$disconnect();
}
