/*
  Warnings:

  - The `recurrence` column on the `Schedule` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "ScheduleRecurrence" AS ENUM ('ONCE', 'DAILY', 'WEEKLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ScheduleLogStatus" AS ENUM ('SUCCESS', 'SKIPPED', 'ERROR');

-- AlterTable
ALTER TABLE "Schedule" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "daysOfWeek" INTEGER[],
ADD COLUMN     "deviceId" TEXT,
ADD COLUMN     "groupId" TEXT,
ALTER COLUMN "endAt" DROP NOT NULL,
DROP COLUMN "recurrence",
ADD COLUMN     "recurrence" "ScheduleRecurrence" NOT NULL DEFAULT 'ONCE';

-- CreateTable
CREATE TABLE "ScheduleLog" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "ScheduleLogStatus" NOT NULL,
    "message" TEXT,

    CONSTRAINT "ScheduleLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "DeviceGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleLog" ADD CONSTRAINT "ScheduleLog_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
