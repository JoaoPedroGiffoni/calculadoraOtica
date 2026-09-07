// Divide um script SQL em comandos individuais.
//
// É necessário porque o driver do Prisma envia cada comando como prepared
// statement, e prepared statement não aceita mais de um comando por vez. Um
// split ingênuo em ";" quebraria em qualquer ponto-e-vírgula dentro de texto,
// de comentário ou de identificador — por isso o parser abaixo percorre o
// script caractere a caractere, sabendo em que contexto está.
//
// Contextos reconhecidos:
//   'texto'            string literal (aspas simples)
//   "texto"            string literal no MySQL; identificador em ANSI_QUOTES.
//                      Nos dois casos é uma região que não se divide, então
//                      tratar como região resolve as duas leituras.
//   `identificador`    crase — a forma do MySQL
//   -- comentário      até o fim da linha
//   # comentário       até o fim da linha (só o MySQL tem esta)
//   /* comentário */   bloco
//
// Escape dentro de string no MySQL vem de duas formas: a duplicação ('') e a
// contrabarra ('\''), e as duas precisam ser entendidas — a segunda não existe
// no padrão SQL, mas é o que o mysqldump gera.

export function dividirComandosSql(script) {
  const comandos = [];
  let atual = '';
  let i = 0;

  let emTextoSimples = false;
  let emTextoDuplo = false;
  let emCrase = false;
  let emComentarioLinha = false;
  let emComentarioBloco = false;

  // Marca se o trecho atual (desde o último ";") tem algo além de comentário
  // e espaço em branco. Sem isto, um comentário sozinho depois do último ";"
  // do arquivo (ex.: uma nota de rodapé) virava um "comando" de verdade —
  // só texto de comentário — que o banco recusa como "Query was empty", e
  // isso trava a migration pela metade (ver src/lib/migrador.js: a linha de
  // controle já foi gravada com `finished_at` nulo, e o próximo boot se
  // recusa a continuar até alguém corrigir na mão).
  let temConteudoReal = false;

  const finalizar = () => {
    const comando = atual.trim();
    if (comando && temConteudoReal) comandos.push(comando);
    atual = '';
    temConteudoReal = false;
  };

  while (i < script.length) {
    const c = script[i];
    const proximo = script[i + 1];

    // --- Comentário de linha ---
    if (emComentarioLinha) {
      atual += c;
      if (c === '\n') emComentarioLinha = false;
      i += 1;
      continue;
    }

    // --- Comentário de bloco ---
    if (emComentarioBloco) {
      if (c === '*' && proximo === '/') {
        emComentarioBloco = false;
        atual += '*/';
        i += 2;
        continue;
      }
      atual += c;
      i += 1;
      continue;
    }

    // --- Dentro de string ou identificador ---
    if (emTextoSimples || emTextoDuplo || emCrase) {
      const delimitador = emTextoSimples ? "'" : emTextoDuplo ? '"' : '`';

      // Contrabarra escapa o próximo caractere (inclusive o delimitador).
      // Não vale para a crase, onde a contrabarra é literal.
      if (c === '\\' && !emCrase && proximo !== undefined) {
        atual += c + proximo;
        temConteudoReal = true;
        i += 2;
        continue;
      }

      atual += c;
      temConteudoReal = true;

      if (c === delimitador) {
        // Delimitador duplicado é ele mesmo escapado, não o fim da região.
        if (proximo === delimitador) {
          atual += proximo;
          i += 2;
          continue;
        }
        emTextoSimples = false;
        emTextoDuplo = false;
        emCrase = false;
      }
      i += 1;
      continue;
    }

    // --- Fora de qualquer contexto especial: detecta as aberturas ---
    // O MySQL só reconhece "--" como comentário quando vem seguido de espaço
    // ou outro caractere de controle (fim de linha, tab...) — sem essa
    // condição, "SELECT 5--3" (subtração sem espaço, "5 - (-3)") seria lido
    // como "SELECT 5" com o resto comentado, diferente do que o banco faz.
    if (c === '-' && proximo === '-' && (script[i + 2] === undefined || /\s/.test(script[i + 2]))) {
      emComentarioLinha = true;
      atual += '--';
      i += 2;
      continue;
    }
    if (c === '#') {
      emComentarioLinha = true;
      atual += c;
      i += 1;
      continue;
    }
    if (c === '/' && proximo === '*') {
      emComentarioBloco = true;
      atual += '/*';
      i += 2;
      continue;
    }
    if (c === "'") {
      emTextoSimples = true;
      atual += c;
      temConteudoReal = true;
      i += 1;
      continue;
    }
    if (c === '"') {
      emTextoDuplo = true;
      atual += c;
      temConteudoReal = true;
      i += 1;
      continue;
    }
    if (c === '`') {
      emCrase = true;
      atual += c;
      temConteudoReal = true;
      i += 1;
      continue;
    }
    if (c === ';') {
      finalizar();
      i += 1;
      continue;
    }

    atual += c;
    if (c.trim() !== '') temConteudoReal = true;
    i += 1;
  }

  finalizar();
  return comandos;
}
