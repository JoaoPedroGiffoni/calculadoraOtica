// Tema claro/escuro. Respeita a preferência do sistema no primeiro acesso e
// guarda a escolha manual no localStorage.
import { createContext, useContext, useEffect, useState } from 'react';

const ContextoTema = createContext(null);
const CHAVE = 'calculadora-otica.tema';

function temaInicial() {
  const salvo = localStorage.getItem(CHAVE);
  if (salvo === 'claro' || salvo === 'escuro') return salvo;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro';
}

export function ProvedorTema({ children }) {
  const [tema, setTema] = useState(temaInicial);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', tema === 'escuro');
    document.documentElement.style.colorScheme = tema === 'escuro' ? 'dark' : 'light';
    localStorage.setItem(CHAVE, tema);
  }, [tema]);

  const alternar = () => setTema((t) => (t === 'escuro' ? 'claro' : 'escuro'));

  return <ContextoTema.Provider value={{ tema, alternar }}>{children}</ContextoTema.Provider>;
}

export function useTema() {
  const contexto = useContext(ContextoTema);
  if (!contexto) throw new Error('useTema precisa estar dentro de <ProvedorTema>');
  return contexto;
}
