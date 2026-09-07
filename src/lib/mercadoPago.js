// Integração com a API de Assinaturas do Mercado Pago.
//
// Fluxo: o botão "Assinar" na página de venda chama GET /pagamentos/assinar
// (ver pagamentos.rotas.js), que cria uma "preapproval" aqui e redireciona
// para o checkout hospedado do Mercado Pago. Quem preencher o pagamento lá
// vira uma assinatura de verdade, e o Mercado Pago avisa por webhook — é
// nesse momento que a conta (Empresa + Usuario) é criada.
//
// NÃO TESTADO CONTRA A API DE VERDADE: esta sessão não alcança
// api.mercadopago.com (mesma restrição de rede que bloqueou o MySQL) — só dá
// para confirmar depois de rodar em produção/preview. Escrito seguindo a
// documentação oficial da API de Assinaturas (preapproval) à risca; qualquer
// divergência de contrato só aparece no teste real.
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { logger } from './logger.js';

const BASE = 'https://api.mercadopago.com';

/// Token de teste (TEST-...) usa sandbox_init_point; produção (APP_USR-...)
/// usa init_point. Confundir os dois é o erro mais comum de quem integra.
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

/**
 * Cria uma assinatura "em aberto" (sem e-mail de pagador ainda — quem entra
 * no checkout se identifica lá) e devolve o link de checkout.
 *
 * `status: "pending"` sem `payer_email` é o que faz o Mercado Pago devolver
 * um `init_point` genérico, aberto para qualquer pessoa completar — sem
 * isso, a API exige amarrar a um pagador específico de antemão.
 */
export async function criarAssinatura() {
  const preapproval = await chamar('/preapproval', {
    method: 'POST',
    body: JSON.stringify({
      reason: 'Calculadora Ótica — assinatura mensal',
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: env.PRECO_ASSINATURA,
        currency_id: 'BRL',
      },
      back_url: `${env.URL_BASE}/login?assinatura=pendente`,
      status: 'pending',
    }),
  });

  const linkCheckout = ehTokenDeTeste() ? preapproval.sandbox_init_point : preapproval.init_point;
  return { id: preapproval.id, linkCheckout };
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
