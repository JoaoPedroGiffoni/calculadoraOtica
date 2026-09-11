// Recuperação de acesso. Mesma identidade visual do login (reaproveita
// Login.css) — é a saída para quem pagou e nunca recebeu (ou perdeu) o
// e-mail com a senha (ver pagamentos.rotas.js / auth.rotas.js).
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ErroApi } from '../lib/api.js';
import { Girando } from '../componentes/Ui.jsx';
import './Login.css';

export default function EsqueciSenha() {
  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState(null);

  async function aoEnviar(evento) {
    evento.preventDefault();
    setEnviando(true);
    setErro(null);
    try {
      await api.post('/auth/recuperar-senha', { email });
      setEnviado(true);
    } catch (e) {
      setErro(e instanceof ErroApi && e.status === 0 ? 'Sem conexão com o servidor. Verifique sua internet.' : 'Não foi possível enviar agora. Tente de novo em alguns instantes.');
    } finally {
      setEnviando(false);
    }
  }

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
            <h1>Esqueci minha senha</h1>
            <p>Informe o e-mail usado na compra — enviamos uma nova senha para ele.</p>
          </div>

          {enviado ? (
            <div className="painel">
              <div className="aviso">
                <span>Se esse e-mail tiver uma conta, a nova senha já foi enviada. Confira sua caixa de entrada (e o spam).</span>
              </div>
              <Link className="btn" to="/login" style={{ textDecoration: 'none', textAlign: 'center' }}>Voltar para o login</Link>
            </div>
          ) : (
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

              {erro && <div className="erro"><span>{erro}</span></div>}

              <button type="submit" className="btn" disabled={enviando}>
                {enviando && <Girando tamanho={16} />}
                {enviando ? 'Enviando...' : 'Enviar nova senha'}
              </button>
            </form>
          )}

          <p className="nota"><Link to="/login">Voltar para o login</Link></p>
        </div>
      </main>
    </div>
  );
}
