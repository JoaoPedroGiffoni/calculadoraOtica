// Tela de login. E-mail, senha e um botão — nada além do necessário.
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/autenticacao.jsx';
import { Erro, Aviso, Girando, Marca } from '../componentes/Ui.jsx';
import { IconeOlho, IconeOlhoFechado, IconeSol, IconeLua } from '../componentes/Icones.jsx';
import { useTema } from '../lib/tema.jsx';

const MOTIVOS = {
  expirada: 'Sua sessão expirou por tempo de inatividade. Entre novamente para continuar.',
  invalida: 'Sua sessão não é mais válida. Entre novamente para continuar.',
};

/**
 * Traduz a falha para o que a pessoa pode fazer a respeito.
 *
 * O 503 com código PREPARANDO é o caso que mais confunde: em produção (banco
 * de verdade), o servidor abre a porta antes de o banco estar pronto, então
 * existe uma janela de alguns segundos em que a tela carrega mas o login
 * ainda não funciona. Sem esta mensagem, o sintoma é "entrei com a senha
 * certa e deu erro".
 */
function explicar(erro) {
  if (!erro) return null;
  if (erro.codigo === 'PREPARANDO') {
    return { aviso: 'O sistema está terminando de subir. Tente de novo em alguns segundos.' };
  }
  if (erro.codigo === 'BANCO_INDISPONIVEL') {
    return { erro: 'O sistema está no ar, mas sem acesso ao banco de dados. Avise o suporte.' };
  }
  if (erro.status === 0) return { erro: 'Sem conexão com o servidor. Verifique sua internet.' };
  return { erro: erro.message, detalhes: erro.detalhes };
}

export default function Login() {
  const { entrar, motivoSaida } = useAuth();
  const { tema, alternar } = useTema();
  const [parametros] = useSearchParams();
  const assinaturaPendente = parametros.get('assinatura') === 'pendente';

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState(null);
  const [enviando, setEnviando] = useState(false);

  async function aoEnviar(evento) {
    evento.preventDefault();
    setEnviando(true);
    setErro(null);
    try {
      await entrar(email, senha);
    } catch (e) {
      setErro(e);
    } finally {
      setEnviando(false);
    }
  }

  const explicacao = explicar(erro);

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-slate-100 px-4 dark:bg-slate-950">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-marca/10 blur-3xl dark:bg-marca/[.07]"
      />

      <button
        type="button"
        onClick={alternar}
        className="botao-icone absolute right-4 top-4"
        aria-label={tema === 'escuro' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
        title={tema === 'escuro' ? 'Tema claro' : 'Tema escuro'}
      >
        {tema === 'escuro' ? <IconeSol /> : <IconeLua />}
      </button>

      <div className="relative w-full max-w-sm animate-entra-baixo">
        <div className="mb-8">
          <Marca />
        </div>

        {assinaturaPendente && (
          <div className="mb-4">
            <Aviso mensagem="Assinatura recebida! Assim que o pagamento for confirmado, enviamos o acesso (e-mail e senha) para o e-mail usado na compra." />
          </div>
        )}

        {MOTIVOS[motivoSaida] && !erro && !assinaturaPendente && (
          <div className="mb-4">
            <Aviso mensagem={MOTIVOS[motivoSaida]} />
          </div>
        )}

        <form onSubmit={aoEnviar} className="cartao space-y-4 p-6 sm:p-7">
          <div>
            <label className="rotulo" htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              className="campo"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              inputMode="email"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="rotulo" htmlFor="senha">Senha</label>
            <div className="relative">
              <input
                id="senha"
                type={mostrarSenha ? 'text' : 'password'}
                className="campo pr-11"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setMostrarSenha((v) => !v)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200"
                aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                tabIndex={-1}
              >
                {mostrarSenha ? <IconeOlhoFechado tamanho={18} /> : <IconeOlho tamanho={18} />}
              </button>
            </div>
          </div>

          {explicacao?.aviso && <Aviso mensagem={explicacao.aviso} />}
          <Erro mensagem={explicacao?.erro} detalhes={explicacao?.detalhes} />

          <button type="submit" className="botao-primario w-full" disabled={enviando}>
            {enviando && <Girando tamanho={16} />}
            {enviando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-400 dark:text-slate-500">
          Acesso vendido por login único, sem subconta.
        </p>
      </div>
    </div>
  );
}
