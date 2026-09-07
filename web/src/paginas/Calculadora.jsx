// Calculadora de margem de contribuição — a ferramenta inteira, sem
// orçamento pro cliente e sem histórico (ver README): abre, calcula, mostra.
// Nada é salvo; o único dado que persiste é o cadastro de custos padrão
// (engrenagem no topo), que só serve para pré-preencher o cálculo seguinte.
import { useEffect, useState } from 'react';
import { useAuth } from '../lib/autenticacao.jsx';
import { useTema } from '../lib/tema.jsx';
import { api } from '../lib/api.js';
import { formatarMoeda } from '../lib/formato.js';
import {
  resolverCmvLente, resolverTaxaFinanceira, percentualParaReais, calcularMargem, configuracaoCustosPadrao,
} from '../lib/calculo.js';
import { Marca, SeloMargem } from '../componentes/Ui.jsx';
import ConfiguracaoCustosModal from '../componentes/ConfiguracaoCustosModal.jsx';
import { IconeSol, IconeLua, IconeSair, IconeEngrenagem } from '../componentes/Icones.jsx';

// Valores em R$, editados diretamente — sem regra pronta pra converter de
// outra coisa (CMV da armação e tratamentos vendidos variam venda a venda
// demais pra ter até um padrão sensato; os outros três vêm do cadastro).
const CUSTOS_VAZIOS = {
  cmvArmacao: '0', cmvLente: '0', custoTratamentos: '0', custoExameVista: '0', custoGarantia: '0', custoEmbalagem: '0',
};

// Valores em %: sempre uma fração do preço de venda, do jeito que aparecem
// no extrato/contrato de verdade (taxa da maquininha, comissão, imposto) —
// digitar em R$ direto exigiria fazer a conta de cabeça toda vez que o
// preço de venda mudasse.
const PERCENTUAIS_VAZIOS = { custoFinanceiro: '0', comissao: '0', impostos: '0' };

// Um array só, na ordem exata da fórmula (2 a 10) — renderizado numa grade
// de 2 colunas, então a ordem de leitura (linha a linha, esquerda pra
// direita) precisa bater com a numeração, senão vira "9, 10, 5, 7, 8" na
// tela e ninguém segue o raciocínio.
const CAMPOS = [
  { chave: 'cmvArmacao', rotulo: '2. CMV da armação', tipo: 'rs' },
  { chave: 'cmvLente', rotulo: '3. CMV da lente', tipo: 'rs' },
  { chave: 'custoTratamentos', rotulo: '4. Tratamentos / upgrades vendidos', tipo: 'rs' },
  { chave: 'custoFinanceiro', rotulo: '5. Custo financeiro do parcelamento (%)', tipo: 'percentual' },
  { chave: 'custoExameVista', rotulo: '6. Exame de vista', tipo: 'rs' },
  { chave: 'comissao', rotulo: '7. Comissão / premiação do vendedor (%)', tipo: 'percentual' },
  { chave: 'impostos', rotulo: '8. Impostos (%)', tipo: 'percentual' },
  { chave: 'custoGarantia', rotulo: '9. Garantia / proteção', tipo: 'rs' },
  { chave: 'custoEmbalagem', rotulo: '10. Embalagem / estojo', tipo: 'rs' },
];

/// Campos em R$ que o cadastro consegue deduzir sozinho (os em % sempre vêm
/// do cadastro — ver useEffect logo abaixo — por isso não precisam entrar
/// aqui).
const CAMPOS_RS_COM_PADRAO = new Set(['cmvLente', 'custoExameVista', 'custoGarantia', 'custoEmbalagem']);

function numero(valor) {
  const n = Number(String(valor).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function paraNumeros(objeto) {
  return Object.fromEntries(Object.entries(objeto).map(([k, v]) => [k, numero(v)]));
}

export default function Calculadora() {
  const { usuario, sair } = useAuth();
  const { tema, alternar } = useTema();

  const [configCustos, setConfigCustos] = useState(configuracaoCustosPadrao());
  const [mostrarConfig, setMostrarConfig] = useState(false);

  const [precoVenda, setPrecoVenda] = useState('');
  const [tipoLente, setTipoLente] = useState('multifocal');
  const [parcelas, setParcelas] = useState(1);

  const [custos, setCustos] = useState(CUSTOS_VAZIOS);
  const [custosTocados, setCustosTocados] = useState(new Set());

  const [percentuais, setPercentuais] = useState(PERCENTUAIS_VAZIOS);
  const [percentuaisTocados, setPercentuaisTocados] = useState(new Set());

  useEffect(() => {
    api.get('/configuracoes/custos').then(setConfigCustos).catch(() => {});
  }, []);

  const precoVendaNum = numero(precoVenda);
  const tipoLenteTexto = tipoLente === 'simples' ? 'Visão simples' : 'Multifocal';

  // Pré-preenche o que dá pra deduzir do cadastro (ver CAMPOS_RS_COM_PADRAO),
  // sem sobrescrever o que a pessoa já editou à mão neste cálculo.
  useEffect(() => {
    setCustos((c) => ({
      ...c,
      cmvLente: custosTocados.has('cmvLente') ? c.cmvLente : String(resolverCmvLente(tipoLenteTexto, precoVendaNum, configCustos)),
      custoExameVista: custosTocados.has('custoExameVista') ? c.custoExameVista : String(configCustos.custoExameVista ?? 0),
      custoGarantia: custosTocados.has('custoGarantia') ? c.custoGarantia : String(configCustos.custoGarantia ?? 0),
      custoEmbalagem: custosTocados.has('custoEmbalagem') ? c.custoEmbalagem : String(configCustos.custoEmbalagem ?? 0),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configCustos, tipoLenteTexto, precoVendaNum]);

  // Mesma ideia para os campos em %. Custo financeiro depende de quantas
  // parcelas foram escolhidas (a taxa da maquininha muda por parcela); os
  // outros dois são flat do cadastro.
  useEffect(() => {
    setPercentuais((p) => ({
      ...p,
      custoFinanceiro: percentuaisTocados.has('custoFinanceiro')
        ? p.custoFinanceiro
        : String(resolverTaxaFinanceira(numero(parcelas) || 1, configCustos)),
      comissao: percentuaisTocados.has('comissao') ? p.comissao : String(configCustos.comissaoPercentual ?? 0),
      impostos: percentuaisTocados.has('impostos') ? p.impostos : String(configCustos.impostosPercentual ?? 0),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configCustos, parcelas]);

  function editarCusto(chave, valor) {
    setCustos((c) => ({ ...c, [chave]: valor }));
    setCustosTocados((t) => new Set(t).add(chave));
  }

  function editarPercentual(chave, valor) {
    setPercentuais((p) => ({ ...p, [chave]: valor }));
    setPercentuaisTocados((t) => new Set(t).add(chave));
  }

  function limpar() {
    setPrecoVenda('');
    setTipoLente('multifocal');
    setParcelas(1);
    setCustos(CUSTOS_VAZIOS);
    setCustosTocados(new Set());
    setPercentuais(PERCENTUAIS_VAZIOS);
    setPercentuaisTocados(new Set());
  }

  async function salvarConfigCustos(novoConfig) {
    const salvo = await api.put('/configuracoes/custos', novoConfig);
    setConfigCustos(salvo);
  }

  const custoFinanceiroRs = percentualParaReais(percentuais.custoFinanceiro, precoVendaNum);
  const comissaoRs = percentualParaReais(percentuais.comissao, precoVendaNum);
  const impostosRs = percentualParaReais(percentuais.impostos, precoVendaNum);

  const margem = precoVendaNum > 0
    ? calcularMargem({
        precoVenda: precoVendaNum,
        custos: { ...paraNumeros(custos), custoFinanceiro: custoFinanceiroRs, comissaoVendedor: comissaoRs, impostos: impostosRs },
      })
    : null;

  const reaisPorPercentual = { custoFinanceiro: custoFinanceiroRs, comissao: comissaoRs, impostos: impostosRs };

  return (
    <div className="min-h-dvh bg-slate-100 pb-16 dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-3 sm:px-6">
          <Marca tamanho="pequeno" />
          <div className="flex items-center gap-1.5">
            <div className="mr-2 hidden text-right sm:block">
              <p className="text-sm font-medium leading-tight">{usuario.nome}</p>
              <p className="text-xs leading-tight text-slate-500 dark:text-slate-400">{usuario.empresa?.nome}</p>
            </div>
            <button type="button" onClick={() => setMostrarConfig(true)} className="botao-icone" aria-label="Custos padrão" title="Custos padrão">
              <IconeEngrenagem />
            </button>
            <button type="button" onClick={alternar} className="botao-icone" aria-label="Alternar tema" title={tema === 'escuro' ? 'Tema claro' : 'Tema escuro'}>
              {tema === 'escuro' ? <IconeSol /> : <IconeLua />}
            </button>
            <button type="button" onClick={sair} className="botao-icone" aria-label="Sair" title="Sair">
              <IconeSair />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 py-6 sm:px-6">
        <div className="cartao animate-entra-baixo space-y-5 p-5 sm:p-6">
          <div>
            <h2 className="text-base font-bold">Margem de contribuição</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">1. Preço de venda do óculos/combo, depois os custos.</p>
          </div>

          <div>
            <label className="rotulo" htmlFor="preco-venda">1. Preço de venda (R$)</label>
            <input
              id="preco-venda"
              className="campo text-lg font-semibold"
              type="number"
              min="0"
              step="0.01"
              placeholder="0,00"
              value={precoVenda}
              onChange={(e) => setPrecoVenda(e.target.value)}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="rotulo">Tipo de lente</label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setTipoLente('simples')}
                  className={tipoLente === 'simples' ? 'botao-primario text-xs' : 'botao-secundario text-xs'}
                >
                  Simples
                </button>
                <button
                  type="button"
                  onClick={() => setTipoLente('multifocal')}
                  className={tipoLente === 'multifocal' ? 'botao-primario text-xs' : 'botao-secundario text-xs'}
                >
                  Multifocal
                </button>
              </div>
            </div>
            <div>
              <label className="rotulo" htmlFor="parcelas">Parcelas</label>
              <input
                id="parcelas"
                className="campo"
                type="number"
                min="1"
                max="12"
                value={parcelas}
                onChange={(e) => setParcelas(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {CAMPOS.map(({ chave, rotulo, tipo }) =>
              tipo === 'rs' ? (
                <div key={chave}>
                  <label className="rotulo text-xs">{rotulo}</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="campo"
                    value={custos[chave]}
                    onChange={(e) => editarCusto(chave, e.target.value)}
                  />
                  {CAMPOS_RS_COM_PADRAO.has(chave) && !custosTocados.has(chave) && (
                    <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">pré-preenchido pelo cadastro</p>
                  )}
                </div>
              ) : (
                <div key={chave}>
                  <label className="rotulo text-xs">{rotulo}</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="campo pr-8"
                      value={percentuais[chave]}
                      onChange={(e) => editarPercentual(chave, e.target.value)}
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-400 dark:text-slate-500">%</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                    {!percentuaisTocados.has(chave) && 'pré-preenchido pelo cadastro · '}
                    = {formatarMoeda(reaisPorPercentual[chave])}
                  </p>
                </div>
              ),
            )}
          </div>

          {margem ? (
            <SeloMargem margemRs={margem.margemRs} margemPercentual={margem.margemPercentual} />
          ) : (
            <p className="rounded-lg bg-slate-100 px-3 py-2 text-center text-sm text-slate-400 dark:bg-slate-800 dark:text-slate-500">
              Preencha o preço de venda para calcular
            </p>
          )}

          <button type="button" onClick={limpar} className="botao-secundario w-full text-sm">
            Limpar e calcular outro
          </button>
        </div>
      </main>

      {mostrarConfig && (
        <ConfiguracaoCustosModal config={configCustos} aoFechar={() => setMostrarConfig(false)} aoSalvar={salvarConfigCustos} />
      )}
    </div>
  );
}
