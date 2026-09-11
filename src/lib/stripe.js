// Integração com a API de Assinaturas do Stripe.
//
// Fluxo: o botão "Assinar" na página de venda chama GET /pagamentos/assinar
// (ver pagamentos.rotas.js), que cria uma Checkout Session em modo
// "subscription" para o preço ativo do produto STRIPE_PRODUTO_ID e
// redireciona pra lá. Quem completar o pagamento vira uma assinatura de
// verdade, e o Stripe avisa por webhook — é nesse momento que a conta
// (Empresa + Usuario) é criada.
//
// Diferente do Mercado Pago (que exigia criar um "plano" fixo antecipado e
// cachear o link gerado), a Checkout Session do Stripe já é de uso único
// por natureza — cada clique em "Assinar" cria uma sessão nova. O único
// dado que vale cachear é o id do preço do produto, que só muda quando o
// preço é trocado no painel do Stripe.
import Stripe from 'stripe';
import { env } from '../config/env.js';

// Instanciado sob demanda (não no carregamento do módulo): o SDK recusa
// `new Stripe()` sem apiKey, e este arquivo é importado mesmo quando o
// pagamento não está configurado (ex.: AUTH_MODO=mock sem venda ligada) —
// `pagamentoConfigurado` é quem garante que STRIPE_ACCESS_TOKEN existe antes
// de qualquer chamada de verdade chegar aqui (ver pagamentos.rotas.js).
let stripeCache = null;
function cliente() {
  if (!stripeCache) stripeCache = new Stripe(env.STRIPE_ACCESS_TOKEN);
  return stripeCache;
}

let precoIdCache = null;

/// Preço recorrente ativo do produto configurado (STRIPE_PRODUTO_ID) —
/// cacheado em memória do processo, reaproveitado entre chamadas.
async function buscarPrecoId() {
  if (precoIdCache) return precoIdCache;

  const precos = await cliente().prices.list({ product: env.STRIPE_PRODUTO_ID, active: true, limit: 1 });
  const preco = precos.data[0];
  if (!preco) {
    throw new Error(`Nenhum preço ativo encontrado para o produto ${env.STRIPE_PRODUTO_ID} no Stripe.`);
  }

  precoIdCache = preco.id;
  return precoIdCache;
}

/**
 * Cria uma Checkout Session de assinatura e devolve o link do checkout
 * hospedado pelo Stripe.
 */
export async function criarAssinatura() {
  const precoId = await buscarPrecoId();

  const sessao = await cliente().checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: precoId, quantity: 1 }],
    // Assinatura recorrente exige cobrança automática mês a mês — boleto e
    // Pix não permitem isso, então restringimos o checkout a cartão de
    // crédito (mesma decisão que já existia com o Mercado Pago).
    payment_method_types: ['card'],
    success_url: `${env.URL_BASE}/login?assinatura=pendente`,
    cancel_url: `${env.URL_BASE}/login?assinatura=cancelada`,
  });

  return { linkCheckout: sessao.url };
}

/// Detalhe de uma assinatura — usado pelo webhook para saber o status atual
/// (active/past_due/canceled) e o e-mail de quem assinou.
export async function buscarAssinatura(id) {
  return cliente().subscriptions.retrieve(id, { expand: ['customer'] });
}

/**
 * Confere a assinatura do webhook — sem isso, qualquer um que descobrisse a
 * URL conseguiria fabricar um evento de "pagamento aprovado" e criar contas
 * de graça. Delega pro próprio SDK do Stripe (`constructEvent`), que faz a
 * verificação HMAC do header `stripe-signature` contra o corpo cru da
 * requisição — por isso o corpo precisa chegar intacto (`req.rawBody`, ver
 * `verify` em `express.json()` no app.js).
 */
export function construirEventoWebhook(req) {
  return cliente().webhooks.constructEvent(req.rawBody, req.headers['stripe-signature'], env.STRIPE_WEBHOOK_SECRET);
}
