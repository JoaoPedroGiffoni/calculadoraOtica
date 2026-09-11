-- RenameColumn: troca de Mercado Pago para Stripe — a coluna passa a
-- guardar o id da subscription do Stripe, não mais o id da preapproval do
-- Mercado Pago, então o nome deixa de amarrar no provedor.
ALTER TABLE `empresas` RENAME COLUMN `mercadoPagoAssinaturaId` TO `assinaturaId`;

-- RenameIndex: MySQL não renomeia o índice único junto da coluna — refaz o
-- nome para bater com a convenção do Prisma (`<tabela>_<coluna>_key`).
ALTER TABLE `empresas` RENAME INDEX `empresas_mercadoPagoAssinaturaId_key` TO `empresas_assinaturaId_key`;
