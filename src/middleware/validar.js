// Validação de entrada com Zod. O schema valida e JÁ normaliza (coerce de
// número, trim de string), então o controller recebe dado limpo e confiável.
import { ErroHttp } from '../lib/erros.js';

function aplicar(schema, dado, origem) {
  const resultado = schema.safeParse(dado);
  if (resultado.success) return resultado.data;

  const detalhes = resultado.error.issues.map((i) => ({
    campo: i.path.join('.') || origem,
    mensagem: i.message,
  }));
  throw new ErroHttp(400, 'Dados inválidos', detalhes, 'VALIDACAO');
}

export const validarCorpo = (schema) => (req, _res, proximo) => {
  try {
    req.body = aplicar(schema, req.body ?? {}, 'body');
    proximo();
  } catch (e) {
    proximo(e);
  }
};

export const validarParams = (schema) => (req, _res, proximo) => {
  try {
    req.params = aplicar(schema, req.params ?? {}, 'params');
    proximo();
  } catch (e) {
    proximo(e);
  }
};
