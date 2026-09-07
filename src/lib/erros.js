// Erros de domínio. Todo erro lançado aqui vira uma resposta HTTP previsível
// no middleware de erro — nada de vazar stack trace para o cliente.

export class ErroHttp extends Error {
  constructor(status, mensagem, detalhes = undefined, codigo = undefined) {
    super(mensagem);
    this.name = 'ErroHttp';
    this.status = status;
    this.detalhes = detalhes;
    this.codigo = codigo;
  }
}

export const erroRequisicao = (msg, detalhes) => new ErroHttp(400, msg, detalhes, 'REQUISICAO_INVALIDA');
export const erroNaoAutenticado = (msg = 'Não autenticado') => new ErroHttp(401, msg, undefined, 'NAO_AUTENTICADO');

export const erroSessaoExpirada = (expiradoEm) =>
  new ErroHttp(
    401,
    'Sua sessão expirou. Faça login novamente para continuar.',
    expiradoEm ? { expiradoEm: new Date(expiradoEm).toISOString() } : undefined,
    'SESSAO_EXPIRADA',
  );

export const erroSemPermissao = (msg = 'Sem permissão para esta ação') =>
  new ErroHttp(403, msg, undefined, 'SEM_PERMISSAO');

export const erroNaoEncontrado = (recurso = 'Registro') => {
  const feminino = /a$/i.test(recurso.trim().split(' ').pop());
  return new ErroHttp(404, `${recurso} não ${feminino ? 'encontrada' : 'encontrado'}`, undefined, 'NAO_ENCONTRADO');
};

export const erroConflito = (msg, detalhes) => new ErroHttp(409, msg, detalhes, 'CONFLITO');
export const erroRegraNegocio = (msg, detalhes) => new ErroHttp(422, msg, detalhes, 'REGRA_NEGOCIO');
