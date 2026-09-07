import { Router } from 'express';
import { repositorioOrcamentos } from '../../lib/repositorioOrcamentos.js';
import { erroNaoEncontrado } from '../../lib/erros.js';
import { validarCorpo, validarParams } from '../../middleware/validar.js';
import { rota } from '../../middleware/erro.js';
import { calcularOrcamento, calcularMargem } from './calculo.js';
import { criarOrcamentoSchema, idParamSchema } from './orcamentos.schema.js';
import { SUGESTOES_TIPO_LENTE, SUGESTOES_TRATAMENTO } from './catalogo.js';

export const rotasOrcamentos = Router();

/// Remove custo/margem de quem não é ADMIN — informação de rentabilidade não
/// é do vendedor. Aplicado em toda resposta que devolve um orçamento, não só
/// na criação: sem isto, um GET /orcamentos/:id feito por um VENDEDOR
/// vazaria a margem de uma venda que ele nem lançou com custos.
function paraPapel(orcamento, papel) {
  if (papel === 'ADMIN') return orcamento;
  const { custos: _custos, margem: _margem, ...resto } = orcamento;
  return resto;
}

/// Sugestões para o formulário — ver catalogo.js sobre por que não há preço
/// fixo aqui.
rotasOrcamentos.get('/catalogo', (_req, res) => {
  res.json({ tiposLente: SUGESTOES_TIPO_LENTE, tratamentos: SUGESTOES_TRATAMENTO });
});

rotasOrcamentos.post(
  '/orcamentos',
  validarCorpo(criarOrcamentoSchema),
  rota(async (req, res) => {
    const { cliente, armacao, lente, tratamentos, desconto, parcelas, observacoes } = req.body;
    const ehAdmin = req.usuario.papel === 'ADMIN';
    const custos = ehAdmin ? req.body.custos : undefined;

    const resultado = calcularOrcamento({ armacao, lente, tratamentos, desconto, parcelas });
    const margem = custos ? calcularMargem({ vendaTotal: resultado.total, custos }) : undefined;

    const orcamento = await repositorioOrcamentos.criar(
      req.usuario.empresaId,
      { cliente, armacao, lente, tratamentos, desconto, observacoes, ...resultado, custos, margem },
      req.usuario,
    );

    res.status(201).json(paraPapel(orcamento, req.usuario.papel));
  }),
);

rotasOrcamentos.get(
  '/orcamentos',
  rota(async (req, res) => {
    const orcamentos = await repositorioOrcamentos.listarPorEmpresa(req.usuario.empresaId);
    res.json(orcamentos.map((o) => paraPapel(o, req.usuario.papel)));
  }),
);

rotasOrcamentos.get(
  '/orcamentos/:id',
  validarParams(idParamSchema),
  rota(async (req, res) => {
    const orcamento = await repositorioOrcamentos.buscarPorId(req.usuario.empresaId, req.params.id);
    if (!orcamento) throw erroNaoEncontrado('Orçamento');
    res.json(paraPapel(orcamento, req.usuario.papel));
  }),
);
