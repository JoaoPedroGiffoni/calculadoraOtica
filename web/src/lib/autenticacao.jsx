// Contexto de autenticação. Guarda o usuário logado, expõe login/logout e
// acompanha o prazo da sessão.
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, guardarToken, limparToken, lerToken, expiracaoDaSessao, aoPerderSessao, marcarSessaoAtiva } from './api.js';
import { estadoDaSessao } from './sessao.js';

const ContextoAuth = createContext(null);
const INTERVALO_CONFERE = 15_000;

export function ProvedorAuth({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [motivoSaida, setMotivoSaida] = useState(null);
  const [avisoSessao, setAvisoSessao] = useState(null);

  useEffect(
    () =>
      aoPerderSessao((motivo) => {
        setMotivoSaida(motivo);
        setAvisoSessao(null);
        setUsuario(null);
      }),
    [],
  );

  useEffect(() => {
    let cancelado = false;

    async function verificar() {
      if (!lerToken()) {
        setCarregando(false);
        return;
      }

      if (estadoDaSessao(expiracaoDaSessao()).expirada) {
        limparToken();
        setMotivoSaida('expirada');
        setCarregando(false);
        return;
      }

      try {
        const eu = await api.get('/auth/eu');
        if (!cancelado) setUsuario(eu);
      } catch (e) {
        limparToken();
        if (!cancelado && e?.status === 401) {
          setMotivoSaida(e.codigo === 'SESSAO_EXPIRADA' ? 'expirada' : 'invalida');
        }
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }

    verificar();
    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    if (!usuario) return undefined;

    function conferir() {
      const { conhecida, expirada, avisar, faltam } = estadoDaSessao(expiracaoDaSessao());
      if (!conhecida) return;

      if (expirada) {
        limparToken();
        setAvisoSessao(null);
        setMotivoSaida('expirada');
        setUsuario(null);
        return;
      }

      setAvisoSessao(avisar ? { faltam } : null);
    }

    conferir();
    const id = setInterval(conferir, INTERVALO_CONFERE);
    document.addEventListener('visibilitychange', conferir);

    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', conferir);
    };
  }, [usuario]);

  const entrar = useCallback(async (email, senha) => {
    const resposta = await api.post('/auth/login', { email, senha });
    guardarToken(resposta.token);
    marcarSessaoAtiva();
    setMotivoSaida(null);
    setAvisoSessao(null);
    setUsuario({ ...resposta.usuario, empresa: resposta.empresa });
    return resposta.usuario;
  }, []);

  const sair = useCallback(() => {
    limparToken();
    marcarSessaoAtiva();
    setMotivoSaida(null);
    setAvisoSessao(null);
    setUsuario(null);
  }, []);

  return (
    <ContextoAuth.Provider value={{ usuario, carregando, motivoSaida, avisoSessao, entrar, sair }}>
      {children}
    </ContextoAuth.Provider>
  );
}

export function useAuth() {
  const contexto = useContext(ContextoAuth);
  if (!contexto) throw new Error('useAuth precisa estar dentro de <ProvedorAuth>');
  return contexto;
}
