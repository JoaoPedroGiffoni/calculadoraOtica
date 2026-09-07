// Custos padrão da conta — usados para pré-preencher a calculadora de
// margem a cada cálculo novo. Não há papel/subconta neste produto (ver
// dadosMock.js): um login é um acesso vendido, e quem loga é dono dos
// próprios custos.
import { Router } from 'express';
import { repositorioConfiguracoes } from '../../lib/repositorioConfiguracoes.js';
import { validarCorpo } from '../../middleware/validar.js';
import { rota } from '../../middleware/erro.js';
import { configuracaoCustosSchema } from './configuracoes.schema.js';

export const rotasConfiguracoes = Router();

rotasConfiguracoes.get(
  '/configuracoes/custos',
  rota(async (req, res) => {
    res.json(await repositorioConfiguracoes.buscarCustos(req.usuario.empresaId));
  }),
);

rotasConfiguracoes.put(
  '/configuracoes/custos',
  validarCorpo(configuracaoCustosSchema),
  rota(async (req, res) => {
    res.json(await repositorioConfiguracoes.atualizarCustos(req.usuario.empresaId, req.body));
  }),
);
