// Tela única: formulário de orçamento à esquerda, resultado + histórico à
// direita. Fase 1 não tem tela separada para isso — a ótica calcula, salva e
// já vê o histórico sem trocar de página.
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../lib/autenticacao.jsx';
import { useTema } from '../lib/tema.jsx';
import { api, ErroApi } from '../lib/api.js';
import { formatarMoeda, formatarDataHora } from '../lib/formato.js';
import { Erro, Carregando, Marca, Girando } from '../componentes/Ui.jsx';
import { IconeSol, IconeLua, IconeSair, IconeMais, IconeLixeira, IconeHistorico, IconeCheck } from '../componentes/Icones.jsx';

const ITEM_VAZIO = { nome: '', valor: '' };
const LENTE_VAZIA = { tipo: '', nome: '', valor: '' };

function numero(valor) {
  const n = Number(String(valor).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

export default function Calculadora() {
  const { usuario, sair } = useAuth();
  const { tema, alternar } = useTema();

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
                    <span className="shrink-0 font-semibold">{formatarMoeda(o.total)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </main>
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
