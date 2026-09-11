// Tela de login. E-mail, senha e um botão — nada além do necessário.
// Mesma identidade visual da home e da demo (ver Venda.jsx/Demo.jsx);
// quem já está autenticado nem chega a ver isso — Conteudo, em App.jsx,
// mostra a Calculadora direto na mesma rota "/login".
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/autenticacao.jsx';
import { Girando } from '../componentes/Ui.jsx';
import { IconeOlho, IconeOlhoFechado } from '../componentes/Icones.jsx';
import './Login.css';

const MOTIVOS = {
  expirada: 'Sua sessão expirou por tempo de inatividade. Entre novamente para continuar.',
  invalida: 'Sua sessão não é mais válida. Entre novamente para continuar.',
  assinatura_inativa: 'Sua assinatura está com pagamento pendente ou foi cancelada. Regularize para continuar usando.',
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
  const avisoTexto = explicacao?.aviso
    ?? (!erro && !assinaturaPendente ? MOTIVOS[motivoSaida] : null);

  return (
    <div className="pagina-login">
      <header className="topo">
        <div className="topo-in">
          <Link className="marca" to="/">GMT<span>.</span>Academy</Link>
        </div>
      </header>

      <main className="conteudo">
        <div className="cartao-login">
          <div className="cabecalho">
            <h1>Entrar</h1>
            <p>Acesse a calculadora de margem da sua ótica.</p>
          </div>

          {assinaturaPendente && (
            <div className="aviso" style={{ marginBottom: 16 }}>
              <span>Assinatura recebida! Assim que o pagamento for confirmado, enviamos o acesso (e-mail e senha) para o e-mail usado na compra.</span>
            </div>
          )}

          <form onSubmit={aoEnviar} className="painel">
            <div className="campo-grupo">
              <label className="rotulo" htmlFor="email">E-mail</label>
              <div className="controle">
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  inputMode="email"
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="campo-grupo">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <label className="rotulo" htmlFor="senha">Senha</label>
                <Link to="/esqueci-senha" style={{ fontSize: 13 }}>Esqueci minha senha</Link>
              </div>
              <div className="controle">
                <input
                  id="senha"
                  type={mostrarSenha ? 'text' : 'password'}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha((v) => !v)}
                  aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                  tabIndex={-1}
                >
                  {mostrarSenha ? <IconeOlhoFechado tamanho={18} /> : <IconeOlho tamanho={18} />}
                </button>
              </div>
            </div>

            {!assinaturaPendente && avisoTexto && (
              <div className="aviso"><span>{avisoTexto}</span></div>
            )}
            {explicacao?.erro && (
              <div className="erro">
                <span>
                  {explicacao.erro}
                  {Array.isArray(explicacao.detalhes) && explicacao.detalhes.length > 0 && (
                    <ul>
                      {explicacao.detalhes.map((d, i) => (
                        <li key={i}>{typeof d === 'string' ? d : `${d.campo}: ${d.mensagem}`}</li>
                      ))}
                    </ul>
                  )}
                </span>
              </div>
            )}

            <button type="submit" className="btn" disabled={enviando}>
              {enviando && <Girando tamanho={16} />}
              {enviando ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <p className="nota">Acesso vendido por login único, sem subconta.</p>
        </div>
      </main>
    </div>
  );
}
