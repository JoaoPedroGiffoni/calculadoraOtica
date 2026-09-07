// Logger minimalista. Evita dependência extra e sai em formato legível no PM2
// (que já carimba data/hora nos arquivos de log).
const niveis = { debug: 10, info: 20, warn: 30, error: 40 };
const nivelAtual = niveis[process.env.LOG_LEVEL ?? 'info'] ?? niveis.info;

function formatar(nivel, mensagem, extra) {
  const linha = `[${nivel.toUpperCase()}] ${mensagem}`;
  if (extra === undefined) return [linha];
  return [linha, extra];
}

export const logger = {
  debug: (m, e) => nivelAtual <= niveis.debug && console.debug(...formatar('debug', m, e)),
  info: (m, e) => nivelAtual <= niveis.info && console.log(...formatar('info', m, e)),
  warn: (m, e) => nivelAtual <= niveis.warn && console.warn(...formatar('warn', m, e)),
  error: (m, e) => nivelAtual <= niveis.error && console.error(...formatar('error', m, e)),
};
