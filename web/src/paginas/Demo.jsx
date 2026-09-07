// Demo pública da calculadora — "Ver como funciona" da home (Venda.jsx).
// Não exige login nem salva nada: é só a conta feita na hora, para quem
// ainda não assinou decidir se vale a pena. A conta de verdade (autenticada,
// com custos padrão da conta) mora em Calculadora.jsx.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/autenticacao.jsx';
import './Demo.css';

const LINK_ASSINATURA = '/api/v1/pagamentos/assinar';

const MOEDA = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const NUM = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const PADRAO = {
  preco: 120000, armacao: 18000, lentes: 32000, outros: 4000, // centavos
  fixos: 2800000,
  imposto: '6', comissao: '3', cartao: '2,5',
};

function useCampoMoeda(centavosIniciais) {
  const [centavos, setCentavos] = useState(centavosIniciais);
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (el) el.setSelectionRange(el.value.length, el.value.length);
  });

  return {
    ref,
    valor: centavos / 100,
    texto: NUM.format(centavos / 100),
    definir: setCentavos,
    aoDigitar: (e) => {
      const digitos = e.target.value.replace(/\D/g, '');
      setCentavos(digitos ? parseInt(digitos, 10) : 0);
    },
  };
}

function pctParaNumero(texto) {
  const v = parseFloat(texto.replace(/\./g, '').replace(',', '.'));
  if (Number.isNaN(v)) return 0;
  return Math.min(100, Math.max(0, v));
}

function useCampoPercentual(textoInicial) {
  const [texto, setTexto] = useState(textoInicial);
  return {
    texto,
    valor: pctParaNumero(texto),
    definir: setTexto,
    aoDigitar: (e) => {
      const v = e.target.value.replace(/[^\d,]/g, '').replace(/,(?=.*,)/g, '');
      setTexto(v);
    },
    aoSair: () => setTexto(String(pctParaNumero(texto)).replace('.', ',')),
  };
}

function calcular(preco, desconto, custos, taxaTotal) {
  const price = preco * (1 - desconto / 100);
  const deducoes = (price * taxaTotal) / 100;
  const mc = price - custos - deducoes;
  const pct = price > 0 ? (mc / price) * 100 : 0;
  return { price, deducoes, mc, pct };
}

function veredito(pct) {
  if (pct <= 0) return { texto: 'Prejuízo', cor: 'var(--bad)' };
  if (pct < 20) return { texto: 'Crítico', cor: 'var(--bad)' };
  if (pct < 35) return { texto: 'Apertado', cor: 'var(--warn)' };
  if (pct < 50) return { texto: 'Saudável', cor: 'oklch(0.48 0.13 140)' };
  return { texto: 'Excelente', cor: 'var(--good)' };
}

/// Posição do pino no medidor (escala 0–20–35–50–70+, segmentos com peso
/// 2/1.5/1.5/2, igual à largura flex de cada faixa colorida).
function pinoEsquerda(pct) {
  const paradas = [0, 20, 35, 50, 70];
  const pesos = [2, 1.5, 1.5, 2];
  const total = 7;
  if (pct <= 0) return 0;
  let acumulado = 0;
  for (let i = 0; i < 4; i += 1) {
    if (pct < paradas[i + 1]) {
      return ((acumulado + (pesos[i] * (pct - paradas[i])) / (paradas[i + 1] - paradas[i])) / total) * 100;
    }
    acumulado += pesos[i];
  }
  return 100;
}

function BotaoAssinar({ usuario, className, children }) {
  if (usuario) {
    return <Link to="/login" className={className}>{children ?? 'Ir para a calculadora'}</Link>;
  }
  return <a href={LINK_ASSINATURA} className={className}>{children ?? 'Assinar a calculadora'}</a>;
}

export default function Demo() {
  const { usuario } = useAuth();

  useEffect(() => {
    document.title = 'Calculadora de Margem — Ótica (demonstração)';
  }, []);

  const preco = useCampoMoeda(PADRAO.preco);
  const armacao = useCampoMoeda(PADRAO.armacao);
  const lentes = useCampoMoeda(PADRAO.lentes);
  const outros = useCampoMoeda(PADRAO.outros);
  const fixos = useCampoMoeda(PADRAO.fixos);
  const imposto = useCampoPercentual(PADRAO.imposto);
  const comissao = useCampoPercentual(PADRAO.comissao);
  const cartao = useCampoPercentual(PADRAO.cartao);
  const [desconto, setDesconto] = useState(0);

  const custos = armacao.valor + lentes.valor + outros.valor;
  const taxaTotal = imposto.valor + comissao.valor + cartao.valor;

  const base = useMemo(() => calcular(preco.valor, 0, custos, taxaTotal), [preco.valor, custos, taxaTotal]);
  const comDesconto = useMemo(
    () => calcular(preco.valor, desconto, custos, taxaTotal),
    [preco.valor, desconto, custos, taxaTotal],
  );
  const v = veredito(base.pct);

  const multiplicador = custos > 0 && preco.valor > 0 ? preco.valor / custos : null;

  let pontoEquilibrio;
  if (fixos.valor > 0 && base.mc > 0) {
    const vendas = Math.ceil(fixos.valor / base.mc);
    pontoEquilibrio = {
      vendas: `${vendas} ${vendas === 1 ? 'venda' : 'vendas'}`,
      detalhe: `por mês, ou ${MOEDA.format(fixos.valor / (base.pct / 100))} de faturamento`,
    };
  } else if (fixos.valor > 0) {
    pontoEquilibrio = { vendas: 'Inalcançável', detalhe: 'com margem zero ou negativa não há ponto de equilíbrio' };
  } else {
    pontoEquilibrio = { vendas: '—', detalhe: 'informe seus custos fixos mensais' };
  }

  function limpar() {
    preco.definir(PADRAO.preco);
    armacao.definir(PADRAO.armacao);
    lentes.definir(PADRAO.lentes);
    outros.definir(PADRAO.outros);
    fixos.definir(PADRAO.fixos);
    imposto.definir(PADRAO.imposto);
    comissao.definir(PADRAO.comissao);
    cartao.definir(PADRAO.cartao);
    setDesconto(0);
  }

  return (
    <div className="pagina-demo">
      <header className="topbar">
        <div className="wrap topbar-in">
          <Link className="brand" to="/">GMT<span className="brand-dot">.</span>Academy</Link>
          <span className="topbar-tag">Ferramenta gratuita</span>
        </div>
      </header>

      <main className="wrap">
        <section className="intro">
          <h1>Quanto <em>realmente</em> sobra de cada venda?</h1>
          <p>
            Preencha os números de um par vendido no balcão. A conta é feita na hora — impostos, comissão, cartão e
            custo dos produtos entram todos na mesma linha.
          </p>
        </section>

        <div className="layout">
          {/* ENTRADAS */}
          <form className="panel inputs" autoComplete="off" onSubmit={(e) => e.preventDefault()}>
            <fieldset>
              <legend><span className="step">1</span> A venda</legend>
              <div className="field">
                <label htmlFor="preco">Preço de venda ao cliente</label>
                <div className="control">
                  <span className="affix">R$</span>
                  <input ref={preco.ref} type="text" id="preco" inputMode="decimal" value={preco.texto} onChange={preco.aoDigitar} />
                </div>
              </div>
            </fieldset>

            <fieldset>
              <legend><span className="step">2</span> Custo dos produtos</legend>
              <div className="grid-2">
                <div className="field">
                  <label htmlFor="armacao">Armação</label>
                  <div className="control">
                    <span className="affix">R$</span>
                    <input ref={armacao.ref} type="text" id="armacao" inputMode="decimal" value={armacao.texto} onChange={armacao.aoDigitar} />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="lentes">Lentes</label>
                  <div className="control">
                    <span className="affix">R$</span>
                    <input ref={lentes.ref} type="text" id="lentes" inputMode="decimal" value={lentes.texto} onChange={lentes.aoDigitar} />
                  </div>
                </div>
              </div>
              <div className="field">
                <label htmlFor="outros">Outros custos da venda <span className="hint">montagem, frete, brinde, embalagem</span></label>
                <div className="control">
                  <span className="affix">R$</span>
                  <input ref={outros.ref} type="text" id="outros" inputMode="decimal" value={outros.texto} onChange={outros.aoDigitar} />
                </div>
              </div>
            </fieldset>

            <fieldset>
              <legend><span className="step">3</span> O que sai por cima do preço</legend>
              <div className="grid-3">
                <div className="field">
                  <label htmlFor="imposto">Impostos</label>
                  <div className="control">
                    <input type="text" id="imposto" inputMode="decimal" value={imposto.texto} onChange={imposto.aoDigitar} onBlur={imposto.aoSair} />
                    <span className="affix affix-r">%</span>
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="comissao">Comissão</label>
                  <div className="control">
                    <input type="text" id="comissao" inputMode="decimal" value={comissao.texto} onChange={comissao.aoDigitar} onBlur={comissao.aoSair} />
                    <span className="affix affix-r">%</span>
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="cartao">Taxa cartão</label>
                  <div className="control">
                    <input type="text" id="cartao" inputMode="decimal" value={cartao.texto} onChange={cartao.aoDigitar} onBlur={cartao.aoSair} />
                    <span className="affix affix-r">%</span>
                  </div>
                </div>
              </div>
            </fieldset>

            <fieldset>
              <legend><span className="step">4</span> Sua loja <span className="opt">opcional</span></legend>
              <div className="field">
                <label htmlFor="fixos">Custos fixos mensais <span className="hint">aluguel, folha, energia, sistema</span></label>
                <div className="control">
                  <span className="affix">R$</span>
                  <input ref={fixos.ref} type="text" id="fixos" inputMode="decimal" value={fixos.texto} onChange={fixos.aoDigitar} />
                </div>
              </div>
            </fieldset>

            <button type="button" className="reset" onClick={limpar}>Limpar e recomeçar</button>
          </form>

          {/* RESULTADO */}
          <aside className="panel results">
            <div className="headline">
              <span className="eyebrow">Margem de contribuição por venda</span>
              <div className="big" style={{ color: base.mc < 0 ? 'var(--bad)' : 'var(--ink)' }}>{MOEDA.format(base.mc)}</div>
              <div className="pctline">
                <span className="pct">{NUM.format(base.pct)}%</span>
                <span className="verdict" style={{ color: v.cor }}>{v.texto}</span>
              </div>
            </div>

            <div className="meter" aria-hidden="true">
              <div className="meter-track">
                <span className="seg s1" /><span className="seg s2" /><span className="seg s3" /><span className="seg s4" />
              </div>
              <div className="meter-pin"><span style={{ left: `${pinoEsquerda(base.pct)}%` }} /></div>
              <div className="meter-scale"><span>0%</span><span>20%</span><span>35%</span><span>50%</span><span>70%+</span></div>
            </div>

            <ul className="breakdown">
              <li><span>Preço de venda</span><b>{MOEDA.format(base.price)}</b></li>
              <li className="neg"><span>Custo dos produtos</span><b>{`– ${MOEDA.format(custos)}`}</b></li>
              <li className="neg"><span>Impostos, comissão e cartão</span><b>{`– ${MOEDA.format(base.deducoes)}`}</b></li>
              <li className="total"><span>Sobra por venda</span><b style={{ color: base.mc < 0 ? 'var(--bad)' : 'var(--ink)' }}>{MOEDA.format(base.mc)}</b></li>
            </ul>

            <div className="cards">
              <div className="mini">
                <span className="mini-label">Multiplicador sobre o custo</span>
                <b>{multiplicador ? `${NUM.format(multiplicador)}×` : '—'}</b>
                <em>{multiplicador ? `você vende por ${NUM.format(multiplicador)} vezes o custo do produto` : 'informe o custo dos produtos'}</em>
              </div>
              <div className="mini">
                <span className="mini-label">Ponto de equilíbrio</span>
                <b>{pontoEquilibrio.vendas}</b>
                <em>{pontoEquilibrio.detalhe}</em>
              </div>
            </div>

            <div className="sim">
              <div className="sim-head">
                <span className="mini-label">Simulador de desconto</span>
                <span className="sim-val">{desconto}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                step="1"
                value={desconto}
                aria-label="Desconto concedido"
                onChange={(e) => setDesconto(parseInt(e.target.value, 10))}
              />
              <p className="sim-out">
                {desconto === 0 ? (
                  'Arraste para ver o estrago que o desconto faz na margem.'
                ) : comDesconto.mc <= 0 ? (
                  <>Com <strong>{desconto}%</strong> de desconto a venda passa a dar prejuízo de <strong>{MOEDA.format(Math.abs(comDesconto.mc))}</strong>. Não feche esse negócio.</>
                ) : (
                  <>
                    Com <strong>{desconto}%</strong> de desconto sobram <strong>{MOEDA.format(comDesconto.mc)}</strong> ({NUM.format(comDesconto.pct)}%).
                    Você perde <strong>{NUM.format(base.mc > 0 ? ((base.mc - comDesconto.mc) / base.mc) * 100 : 0)}%</strong> da
                    margem e precisa vender <strong>{NUM.format(comDesconto.mc > 0 ? base.mc / comDesconto.mc : 0)}×</strong> mais para ganhar o mesmo.
                  </>
                )}
              </p>
            </div>
          </aside>
        </div>

        <section className="explain">
          <h2>Como ler esse número</h2>
          <div className="explain-grid">
            <div>
              <h3>Margem de contribuição</h3>
              <p>É o que sobra da venda depois de pagar tudo que só existe porque a venda aconteceu: produto, imposto, comissão e cartão. Esse dinheiro é o que banca o aluguel, a folha e, no fim, o lucro.</p>
            </div>
            <div>
              <h3>Ponto de equilíbrio</h3>
              <p>Quantas vendas com esse perfil você precisa fechar no mês para cobrir os custos fixos. Da venda seguinte em diante, a margem vira lucro.</p>
            </div>
            <div>
              <h3>Desconto não é 10%</h3>
              <p>Um desconto de 10% no preço não tira 10% do seu lucro — tira uma fatia muito maior da margem, porque os custos continuam iguais. O simulador mostra o tamanho real do buraco.</p>
            </div>
          </div>
        </section>

        <section className="cta">
          <p>Pronto para usar isso em toda venda da sua loja?</p>
          <BotaoAssinar usuario={usuario} className="btn" />
        </section>
      </main>

      <footer className="foot">
        <div className="wrap">
          <span>GMT Academy · Calculadora de margem para óticas</span>
          <span className="foot-note">Os resultados são estimativas baseadas nos valores informados.</span>
        </div>
      </footer>
    </div>
  );
}
