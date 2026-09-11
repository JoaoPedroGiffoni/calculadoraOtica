// Integração com a API de Assinaturas do Mercado Pago.
//
// Fluxo: o botão "Assinar" na página de venda chama GET /pagamentos/assinar
// (ver pagamentos.rotas.js), que devolve o link de checkout de um PLANO de
// assinatura e redireciona pra lá. Quem completar o pagamento lá vira uma
// assinatura de verdade (uma "preapproval" ligada ao plano), e o Mercado
// Pago avisa por webhook — é nesse momento que a conta (Empresa + Usuario)
// é criada.
//
// Por que plano, e não "preapproval" direto: a tentativa inicial criava uma
// preapproval diretamente (POST /preapproval, sem payer_email), na
// expectativa — desta vez SEM confirmação contra a API de verdade, só pela
// doc — de que isso geraria um link genérico. Testado em produção, a API
// recusou com "payer_email is required": criar uma preapproval sem plano
// exige já saber quem é o pagador, não serve para um link público de venda.
// O jeito certo é criar um PLANO (POST /preapproval_plan, sem payer_email
// nenhum) — aí sim o Mercado Pago devolve um `init_point` aberto para
// qualquer pessoa se identificar e pagar. Confirmado contra a API real.
//
// Como o preço é fixo (R$49/mês, um plano só), o plano é criado uma vez
// e cacheado em memória do processo — evita recriar um plano novo a cada
// clique. Reinícios do processo criam outro (efeito colateral aceitável:
// planos antigos ficam órfãos no painel do Mercado Pago, sem custo).
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { logger } from './logger.js';

const BASE = 'https://api.mercadopago.com';

/// Token de teste (TEST-...) usa sandbox_init_point quando existir; produção
/// (APP_USR-...) usa init_point. Confundir os dois é o erro mais comum de
/// quem integra.
function ehTokenDeTeste() {
  return (env.MERCADOPAGO_ACCESS_TOKEN ?? '').startsWith('TEST-');
}

async function chamar(caminho, opcoes = {}) {
  const resposta = await fetch(`${BASE}${caminho}`, {
    ...opcoes,
    headers: {
      Authorization: `Bearer ${env.MERCADOPAGO_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      ...opcoes.headers,
    },
  });

  const texto = await resposta.text();
  const dado = texto ? JSON.parse(texto) : null;

  if (!resposta.ok) {
    logger.error(`Mercado Pago recusou ${caminho} (${resposta.status})`, dado);
    throw new Error(`Mercado Pago: ${dado?.message ?? `erro ${resposta.status}`}`);
  }

  return dado;
}

let planoCache = null;

/**
 * Devolve o link de checkout do plano de assinatura — cria o plano no
 * Mercado Pago na primeira chamada (POST /preapproval_plan, sem
 * payer_email: é isso que torna o link genérico, aberto pra qualquer
 * pessoa) e reaproveita o mesmo link nas chamadas seguintes.
 */
export async function criarAssinatura() {
  if (planoCache) return planoCache;

  const plano = await chamar('/preapproval_plan', {
    method: 'POST',
    body: JSON.stringify({
      reason: 'Calculadora Ótica — assinatura mensal',
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: env.PRECO_ASSINATURA,
        currency_id: 'BRL',
      },
      // Assinatura recorrente exige cobrança automática mês a mês — boleto
      // não permite isso, então restringimos o checkout a cartão de crédito.
      payment_methods_allowed: {
        payment_types: [{ id: 'credit_card' }],
      },
      back_url: `${env.URL_BASE}/login?assinatura=pendente`,
    }),
  });

  const linkCheckout = (ehTokenDeTeste() && plano.sandbox_init_point) || plano.init_point;
  logger.info(`Plano de assinatura criado no Mercado Pago: ${plano.id}`);

  planoCache = { id: plano.id, linkCheckout };
  return planoCache;
}

/// Detalhe de uma assinatura — usado pelo webhook para saber o status atual
/// (authorized/paused/cancelled) e o e-mail de quem assinou.
export async function buscarAssinatura(id) {
  return chamar(`/preapproval/${id}`);
}

/**
 * Confere a assinatura HMAC do webhook — sem isso, qualquer um que
 * descobrisse a URL conseguiria fabricar uma notificação de "pagamento
 * aprovado" e criar contas de graça.
 *
 * Algoritmo documentado pelo Mercado Pago: monta um "manifest" com o id do
 * recurso (da querystring, não do corpo), o x-request-id e o timestamp que
 * vêm no próprio header x-signature, assina com HMAC-SHA256 usando o
 * segredo do webhook, e compara com o hash que veio no header.
 */
export function verificarAssinaturaWebhook(req) {
  const cabecalho = req.headers['x-signature'];
  const requestId = req.headers['x-request-id'];
  const dataId = req.query?.['data.id'];

  if (!cabecalho || !requestId || !dataId) return false;

  const partes = Object.fromEntries(
    String(cabecalho)
      .split(',')
      .map((par) => par.trim().split('=').map((s) => s.trim())),
  );
  const { ts, v1: hashRecebido } = partes;
  if (!ts || !hashRecebido) return false;

  // O Mercado Pago documenta: se o data.id tiver letra, usar em minúsculas.
  const manifest = `id:${String(dataId).toLowerCase()};request-id:${requestId};ts:${ts};`;
  const hashEsperado = crypto.createHmac('sha256', env.MERCADOPAGO_WEBHOOK_SECRET).update(manifest).digest('hex');

  const bufEsperado = Buffer.from(hashEsperado, 'hex');
  const bufRecebido = Buffer.from(hashRecebido, 'hex');
  if (bufEsperado.length !== bufRecebido.length) return false;

  return crypto.timingSafeEqual(bufEsperado, bufRecebido);
}
