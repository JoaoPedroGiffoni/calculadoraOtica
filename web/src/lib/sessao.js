// Prazo de validade da sessão, lido do próprio JWT no navegador.
// Aqui NÃO se valida assinatura — quem valida é o servidor. Isto existe só
// para a interface saber quanto tempo resta e avisar antes de a sessão cair.
export const MINUTO = 60_000;
export const ANTECEDENCIA_AVISO = 5 * MINUTO;
export const FOLGA_RELOGIO = 10_000;

export function lerPayload(token) {
  if (typeof token !== 'string') return null;
  const partes = token.split('.');
  if (partes.length !== 3) return null;

  try {
    const base64 = partes[1].replace(/-/g, '+').replace(/_/g, '/');
    const preenchido = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const bytes = atob(preenchido);
    const texto = decodeURIComponent(
      Array.from(bytes, (c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`).join(''),
    );
    return JSON.parse(texto);
  } catch {
    return null;
  }
}

export function expiracaoDoToken(token) {
  const exp = lerPayload(token)?.exp;
  return typeof exp === 'number' ? exp * 1000 : null;
}

export function estadoDaSessao(expiraEm, agora = Date.now()) {
  if (typeof expiraEm !== 'number' || Number.isNaN(expiraEm)) {
    return { conhecida: false, expirada: false, avisar: false, faltam: null };
  }

  const faltam = expiraEm - agora;
  const expirada = faltam <= FOLGA_RELOGIO;

  return {
    conhecida: true,
    expirada,
    avisar: !expirada && faltam <= ANTECEDENCIA_AVISO,
    faltam: Math.max(0, faltam),
  };
}
