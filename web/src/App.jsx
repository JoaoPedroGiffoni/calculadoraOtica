// Roteador da aplicação.
// "/"               — página de venda, pública (domínio principal).
// "/como-funciona"  — demo pública da calculadora, sem login (linkada pela venda).
// "/login"          — onde mora o produto: formulário de login, ou a calculadora
//                     direto pra quem já está autenticado. Mesma tela de sempre,
//                     só que atrás de uma rota agora — ver Conteudo, abaixo.
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ProvedorAuth, useAuth } from './lib/autenticacao.jsx';
import { ProvedorTema } from './lib/tema.jsx';
import { Carregando } from './componentes/Ui.jsx';
import Venda from './paginas/Venda.jsx';
import Demo from './paginas/Demo.jsx';
import Login from './paginas/Login.jsx';
import Calculadora from './paginas/Calculadora.jsx';

// Enquanto o token está sendo validado mostramos uma tela neutra, para não
// piscar o formulário de login para quem já está autenticado.
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
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Venda />} />
            <Route path="/como-funciona" element={<Demo />} />
            <Route path="/login" element={<Conteudo />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ProvedorAuth>
    </ProvedorTema>
  );
}
