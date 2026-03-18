import { z } from "zod";

export const RecurrenceSchema = z.object({
  freq: z.enum(["DAILY", "WEEKLY", "MONTHLY"]),
  interval: z.number().int().min(1).default(1),
  byDay: z
    .array(z.enum(["MO", "TU", "WE", "TH", "FR", "SA", "SU"]))
    .optional(),
  until: z.string().datetime().optional(),
  count: z.number().int().min(1).optional(),
});

export type Recurrence = z.infer<typeof RecurrenceSchema>;

export const ScheduleSchema = z.object({
  id: z.string().cuid(),
  tenantId: z.string().cuid(),
  playlistId: z.string().cuid(),
  name: z.string().min(1).max(255),
  startAt: z.date(),
  endAt: z.date(),
  recurrence: RecurrenceSchema.nullable().optional(),
  priority: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
  screens: z.array(z.string()).optional(),
});

export type Schedule = z.infer<typeof ScheduleSchema>;

export const CreateScheduleSchema = z.object({
  playlistId: z.string().cuid(),
  name: z.string().min(1).max(255),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  recurrence: RecurrenceSchema.optional(),
  priority: z.number().int().min(0).default(0),
  screenIds: z.array(z.string().cuid()).min(1),
});

export type CreateSchedule = z.infer<typeof CreateScheduleSchema>;

export const UpdateScheduleSchema = CreateScheduleSchema.partial();
export type UpdateSchedule = z.infer<typeof UpdateScheduleSchema>;
