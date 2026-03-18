import { z } from "zod";

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  tenantSlug: z.string().min(1),
});

export type LoginInput = z.infer<typeof LoginSchema>;

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export type RefreshTokenInput = z.infer<typeof RefreshTokenSchema>;

export const ScreenPairSchema = z.object({
  pairingCode: z.string().min(1),
  deviceInfo: z
    .object({
      resolution: z
        .object({
          width: z.number(),
          height: z.number(),
        })
        .optional(),
      orientation: z.enum(["LANDSCAPE", "PORTRAIT"]).optional(),
      userAgent: z.string().optional(),
    })
    .optional(),
});

export type ScreenPairInput = z.infer<typeof ScreenPairSchema>;

export const TokenResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number(),
  user: z.object({
    id: z.string(),
    email: z.string(),
    name: z.string(),
    role: z.string(),
    tenantId: z.string(),
  }),
});

export type TokenResponse = z.infer<typeof TokenResponseSchema>;
