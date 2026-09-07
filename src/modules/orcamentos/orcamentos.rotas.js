import { Router } from 'express';
import { repositorioOrcamentos } from '../../lib/repositorioOrcamentos.js';
import { erroNaoEncontrado } from '../../lib/erros.js';
import { validarCorpo, validarParams } from '../../middleware/validar.js';
import { rota } from '../../middleware/erro.js';
import { calcularOrcamento } from './calculo.js';
import { criarOrcamentoSchema, idParamSchema } from './orcamentos.schema.js';
import { SUGESTOES_TIPO_LENTE, SUGESTOES_TRATAMENTO } from './catalogo.js';

export const rotasOrcamentos = Router();

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

    const resultado = calcularOrcamento({ armacao, lente, tratamentos, desconto, parcelas });

    const orcamento = await repositorioOrcamentos.criar(
      req.usuario.empresaId,
      { cliente, armacao, lente, tratamentos, desconto, observacoes, ...resultado },
      req.usuario,
    );

    res.status(201).json(orcamento);
  }),
);

rotasOrcamentos.get(
  '/orcamentos',
  rota(async (req, res) => {
    const orcamentos = await repositorioOrcamentos.listarPorEmpresa(req.usuario.empresaId);
    res.json(orcamentos);
  }),
);

rotasOrcamentos.get(
  '/orcamentos/:id',
  validarParams(idParamSchema),
  rota(async (req, res) => {
    const orcamento = await repositorioOrcamentos.buscarPorId(req.usuario.empresaId, req.params.id);
    if (!orcamento) throw erroNaoEncontrado('Orçamento');
    res.json(orcamento);
  }),
);
