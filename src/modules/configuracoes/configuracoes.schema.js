import { z } from 'zod';

export const configuracaoCustosSchema = z
  .object({
    cmvLenteSimples: z.coerce.number().min(0),
    cmvLentePercentual: z.coerce.number().min(0).max(100),
    taxaMaquininhaPorParcela: z
      .array(
        z.object({
          parcelas: z.coerce.number().int().min(1).max(12),
          percentual: z.coerce.number().min(0).max(100),
        }),
      )
      .min(1)
      .max(12),
    custoExameVista: z.coerce.number().min(0),
    custoGarantia: z.coerce.number().min(0),
    custoEmbalagem: z.coerce.number().min(0),
    comissaoPercentual: z.coerce.number().min(0).max(100),
  })
  .partial()
  .refine((d) => Object.keys(d).length > 0, { message: 'Nada para atualizar' });
