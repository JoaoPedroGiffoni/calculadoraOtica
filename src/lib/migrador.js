// Aplicador de migrations que roda DENTRO do processo, sem criar subprocesso.
//
// Por que não usar o CLI (`prisma migrate deploy`):
// a hospedagem é CloudLinux, que impõe um teto de processos por usuário. O
// CLI do Prisma, além de ser um processo novo, ainda dispara um segundo
// filho para telemetria (checkpoint.prisma.io) — e o `spawn` falha com EAGAIN
// quando o teto é atingido, derrubando o boot.
//
// Este módulo faz o mesmo trabalho reutilizando a conexão que o Prisma Client
// já abriu: lê prisma/migrations, descobre o que falta e aplica, mantendo a
// tabela `_prisma_migrations` no formato exato que o Prisma usa. Assim
// `prisma migrate status` e `prisma migrate dev` continuam funcionando
// normalmente na máquina de desenvolvimento.
//
// SOBRE NÃO HAVER TRANSAÇÃO AQUI — e por que isso não deixa o banco à deriva:
//
// No MySQL, comando de DDL (CREATE TABLE, ALTER TABLE...) provoca commit
// implícito. Envolver a migration numa transação daria uma falsa sensação de
// segurança: um erro no meio NÃO desfaria as tabelas já criadas. Então não
// fingimos que protege.
//
// A segurança vem de outro lugar, o mesmo que o Prisma usa: o registro de
// controle é gravado ANTES, com `finished_at` nulo, e só é fechado quando a
// migration inteira passa. Se o processo morrer no meio, a linha fica aberta —
// e o boot seguinte se recusa a continuar, em vez de aplicar por cima de um
// banco pela metade e transformar um problema visível num problema silencioso.
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { prisma } from './prisma.js';
import { logger } from './logger.js';
import { dividirComandosSql } from './sqlSplit.js';

/// Estrutura da tabela de controle, idêntica à que o Prisma cria no MySQL.
const SQL_TABELA_CONTROLE = `
CREATE TABLE IF NOT EXISTS \`_prisma_migrations\` (
  \`id\`                  VARCHAR(36) NOT NULL,
  \`checksum\`            VARCHAR(64) NOT NULL,
  \`finished_at\`         DATETIME(3) NULL,
  \`migration_name\`      VARCHAR(255) NOT NULL,
  \`logs\`                TEXT NULL,
  \`rolled_back_at\`      DATETIME(3) NULL,
  \`started_at\`          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  \`applied_steps_count\` INTEGER UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`;

/// Lê as migrations do disco, em ordem cronológica (o nome começa com a data).
async function lerMigrationsDoDisco(diretorio) {
  const entradas = await fs.readdir(diretorio, { withFileTypes: true });

  const pastas = entradas
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  const migrations = [];
  for (const nome of pastas) {
    const arquivo = path.join(diretorio, nome, 'migration.sql');
    let sql;
    try {
      sql = await fs.readFile(arquivo, 'utf8');
    } catch {
      continue; // pasta sem migration.sql: ignora
    }
    migrations.push({
      nome,
      sql,
      // Mesmo algoritmo do Prisma: SHA-256 do conteúdo do arquivo.
      checksum: crypto.createHash('sha256').update(sql).digest('hex'),
    });
  }
  return migrations;
}

/**
 * Aplica as migrations pendentes.
 * Devolve { aplicadas: string[], jaEstavam: number }.
 */
export async function aplicarMigrationsPendentes({ diretorio } = {}) {
  const pasta = diretorio ?? path.resolve(process.cwd(), 'prisma', 'migrations');

  const migrations = await lerMigrationsDoDisco(pasta);
  if (migrations.length === 0) {
    logger.warn('Nenhuma migration encontrada em prisma/migrations.');
    return { aplicadas: [], jaEstavam: 0 };
  }

  await prisma.$executeRawUnsafe(SQL_TABELA_CONTROLE);

  const registradas = await prisma.$queryRawUnsafe(
    'SELECT migration_name, checksum, finished_at, rolled_back_at FROM `_prisma_migrations`',
  );
  const porNome = new Map(registradas.map((r) => [r.migration_name, r]));

  const aplicadas = [];

  for (const migration of migrations) {
    const registro = porNome.get(migration.nome);

    if (registro) {
      // Já aplicada. Se o arquivo mudou depois disso, o histórico e o banco
      // divergiram — parar é mais seguro do que reaplicar em cima.
      if (registro.checksum !== migration.checksum && !registro.rolled_back_at) {
        throw new Error(
          `A migration "${migration.nome}" já foi aplicada, mas o arquivo mudou desde então. ` +
            'Não é seguro reaplicar automaticamente — resolva com o CLI do Prisma.',
        );
      }
      if (!registro.finished_at && !registro.rolled_back_at) {
        throw new Error(
          `A migration "${migration.nome}" ficou pela metade em uma execução anterior. ` +
            'No MySQL o DDL não volta atrás sozinho: confira o estado das tabelas e resolva ' +
            'com `prisma migrate resolve` antes de subir.',
        );
      }
      continue;
    }

    logger.info(`Aplicando migration ${migration.nome}...`);

    // O driver envia cada comando como prepared statement, e prepared
    // statement não aceita múltiplos comandos — por isso o script é dividido
    // antes (ver lib/sqlSplit.js).
    const comandos = dividirComandosSql(migration.sql);
    const id = crypto.randomUUID();

    // Marca a migration como iniciada ANTES de aplicar. Se algo estourar no
    // meio, esta linha fica sem `finished_at` e o boot seguinte se recusa a
    // continuar — ver o comentário no topo do arquivo.
    await prisma.$executeRawUnsafe(
      'INSERT INTO `_prisma_migrations` (id, checksum, migration_name, started_at) VALUES (?, ?, ?, now(3))',
      id,
      migration.checksum,
      migration.nome,
    );

    let passo = 0;
    try {
      for (const comando of comandos) {
        passo += 1;
        await prisma.$executeRawUnsafe(comando);
      }
    } catch (erro) {
      throw new Error(
        `A migration "${migration.nome}" falhou no comando ${passo} de ${comandos.length}: ${erro.message}\n` +
          'O que já tinha sido aplicado permanece no banco (no MySQL o DDL não volta atrás). ' +
          'A migration ficou registrada como não concluída, então o próximo boot vai parar aqui ' +
          'em vez de aplicar por cima.',
        { cause: erro },
      );
    }

    await prisma.$executeRawUnsafe(
      'UPDATE `_prisma_migrations` SET finished_at = now(3), applied_steps_count = ? WHERE id = ?',
      comandos.length,
      id,
    );

    logger.info(`  ${migration.nome}: ${comandos.length} comando(s) aplicado(s).`);
    aplicadas.push(migration.nome);
  }

  return { aplicadas, jaEstavam: migrations.length - aplicadas.length };
}
