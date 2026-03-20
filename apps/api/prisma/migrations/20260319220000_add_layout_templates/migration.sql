-- CreateEnum
CREATE TYPE "LayoutTemplate" AS ENUM ('FULLSCREEN', 'SPLIT_BOTTOM', 'SPLIT_SIDE', 'GRID');

-- AlterTable: Layout - adicionar campos de template
ALTER TABLE "Layout" ADD COLUMN "template" "LayoutTemplate" NOT NULL DEFAULT 'FULLSCREEN';
ALTER TABLE "Layout" ADD COLUMN "config" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "Layout" ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Layout" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Layout" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable: Device - adicionar layoutId
ALTER TABLE "Device" ADD COLUMN "layoutId" TEXT;

-- AlterTable: DeviceGroup - adicionar layoutId
ALTER TABLE "DeviceGroup" ADD COLUMN "layoutId" TEXT;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_layoutId_fkey" FOREIGN KEY ("layoutId") REFERENCES "Layout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceGroup" ADD CONSTRAINT "DeviceGroup_layoutId_fkey" FOREIGN KEY ("layoutId") REFERENCES "Layout"("id") ON DELETE SET NULL ON UPDATE CASCADE;
