// Tratamento central de erro. Converte erros do domínio em respostas HTTP
// consistentes: { erro: { codigo, mensagem, detalhes } }.
import { ErroHttp } from '../lib/erros.js';
import { logger } from '../lib/logger.js';
import { ehProducao } from '../config/env.js';

export function rotaNaoEncontrada(req, res) {
  res.status(404).json({
    erro: { codigo: 'ROTA_NAO_ENCONTRADA', mensagem: `Rota ${req.method} ${req.originalUrl} não existe` },
  });
}

// eslint-disable-next-line no-unused-vars
export function tratadorDeErro(erro, req, res, _proximo) {
  if (erro instanceof ErroHttp) {
    return res.status(erro.status).json({
      erro: { codigo: erro.codigo ?? 'ERRO', mensagem: erro.message, detalhes: erro.detalhes },
    });
  }

  if (erro?.type === 'entity.parse.failed') {
    return res.status(400).json({
      erro: { codigo: 'JSON_INVALIDO', mensagem: 'Corpo da requisição não é um JSON válido' },
    });
  }

  logger.error(`Erro não tratado em ${req.method} ${req.originalUrl}`, erro);

  res.status(500).json({
    erro: {
      codigo: 'ERRO_INTERNO',
      mensagem: 'Erro interno no servidor',
      detalhes: ehProducao ? undefined : { mensagem: erro?.message, stack: erro?.stack?.split('\n').slice(0, 5) },
    },
  });
}

/// Envolve handler async para que qualquer throw caia no tratador acima
/// (Express 4 não captura rejeição de Promise sozinho).
export const rota = (handler) => (req, res, proximo) =>
  Promise.resolve(handler(req, res, proximo)).catch(proximo);
