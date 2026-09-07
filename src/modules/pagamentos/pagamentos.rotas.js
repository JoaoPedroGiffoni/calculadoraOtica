// Venda de acesso: link de checkout + webhook que provisiona a conta.
// As duas rotas são PÚBLICAS de propósito — /assinar é o botão da página de
// venda (ninguém está logado ainda), e /webhook é chamado pelo próprio
// Mercado Pago (autenticado pela assinatura HMAC, não por JWT).
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { env, pagamentoConfigurado } from '../../config/env.js';
import { criarAssinatura, buscarAssinatura, verificarAssinaturaWebhook } from '../../lib/mercadoPago.js';
import { repositorioUsuarios } from '../../lib/repositorioUsuarios.js';
import { enviarEmailAcesso } from '../../lib/email.js';
import { logger } from '../../lib/logger.js';
import { rota } from '../../middleware/erro.js';
import { erroRequisicao } from '../../lib/erros.js';

export const rotasPagamentos = Router();

/// Gera uma senha inicial forte — quem assina recebe ela por e-mail e pode
/// seguir usando (ainda não há tela de "trocar senha").
function gerarSenha() {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  return Array.from({ length: 16 }, () => alfabeto[Math.floor(Math.random() * alfabeto.length)]).join('');
}

/// Cria a assinatura no Mercado Pago e redireciona para o checkout
/// hospedado. GET (não POST) de propósito: é literalmente um link, pra
/// poder ser um <a href> simples na página de venda, sem JavaScript.
rotasPagamentos.get(
  '/pagamentos/assinar',
  rota(async (req, res) => {
    if (!pagamentoConfigurado) {
      throw erroRequisicao('Pagamento ainda não configurado neste ambiente.');
    }

    const { linkCheckout } = await criarAssinatura();
    res.redirect(302, linkCheckout);
  }),
);

/// Notificação do Mercado Pago. Responde 200 rápido sempre que a assinatura
/// bate — um 4xx/5xx faz o Mercado Pago reenviar (com backoff), então só
/// devolvemos erro quando é mesmo o caso de tentar de novo depois.
rotasPagamentos.post(
  '/pagamentos/webhook',
  rota(async (req, res) => {
    if (!pagamentoConfigurado) {
      logger.warn('Webhook do Mercado Pago recebido, mas pagamento não está configurado — ignorando.');
      return res.status(200).json({ recebido: true });
    }

    if (!verificarAssinaturaWebhook(req)) {
      logger.warn('Webhook do Mercado Pago com assinatura inválida — descartado.');
      return res.status(401).json({ erro: 'assinatura inválida' });
    }

    const tipo = req.query?.type ?? req.body?.type;
    const dataId = req.query?.['data.id'] ?? req.body?.data?.id;

    // Só nos importa o ciclo de vida da assinatura em si (autorizada, pausada,
    // cancelada) — cada cobrança recorrente individual (subscription_
    // authorized_payment) não muda o status da conta, então é só confirmar
    // recebimento sem processar.
    if (tipo !== 'subscription_preapproval' && tipo !== 'preapproval') {
      return res.status(200).json({ recebido: true });
    }

    const assinatura = await buscarAssinatura(dataId);
    logger.info(`Webhook Mercado Pago: assinatura ${dataId} está "${assinatura.status}"`);

    if (assinatura.status === 'authorized') {
      const existente = await repositorioUsuarios.buscarEmpresaPorAssinatura(dataId);
      if (existente) {
        // Reenvio do mesmo evento (o Mercado Pago reenvia se não confirmarmos
        // a tempo) — idempotente, não cria de novo.
        await repositorioUsuarios.atualizarStatusEmpresaPorAssinatura(dataId, 'ativo');
        return res.status(200).json({ recebido: true });
      }

      const email = (assinatura.payer_email ?? '').trim().toLowerCase();
      if (!email) {
        logger.error(`Assinatura ${dataId} autorizada sem payer_email — não dá para provisionar a conta.`);
        return res.status(200).json({ recebido: true });
      }

      const senha = gerarSenha();
      const { empresa, usuario } = await repositorioUsuarios.criarContaPaga({
        empresaNome: 'Minha Ótica',
        email,
        senhaHash: await bcrypt.hash(senha, 10),
        mercadoPagoAssinaturaId: dataId,
      });

      logger.info(`Conta criada a partir da assinatura ${dataId}: ${usuario.email} (empresa ${empresa.id})`);

      try {
        await enviarEmailAcesso({ para: email, nomeEmpresa: empresa.nome, senha, urlBase: env.URL_BASE });
      } catch (erro) {
        // A conta já existe e já é utilizável — a pessoa só não recebeu o
        // e-mail. Não derruba o webhook por isso (o Mercado Pago reenviaria
        // e tentaríamos criar a conta de novo, sem necessidade).
        logger.error(`Conta ${usuario.email} criada, mas falhou o envio do e-mail de acesso.`, erro?.message);
      }
    } else if (assinatura.status === 'paused') {
      await repositorioUsuarios.atualizarStatusEmpresaPorAssinatura(dataId, 'inadimplente');
    } else if (assinatura.status === 'cancelled') {
      await repositorioUsuarios.atualizarStatusEmpresaPorAssinatura(dataId, 'cancelado');
    }

    res.status(200).json({ recebido: true });
  }),
);
