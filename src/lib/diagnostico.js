// Traduz falha de conexão com o banco em causa provável e o que fazer.
//
// Existe porque o erro que chega pelo Prisma é quase sempre inútil: quando o
// pool não consegue criar nenhuma conexão, o que aparece no log é
//
//   pool timeout: failed to retrieve a connection from pool after 10000ms
//   (pool connections: active=0 idle=0 limit=3)
//
// — que informa apenas que nada conectou. Host errado, senha errada, banco
// inexistente e firewall bloqueando produzem exatamente essa mesma linha, e
// cada um tem uma solução diferente. Descobrir qual é, na tentativa e erro,
// custa uma tarde.
//
// Então, quando a conexão falha, abrimos uma conexão crua com o driver — sem
// pool, sem Prisma no meio — só para capturar o erro de verdade e dizer, em
// português, o que ele significa neste ambiente.
import mariadb from 'mariadb';
import { logger } from './logger.js';

/**
 * O que o erro do driver quer dizer, e o que fazer a respeito.
 * Função pura: recebe o erro e a configuração, devolve as linhas do recado.
 */
export function explicarErroDeConexao(erro, config = {}) {
  const codigo = erro?.code ?? '';
  const texto = String(erro?.message ?? erro);
  const onde = `${config.host ?? '?'}:${config.port ?? '?'}`;

  if (codigo === 'ENOTFOUND' || codigo === 'EAI_AGAIN') {
    return [
      `O endereço "${config.host}" não resolve.`,
      'Confira o host da DATABASE_URL. Na Hostinger ele é o que aparece em',
      'Bancos de dados → detalhes da conexão (algo como auth-dbNNNN.hstgr.io),',
      'ou "localhost" quando a aplicação roda na mesma máquina do banco.',
    ];
  }

  if (codigo === 'ECONNREFUSED') {
    return [
      `Nada está escutando em ${onde} — a conexão foi recusada na hora.`,
      'Ou a porta está errada (MySQL usa 3306), ou o banco não está nesse host.',
    ];
  }

  if (codigo === 'ETIMEDOUT' || /timeout/i.test(texto)) {
    return [
      `A conexão com ${onde} ficou pendurada até estourar o tempo.`,
      'Pendurar, em vez de recusar, é sinal de pacote sendo descartado — quase',
      'sempre uma destas duas coisas:',
      '  1. o host está errado (a aplicação não alcança o banco por esse endereço);',
      '  2. o banco só aceita conexão local e a aplicação vem de fora — nesse caso,',
      '     libere o acesso em Bancos de dados → MySQL remoto.',
    ];
  }

  // ANTES da checagem de credencial, de propósito: banco inexistente também
  // responde "Access denied" (erro 1044, e não "unknown database", porque o
  // servidor não conta a quem não tem acesso se o banco existe). Sem esta
  // ordem, errar o prefixo da conta no nome do banco seria diagnosticado como
  // senha errada, e a pessoa trocaria a senha certa sem resolver nada.
  if (codigo === 'ER_DBACCESS_DENIED_ERROR' || /to database/i.test(texto)) {
    return [
      `O usuário "${config.user}" não tem acesso ao banco "${config.database}" — ou ele não existe.`,
      'Na Hostinger o nome vem com o prefixo da conta (u000000000_...), e é ele',
      'inteiro que vai no fim da DATABASE_URL. Confira também se o usuário está',
      'associado a este banco em Bancos de dados → lista.',
    ];
  }

  if (codigo === 'ER_ACCESS_DENIED_ERROR' || /access denied/i.test(texto)) {
    const resposta = texto.split('\n')[0].replace(/^\(conn:[^)]*\)\s*/, '');
    // O MySQL responde no formato usuario@origem. Origem com ":" é IPv6.
    const origem = /@'([^']+)'/.exec(resposta)?.[1] ?? null;

    if (origem?.includes(':')) {
      return [
        `O servidor recusou a conexão porque ela chegou por IPv6, de ${origem}.`,
        '',
        'Não é a senha. O host do banco tem endereço IPv4 e IPv6, o Node prefere',
        'IPv6 desde a versão 17, e o MySQL compara a origem com os endereços',
        'autorizados para o usuário — onde costuma estar só o IPv4. A recusa por',
        'origem e a recusa por senha são o mesmo erro 1045, o que torna isso',
        'especialmente enganoso.',
        '',
        'O sistema já pede IPv4 na resolução de nomes (ver src/lib/rede.js). Se',
        'mesmo assim a conexão sair por IPv6, libere o acesso em Bancos de dados',
        '→ MySQL remoto, com "%" (qualquer host) se o formulário não aceitar IPv6.',
        '',
        `  O servidor respondeu: ${resposta}`,
      ];
    }

    return [
      `O servidor recusou o usuário "${config.user}". Três causas possíveis:`,
      '',
      '  1. A senha do banco não é a que está na DATABASE_URL. Troque-a no painel',
      '     para bater com a variável, ou ajuste a variável para bater com ela.',
      '',
      '  2. A senha tem caractere especial sem codificar na URL. "#" corta a URL',
      '     ali mesmo e a senha chega truncada — este erro aparece com a senha',
      '     CERTA. Use %23 para "#", %2F para "/", %40 para "@".',
      '',
      '  3. O usuário não tem permissão de vir deste endereço. Libere o IP da',
      '     aplicação em Bancos de dados → MySQL remoto.',
      '',
      // A resposta crua do MySQL traz o endereço de onde ELE viu a conexão
      // chegar, no formato usuario@origem. É o que separa a causa 3 das outras
      // duas: se a origem não for a esperada, o problema é permissão, não senha.
      `  O servidor respondeu: ${resposta}`,
    ];
  }

  if (codigo === 'ER_BAD_DB_ERROR' || /unknown database/i.test(texto)) {
    return [
      `O banco "${config.database}" não existe neste servidor.`,
      'Na Hostinger o nome vem com o prefixo da conta (u000000000_...), e é ele',
      'inteiro que vai no fim da DATABASE_URL.',
    ];
  }

  if (codigo === 'ER_HOST_NOT_PRIVILEGED' || /not allowed to connect/i.test(texto)) {
    return [
      'O servidor MySQL recusou este endereço de origem.',
      'Libere o IP da aplicação em Bancos de dados → MySQL remoto.',
    ];
  }

  return [`Erro do driver: ${codigo || 'sem código'} — ${texto.split('\n')[0]}`];
}

/**
 * Abre uma conexão crua, sem pool, só para descobrir a causa real da falha.
 *
 * Nunca lança: é diagnóstico, e diagnóstico que quebra o boot não serve para
 * nada. Devolve `true` se a conexão foi possível.
 */
export async function diagnosticarConexao(config) {
  let conexao;
  try {
    conexao = await mariadb.createConnection({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      connectTimeout: 5_000,
    });
    return true;
  } catch (erro) {
    logger.error('');
    logger.error('  Não consegui conectar no banco. Causa provável:');
    logger.error('');
    for (const linha of explicarErroDeConexao(erro, config)) logger.error(`  ${linha}`);
    logger.error('');
    logger.error(`  Tentei: ${config.user}@${config.host}:${config.port}/${config.database}`);
    logger.error('');
    return false;
  } finally {
    await conexao?.end().catch(() => {});
  }
}
