// Estado de prontidão da aplicação — só é usado quando AUTH_MODO=banco.
//
// O servidor HTTP abre a porta imediatamente, antes de o banco estar pronto:
// plataformas de hospedagem derrubam o processo que não chama `listen()` em
// poucos segundos (a Hostinger exige 3), e migration mais seed levam bem mais
// que isso num primeiro deploy.
//
// Enquanto a preparação roda em segundo plano, as rotas que dependem do banco
// respondem 503 com mensagem clara, em vez de estourar erro genérico.
export const estado = {
  bancoPronto: false,
  preparando: true,
  erro: null,
  iniciadoEm: new Date(),
  prontoEm: null,
};

export function marcarBancoPronto() {
  estado.bancoPronto = true;
  estado.preparando = false;
  estado.erro = null;
  estado.prontoEm = new Date();
}

export function marcarFalha(erro) {
  estado.bancoPronto = false;
  estado.preparando = false;
  estado.erro = String(erro?.message ?? erro);
}
