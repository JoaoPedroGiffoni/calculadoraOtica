import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { repositorioUsuarios } from '../../lib/repositorioUsuarios.js';
import { erroNaoAutenticado } from '../../lib/erros.js';
import { assinarToken, autenticar } from '../../middleware/autenticacao.js';
import { validarCorpo } from '../../middleware/validar.js';
import { rota } from '../../middleware/erro.js';
import { loginSchema } from './auth.schema.js';

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

    const { token, expiraEm } = assinarToken(usuario);

    res.json({
      token,
      expiraEm,
      usuario: {
        id: usuario.id, nome: usuario.nome, email: usuario.email, papel: usuario.papel,
        empresaId: usuario.empresaId,
      },
      empresa: empresa ? { id: empresa.id, nome: empresa.nome, status: empresa.status } : null,
    });
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
