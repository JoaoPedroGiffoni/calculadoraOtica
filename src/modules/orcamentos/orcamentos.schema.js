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
});

export const idParamSchema = z.object({ id: z.string().min(1) });
