// Venda de acesso: link de checkout + webhook que provisiona a conta.
// As duas rotas são PÚBLICAS de propósito — /assinar é o botão da página de
// venda (ninguém está logado ainda), e /webhook é chamado pelo próprio
// Stripe (autenticado pela assinatura do header stripe-signature, não por JWT).
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { env, pagamentoConfigurado } from '../../config/env.js';
import { criarAssinatura, buscarAssinatura, construirEventoWebhook } from '../../lib/stripe.js';
import { repositorioUsuarios } from '../../lib/repositorioUsuarios.js';
import { enviarEmailAcesso, enviarAlertaFalhaEmail } from '../../lib/email.js';
import { gerarSenha } from '../../lib/senha.js';
import { logger } from '../../lib/logger.js';
import { rota } from '../../middleware/erro.js';
import { erroRequisicao } from '../../lib/erros.js';

export const rotasPagamentos = Router();

/// Cria a Checkout Session no Stripe e redireciona para o checkout
/// hospedado. GET (não POST) de propósito: é literalmente um link, pra
/// poder ser um <a href> simples na página de venda, sem JavaScript.
rotasPagamentos.get(
  '/pagamentos/assinar',
  rota(async (req, res) => {
    if (!pagamentoConfigurado) {
      throw erroRequisicao('Pagamento ainda não configurado neste ambiente.');
    }

    const { linkCheckout } = await criarAssinatura();
    res.redirect(303, linkCheckout);
  }),
);

/// Notificação do Stripe. Responde 200 rápido sempre que o evento bate — um
/// 4xx/5xx faz o Stripe reenviar (com backoff), então só devolvemos erro
/// quando é mesmo o caso de tentar de novo depois.
rotasPagamentos.post(
  '/pagamentos/webhook',
  rota(async (req, res) => {
    if (!pagamentoConfigurado) {
      logger.warn('Webhook do Stripe recebido, mas pagamento não está configurado — ignorando.');
      return res.status(200).json({ recebido: true });
    }

    let evento;
    try {
      evento = construirEventoWebhook(req);
    } catch (erro) {
      logger.warn(`Webhook do Stripe com assinatura inválida — descartado. ${erro?.message}`);
      return res.status(401).json({ erro: 'assinatura inválida' });
    }

    // Só nos importa o ciclo de vida da assinatura em si (criada/paga,
    // atrasada, cancelada) — a fatura de cada cobrança recorrente individual
    // não muda o status da conta além disso.
    let assinaturaId;
    if (evento.type === 'checkout.session.completed') {
      const sessao = evento.data.object;
      if (sessao.mode !== 'subscription') return res.status(200).json({ recebido: true });
      assinaturaId = sessao.subscription;
    } else if (evento.type === 'customer.subscription.updated' || evento.type === 'customer.subscription.deleted') {
      assinaturaId = evento.data.object.id;
    } else {
      return res.status(200).json({ recebido: true });
    }

    const assinatura = await buscarAssinatura(assinaturaId);
    logger.info(`Webhook Stripe: assinatura ${assinaturaId} está "${assinatura.status}"`);

    if (assinatura.status === 'active' || assinatura.status === 'trialing') {
      const existente = await repositorioUsuarios.buscarEmpresaPorAssinatura(assinaturaId);
      if (existente) {
        // Reenvio do mesmo evento (o Stripe reenvia se não confirmarmos a
        // tempo) — idempotente, não cria de novo.
        await repositorioUsuarios.atualizarStatusEmpresaPorAssinatura(assinaturaId, 'ativo');
        return res.status(200).json({ recebido: true });
      }

      const email = (assinatura.customer?.email ?? '').trim().toLowerCase();
      if (!email) {
        logger.error(`Assinatura ${assinaturaId} ativa sem e-mail do cliente — não dá para provisionar a conta.`);
        return res.status(200).json({ recebido: true });
      }

      const senha = gerarSenha();
      const { empresa, usuario } = await repositorioUsuarios.criarContaPaga({
        empresaNome: 'Minha Ótica',
        email,
        senhaHash: await bcrypt.hash(senha, 10),
        assinaturaId,
      });

      logger.info(`Conta criada a partir da assinatura ${assinaturaId}: ${usuario.email} (empresa ${empresa.id})`);

      try {
        await enviarEmailAcesso({ para: email, nomeEmpresa: empresa.nome, senha, urlBase: env.URL_BASE });
      } catch (erro) {
        // A conta já existe e já é utilizável — a pessoa só não recebeu o
        // e-mail. Não derruba o webhook por isso (o Stripe reenviaria e
        // tentaríamos criar a conta de novo, sem necessidade). Avisa o dono
        // do produto (se EMAIL_ALERTA estiver configurado) e conta com a
        // pessoa usar "esqueci minha senha" em /login — ver auth.rotas.js.
        logger.error(`Conta ${usuario.email} criada, mas falhou o envio do e-mail de acesso.`, erro?.message);
        await enviarAlertaFalhaEmail({ emailCliente: usuario.email, nomeEmpresa: empresa.nome, motivo: erro?.message ?? 'desconhecido' });
      }
    } else if (assinatura.status === 'past_due' || assinatura.status === 'unpaid') {
      await repositorioUsuarios.atualizarStatusEmpresaPorAssinatura(assinaturaId, 'inadimplente');
    } else if (assinatura.status === 'canceled') {
      await repositorioUsuarios.atualizarStatusEmpresaPorAssinatura(assinaturaId, 'cancelado');
    }

    res.status(200).json({ recebido: true });
  }),
);
