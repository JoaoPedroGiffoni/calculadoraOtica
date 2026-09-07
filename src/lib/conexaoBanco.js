// Traduz a DATABASE_URL na configuração de pool que o driver `mariadb` espera.
//
// Mora sozinho, e não dentro de `lib/prisma.js`, por um motivo prático: o
// `prisma.js` valida as variáveis de ambiente da aplicação inteira ao ser
// importado (`config/env.js` derruba o processo sem JWT_SECRET, por exemplo).
// O seed precisa da mesma preparação de URL e não precisa de nada disso —
// arrastar a validação junto obrigaria a informar segredos de aplicação para
// popular um banco vazio.
//
// `connection_limit`, `pool_timeout` e `connect_timeout` são entendidos pelo
// motor do Prisma; o driver os rejeitaria como opções desconhecidas. Por isso
// são retirados aqui.

/// Descarta os parâmetros que são do Prisma e não do driver.
const PARAMETROS_DO_PRISMA = ['connection_limit', 'pool_timeout', 'connect_timeout', 'schema'];

/**
 * Converte "mysql://usuario:senha@host:3306/banco" na configuração do pool.
 *
 * ATENÇÃO À SENHA: como isto é uma URL, caractere especial na senha precisa
 * estar percent-encoded. `#` é o pior deles — numa URL ele inicia o fragmento,
 * então `senha#abc` faz o driver receber a senha truncada em `senha` e o erro
 * que aparece é "Access denied", que manda você conferir a senha certa
 * achando que ela está errada. Também mordem `/`, `@`, `:`, `?` e `%`.
 * Codifique com `encodeURIComponent` antes de montar a URL, ou gere uma senha
 * só com letras e números.
 *
 * @param {string} url
 * @param {number} [maxConexoes]
 */
export function prepararConexao(url, maxConexoes = 3) {
  const alvo = new URL(url);

  for (const chave of PARAMETROS_DO_PRISMA) alvo.searchParams.delete(chave);

  // O pathname vem como "/nome_do_banco".
  const database = decodeURIComponent(alvo.pathname.replace(/^\//, ''));

  const config = {
    host: alvo.hostname,
    port: alvo.port ? Number(alvo.port) : 3306,
    user: decodeURIComponent(alvo.username),
    password: decodeURIComponent(alvo.password),
    database,
    connectionLimit: maxConexoes,
    // Conexão ociosa ainda ocupa recurso em hospedagem compartilhada.
    idleTimeout: 30,
    // ABAIXO do tempo que o pool espera por uma conexão (10s), e não acima.
    //
    // Com 15s aqui, o pool desistia primeiro e o erro que chegava ao log era
    // sempre o genérico "pool timeout: ... active=0 idle=0", que diz que
    // nenhuma conexão foi criada mas não diz por quê. O erro útil — host que
    // não resolve, porta recusada, acesso negado, banco inexistente — morria
    // dentro da tentativa que nunca terminava. Falhando antes do pool, ele
    // aparece.
    connectTimeout: 5_000,
    acquireTimeout: 10_000,
    // O driver devolve BigInt para INTEGER grande, e BigInt não é serializável
    // em JSON — uma contagem viraria erro de resposta. Como nenhum número do
    // sistema chega perto do limite do Number, converter é seguro.
    insertIdAsNumber: true,
    decimalAsNumber: true,
    bigIntAsNumber: true,
  };

  // Hostinger não pede TLS quando a aplicação e o banco estão na mesma
  // máquina; banco externo normalmente pede.
  const ssl = alvo.searchParams.get('ssl');
  if (ssl === 'true' || alvo.searchParams.get('sslaccept') === 'strict') {
    config.ssl = { rejectUnauthorized: true };
  }

  return { config, database };
}
