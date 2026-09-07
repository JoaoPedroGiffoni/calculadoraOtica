// Router principal da API. Tudo abaixo de /api/v1 exige autenticação, exceto
// as rotas públicas explicitamente montadas antes do middleware `autenticar`.
import { Router } from 'express';
import { autenticar } from '../middleware/autenticacao.js';
import { versao } from '../lib/versao.js';
import { env } from '../config/env.js';
import { rotasAuth } from '../modules/auth/auth.rotas.js';
import { rotasOrcamentos } from '../modules/orcamentos/orcamentos.rotas.js';

export const rotasApi = Router();

/// Healthcheck. Responde sempre 200 — plataformas de hospedagem usam esta
/// rota para decidir se o processo está vivo.
rotasApi.get('/saude', (_req, res) => {
  res.json({
    status: 'ok',
    authModo: env.AUTH_MODO,
    versao,
    horario: new Date().toISOString(),
  });
});

// --- Públicas ---
rotasApi.use('/auth', rotasAuth);

// --- A partir daqui, tudo autenticado ---
rotasApi.use(autenticar);
rotasApi.use(rotasOrcamentos);
