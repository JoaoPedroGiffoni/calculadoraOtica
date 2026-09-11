// Gerador de senha inicial forte — usado tanto para a conta criada pelo
// webhook de pagamento (pagamentos.rotas.js) quanto para o reenvio de acesso
// (auth.rotas.js). `crypto.randomInt`, não `Math.random()`: é a senha real
// de uma conta paga, precisa vir de um gerador criptograficamente seguro.
import { randomInt } from 'node:crypto';

export function gerarSenha() {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  return Array.from({ length: 16 }, () => alfabeto[randomInt(alfabeto.length)]).join('');
}
