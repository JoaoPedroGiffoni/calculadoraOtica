// Cliente HTTP da API. Centraliza o token, o tratamento de erro e a perda de
// sessão — que avisa quem estiver ouvindo em vez de recarregar a página.
import { expiracaoDoToken, estadoDaSessao } from './sessao.js';

const BASE = '/api/v1';
const CHAVE_TOKEN = 'calculadora-otica.token';

export const guardarToken = (token) => localStorage.setItem(CHAVE_TOKEN, token);
export const lerToken = () => localStorage.getItem(CHAVE_TOKEN);
export const limparToken = () => localStorage.removeItem(CHAVE_TOKEN);

export const expiracaoDaSessao = () => {
  const token = lerToken();
  return token ? expiracaoDoToken(token) : null;
};

const ouvintes = new Set();
let jaDerrubada = false;

export function aoPerderSessao(ouvinte) {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

export function marcarSessaoAtiva() {
  jaDerrubada = false;
}

function derrubarSessao(motivo) {
  limparToken();
  if (jaDerrubada) return;
  jaDerrubada = true;
  for (const ouvinte of ouvintes) ouvinte(motivo);
}

const SESSAO_EXPIRADA = 'Sua sessão expirou. Faça login novamente para continuar.';

export class ErroApi extends Error {
  constructor(mensagem, status, detalhes, codigo) {
    super(mensagem);
    this.status = status;
    this.detalhes = detalhes;
    this.codigo = codigo;
  }
}

async function requisitar(caminho, opcoes = {}) {
  const token = lerToken();
  const ehLogin = caminho.startsWith('/auth/login');

  if (token && !ehLogin && estadoDaSessao(expiracaoDoToken(token)).expirada) {
    derrubarSessao('expirada');
    throw new ErroApi(SESSAO_EXPIRADA, 401, undefined, 'SESSAO_EXPIRADA');
  }

  let resposta;
  try {
    resposta = await fetch(`${BASE}${caminho}`, {
      ...opcoes,
      headers: {
        ...(opcoes.corpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...opcoes.headers,
      },
      body: opcoes.corpo !== undefined ? JSON.stringify(opcoes.corpo) : opcoes.body,
    });
  } catch {
    throw new ErroApi('Sem conexão com o servidor. Verifique sua internet.', 0);
  }

  if (resposta.status === 204) return null;

  const texto = await resposta.text();
  let dado = null;
  try {
    dado = texto ? JSON.parse(texto) : null;
  } catch {
    dado = null;
  }

  if (!resposta.ok) {
    const erro = dado?.erro;

    if (resposta.status === 401 && !ehLogin) {
      derrubarSessao(erro?.codigo === 'SESSAO_EXPIRADA' ? 'expirada' : 'invalida');
    }

    throw new ErroApi(erro?.mensagem ?? `Erro ${resposta.status}`, resposta.status, erro?.detalhes, erro?.codigo);
  }

  return dado;
}

export const api = {
  get: (caminho) => requisitar(caminho),
  post: (caminho, corpo) => requisitar(caminho, { method: 'POST', corpo }),
  put: (caminho, corpo) => requisitar(caminho, { method: 'PUT', corpo }),
};
