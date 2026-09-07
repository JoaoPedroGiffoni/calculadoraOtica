// Componentes de interface reutilizáveis: estados de carregamento, erro e
// aviso — mesma cara em todo fluxo da aplicação.
import { IconeAlerta, IconeOculos } from './Icones.jsx';
import { classificarMargem } from '../lib/calculo.js';

export function Girando({ tamanho = 20, className = '' }) {
  return (
    <svg className={`animate-spin ${className}`} width={tamanho} height={tamanho} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" opacity="0.2" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function Carregando({ texto = 'Carregando...' }) {
  return (
    <div className="flex animate-entra-baixo items-center justify-center gap-3 py-16 text-slate-500 dark:text-slate-400">
      <Girando />
      <span className="text-sm">{texto}</span>
    </div>
  );
}

export function Erro({ mensagem, detalhes }) {
  if (!mensagem) return null;
  return (
    <div
      role="alert"
      className="flex animate-entra-baixo items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
    >
      <IconeAlerta tamanho={18} className="mt-0.5 shrink-0" />
      <div className="flex-1">
        <p className="font-medium">{mensagem}</p>
        {Array.isArray(detalhes) && detalhes.length > 0 && (
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-red-700 dark:text-red-300">
            {detalhes.map((d, i) => (
              <li key={i}>{typeof d === 'string' ? d : `${d.campo}: ${d.mensagem}`}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function Aviso({ mensagem, compacto = false }) {
  if (!mensagem) return null;
  return (
    <div
      className={
        compacto
          ? 'flex flex-wrap animate-entra-baixo items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200'
          : 'flex animate-entra-baixo items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200'
      }
    >
      <IconeAlerta tamanho={compacto ? 14 : 18} className={compacto ? 'shrink-0' : 'mt-0.5 shrink-0'} />
      <p className="flex-1 font-medium">{mensagem}</p>
    </div>
  );
}

/// Selo de leitura da margem de contribuição — a régua de saúde financeira
/// da venda (ver classificarMargem em lib/calculo.js). `compacto` é para
/// caber numa linha de histórico; a versão normal vai no resultado e no
/// formulário, com a régua completa por baixo.
export function SeloMargem({ margemRs, margemPercentual, compacto = false }) {
  const faixa = classificarMargem(margemPercentual);

  if (compacto) {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${faixa.classe}`}>
        {faixa.emoji} {margemPercentual}%
      </span>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between rounded-lg bg-marca/10 px-3 py-2 text-sm">
        <span className="font-medium text-slate-600 dark:text-slate-300">Margem de contribuição</span>
        <span className="font-bold text-marca">
          {(Number(margemRs) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} ({margemPercentual}%)
        </span>
      </div>
      <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${faixa.classe}`}>
        <span>{faixa.emoji}</span>
        <span>{faixa.rotulo}</span>
      </div>
      <p className="text-xs text-slate-400 dark:text-slate-500">
        🎯 Meta ideal para ótica física: 60% a 70%. Margem de contribuição não é lucro — dela ainda saem os custos fixos da operação.
      </p>
    </div>
  );
}

/// A marca: o ícone de óculos e o nome. Usada no login e no topo.
export function Marca({ tamanho = 'grande' }) {
  const grande = tamanho === 'grande';
  return (
    <div className={grande ? 'text-center' : 'flex items-center gap-2'}>
      <span
        className={[
          'flex items-center justify-center rounded-2xl bg-gradient-to-br from-marca-claro to-marca-escuro text-white shadow-cartao ring-1 ring-black/5',
          grande ? 'mx-auto mb-3 h-14 w-14' : 'h-8 w-8 rounded-xl',
        ].join(' ')}
        aria-hidden="true"
      >
        <IconeOculos tamanho={grande ? 28 : 18} />
      </span>
      <div className={grande ? '' : 'leading-tight'}>
        <h1 className={grande ? 'text-xl font-bold tracking-tight' : 'text-sm font-bold tracking-tight'}>Calculadora Ótica</h1>
        {grande && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Orçamento de óculos em segundos</p>}
      </div>
    </div>
  );
}
