// Custos padrão da conta. Editar aqui só muda o que pré-preenche o próximo
// cálculo — nada é salvo/histórico, então não existe "cálculo antigo" para
// atualizar retroativamente.
import { useState } from 'react';
import { Erro, Girando } from './Ui.jsx';
import { IconeX } from './Icones.jsx';

export default function ConfiguracaoCustosModal({ config, aoFechar, aoSalvar }) {
  const [local, setLocal] = useState(config);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  function campo(chave, valor) {
    setLocal((c) => ({ ...c, [chave]: valor }));
  }

  function parcela(indice, valor) {
    setLocal((c) => ({
      ...c,
      taxaMaquininhaPorParcela: c.taxaMaquininhaPorParcela.map((p, i) =>
        i === indice ? { ...p, percentual: valor } : p,
      ),
    }));
  }

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      await aoSalvar(local);
      aoFechar();
    } catch (e) {
      setErro(e);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className="cartao w-full max-w-lg animate-entra-baixo space-y-5 p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold">Custos padrão</h2>
          <button type="button" onClick={aoFechar} className="botao-icone" aria-label="Fechar">
            <IconeX tamanho={18} />
          </button>
        </div>
        <p className="-mt-3 text-xs text-slate-500 dark:text-slate-400">
          Pré-preenche a calculadora a cada cálculo novo. Cada venda ainda pode ajustar na hora.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <CampoNumero rotulo="CMV lente simples (R$)" valor={local.cmvLenteSimples} aoMudar={(v) => campo('cmvLenteSimples', v)} />
          <CampoNumero rotulo="CMV lente multifocal (% do ticket)" valor={local.cmvLentePercentual} aoMudar={(v) => campo('cmvLentePercentual', v)} />
          <CampoNumero rotulo="Exame de vista (R$)" valor={local.custoExameVista} aoMudar={(v) => campo('custoExameVista', v)} />
          <CampoNumero rotulo="Garantia / GMT (R$)" valor={local.custoGarantia} aoMudar={(v) => campo('custoGarantia', v)} />
          <CampoNumero rotulo="Embalagem (R$)" valor={local.custoEmbalagem} aoMudar={(v) => campo('custoEmbalagem', v)} />
          <CampoNumero rotulo="Comissão do vendedor (%)" valor={local.comissaoPercentual} aoMudar={(v) => campo('comissaoPercentual', v)} />
          <CampoNumero rotulo="Impostos (%)" valor={local.impostosPercentual} aoMudar={(v) => campo('impostosPercentual', v)} />
        </div>

        <div>
          <p className="rotulo mb-0.5">Taxa da maquininha por parcela (%)</p>
          <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
            Valor de referência (taxa comum de mercado para crédito à vista/parcelado) — não é a taxa real da sua
            maquininha, é só um ponto de partida. Cada operadora e cada negociação tem a sua; ajuste para o valor
            do seu extrato.
          </p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {local.taxaMaquininhaPorParcela.map((p, i) => (
              <div key={p.parcelas}>
                <label className="mb-1 block text-center text-[11px] text-slate-500 dark:text-slate-400">{p.parcelas}x</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="campo px-2 py-1.5 text-center text-sm"
                  value={p.percentual}
                  onChange={(e) => parcela(i, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>

        <Erro mensagem={erro?.message} detalhes={erro?.detalhes} />

        <div className="flex justify-end gap-2">
          <button type="button" onClick={aoFechar} className="botao-secundario">Cancelar</button>
          <button type="button" onClick={salvar} className="botao-primario" disabled={salvando}>
            {salvando && <Girando tamanho={16} />}
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CampoNumero({ rotulo, valor, aoMudar }) {
  return (
    <div>
      <label className="rotulo">{rotulo}</label>
      <input
        type="number"
        min="0"
        step="0.01"
        className="campo"
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
      />
    </div>
  );
}
