import bcrypt from "bcryptjs";
import type { PrismaClient, Role } from "@prisma/client";

export interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  role?: Role;
}

export interface UpdateUserInput {
  email?: string;
  name?: string;
  role?: Role;
  isActive?: boolean;
  password?: string;
}

export async function listUsers(
  prisma: PrismaClient,
  tenantId: string,
  params: { page?: number; pageSize?: number; search?: string } = {}
) {
  const { page = 1, pageSize = 20, search } = params;
  const skip = (page - 1) * pageSize;

  const where = {
    tenantId,
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  return { users, total, page, pageSize };
}

export async function getUserById(
  prisma: PrismaClient,
  tenantId: string,
  userId: string
) {
  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw Object.assign(new Error("User not found"), {
      statusCode: 404,
      code: "USER_NOT_FOUND",
    });
  }

  return user;
}

export async function createUser(
  prisma: PrismaClient,
  tenantId: string,
  input: CreateUserInput
) {
  const existing = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId, email: input.email } },
  });

  if (existing) {
    throw Object.assign(new Error("Email already in use"), {
      statusCode: 409,
      code: "EMAIL_ALREADY_EXISTS",
    });
  }

  const passwordHash = await bcrypt.hash(input.password, 12);

  const user = await prisma.user.create({
    data: {
      tenantId,
      email: input.email,
      passwordHash,
      name: input.name,
      role: input.role ?? "OPERATOR",
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  return user;
}

export async function updateUser(
  prisma: PrismaClient,
  tenantId: string,
  userId: string,
  input: UpdateUserInput
) {
  const existing = await prisma.user.findFirst({
    where: { id: userId, tenantId },
  });

  if (!existing) {
    throw Object.assign(new Error("User not found"), {
      statusCode: 404,
      code: "USER_NOT_FOUND",
    });
  }

  const data: Record<string, unknown> = {};
  if (input.email !== undefined) data["email"] = input.email;
  if (input.name !== undefined) data["name"] = input.name;
  if (input.role !== undefined) data["role"] = input.role;
  if (input.isActive !== undefined) data["isActive"] = input.isActive;
  if (input.password !== undefined) {
    data["passwordHash"] = await bcrypt.hash(input.password, 12);
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  return user;
}

export async function deleteUser(
  prisma: PrismaClient,
  tenantId: string,
  userId: string
): Promise<void> {
  const existing = await prisma.user.findFirst({
    where: { id: userId, tenantId },
  });

  if (!existing) {
    throw Object.assign(new Error("User not found"), {
      statusCode: 404,
      code: "USER_NOT_FOUND",
    });
  }

  await prisma.user.delete({ where: { id: userId } });
}
