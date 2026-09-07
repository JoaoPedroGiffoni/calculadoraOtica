// Roteador da aplicação. Enquanto o token está sendo validado mostramos uma
// tela neutra, para não piscar o login para quem já está autenticado.
import { ProvedorAuth, useAuth } from './lib/autenticacao.jsx';
import { ProvedorTema } from './lib/tema.jsx';
import { Carregando } from './componentes/Ui.jsx';
import Login from './paginas/Login.jsx';
import Calculadora from './paginas/Calculadora.jsx';

function Conteudo() {
  const { usuario, carregando } = useAuth();

  if (carregando) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Carregando texto="Verificando sessão..." />
      </div>
    );
  }

  return usuario ? <Calculadora /> : <Login />;
}

export default function App() {
  return (
    <ProvedorTema>
      <ProvedorAuth>
        <Conteudo />
      </ProvedorAuth>
    </ProvedorTema>
  );
}
