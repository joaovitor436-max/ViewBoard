import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import type { PrismaClient } from "@prisma/client";
import type IORedis from "ioredis";
import type { LoginInput, ScreenPairInput } from "./auth.schema.js";

const JWT_SECRET = process.env["JWT_SECRET"] ?? "fallback-secret-change-me";
const JWT_REFRESH_SECRET =
  process.env["JWT_REFRESH_SECRET"] ?? "fallback-refresh-secret-change-me";
const ACCESS_EXPIRES_IN = process.env["JWT_ACCESS_EXPIRES_IN"] ?? "15m";
const REFRESH_EXPIRES_IN = process.env["JWT_REFRESH_EXPIRES_IN"] ?? "7d";

function parseExpiry(expiry: string): number {
  const unit = expiry.slice(-1);
  const value = parseInt(expiry.slice(0, -1), 10);
  switch (unit) {
    case "m":
      return value * 60;
    case "h":
      return value * 3600;
    case "d":
      return value * 86400;
    default:
      return 900;
  }
}

export async function signAccessToken(payload: object): Promise<string> {
  const secret = new TextEncoder().encode(JWT_SECRET);
  const expiresIn = parseExpiry(ACCESS_EXPIRES_IN);
  return new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + expiresIn)
    .sign(secret);
}

export async function signRefreshToken(payload: object): Promise<string> {
  const secret = new TextEncoder().encode(JWT_REFRESH_SECRET);
  const expiresIn = parseExpiry(REFRESH_EXPIRES_IN);
  return new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + expiresIn)
    .sign(secret);
}

export async function login(
  prisma: PrismaClient,
  redis: IORedis,
  input: LoginInput
) {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: input.tenantSlug },
  });

  if (!tenant) {
    throw Object.assign(new Error("Tenant not found"), {
      statusCode: 404,
      code: "TENANT_NOT_FOUND",
    });
  }

  const user = await prisma.user.findUnique({
    where: {
      tenantId_email: { tenantId: tenant.id, email: input.email },
    },
  });

  if (!user || !user.isActive) {
    throw Object.assign(new Error("Invalid credentials"), {
      statusCode: 401,
      code: "INVALID_CREDENTIALS",
    });
  }

  const passwordValid = await bcrypt.compare(input.password, user.passwordHash);
  if (!passwordValid) {
    throw Object.assign(new Error("Invalid credentials"), {
      statusCode: 401,
      code: "INVALID_CREDENTIALS",
    });
  }

  const tokenPayload = {
    sub: user.id,
    tenantId: tenant.id,
    email: user.email,
    role: user.role,
    type: "access",
  };

  const refreshPayload = {
    sub: user.id,
    tenantId: tenant.id,
    type: "refresh",
  };

  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(tokenPayload),
    signRefreshToken(refreshPayload),
  ]);

  // Store refresh token in Redis with TTL
  const expiresIn = parseExpiry(REFRESH_EXPIRES_IN);
  await redis.setex(
    `refresh:${user.id}`,
    expiresIn,
    refreshToken
  );

  return {
    accessToken,
    refreshToken,
    expiresIn: parseExpiry(ACCESS_EXPIRES_IN),
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: tenant.id,
    },
  };
}

export async function refreshTokens(
  prisma: PrismaClient,
  redis: IORedis,
  refreshToken: string
) {
  const secret = new TextEncoder().encode(JWT_REFRESH_SECRET);

  let payload: { sub?: string; tenantId?: string; type?: string };
  try {
    const { payload: verified } = await jwtVerify(refreshToken, secret);
    payload = verified as typeof payload;
  } catch {
    throw Object.assign(new Error("Invalid refresh token"), {
      statusCode: 401,
      code: "INVALID_REFRESH_TOKEN",
    });
  }

  if (payload.type !== "refresh" || !payload.sub) {
    throw Object.assign(new Error("Invalid token type"), {
      statusCode: 401,
      code: "INVALID_TOKEN_TYPE",
    });
  }

  // Validate stored refresh token
  const stored = await redis.get(`refresh:${payload.sub}`);
  if (stored !== refreshToken) {
    throw Object.assign(new Error("Refresh token mismatch"), {
      statusCode: 401,
      code: "TOKEN_MISMATCH",
    });
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
  });

  if (!user || !user.isActive) {
    throw Object.assign(new Error("User not found"), {
      statusCode: 404,
      code: "USER_NOT_FOUND",
    });
  }

  const newAccessToken = await signAccessToken({
    sub: user.id,
    tenantId: user.tenantId,
    email: user.email,
    role: user.role,
    type: "access",
  });

  const newRefreshToken = await signRefreshToken({
    sub: user.id,
    tenantId: user.tenantId,
    type: "refresh",
  });

  const expiresIn = parseExpiry(REFRESH_EXPIRES_IN);
  await redis.setex(`refresh:${user.id}`, expiresIn, newRefreshToken);

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    expiresIn: parseExpiry(ACCESS_EXPIRES_IN),
  };
}

export async function logout(redis: IORedis, userId: string): Promise<void> {
  await redis.del(`refresh:${userId}`);
}

export async function pairScreen(
  prisma: PrismaClient,
  input: ScreenPairInput
) {
  const screen = await prisma.screen.findUnique({
    where: { pairingCode: input.pairingCode },
    include: { tenant: true },
  });

  if (!screen) {
    throw Object.assign(new Error("Invalid pairing code"), {
      statusCode: 404,
      code: "INVALID_PAIRING_CODE",
    });
  }

  // Update screen with device info if provided
  const updateData: {
    resolution?: object;
    orientation?: "LANDSCAPE" | "PORTRAIT";
  } = {};

  if (input.deviceInfo?.resolution) {
    updateData.resolution = input.deviceInfo.resolution;
  }

  if (input.deviceInfo?.orientation) {
    updateData.orientation = input.deviceInfo.orientation;
  }

  if (Object.keys(updateData).length > 0) {
    await prisma.screen.update({
      where: { id: screen.id },
      data: updateData,
    });
  }

  const screenToken = await signAccessToken({
    sub: screen.id,
    tenantId: screen.tenantId,
    screenId: screen.id,
    type: "screen",
  });

  return {
    screenToken,
    screen: {
      id: screen.id,
      name: screen.name,
      tenantId: screen.tenantId,
      tenantSlug: screen.tenant.slug,
    },
  };
}
