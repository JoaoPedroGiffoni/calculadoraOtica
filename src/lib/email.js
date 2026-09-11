// Envio de e-mail transacional via Resend — só o necessário (o acesso de
// conta nova), via fetch direto na API REST deles, sem SDK: é uma chamada
// só, não vale a dependência extra.
//
// EMAIL_REMETENTE é específico DESTE produto (acesso@calculadora.gmtacademy.com.br),
// não um endereço genérico da empresa — cada produto da GMT Academy manda do
// seu próprio remetente. O domínio do remetente precisa estar verificado no
// Resend (registro SPF/DKIM), senão a API recusa o envio.
import { env, emailConfigurado } from '../config/env.js';
import { logger } from './logger.js';

const RESEND_URL = 'https://api.resend.com/emails';

/// `para`/`nomeEmpresa` podem carregar o que quer que o pagador tenha
/// digitado no checkout do Stripe — escapa antes de colar no HTML do
/// e-mail, senão vira injeção de HTML (o e-mail vai por HTML puro, sem
/// template engine nenhum escapando por baixo).
function escaparHtml(texto) {
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/// Lança se a API recusar — quem chama decide o que fazer (a rota de
/// webhook não deixa a criação da conta falhar por causa do e-mail; ver
/// pagamentos.rotas.js).
async function enviar({ para, assunto, html }) {
  if (!emailConfigurado) {
    throw new Error('RESEND_API_KEY/EMAIL_REMETENTE não configurados — e-mail não enviado.');
  }

  const resposta = await fetch(RESEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: env.EMAIL_REMETENTE, to: [para], subject: assunto, html }),
  });

  if (!resposta.ok) {
    const corpo = await resposta.text().catch(() => '');
    throw new Error(`Resend recusou o envio (${resposta.status}): ${corpo.slice(0, 300)}`);
  }

  const dado = await resposta.json();
  logger.info(`E-mail enviado para ${para} (id ${dado.id ?? '?'})`);
  return dado;
}

/// O e-mail que uma conta nova recebe assim que a assinatura é aprovada.
export async function enviarEmailAcesso({ para, nomeEmpresa, senha, urlBase }) {
  const urlLogin = `${urlBase}/login`;
  const nomeSeguro = escaparHtml(nomeEmpresa);
  const emailSeguro = escaparHtml(para);

  const html = `
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto; color: #0f172a;">
      <h1 style="font-size: 20px;">Seu acesso à Calculadora Ótica está pronto</h1>
      <p>Olá! Sua assinatura foi confirmada e a conta de <strong>${nomeSeguro}</strong> já está liberada.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
        <tr>
          <td style="padding: 12px 16px; background: #f1f5f9; border-radius: 12px 12px 0 0;">
            <span style="color: #64748b; font-size: 13px;">E-mail de acesso</span><br />
            <strong>${emailSeguro}</strong>
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; background: #f1f5f9; border-radius: 0 0 12px 12px;">
            <span style="color: #64748b; font-size: 13px;">Senha</span><br />
            <strong>${senha}</strong>
          </td>
        </tr>
      </table>
      <p>
        <a href="${urlLogin}" style="display: inline-block; background: #4F46E5; color: #fff; padding: 10px 20px; border-radius: 10px; text-decoration: none; font-weight: 600;">
          Entrar na calculadora
        </a>
      </p>
      <p style="color: #64748b; font-size: 13px; margin-top: 24px;">
        Guarde este e-mail. Se perder a senha, use "Esqueci minha senha" na tela de login para gerar uma nova.
      </p>
    </div>
  `.trim();

  return enviar({ para, assunto: 'Seu acesso à Calculadora Ótica', html });
}

/// E-mail de "esqueci minha senha" — mesmo layout do e-mail de acesso inicial,
/// mandado de novo (com senha nova) quando a pessoa pede reenvio em
/// /auth/recuperar-senha. Ver auth.rotas.js.
export async function enviarEmailRecuperacao({ para, nomeEmpresa, senha, urlBase }) {
  const urlLogin = `${urlBase}/login`;
  const nomeSeguro = escaparHtml(nomeEmpresa);
  const emailSeguro = escaparHtml(para);

  const html = `
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto; color: #0f172a;">
      <h1 style="font-size: 20px;">Nova senha de acesso</h1>
      <p>Geramos uma nova senha para a conta de <strong>${nomeSeguro}</strong>, como você pediu.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
        <tr>
          <td style="padding: 12px 16px; background: #f1f5f9; border-radius: 12px 12px 0 0;">
            <span style="color: #64748b; font-size: 13px;">E-mail de acesso</span><br />
            <strong>${emailSeguro}</strong>
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; background: #f1f5f9; border-radius: 0 0 12px 12px;">
            <span style="color: #64748b; font-size: 13px;">Nova senha</span><br />
            <strong>${senha}</strong>
          </td>
        </tr>
      </table>
      <p>
        <a href="${urlLogin}" style="display: inline-block; background: #4F46E5; color: #fff; padding: 10px 20px; border-radius: 10px; text-decoration: none; font-weight: 600;">
          Entrar na calculadora
        </a>
      </p>
      <p style="color: #64748b; font-size: 13px; margin-top: 24px;">
        Se você não pediu essa troca, ignore este e-mail — sua senha antiga continua valendo.
      </p>
    </div>
  `.trim();

  return enviar({ para, assunto: 'Nova senha de acesso — Calculadora Ótica', html });
}

/// Avisa o dono do produto (EMAIL_ALERTA) quando o e-mail de acesso de uma
/// conta recém-paga falha ao enviar — sem isso, o único jeito de notar é
/// lendo o log do PM2 (ver pagamentos.rotas.js). Falha por conta própria
/// (EMAIL_ALERTA não configurado, Resend fora do ar) nunca deve derrubar o
/// webhook: só loga e segue.
export async function enviarAlertaFalhaEmail({ emailCliente, nomeEmpresa, motivo }) {
  if (!env.EMAIL_ALERTA) {
    logger.warn('EMAIL_ALERTA não configurado — alerta de falha de e-mail de acesso só registrado no log.');
    return;
  }

  const html = `
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto; color: #0f172a;">
      <h1 style="font-size: 18px;">Falha ao enviar e-mail de acesso</h1>
      <p>A conta de <strong>${escaparHtml(nomeEmpresa)}</strong> (${escaparHtml(emailCliente)}) foi criada normalmente, mas o e-mail com a senha não saiu.</p>
      <p style="color: #64748b; font-size: 13px;">Motivo: ${escaparHtml(motivo)}</p>
      <p>A pessoa pode gerar uma nova senha sozinha em "Esqueci minha senha" na tela de login.</p>
    </div>
  `.trim();

  try {
    await enviar({ para: env.EMAIL_ALERTA, assunto: `[alerta] e-mail de acesso falhou — ${emailCliente}`, html });
  } catch (erro) {
    logger.error('Alerta de falha de e-mail de acesso também falhou ao enviar.', erro?.message);
  }
}
