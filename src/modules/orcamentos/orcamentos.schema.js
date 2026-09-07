import { z } from 'zod';

const item = z.object({
  nome: z.string().trim().min(1, 'Informe o nome'),
  valor: z.coerce.number().min(0, 'Valor não pode ser negativo'),
});

export const criarOrcamentoSchema = z.object({
  cliente: z.string().trim().min(1, 'Informe o nome do cliente').max(200),
  armacao: item,
  lente: item.extend({
    tipo: z.string().trim().min(1, 'Informe o tipo de lente'),
  }),
  tratamentos: z.array(item).max(10).default([]),
  desconto: z
    .object({
      tipo: z.enum(['percentual', 'valor']),
      valor: z.coerce.number().min(0),
    })
    .refine((d) => d.tipo !== 'percentual' || d.valor <= 100, {
      message: 'Desconto percentual não pode passar de 100%',
      path: ['valor'],
    })
    .default({ tipo: 'percentual', valor: 0 }),
  parcelas: z.coerce.number().int().min(1).max(12).default(1),
  observacoes: z.string().trim().max(500).optional(),
  // Só tem efeito quando quem envia é ADMIN — a rota descarta este campo
  // para qualquer outro papel (ver orcamentos.rotas.js). Todos os valores já
  // resolvidos em R$: o front decide fixo x percentual e taxa por parcela
  // antes de mandar (ver web/src/lib/calculo.js).
  custos: z
    .object({
      cmvArmacao: z.coerce.number().min(0).default(0),
      cmvLente: z.coerce.number().min(0).default(0),
      custoTratamentos: z.coerce.number().min(0).default(0),
      custoFinanceiro: z.coerce.number().min(0).default(0),
      custoExameVista: z.coerce.number().min(0).default(0),
      comissaoVendedor: z.coerce.number().min(0).default(0),
      custoGarantia: z.coerce.number().min(0).default(0),
      custoEmbalagem: z.coerce.number().min(0).default(0),
    })
    .optional(),
});

export const idParamSchema = z.object({ id: z.string().min(1) });
