// Identifica o build no ar — mesma ideia do AtendimentoLocaPronto, versão
// simplificada (sem o script de carimbo de commit, que não é essencial na
// Fase 1). Serve para /saude confirmar, num olhar, se o deploy pegou o
// código novo.
import { execSync } from 'node:child_process';

function commitAtual() {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'dev';
  }
}

export const versao = {
  commit: commitAtual(),
};
