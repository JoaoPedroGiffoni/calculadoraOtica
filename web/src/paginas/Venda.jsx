// Página de venda — domínio principal. Pública, sem autenticação: quem
// compra o acesso ainda entra por fora (venda manual, ver README Fase 3);
// o botão "Entrar" leva para /login, onde mora o produto de verdade.
// Design GMT Academy (fundo creme, hero escuro, acento laranja) — ver
// componentes/Demo.jsx para a página "Ver como funciona" ligada por aqui.
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/autenticacao.jsx';
import './Venda.css';

const LINK_ASSINATURA = '/api/v1/pagamentos/assinar';

/// Link de checkout: precisa ser um <a href> de verdade, não <Link> do
/// react-router — /api/v1/... é rota do backend, não da SPA, e o <Link>
/// intercepta o clique pra navegação client-side (cai no fallback "*" e
/// volta pra "/" sem nunca chamar a API).
function BotaoAssinar({ usuario, className, children }) {
  if (usuario) {
    return (
      <Link to="/login" className={className}>
        {children ?? 'Ir para a calculadora'}
      </Link>
    );
  }
  return (
    <a href={LINK_ASSINATURA} className={className}>
      {children ?? 'Assinar a calculadora'}
    </a>
  );
}

const DORES = [
  {
    numero: '01',
    titulo: 'Confundir markup com margem',
    texto: 'Vender por três vezes o custo parece muito. Depois do imposto, da comissão e da maquininha, sobra bem menos do que o dono imagina.',
  },
  {
    numero: '02',
    titulo: 'Dar desconto no escuro',
    texto: 'Dez por cento no preço não tira dez por cento do lucro. Tira uma fatia muito maior da margem — e ninguém percebe no balcão.',
  },
  {
    numero: '03',
    titulo: 'Não saber o ponto de equilíbrio',
    texto: 'Sem saber quantas vendas pagam o aluguel e a folha, o mês vira aposta. A loja fatura, movimenta, e o caixa não fecha.',
  },
];

const RECURSOS = [
  {
    titulo: 'Margem de contribuição real',
    texto: 'Em reais e em percentual, já descontando produto, imposto, comissão e taxa de cartão da mesma venda.',
  },
  {
    titulo: 'Um veredito, não só um número',
    texto: 'Crítico, apertado, saudável ou excelente — para você saber na hora se aquela venda vale a pena repetir.',
  },
  {
    titulo: 'Ponto de equilíbrio do mês',
    texto: 'Informe seus custos fixos e veja quantas vendas como essa a loja precisa fechar antes de começar a lucrar.',
  },
  {
    titulo: 'Simulador de desconto',
    texto: 'Arraste o desconto e veja quanto da margem evapora e quantas vezes mais você teria que vender para empatar.',
  },
];

const PASSOS = [
  {
    numero: 1,
    titulo: 'Pegue uma venda recente',
    texto: 'De preferência uma típica da sua loja, não a melhor nem a pior do mês.',
  },
  {
    numero: 2,
    titulo: 'Preencha preço, custos e taxas',
    texto: 'Armação, lentes, montagem, imposto, comissão e a taxa da maquininha.',
  },
  {
    numero: 3,
    titulo: 'Leia o que sobra',
    texto: 'E use o simulador antes de autorizar o próximo desconto no balcão.',
  },
];

const PRECO_ITENS = [
  'Margem de contribuição de qualquer venda, em R$ e %',
  'Ponto de equilíbrio mensal da sua loja',
  'Simulador de desconto antes de fechar o negócio',
  'Uso ilimitado, no balcão ou no celular',
  'Cancele quando quiser, sem fidelidade',
];

const FAQS = [
  {
    pergunta: 'Como funciona a assinatura?',
    resposta: 'São R$ 49 por mês, cobrados de forma recorrente pelo Mercado Pago. Você pode cancelar a qualquer momento direto na sua conta do Mercado Pago, sem multa nem fidelidade.',
  },
  {
    pergunta: 'Serve para lente de contato e serviços?',
    resposta: 'Serve para qualquer venda em que você consiga separar o custo direto do produto das taxas que incidem sobre o preço.',
  },
  {
    pergunta: 'Qual a diferença entre margem e lucro?',
    resposta: 'A margem de contribuição é o que sobra de cada venda para pagar os custos fixos. O lucro só aparece depois que o conjunto das vendas do mês cobre esses fixos.',
  },
  {
    pergunta: 'Funciona no celular?',
    resposta: 'Sim, foi feita para ser usada em pé, atrás do balcão.',
  },
];

export default function Venda() {
  const { usuario } = useAuth();

  useEffect(() => {
    document.title = 'Calculadora de Margem para Óticas — GMT Academy';
  }, []);

  return (
    <div className="pagina-venda">
      <header className="nav">
        <div className="wrap nav-in">
          <Link className="brand" to="/">GMT<span>.</span>Academy</Link>
          <nav className="nav-links">
            <a href="#oque">O que faz</a>
            <a href="#como">Como funciona</a>
            <a href="#preco">Preço</a>
            <a href="#faq">Dúvidas</a>
          </nav>
          {!usuario && (
            <Link to="/login" className="nav-entrar">Entrar</Link>
          )}
          <BotaoAssinar usuario={usuario} className="btn btn-sm">
            {usuario ? 'Calculadora' : 'Assinar'}
          </BotaoAssinar>
        </div>
      </header>

      <main>
        {/* HERO */}
        <section className="hero">
          <div className="wrap hero-in">
            <div className="hero-copy">
              <span className="kicker">Ferramenta para óticas</span>
              <h1>Você sabe quanto <em>sobra</em> de cada par que vende?</h1>
              <p className="lead">
                Não é o preço menos o custo da lente. Imposto, comissão, taxa de cartão e montagem comem a venda por
                dentro. A calculadora do GMT Academy mostra o número que resta — em segundos, sem planilha.
              </p>
              <div className="hero-actions">
                <BotaoAssinar usuario={usuario} className="btn btn-lg" />
                <Link className="btn-ghost" to="/como-funciona">Ver como funciona</Link>
              </div>
              <span className="btn-note">R$ 49 por mês · Mercado Pago · cancele quando quiser</span>
            </div>
          </div>
        </section>

        {/* DOR */}
        <section className="band">
          <div className="wrap">
            <h2 className="sec-title">Três contas que quase toda ótica faz errado</h2>
            <div className="cols-3">
              {DORES.map(({ numero, titulo, texto }) => (
                <article className="pain" key={numero}>
                  <span className="pnum">{numero}</span>
                  <h3>{titulo}</h3>
                  <p>{texto}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* O QUE FAZ */}
        <section id="oque" className="section">
          <div className="wrap">
            <h2 className="sec-title">O que a calculadora entrega</h2>
            <div className="cols-2 features">
              {RECURSOS.map(({ titulo, texto }) => (
                <article className="feat" key={titulo}>
                  <h3>{titulo}</h3>
                  <p>{texto}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* COMO FUNCIONA */}
        <section id="como" className="band">
          <div className="wrap">
            <h2 className="sec-title">Três passos, menos de um minuto</h2>
            <ol className="steps">
              {PASSOS.map(({ numero, titulo, texto }) => (
                <li key={numero}>
                  <span className="snum">{numero}</span>
                  <div>
                    <h3>{titulo}</h3>
                    <p>{texto}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* PREÇO */}
        <section id="preco" className="section">
          <div className="wrap price-wrap">
            <div className="price-card">
              <span className="price-label">Assinatura mensal</span>
              <div className="price-value">
                <span className="cur">R$</span><b>49</b><span className="per">/mês</span>
              </div>
              <ul className="price-list">
                {PRECO_ITENS.map((item) => <li key={item}>{item}</li>)}
              </ul>
              <BotaoAssinar usuario={usuario} className="btn btn-lg price-btn">
                {usuario ? 'Ir para a calculadora' : 'Assinar agora'}
              </BotaoAssinar>
              <span className="price-note">Pagamento seguro pelo Mercado Pago</span>
            </div>
            <div className="price-side">
              <h2 className="sec-title">Menos de dois reais por dia</h2>
              <p>
                Um único desconto dado no escuro custa mais caro que um ano de assinatura. A calculadora se paga na
                primeira venda em que você disser não.
              </p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="section">
          <div className="wrap faq-wrap">
            <h2 className="sec-title">Dúvidas rápidas</h2>
            <div className="faq">
              {FAQS.map(({ pergunta, resposta }) => (
                <details key={pergunta}>
                  <summary>{pergunta}</summary>
                  <p>{resposta}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="final">
          <div className="wrap final-in">
            <h2>Pare de dar desconto no escuro</h2>
            <p>R$ 49 por mês. Cancele quando quiser.</p>
            <BotaoAssinar usuario={usuario} className="btn btn-lg btn-invert" />
            <Link className="final-alt" to="/como-funciona">ou veja antes como ela funciona</Link>
          </div>
        </section>
      </main>

      <footer className="foot">
        <div className="wrap foot-in">
          <span className="brand brand-foot">GMT<span>.</span>Academy</span>
          <span className="foot-note">Os resultados são estimativas baseadas nos valores que você informar.</span>
        </div>
      </footer>
    </div>
  );
}
