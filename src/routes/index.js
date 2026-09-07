// Router principal da API. Tudo abaixo de /api/v1 exige autenticação, exceto
// as rotas públicas explicitamente montadas antes do middleware `autenticar`.
import { Router } from 'express';
import { autenticar } from '../middleware/autenticacao.js';
import { exigirBancoPronto } from '../middleware/prontidaoBanco.js';
import { versao } from '../lib/versao.js';
import { env } from '../config/env.js';
import { rotasAuth } from '../modules/auth/auth.rotas.js';
import { rotasConfiguracoes } from '../modules/configuracoes/configuracoes.rotas.js';
import { rotasPagamentos } from '../modules/pagamentos/pagamentos.rotas.js';

export const rotasApi = Router();

/// Healthcheck. Responde sempre 200 — plataformas de hospedagem usam esta
/// rota para decidir se o processo está vivo. Nunca passa por
/// `exigirBancoPronto`: precisa responder mesmo com o banco fora do ar.
rotasApi.get('/saude', async (_req, res) => {
  let banco = 'mock';
  if (env.AUTH_MODO === 'banco') {
    const { estado } = await import('../lib/estado.js');
    banco = estado.bancoPronto ? 'ok' : estado.preparando ? 'preparando' : 'indisponivel';
  }

  res.json({
    status: 'ok',
    authModo: env.AUTH_MODO,
    banco,
    versao,
    horario: new Date().toISOString(),
  });
});

// --- Públicas, mas dependem do banco (login precisa consultar usuário) ---
rotasApi.use('/auth', exigirBancoPronto, rotasAuth);
rotasApi.use(exigirBancoPronto, rotasPagamentos);

// --- A partir daqui, tudo autenticado ---
rotasApi.use(exigirBancoPronto, autenticar);
rotasApi.use(rotasConfiguracoes);
