// Custos padrão da empresa — só ADMIN acessa. É informação sensível (o
// vendedor não precisa saber o CMV nem a comissão de terceiros) e serve só
// para pré-preencher a seção de margem no formulário de orçamento.
import { Router } from 'express';
import { repositorioConfiguracoes } from '../../lib/repositorioConfiguracoes.js';
import { exigirPapel } from '../../middleware/autenticacao.js';
import { validarCorpo } from '../../middleware/validar.js';
import { rota } from '../../middleware/erro.js';
import { configuracaoCustosSchema } from './configuracoes.schema.js';

export const rotasConfiguracoes = Router();

rotasConfiguracoes.get(
  '/configuracoes/custos',
  exigirPapel('ADMIN'),
  rota(async (req, res) => {
    res.json(await repositorioConfiguracoes.buscarCustos(req.usuario.empresaId));
  }),
);

rotasConfiguracoes.put(
  '/configuracoes/custos',
  exigirPapel('ADMIN'),
  validarCorpo(configuracaoCustosSchema),
  rota(async (req, res) => {
    res.json(await repositorioConfiguracoes.atualizarCustos(req.usuario.empresaId, req.body));
  }),
);
