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

  const html = `
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto; color: #0f172a;">
      <h1 style="font-size: 20px;">Seu acesso à Calculadora Ótica está pronto</h1>
      <p>Olá! Sua assinatura foi confirmada e a conta de <strong>${nomeEmpresa}</strong> já está liberada.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
        <tr>
          <td style="padding: 12px 16px; background: #f1f5f9; border-radius: 12px 12px 0 0;">
            <span style="color: #64748b; font-size: 13px;">E-mail de acesso</span><br />
            <strong>${para}</strong>
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
        Guarde este e-mail — ainda não existe tela de "esqueci minha senha".
      </p>
    </div>
  `.trim();

  return enviar({ para, assunto: 'Seu acesso à Calculadora Ótica', html });
}
