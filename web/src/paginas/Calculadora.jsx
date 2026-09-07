// Tela única: formulário de orçamento à esquerda, resultado + histórico à
// direita. Fase 1 não tem tela separada para isso — a ótica calcula, salva e
// já vê o histórico sem trocar de página.
//
// Quem é ADMIN ganha uma seção a mais (fechada por padrão): custo da venda e
// margem de contribuição — informação que o vendedor não vê, nem aqui nem no
// histórico (o servidor já tira `custos`/`margem` da resposta para quem não
// é ADMIN — ver src/modules/orcamentos/orcamentos.rotas.js#paraPapel; aqui é
// só reforço de UI, não a barreira de verdade).
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../lib/autenticacao.jsx';
import { useTema } from '../lib/tema.jsx';
import { api, ErroApi } from '../lib/api.js';
import { formatarMoeda, formatarDataHora } from '../lib/formato.js';
import {
  calcularOrcamento, calcularMargem, resolverCmvLente, resolverCustoFinanceiro, resolverComissao,
  configuracaoCustosPadrao,
} from '../lib/calculo.js';
import { Erro, Carregando, Marca, Girando, SeloMargem } from '../componentes/Ui.jsx';
import ConfiguracaoCustosModal from '../componentes/ConfiguracaoCustosModal.jsx';
import {
  IconeSol, IconeLua, IconeSair, IconeMais, IconeLixeira, IconeHistorico, IconeCheck,
  IconeEngrenagem, IconeGrafico,
} from '../componentes/Icones.jsx';

const ITEM_VAZIO = { nome: '', valor: '' };
const LENTE_VAZIA = { tipo: '', nome: '', valor: '' };
const CUSTOS_VAZIOS = {
  cmvArmacao: '0', cmvLente: '0', custoTratamentos: '0', custoFinanceiro: '0',
  custoExameVista: '0', comissaoVendedor: '0', custoGarantia: '0', custoEmbalagem: '0',
};

function numero(valor) {
  const n = Number(String(valor).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function custosParaNumeros(custos) {
  return Object.fromEntries(Object.entries(custos).map(([k, v]) => [k, numero(v)]));
}

export default function Calculadora() {
  const { usuario, sair } = useAuth();
  const { tema, alternar } = useTema();
  const ehAdmin = usuario.papel === 'ADMIN';

  const [catalogo, setCatalogo] = useState({ tiposLente: [], tratamentos: [] });
  const [historico, setHistorico] = useState([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(true);

  const [cliente, setCliente] = useState('');
  const [armacao, setArmacao] = useState(ITEM_VAZIO);
  const [lente, setLente] = useState(LENTE_VAZIA);
  const [tratamentos, setTratamentos] = useState([]);
  const [descontoTipo, setDescontoTipo] = useState('percentual');
  const [descontoValor, setDescontoValor] = useState('0');
  const [parcelas, setParcelas] = useState(1);
  const [observacoes, setObservacoes] = useState('');

  // --- Custos e margem (só ADMIN) ---
  const [configCustos, setConfigCustos] = useState(configuracaoCustosPadrao());
  const [mostrarConfig, setMostrarConfig] = useState(false);
  const [mostrarCustos, setMostrarCustos] = useState(false);
  const [custos, setCustos] = useState(CUSTOS_VAZIOS);
  const [custosTocados, setCustosTocados] = useState(new Set());

  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const carregarHistorico = useCallback(async () => {
    try {
      const lista = await api.get('/orcamentos');
      setHistorico(lista);
    } catch {
      // Histórico é secundário à calculadora — falha aqui não impede o uso.
    } finally {
      setCarregandoHistorico(false);
    }
  }, []);

  useEffect(() => {
    api.get('/catalogo').then(setCatalogo).catch(() => {});
    carregarHistorico();
  }, [carregarHistorico]);

  useEffect(() => {
    if (!ehAdmin) return;
    api.get('/configuracoes/custos').then(setConfigCustos).catch(() => {});
  }, [ehAdmin]);

  // Pré-preenche os custos que dá para deduzir (CMV da lente, financeiro do
  // parcelamento, comissão, e os fixos do cadastro), sem sobrescrever o que o
  // ADMIN já mexeu à mão nesta venda (ver custosTocados).
  const previa = calcularOrcamento({
    armacao: { valor: numero(armacao.valor) },
    lente: { valor: numero(lente.valor) },
    tratamentos: tratamentos.map((t) => ({ valor: numero(t.valor) })),
    desconto: { tipo: descontoTipo, valor: numero(descontoValor) },
    parcelas: numero(parcelas) || 1,
  });

  useEffect(() => {
    if (!ehAdmin || !mostrarCustos) return;
    setCustos((c) => ({
      ...c,
      cmvLente: custosTocados.has('cmvLente') ? c.cmvLente : String(resolverCmvLente(lente.tipo, previa.total, configCustos)),
      custoFinanceiro: custosTocados.has('custoFinanceiro')
        ? c.custoFinanceiro
        : String(resolverCustoFinanceiro(numero(parcelas) || 1, previa.total, configCustos)),
      comissaoVendedor: custosTocados.has('comissaoVendedor') ? c.comissaoVendedor : String(resolverComissao(previa.total, configCustos)),
      custoExameVista: custosTocados.has('custoExameVista') ? c.custoExameVista : String(configCustos.custoExameVista ?? 0),
      custoGarantia: custosTocados.has('custoGarantia') ? c.custoGarantia : String(configCustos.custoGarantia ?? 0),
      custoEmbalagem: custosTocados.has('custoEmbalagem') ? c.custoEmbalagem : String(configCustos.custoEmbalagem ?? 0),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ehAdmin, mostrarCustos, configCustos, lente.tipo, previa.total, parcelas]);

  const previaMargem = mostrarCustos ? calcularMargem({ vendaTotal: previa.total, custos: custosParaNumeros(custos) }) : null;

  function editarCusto(chave, valor) {
    setCustos((c) => ({ ...c, [chave]: valor }));
    setCustosTocados((t) => new Set(t).add(chave));
  }

  function adicionarTratamento() {
    setTratamentos((lista) => [...lista, { ...ITEM_VAZIO }]);
  }

  function atualizarTratamento(indice, campo, valor) {
    setTratamentos((lista) => lista.map((t, i) => (i === indice ? { ...t, [campo]: valor } : t)));
  }

  function removerTratamento(indice) {
    setTratamentos((lista) => lista.filter((_, i) => i !== indice));
  }

  function limparFormulario() {
    setCliente('');
    setArmacao(ITEM_VAZIO);
    setLente(LENTE_VAZIA);
    setTratamentos([]);
    setDescontoTipo('percentual');
    setDescontoValor('0');
    setParcelas(1);
    setObservacoes('');
    setCustos(CUSTOS_VAZIOS);
    setCustosTocados(new Set());
    setMostrarCustos(false);
  }

  async function aoSubmeter(evento) {
    evento.preventDefault();
    setErro(null);
    setEnviando(true);

    const payload = {
      cliente,
      armacao: { nome: armacao.nome, valor: numero(armacao.valor) },
      lente: { tipo: lente.tipo, nome: lente.nome || lente.tipo, valor: numero(lente.valor) },
      tratamentos: tratamentos
        .filter((t) => t.nome.trim())
        .map((t) => ({ nome: t.nome, valor: numero(t.valor) })),
      desconto: { tipo: descontoTipo, valor: numero(descontoValor) },
      parcelas: numero(parcelas) || 1,
      observacoes: observacoes || undefined,
      ...(ehAdmin && mostrarCustos ? { custos: custosParaNumeros(custos) } : {}),
    };

    try {
      const criado = await api.post('/orcamentos', payload);
      setResultado(criado);
      setHistorico((lista) => [criado, ...lista]);
      limparFormulario();
    } catch (e) {
      setErro(e instanceof ErroApi ? e : new ErroApi('Falha ao calcular o orçamento', 0));
    } finally {
      setEnviando(false);
    }
  }

  async function salvarConfigCustos(novoConfig) {
    const salvo = await api.put('/configuracoes/custos', novoConfig);
    setConfigCustos(salvo);
  }

  return (
    <div className="min-h-dvh bg-slate-100 pb-16 dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Marca tamanho="pequeno" />
          <div className="flex items-center gap-1.5">
            <div className="mr-2 hidden text-right sm:block">
              <p className="text-sm font-medium leading-tight">{usuario.nome}</p>
              <p className="text-xs leading-tight text-slate-500 dark:text-slate-400">{usuario.empresa?.nome}</p>
            </div>
            {ehAdmin && (
              <button
                type="button"
                onClick={() => setMostrarConfig(true)}
                className="botao-icone"
                aria-label="Custos padrão"
                title="Custos padrão"
              >
                <IconeEngrenagem />
              </button>
            )}
            <button
              type="button"
              onClick={alternar}
              className="botao-icone"
              aria-label="Alternar tema"
              title={tema === 'escuro' ? 'Tema claro' : 'Tema escuro'}
            >
              {tema === 'escuro' ? <IconeSol /> : <IconeLua />}
            </button>
            <button type="button" onClick={sair} className="botao-icone" aria-label="Sair" title="Sair">
              <IconeSair />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1.2fr_1fr]">
        {/* --- Formulário --- */}
        <form onSubmit={aoSubmeter} className="cartao animate-entra-baixo space-y-5 p-5 sm:p-6">
          <h2 className="text-base font-bold">Novo orçamento</h2>

          <div>
            <label className="rotulo" htmlFor="cliente">Cliente</label>
            <input
              id="cliente"
              className="campo"
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              placeholder="Nome do cliente"
              required
            />
          </div>

          <fieldset className="space-y-2 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
            <legend className="px-1 text-sm font-semibold">Armação</legend>
            <div className="grid grid-cols-[1fr_9rem] gap-2">
              <input
                className="campo"
                placeholder="Modelo (ex.: Ray-Ban RB2132)"
                value={armacao.nome}
                onChange={(e) => setArmacao((a) => ({ ...a, nome: e.target.value }))}
                required
              />
              <input
                className="campo"
                type="number"
                min="0"
                step="0.01"
                placeholder="R$"
                value={armacao.valor}
                onChange={(e) => setArmacao((a) => ({ ...a, valor: e.target.value }))}
                required
              />
            </div>
          </fieldset>

          <fieldset className="space-y-2 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
            <legend className="px-1 text-sm font-semibold">Lente</legend>
            <div className="grid grid-cols-[1fr_9rem] gap-2">
              <input
                className="campo"
                list="tipos-lente"
                placeholder="Tipo (ex.: Multifocal)"
                value={lente.tipo}
                onChange={(e) => setLente((l) => ({ ...l, tipo: e.target.value }))}
                required
              />
              <input
                className="campo"
                type="number"
                min="0"
                step="0.01"
                placeholder="R$"
                value={lente.valor}
                onChange={(e) => setLente((l) => ({ ...l, valor: e.target.value }))}
                required
              />
            </div>
            <datalist id="tipos-lente">
              {catalogo.tiposLente.map((t) => <option key={t} value={t} />)}
            </datalist>
          </fieldset>

          <fieldset className="space-y-2 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
            <legend className="px-1 text-sm font-semibold">Tratamentos</legend>
            {tratamentos.length === 0 && (
              <p className="text-xs text-slate-400 dark:text-slate-500">Nenhum tratamento adicionado.</p>
            )}
            <div className="space-y-2">
              {tratamentos.map((t, i) => (
                <div key={i} className="grid grid-cols-[1fr_7rem_auto] gap-2">
                  <input
                    className="campo"
                    list="tratamentos-sugeridos"
                    placeholder="Ex.: Antirreflexo"
                    value={t.nome}
                    onChange={(e) => atualizarTratamento(i, 'nome', e.target.value)}
                  />
                  <input
                    className="campo"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="R$"
                    value={t.valor}
                    onChange={(e) => atualizarTratamento(i, 'valor', e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => removerTratamento(i)}
                    className="botao-icone"
                    aria-label="Remover tratamento"
                  >
                    <IconeLixeira tamanho={16} />
                  </button>
                </div>
              ))}
            </div>
            <datalist id="tratamentos-sugeridos">
              {catalogo.tratamentos.map((t) => <option key={t} value={t} />)}
            </datalist>
            <button type="button" onClick={adicionarTratamento} className="botao-secundario mt-1 text-xs">
              <IconeMais tamanho={14} /> Adicionar tratamento
            </button>
          </fieldset>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <label className="rotulo" htmlFor="desconto-tipo">Desconto</label>
              <select
                id="desconto-tipo"
                className="campo"
                value={descontoTipo}
                onChange={(e) => setDescontoTipo(e.target.value)}
              >
                <option value="percentual">%</option>
                <option value="valor">R$</option>
              </select>
            </div>
            <div>
              <label className="rotulo" htmlFor="desconto-valor">&nbsp;</label>
              <input
                id="desconto-valor"
                className="campo"
                type="number"
                min="0"
                step="0.01"
                value={descontoValor}
                onChange={(e) => setDescontoValor(e.target.value)}
              />
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

          <div>
            <label className="rotulo" htmlFor="observacoes">Observações (opcional)</label>
            <textarea
              id="observacoes"
              className="campo"
              rows={2}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
            />
          </div>

          {ehAdmin && (
            <fieldset className="space-y-3 rounded-xl border border-dashed border-marca/40 p-3">
              <legend className="flex items-center gap-1.5 px-1 text-sm font-semibold text-marca">
                <IconeGrafico tamanho={15} /> Custo e margem — só você vê
              </legend>

              {!mostrarCustos ? (
                <button type="button" onClick={() => setMostrarCustos(true)} className="botao-secundario w-full text-xs">
                  <IconeMais tamanho={14} /> Lançar custos desta venda
                </button>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <CampoCusto rotulo="CMV armação" valor={custos.cmvArmacao} aoMudar={(v) => editarCusto('cmvArmacao', v)} />
                    <CampoCusto rotulo="CMV lente" valor={custos.cmvLente} aoMudar={(v) => editarCusto('cmvLente', v)} />
                    <CampoCusto rotulo="Custo tratamentos" valor={custos.custoTratamentos} aoMudar={(v) => editarCusto('custoTratamentos', v)} />
                    <CampoCusto rotulo="Custo financeiro" valor={custos.custoFinanceiro} aoMudar={(v) => editarCusto('custoFinanceiro', v)} />
                    <CampoCusto rotulo="Exame de vista" valor={custos.custoExameVista} aoMudar={(v) => editarCusto('custoExameVista', v)} />
                    <CampoCusto rotulo="Comissão vendedor" valor={custos.comissaoVendedor} aoMudar={(v) => editarCusto('comissaoVendedor', v)} />
                    <CampoCusto rotulo="Garantia / GMT" valor={custos.custoGarantia} aoMudar={(v) => editarCusto('custoGarantia', v)} />
                    <CampoCusto rotulo="Embalagem" valor={custos.custoEmbalagem} aoMudar={(v) => editarCusto('custoEmbalagem', v)} />
                  </div>

                  {previaMargem && (
                    <SeloMargem margemRs={previaMargem.margemRs} margemPercentual={previaMargem.margemPercentual} />
                  )}

                  <button type="button" onClick={() => { setMostrarCustos(false); setCustos(CUSTOS_VAZIOS); setCustosTocados(new Set()); }} className="text-xs text-slate-400 underline underline-offset-2 hover:text-slate-600 dark:hover:text-slate-300">
                    Remover custos desta venda
                  </button>
                </>
              )}
            </fieldset>
          )}

          <Erro mensagem={erro?.message} detalhes={erro?.detalhes} />

          <button type="submit" className="botao-primario w-full" disabled={enviando}>
            {enviando && <Girando tamanho={16} />}
            {enviando ? 'Calculando...' : 'Calcular e salvar orçamento'}
          </button>
        </form>

        {/* --- Resultado + histórico --- */}
        <div className="space-y-6">
          {resultado && (
            <div className="cartao animate-entra-baixo space-y-3 border-marca/30 p-5 sm:p-6">
              <div className="flex items-center gap-2 text-marca">
                <IconeCheck tamanho={18} />
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Orçamento salvo</h2>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">{resultado.cliente}</p>
              <dl className="space-y-1.5 text-sm">
                <Linha rotulo="Subtotal" valor={formatarMoeda(resultado.subtotal)} />
                <Linha rotulo="Desconto" valor={`- ${formatarMoeda(resultado.valorDesconto)}`} />
                <Linha rotulo="Total" valor={formatarMoeda(resultado.total)} destaque />
                {resultado.parcelas > 1 && (
                  <Linha rotulo={`${resultado.parcelas}x de`} valor={formatarMoeda(resultado.valorParcela)} />
                )}
              </dl>
              {resultado.margem && (
                <SeloMargem margemRs={resultado.margem.margemRs} margemPercentual={resultado.margem.margemPercentual} />
              )}
            </div>
          )}

          <div className="cartao animate-entra-baixo p-5 sm:p-6">
            <h2 className="mb-3 flex items-center gap-2 text-base font-bold">
              <IconeHistorico tamanho={18} /> Histórico
            </h2>

            {carregandoHistorico ? (
              <Carregando texto="Carregando histórico..." />
            ) : historico.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500">Nenhum orçamento ainda.</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {historico.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{o.cliente}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {formatarDataHora(o.criadoEm)} · {o.criadoPorNome}
                      </p>
                    </div>
                    <div className="shrink-0 space-y-1 text-right">
                      <p className="font-semibold">{formatarMoeda(o.total)}</p>
                      {o.margem && (
                        <SeloMargem margemRs={o.margem.margemRs} margemPercentual={o.margem.margemPercentual} compacto />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </main>

      {mostrarConfig && (
        <ConfiguracaoCustosModal config={configCustos} aoFechar={() => setMostrarConfig(false)} aoSalvar={salvarConfigCustos} />
      )}
    </div>
  );
}

function Linha({ rotulo, valor, destaque = false }) {
  return (
    <div className="flex items-center justify-between">
      <dt className={destaque ? 'font-semibold' : 'text-slate-500 dark:text-slate-400'}>{rotulo}</dt>
      <dd className={destaque ? 'text-lg font-bold text-marca' : 'font-medium'}>{valor}</dd>
    </div>
  );
}

function CampoCusto({ rotulo, valor, aoMudar }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">{rotulo}</label>
      <input
        type="number"
        min="0"
        step="0.01"
        className="campo py-1.5 text-sm"
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
      />
    </div>
  );
}
