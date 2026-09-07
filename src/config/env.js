// Carrega e valida as variáveis de ambiente uma única vez, no boot.
// Se faltar algo obrigatório o processo morre cedo, com mensagem clara, em vez
// de quebrar no meio de uma requisição.
import 'dotenv/config';
import { z } from 'zod';

const esquema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  // 3335, e não 3334/3333, para conviver com o AtendimentoLocaPronto e o
  // painel financeiro na mesma máquina.
  PORT: z.coerce.number().int().positive().default(3335),

  // "mock" (fase atual): usuários e orçamentos vivem em memória, sem banco.
  // "banco": Prisma + MySQL, mesmo esquema do AtendimentoLocaPronto — exige
  // DATABASE_URL (ver comentário abaixo). Trocar isto é o gatilho da Fase 2.
  AUTH_MODO: z.enum(['mock', 'banco']).default('mock'),

  DATABASE_URL: z.string().optional(),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET precisa ter ao menos 16 caracteres'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  // CORS: em produção o front é servido pelo próprio Express, então a lista
  // pode ficar vazia. Em desenvolvimento liberamos o Vite.
  CORS_ORIGINS: z.string().default('http://localhost:5175'),

  // Diretório do build do front servido estaticamente.
  WEB_DIST_DIR: z.string().default('./web/dist'),

  TZ: z.string().default('America/Sao_Paulo'),
});

const resultado = esquema.safeParse(process.env);

if (!resultado.success) {
  const problemas = resultado.error.issues
    .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  console.error('\n[config] Variáveis de ambiente inválidas:\n' + problemas + '\n');
  console.error('Copie o .env.example para .env e preencha os valores.\n');
  process.exit(1);
}

export const env = resultado.data;

export const ehProducao = env.NODE_ENV === 'production';

// AUTH_MODO=banco sem DATABASE_URL derrubaria a aplicação só na primeira
// consulta, com um erro de conexão que não diz o que realmente falta. Melhor
// morrer cedo, no boot, com mensagem direta.
if (env.AUTH_MODO === 'banco' && !env.DATABASE_URL) {
  console.error('\n[config] AUTH_MODO=banco exige DATABASE_URL preenchida no .env.\n');
  process.exit(1);
}

// Aviso, não bloqueio: elevar o mínimo do schema acima (hoje 16) quebraria o
// boot de quem já tem um JWT_SECRET mais curto em produção.
if (env.JWT_SECRET.length < 32) {
  console.warn(
    '[config] JWT_SECRET tem menos de 32 caracteres — considere gerar um mais forte com ' +
      '`openssl rand -base64 48` e trocar no .env (isso derruba todas as sessões abertas).',
  );
}

/// Lista de origens liberadas no CORS, já normalizada.
export const origensCors = env.CORS_ORIGINS.split(',')
  .map((o) => o.trim())
  .filter(Boolean);
