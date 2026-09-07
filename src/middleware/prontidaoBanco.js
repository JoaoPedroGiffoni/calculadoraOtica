// Barra requisições que dependem do banco enquanto ele ainda está sendo
// preparado (ver src/server.js — a porta abre antes do banco estar pronto).
// Em AUTH_MODO=mock isto nunca faz nada: não há banco para esperar.
import { env } from '../config/env.js';
import { ErroHttp } from '../lib/erros.js';

export async function exigirBancoPronto(_req, _res, proximo) {
  if (env.AUTH_MODO !== 'banco') return proximo();

  const { estado } = await import('../lib/estado.js');

  if (estado.bancoPronto) return proximo();

  if (estado.preparando) {
    return proximo(
      new ErroHttp(503, 'O sistema está terminando de subir. Tente de novo em alguns segundos.', undefined, 'PREPARANDO'),
    );
  }

  return proximo(
    new ErroHttp(503, 'O sistema está no ar, mas sem acesso ao banco de dados.', { erro: estado.erro }, 'BANCO_INDISPONIVEL'),
  );
}
