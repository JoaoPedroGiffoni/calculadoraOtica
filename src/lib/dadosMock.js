// FASE 1 (AUTH_MODO=mock): quem loga e de qual conta, tudo em memória —
// zerado a cada restart do processo. Existe para validar o produto (login +
// calculadora de margem) antes de plugar banco de verdade e o fluxo de venda
// de acesso.
//
// Um login = um acesso vendido. Não há subconta nem papel dentro de uma
// mesma empresa — quem loga é o único dono daquele acesso, ponto. Empresa
// segue separada de Usuario mesmo assim porque `status` (trial/ativo/
// inadimplente/cancelado) é o que o webhook de pagamento da Fase 3 vai
// mexer, e essa marcação não deveria virar coluna solta em Usuario.
//
// Formato pensado para migrar direto para as tabelas Empresa/Usuario do
// prisma/schema.prisma quando a Fase 2 chegar.
//
// Para editar quem consegue entrar agora, mexa só aqui.
import bcrypt from 'bcryptjs';

const SENHA_PADRAO_DEMO = '123456';

/// bcrypt.hashSync é caro (~80ms) — rodado uma vez só no boot, não por login.
const senhaHashPadrao = bcrypt.hashSync(SENHA_PADRAO_DEMO, 10);

export const empresasMock = [
  { id: 'empresa-1', nome: 'Ótica Visão Clara', status: 'trial' },
  { id: 'empresa-2', nome: 'Ótica Bella Vista', status: 'ativo' },
];

export const usuariosMock = [
  {
    id: 'usuario-1',
    empresaId: 'empresa-1',
    nome: 'Ana Souza',
    email: 'ana@visaoclara.com.br',
    senhaHash: senhaHashPadrao,
    ativo: true,
  },
  {
    id: 'usuario-2',
    empresaId: 'empresa-2',
    nome: 'Carlos Lima',
    email: 'carlos@bellavista.com.br',
    senhaHash: senhaHashPadrao,
    ativo: true,
  },
];

/// Só para a mensagem de ajuda na tela de login — nunca a senha real fora de
/// ambiente de demonstração.
export const SENHA_DEMO_VISIVEL = SENHA_PADRAO_DEMO;
