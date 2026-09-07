// Autenticação via JWT. TODA rota de /api (exceto login e healthcheck) passa
// por aqui — não existe endpoint de dados aberto.
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { repositorioUsuarios } from '../lib/repositorioUsuarios.js';
import { erroNaoAutenticado, erroSessaoExpirada, erroSemPermissao } from '../lib/erros.js';

/// Assina o token e devolve junto a data de expiração. O front usa esse
/// carimbo para avisar o usuário ANTES de a sessão cair.
export function assinarToken(usuario) {
  const token = jwt.sign(
    { sub: usuario.id, email: usuario.email, papel: usuario.papel, empresaId: usuario.empresaId },
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

    const { senhaHash: _senhaHash, ...usuarioSemSenha } = usuario;
    req.usuario = usuarioSemSenha;
    proximo();
  } catch (erro) {
    proximo(erro);
  }
}

/// Restringe a rota a determinados papéis.
export function exigirPapel(...papeis) {
  return (req, _res, proximo) => {
    if (!req.usuario) return proximo(erroNaoAutenticado());
    if (!papeis.includes(req.usuario.papel)) {
      return proximo(erroSemPermissao(`Ação restrita a: ${papeis.join(', ')}`));
    }
    proximo();
  };
}
