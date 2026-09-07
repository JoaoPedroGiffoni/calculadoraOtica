// Montagem do Express. Em produção o mesmo processo serve a API e o build
// estático do front — uma porta só, atrás do Nginx/Cloudflare (ou direto na
// hospedagem gerenciada da Hostinger).
import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env, ehProducao, origensCors } from './config/env.js';
import { rotasApi } from './routes/index.js';
import { rotaNaoEncontrada, tratadorDeErro } from './middleware/erro.js';
import { logger } from './lib/logger.js';

/**
 * Política de CORS. Regras, nesta ordem:
 *  1. Requisição sem `Origin` (curl, mesma origem): libera.
 *  2. `Origin` igual ao host do próprio servidor: libera sempre — é o caso do
 *     front buildado sendo servido pelo Express.
 *  3. `Origin` listado em CORS_ORIGINS (ex.: o Vite em desenvolvimento): libera.
 *  4. Qualquer outra: responde SEM os cabeçalhos de CORS, deixando o navegador
 *     bloquear — nunca lançamos erro aqui, um throw viraria 500.
 */
function opcoesCors(req, callback) {
  const liberado = { origin: true, credentials: true };
  const origem = req.headers.origin;

  if (!origem) return callback(null, liberado);

  try {
    if (new URL(origem).host === req.headers.host) return callback(null, liberado);
  } catch {
    // Origin malformado: cai na verificação da lista abaixo.
  }

  if (origensCors.includes(origem)) return callback(null, liberado);

  logger.warn(`Origem bloqueada pelo CORS: ${origem}`);
  return callback(null, { origin: false });
}

export function criarApp() {
  const app = express();

  // Atrás do Nginx/Cloudflare: confia no proxy para ler o IP real, necessário
  // para o rate limit do login funcionar de verdade.
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: ehProducao
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
              connectSrc: ["'self'"],
              fontSrc: ["'self'", 'data:'],
              objectSrc: ["'none'"],
            },
          }
        : false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  // CORS só na API. Os arquivos estáticos do front nunca passam por aqui.
  app.use('/api', cors(opcoesCors));

  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  if (!ehProducao) app.use(morgan('dev'));
  else app.use(morgan('combined'));

  // Rate limit geral da API — proteção básica contra abuso.
  app.use(
    '/api',
    rateLimit({
      windowMs: 60 * 1000,
      max: 300,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        erro: { codigo: 'MUITAS_REQUISICOES', mensagem: 'Muitas requisições. Aguarde um instante.' },
      },
    }),
  );

  app.use('/api/v1', rotasApi);

  // --- Front estático ---
  const dirWeb = path.resolve(process.cwd(), env.WEB_DIST_DIR);
  const indexHtml = path.join(dirWeb, 'index.html');

  if (fs.existsSync(indexHtml)) {
    app.use(
      express.static(dirWeb, {
        setHeaders: (res, arquivo) => {
          if (arquivo.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          } else {
            res.setHeader('Cache-Control', 'no-cache');
          }
        },
      }),
    );

    // SPA fallback: qualquer rota que não seja /api devolve o index.
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(indexHtml));
  } else {
    logger.warn(`Build do front não encontrado em ${dirWeb}. Rode "npm run build".`);
    app.get('/', (_req, res) =>
      res
        .status(200)
        .send(
          '<h1>Calculadora Ótica</h1><p>API no ar em <code>/api/v1/saude</code>. O front ainda não foi buildado: rode <code>npm run build</code>.</p>',
        ),
    );
  }

  app.use('/api', rotaNaoEncontrada);
  app.use(tratadorDeErro);

  return app;
}
