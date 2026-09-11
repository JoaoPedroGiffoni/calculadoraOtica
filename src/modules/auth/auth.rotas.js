import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { env } from '../../config/env.js';
import { repositorioUsuarios } from '../../lib/repositorioUsuarios.js';
import { enviarEmailRecuperacao } from '../../lib/email.js';
import { gerarSenha } from '../../lib/senha.js';
import { logger } from '../../lib/logger.js';
import { erroNaoAutenticado, erroAssinaturaInativa } from '../../lib/erros.js';

const STATUS_BLOQUEIA_ACESSO = new Set(['inadimplente', 'cancelado']);
import { assinarToken, autenticar } from '../../middleware/autenticacao.js';
import { validarCorpo } from '../../middleware/validar.js';
import { rota } from '../../middleware/erro.js';
import { loginSchema, recuperarSenhaSchema } from './auth.schema.js';

export const rotasAuth = Router();

// Rate limit dedicado ao login: dificulta força bruta sem atrapalhar o uso
// normal do sistema.
const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    erro: {
      codigo: 'MUITAS_TENTATIVAS',
      mensagem: 'Muitas tentativas de login. Tente novamente em alguns minutos.',
    },
  },
});

// Rate limit dedicado à recuperação de senha: cada pedido dispara um envio
// de e-mail (custo real no Resend), então o limite é mais apertado que o do
// login.
const limiteRecuperacao = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    erro: {
      codigo: 'MUITAS_TENTATIVAS',
      mensagem: 'Muitos pedidos de recuperação. Tente novamente em alguns minutos.',
    },
  },
});

rotasAuth.post(
  '/login',
  limiteLogin,
  validarCorpo(loginSchema),
  rota(async (req, res) => {
    const { email, senha } = req.body;

    const usuario = await repositorioUsuarios.buscarPorEmail(email);

    // Mensagem genérica de propósito: não revela se o e-mail existe.
    const credenciaisInvalidas = erroNaoAutenticado('E-mail ou senha inválidos');

    if (!usuario || !usuario.ativo) throw credenciaisInvalidas;

    const confere = await bcrypt.compare(senha, usuario.senhaHash);
    if (!confere) throw credenciaisInvalidas;

    const empresa = await repositorioUsuarios.buscarEmpresa(usuario.empresaId);
    if (empresa && STATUS_BLOQUEIA_ACESSO.has(empresa.status)) throw erroAssinaturaInativa(empresa.status);

    const { token, expiraEm } = assinarToken(usuario);

    res.json({
      token,
      expiraEm,
      usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, empresaId: usuario.empresaId },
      empresa: empresa ? { id: empresa.id, nome: empresa.nome, status: empresa.status } : null,
    });
  }),
);

/// Gera uma senha nova e reenvia o acesso por e-mail — recuperação para
/// quem nunca recebeu (ou perdeu) o e-mail original de acesso (ver
/// pagamentos.rotas.js). Resposta sempre genérica e sempre 200, exista ou
/// não o e-mail: não dá pra essa rota revelar quais e-mails têm conta.
rotasAuth.post(
  '/recuperar-senha',
  limiteRecuperacao,
  validarCorpo(recuperarSenhaSchema),
  rota(async (req, res) => {
    const { email } = req.body;
    const resposta = { mensagem: 'Se esse e-mail tiver uma conta, enviamos uma nova senha para ele.' };

    const usuario = await repositorioUsuarios.buscarPorEmail(email);
    if (!usuario || !usuario.ativo) return res.json(resposta);

    const empresa = await repositorioUsuarios.buscarEmpresa(usuario.empresaId);
    if (empresa && STATUS_BLOQUEIA_ACESSO.has(empresa.status)) return res.json(resposta);

    const senha = gerarSenha();

    // Manda o e-mail ANTES de trocar a senha no banco: se o envio falhar, a
    // senha antiga continua valendo (em vez de trocar pra uma senha nova que
    // a pessoa nunca recebeu e ficar sem nenhuma que funcione).
    try {
      await enviarEmailRecuperacao({ para: usuario.email, nomeEmpresa: empresa?.nome ?? usuario.nome, senha, urlBase: env.URL_BASE });
    } catch (erro) {
      logger.error(`Pedido de recuperação de ${usuario.email}: e-mail falhou, senha antiga mantida.`, erro?.message);
      return res.json(resposta);
    }

    await repositorioUsuarios.atualizarSenha(usuario.id, await bcrypt.hash(senha, 10));
    res.json(resposta);
  }),
);

rotasAuth.post(
  '/renovar',
  autenticar,
  rota(async (req, res) => {
    const { token, expiraEm } = assinarToken(req.usuario);
    res.json({ token, expiraEm, usuario: req.usuario });
  }),
);

rotasAuth.get(
  '/eu',
  autenticar,
  rota(async (req, res) => {
    const empresa = await repositorioUsuarios.buscarEmpresa(req.usuario.empresaId);
    res.json({ ...req.usuario, empresa: empresa ? { id: empresa.id, nome: empresa.nome, status: empresa.status } : null });
  }),
);
