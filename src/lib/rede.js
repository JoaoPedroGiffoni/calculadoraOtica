// Preferência de IPv4 na resolução de nomes.
//
// A partir do Node 17, `dns.lookup` devolve os endereços na ordem em que o
// DNS respondeu (`verbatim`), e não mais com IPv4 primeiro. Quando o host do
// banco tem registro A e AAAA — o caso do auth-dbNNNN.hstgr.io da Hostinger —,
// a conexão sai por IPv6.
//
// O MySQL enxerga a origem e a compara com os endereços autorizados para o
// usuário. Saindo por IPv6, a origem vira algo como 2a02:4780:13:1234::1b, que
// não costuma estar na lista, e a resposta é
//
//   Access denied for user 'usuario'@'2a02:4780:13:1234::1b' (using password: YES)
//
// — o MESMO erro 1045 de senha errada. O tempo perdido não está em consertar,
// está em descobrir.
//
// Voltar a preferir IPv4 faz a origem ser o IPv4 da aplicação, que é o que os
// painéis de hospedagem cadastram. Não é exclusão: se o host só tiver AAAA, o
// IPv6 continua sendo usado.
import dns from 'node:dns';
import { logger } from './logger.js';

export function preferirIpv4() {
  try {
    dns.setDefaultResultOrder('ipv4first');
  } catch {
    // Node antigo sem a função: o padrão de lá já é IPv4 primeiro.
    logger.debug('dns.setDefaultResultOrder indisponível — seguindo com o padrão.');
  }
}
