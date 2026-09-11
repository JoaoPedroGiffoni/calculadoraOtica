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
  DB_MAX_CONEXOES: z.coerce.number().int().positive().default(3),
  // Aplica migrations pendentes e semeia a primeira conta no boot — só faz
  // sentido com AUTH_MODO=banco. Ver src/lib/bootstrap.js.
  MIGRAR_NO_BOOT: z
    .string()
    .default('true')
    .transform((v) => v !== 'false'),

  // Primeira conta, criada pelo seed quando o banco está vazio (ver
  // prisma/seed.js) — só usadas com AUTH_MODO=banco.
  EMPRESA_NOME: z.string().optional(),
  ADMIN_NOME: z.string().optional(),
  ADMIN_EMAIL: z.string().optional(),
  ADMIN_SENHA: z.string().optional(),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET precisa ter ao menos 16 caracteres'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  // CORS: em produção o front é servido pelo próprio Express, então a lista
  // pode ficar vazia. Em desenvolvimento liberamos o Vite.
  CORS_ORIGINS: z.string().default('http://localhost:5175'),

  // Diretório do build do front servido estaticamente.
  WEB_DIST_DIR: z.string().default('./web/dist'),

  TZ: z.string().default('America/Sao_Paulo'),

  // --- Fase 3: venda de acesso ---
  // URL pública desta aplicação, sem barra no fim — usada para montar as
  // URLs de retorno do checkout (success_url/cancel_url). Em produção é o
  // domínio de verdade; em desenvolvimento, o preview/túnel que estiver
  // ativo no momento.
  URL_BASE: z.string().optional(),

  // Chave secreta da conta Stripe (sk_test_... em teste, sk_live_... em
  // produção) — ver painel de Desenvolvedores > Chaves de API.
  STRIPE_ACCESS_TOKEN: z.string().optional(),
  // Id do produto no Stripe (prod_...) cujo preço ativo vira a Checkout
  // Session de assinatura — ver src/lib/stripe.js.
  STRIPE_PRODUTO_ID: z.string().optional(),
  // Segredo mostrado ao configurar o endpoint de webhook no painel do
  // Stripe — confere que o evento realmente veio de lá (ver
  // src/lib/stripe.js#construirEventoWebhook).
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // E-mail transacional (Resend) — o acesso de cada conta nova sai por
  // aqui. EMAIL_REMETENTE é específico deste produto, de propósito: cada
  // produto da empresa manda do seu próprio remetente, não de um endereço
  // genérico compartilhado.
  RESEND_API_KEY: z.string().optional(),
  EMAIL_REMETENTE: z.string().optional(),
  // Para onde avisar quando o e-mail de acesso de uma conta paga falha ao
  // enviar (ver pagamentos.rotas.js) — sem isso, a única forma de notar é
  // lendo o log do PM2. Opcional: se vazio, o aviso só fica no log mesmo.
  EMAIL_ALERTA: z.string().optional(),
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

// Venda de acesso: ou está tudo preenchido, ou nada — um conjunto pela
// metade falha de um jeito confuso (ex.: gera link de checkout mas nunca
// consegue confirmar o webhook). Sem nenhuma delas a aplicação sobe normal,
// só sem o botão de assinar funcionando de verdade.
export const pagamentoConfigurado = Boolean(
  env.STRIPE_ACCESS_TOKEN && env.STRIPE_PRODUTO_ID && env.STRIPE_WEBHOOK_SECRET && env.URL_BASE,
);
const pagamentoParcial =
  !pagamentoConfigurado &&
  Boolean(env.STRIPE_ACCESS_TOKEN || env.STRIPE_PRODUTO_ID || env.STRIPE_WEBHOOK_SECRET || env.URL_BASE);
if (pagamentoParcial) {
  console.warn(
    '[config] Configuração de pagamento incompleta — preencha STRIPE_ACCESS_TOKEN, ' +
      'STRIPE_PRODUTO_ID, STRIPE_WEBHOOK_SECRET e URL_BASE juntas. Até lá, /pagamentos/assinar ' +
      'responde erro em vez de meio-funcionar.',
  );
}

export const emailConfigurado = Boolean(env.RESEND_API_KEY && env.EMAIL_REMETENTE);
