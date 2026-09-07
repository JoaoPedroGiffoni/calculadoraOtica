-- AlterTable
ALTER TABLE `empresas` ADD COLUMN `mercadoPagoAssinaturaId` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `empresas_mercadoPagoAssinaturaId_key` ON `empresas`(`mercadoPagoAssinaturaId`);
