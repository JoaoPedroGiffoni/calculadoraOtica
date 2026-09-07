// Página de venda — domínio principal. Pública, sem autenticação: quem
// compra o acesso ainda entra por fora (venda manual, ver README Fase 3);
// o botão "Entrar" leva para /login, onde mora o produto de verdade.
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/autenticacao.jsx';
import { useTema } from '../lib/tema.jsx';
import { Marca } from '../componentes/Ui.jsx';
import {
  IconeSol, IconeLua, IconeCalculadora, IconeGrafico, IconeEngrenagem, IconeCheck, IconeOculos,
} from '../componentes/Icones.jsx';

const RECURSOS = [
  {
    icone: IconeCalculadora,
    titulo: 'Rápida e prática',
    texto: 'Sem orçamento pra montar, sem histórico pra revisar. Preço de venda, custos, resultado — na mesma tela.',
  },
  {
    icone: IconeCheck,
    titulo: 'A fórmula certa',
    texto: 'CMV de armação e lente, tratamentos, financeiro do parcelamento, exame, comissão, garantia, embalagem e impostos — nada fica de fora da conta.',
  },
  {
    icone: IconeGrafico,
    titulo: 'Leitura na hora',
    texto: 'Selo colorido (🟢 a ☠️) diz se a margem está saudável ou perigosa pra loja física, com a meta de 60%–70% sempre à vista.',
  },
  {
    icone: IconeEngrenagem,
    titulo: 'Custos padrão, uma vez só',
    texto: 'Cadastra a taxa da maquininha, comissão e o resto uma vez; a calculadora pré-preenche sozinha em todo cálculo novo — e ainda dá pra ajustar na hora.',
  },
];

export default function Venda() {
  const { usuario } = useAuth();
  const { tema, alternar } = useTema();

  return (
    <div className="min-h-dvh bg-slate-100 dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <Marca tamanho="pequeno" />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={alternar}
              className="botao-icone"
              aria-label="Alternar tema"
              title={tema === 'escuro' ? 'Tema claro' : 'Tema escuro'}
            >
              {tema === 'escuro' ? <IconeSol /> : <IconeLua />}
            </button>
            <Link to="/login" className="botao-primario text-sm">
              {usuario ? 'Ir para a calculadora' : 'Entrar'}
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* --- Hero --- */}
        <section className="relative overflow-hidden px-4 py-20 text-center sm:px-6 sm:py-28">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-0 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/3 rounded-full bg-marca/10 blur-3xl dark:bg-marca/[.07]"
          />
          <div className="relative mx-auto max-w-2xl animate-entra-baixo">
            <span className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-marca-claro to-marca-escuro text-white shadow-cartao">
              <IconeOculos tamanho={32} />
            </span>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Toda venda tem uma margem.<br className="hidden sm:block" /> Descubra a sua em segundos.
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg text-slate-600 dark:text-slate-400">
              A calculadora de margem de contribuição feita para ótica: coloca o preço de venda, lança os custos e
              vê na hora se aquela venda vale a pena — sem planilha, sem chute.
            </p>
            <div className="mt-8 flex justify-center">
              <Link to="/login" className="botao-primario px-6 py-3 text-base">
                {usuario ? 'Ir para a calculadora' : 'Entrar'}
              </Link>
            </div>
            <p className="mt-4 text-sm text-slate-400 dark:text-slate-500">
              Já é cliente? Entre com o e-mail e senha que você recebeu.
            </p>
          </div>
        </section>

        {/* --- Recursos --- */}
        <section className="border-t border-slate-200 bg-white px-4 py-16 dark:border-slate-800 dark:bg-slate-900 sm:px-6">
          <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2">
            {RECURSOS.map(({ icone: Icone, titulo, texto }) => (
              <div key={titulo} className="cartao animate-entra-baixo p-6">
                <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-marca/10 text-marca">
                  <Icone tamanho={20} />
                </span>
                <h3 className="font-semibold">{titulo}</h3>
                <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{texto}</p>
              </div>
            ))}
          </div>
        </section>

        {/* --- Régua de margem, em miniatura --- */}
        <section className="px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight">A régua que toda ótica deveria olhar antes de fechar a venda</h2>
            <p className="mx-auto mt-3 max-w-lg text-slate-500 dark:text-slate-400">
              Meta ideal para loja física: <strong className="text-slate-700 dark:text-slate-200">60% a 70%</strong> de
              margem de contribuição. Abaixo disso, a calculadora já avisa.
            </p>
            <div className="mx-auto mt-8 grid max-w-md grid-cols-1 gap-2 text-left text-sm">
              {[
                ['🟢 EXCELENTE', '≥ 70%', 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'],
                ['🟡 INTERMEDIÁRIA', '50% – 59%', 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'],
                ['🔴 PERIGOSA', '30% – 39%', 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'],
                ['☠️ RISCO DE PREJUÍZO', '< 20%', 'bg-slate-900 text-red-200 dark:bg-black dark:text-red-300'],
              ].map(([rotulo, faixa, classe]) => (
                <div key={rotulo} className={`flex items-center justify-between rounded-lg px-4 py-2.5 font-semibold ${classe}`}>
                  <span>{rotulo}</span>
                  <span className="font-normal opacity-80">{faixa}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* --- CTA final --- */}
        <section className="border-t border-slate-200 bg-white px-4 py-16 text-center dark:border-slate-800 dark:bg-slate-900 sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight">Pronto pra saber a margem da próxima venda?</h2>
          <div className="mt-6">
            <Link to="/login" className="botao-primario px-6 py-3 text-base">
              {usuario ? 'Ir para a calculadora' : 'Entrar'}
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 px-4 py-8 text-center text-sm text-slate-400 dark:border-slate-800 dark:text-slate-500 sm:px-6">
        Um produto GMT Academy.
      </footer>
    </div>
  );
}
