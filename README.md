# Calculadora Ótica

Calculadora de **margem de contribuição** para óticas: preço de venda menos
os custos da venda (armação, lente, tratamentos, financeiro do parcelamento,
exame, comissão, garantia, embalagem) = quanto sobra, em segundos. Rápida e
prática de propósito — sem orçamento pra montar, sem histórico pra revisar,
só o número que importa na hora de decidir se a venda vale a pena.

Pensada para ser **vendida** para outras óticas: cada acesso vendido é um
login (sem subconta — um e-mail e senha por acesso), com os próprios custos
padrão isolados dos de qualquer outra ótica.

---

## Stack

Mesma do [AtendimentoLocaPronto](https://github.com/JoaoPedroGiffoni/AtendimentoLocaPronto),
de propósito: é a combinação que já provou subir e ficar de pé na Hostinger,
e os dois sistemas vão rodar **no mesmo servidor**.

- **Backend:** Node.js 20+ · Express · Zod
- **Frontend:** React 18 · Vite · TailwindCSS
- **Auth:** JWT
- **Deploy:** aplicação Node.js na Hostinger (CloudLinux), uma porta só —
  mesmo procedimento do AtendimentoLocaPronto, banco (Fase 2) e domínio à
  parte.

O Express serve a API **e** o build estático do front. Não há segundo
processo, nem Docker.

---

## Fase atual: mock, sem banco e sem pagamento

`AUTH_MODO=mock` (padrão): login e custos padrão vivem em **memória do
processo** — zera a cada restart. Existe para validar o produto (calculadora
+ login por conta) antes de conectar banco de dados de verdade e o fluxo de
venda de acesso.

Logins de teste (ver [`src/lib/dadosMock.js`](src/lib/dadosMock.js) para
editar):

| E-mail | Senha | Ótica |
|---|---|---|
| `ana@visaoclara.com.br` | `123456` | Ótica Visão Clara (trial) |
| `carlos@bellavista.com.br` | `123456` | Ótica Bella Vista (ativo) |

Cada login só vê os próprios custos padrão (`empresaId` no token JWT isola
tudo — inclusive no modo mock). Não há papel nem subconta: um login é um
acesso vendido, ponto — ver comentário no topo de `dadosMock.js`.

### O que já funciona

| Rota | O que faz |
|---|---|
| `GET /api/v1/saude` | Healthcheck |
| `POST /api/v1/auth/login` | E-mail + senha → token JWT |
| `POST /api/v1/auth/renovar` | Estende a sessão |
| `GET /api/v1/auth/eu` | Quem sou eu, com dados da conta |
| `GET /api/v1/configuracoes/custos` | Custos padrão da conta (pré-preenche a calculadora) |
| `PUT /api/v1/configuracoes/custos` | Atualiza os custos padrão |

O cálculo da margem em si **não passa pela API** — é só JavaScript no
navegador (ver [`web/src/lib/calculo.js`](web/src/lib/calculo.js)), porque
nada é salvo: sem histórico, não existe round-trip nenhum a fazer para
mostrar o resultado.

### Regra de cálculo

```
preço de venda do óculos/combo
(–) CMV da armação
(–) CMV da lente (fixo p/ visão simples, % do preço de venda p/ multifocal)
(–) custo de tratamentos/upgrades vendidos
(–) custo financeiro do parcelamento (taxa da maquininha, por nº de parcelas)
(–) exame de vista (se tiver custo direto)
(–) comissão/premiação do vendedor
(–) custo de garantia/proteção por unidade
(–) embalagem/estojo entregue ao cliente
= margem de contribuição (R$) ÷ preço de venda = margem de contribuição (%)
```

Não entra aqui: aluguel, folha fixa, pró-labore, contador, sistemas, energia
e marketing — isso é custo fixo/CAC, calculado à parte.

A leitura da margem segue esta régua ([`web/src/lib/calculo.js`](web/src/lib/calculo.js),
`classificarMargem`):

| Margem | Leitura |
|---:|---|
| ≥ 70% | 🟢 EXCELENTE |
| 60% – 69% | 🟢 SAUDÁVEL |
| 50% – 59% | 🟡 INTERMEDIÁRIA - MERECE ATENÇÃO |
| 40% – 49% | 🟠 ATENÇÃO |
| 30% – 39% | 🔴 PERIGOSA |
| 20% – 29% | 🔴 ALTÍSSIMO RISCO |
| < 20% | ☠️ RISCO MUITO ALTO DE PREJUÍZO |

Meta ideal para uma ótica física: **60% a 70%**. Margem de contribuição não
é lucro — dela ainda saem os custos fixos da operação.

---

## Instalação local (desenvolvimento)

```bash
# 1. Backend
npm install
cp .env.example .env    # AUTH_MODO=mock já funciona sem preencher nada além do JWT_SECRET
npm run dev              # porta 3335

# 2. Frontend (outro terminal)
npm run dev:web          # porta 5175, com proxy para a 3335
```

Abra `http://localhost:5175`. As portas são 3335/5175 — terceira faixa da
família (AtendimentoLocaPronto usa 3334/5174, o painel financeiro usa
3333/5173) — para os três sistemas rodarem juntos na mesma máquina de
desenvolvimento sem conflito.

```bash
npm test              # backend: node --test, sem dependência externa
cd web && npm test     # frontend: mesma ideia, testa a conta da margem
```

---

## Próximas fases

### Fase 2 — banco de dados

Trocar `AUTH_MODO=mock` por `AUTH_MODO=banco` e preencher `DATABASE_URL`.
O [`prisma/schema.prisma`](prisma/schema.prisma) já está escrito, no mesmo
formato do AtendimentoLocaPronto — `Empresa` (o acesso vendido) e `Usuario`
(o login, um por Empresa) — pronto para `prisma migrate dev` assim que a
decisão for tomada. Falta implementar o lado `banco` de
[`src/lib/repositorioUsuarios.js`](src/lib/repositorioUsuarios.js) e de
[`src/lib/repositorioConfiguracoes.js`](src/lib/repositorioConfiguracoes.js)
— a interface das funções já é a mesma, então nada muda em quem as chama
(rotas, middleware).

Ao ligar o banco, mover `@prisma/client`, `prisma` e `@prisma/adapter-mariadb`
de `devDependencies` para `dependencies` no `package.json` (mesmo motivo do
AtendimentoLocaPronto: hospedagem gerenciada instala com
`NODE_ENV=production`, que pula dependências de desenvolvimento) e seguir a
mesma receita de lá — `engineType = "client"` + driver adapter, sem motor
Rust (CloudLinux mata processo que cria thread nativa), migrations aplicadas
em processo (não pelo CLI do Prisma, que estoura o teto de processos), porta
aberta antes do banco pronto. Banco **próprio**, separado dos outros dois
sistemas.

### Fase 3 — venda e pagamento

Fluxo: cliente compra → webhook do meio de pagamento cria a `Empresa` e o
`Usuario` (um só — sem subconta, ver acima) → e-mail com o login sai
automático.

Meio de pagamento ainda em aberto — comparativo levantado nesta conversa:

- **Mercado Pago:** Pix ~0,99%, cartão ~3,0% a ~5,0% conforme prazo de
  recebimento, sem mensalidade. Assinatura recorrente cobre cartão, Pix e
  boleto com nova tentativa automática em caso de falha.
- **Asaas:** Pix R$ 1,99 fixo por cobrança (100 primeiras grátis/mês), boleto
  R$ 3,49, cartão 2,99% + R$ 0,49 (mais 1,99% em parcelado/assinatura), sem
  mensalidade. Cobrança recorrente e régua de inadimplência nativas — se
  encaixa bem no modelo `trial → ativo → inadimplente → cancelado` já
  desenhado no `StatusEmpresa` do schema.

Ambos sem mensalidade fixa (só taxa por cobrança); vale checar os valores
atuais direto no site de cada um antes de decidir — taxa de meio de
pagamento muda com frequência.

### Fase 4 — deploy na Hostinger

Mesmo procedimento do AtendimentoLocaPronto (aplicação Node.js importada do
GitHub, `npm install` → `npm run build` → `npm start`, sem `PORT` fixo,
banco MySQL próprio criado no hPanel) — ver o README daquele projeto para o
passo a passo completo, incluindo os detalhes que custam tempo (host do
banco não é `localhost`, percent-encoding de senha, `CHECKPOINT_DISABLE=1`).
Outro subdomínio, mesma conta, mesmo servidor (`server1181`).

---

## Estrutura

```
src/
  server.js            ponto de entrada
  app.js               montagem do Express (helmet, CORS, rate limit, front estático)
  config/env.js        variáveis validadas com Zod
  lib/
    dadosMock.js              empresas/usuários de teste (Fase 1)
    repositorioUsuarios.js       acesso a usuário — mock hoje, banco na Fase 2
    repositorioConfiguracoes.js  custos padrão da conta — memória hoje, banco na Fase 2
    erros.js, logger.js, versao.js
  middleware/
    autenticacao.js    JWT
    erro.js            tratador central
    validar.js         validação de entrada com Zod
  modules/
    auth/               login, renovar, eu
    configuracoes/       custos padrão (GET/PUT /configuracoes/custos)
  routes/index.js      /api/v1

web/src/
  App.jsx                       roteador; sem usuário, o login ocupa a tela
  lib/api.js                    cliente HTTP, token e perda de sessão
  lib/autenticacao.jsx          contexto de auth
  lib/calculo.js                toda a conta da margem — a lógica de negócio mora aqui, não no servidor
  paginas/Login.jsx
  paginas/Calculadora.jsx       a ferramenta inteira: preço de venda + custos → margem, sem salvar nada
  componentes/ConfiguracaoCustosModal.jsx  edita os custos padrão

prisma/
  schema.prisma        Empresa, Usuario — pronto para a Fase 2, ainda não conectado

tests/
  configuracoes.schema.test.js

web/tests/
  calculo.test.js       a conta da margem (CMV, custo financeiro, comissão, faixas de leitura)
```
