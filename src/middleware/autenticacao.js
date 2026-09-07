// Autenticação via JWT. TODA rota de /api (exceto login e healthcheck) passa
// por aqui — não existe endpoint de dados aberto.
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { repositorioUsuarios } from '../lib/repositorioUsuarios.js';
import { erroNaoAutenticado, erroSessaoExpirada, erroAssinaturaInativa } from '../lib/erros.js';

const STATUS_BLOQUEIA_ACESSO = new Set(['inadimplente', 'cancelado']);

/// Assina o token e devolve junto a data de expiração. O front usa esse
/// carimbo para avisar o usuário ANTES de a sessão cair.
export function assinarToken(usuario) {
  const token = jwt.sign(
    { sub: usuario.id, email: usuario.email, empresaId: usuario.empresaId },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN },
  );
  const { exp } = jwt.decode(token);
  return { token, expiraEm: new Date(exp * 1000).toISOString() };
}

export async function autenticar(req, _res, proximo) {
  try {
    const cabecalho = req.headers.authorization ?? '';
    const [esquema, token] = cabecalho.split(' ');
    if (esquema !== 'Bearer' || !token) {
      throw erroNaoAutenticado('Envie o token no header Authorization: Bearer <token>');
    }

    let payload;
    try {
      payload = jwt.verify(token, env.JWT_SECRET);
    } catch (e) {
      if (e.name === 'TokenExpiredError') {
        const dono = jwt.decode(token)?.email ?? 'desconhecido';
        const minutos = Math.round((Date.now() - e.expiredAt.getTime()) / 60000);
        logger.warn(`Sessão expirada há ${minutos}min: ${dono} em ${req.method} ${req.originalUrl}`);
        throw erroSessaoExpirada(e.expiredAt);
      }
      logger.warn(`Token inválido em ${req.method} ${req.originalUrl}`);
      throw erroNaoAutenticado('Token inválido');
    }

    // Revalida contra o repositório: se o usuário foi desativado, o token
    // para de valer na hora, sem esperar expirar.
    const usuario = await repositorioUsuarios.buscarPorId(payload.sub);
    if (!usuario || !usuario.ativo) throw erroNaoAutenticado('Usuário inativo ou inexistente');

    // Mesma lógica pro lado da assinatura: se ficou inadimplente ou foi
    // cancelada enquanto a sessão estava aberta, corta o acesso na próxima
    // requisição — não espera o token expirar (até 7 dias).
    const empresa = await repositorioUsuarios.buscarEmpresa(usuario.empresaId);
    if (empresa && STATUS_BLOQUEIA_ACESSO.has(empresa.status)) throw erroAssinaturaInativa(empresa.status);

    const { senhaHash: _senhaHash, ...usuarioSemSenha } = usuario;
    req.usuario = usuarioSemSenha;
    proximo();
  } catch (erro) {
    proximo(erro);
  }
}
