import type { PrismaClient } from "@prisma/client";

// ── Tipos ────────────────────────────────────────────────────────────

export type LayoutTemplate = "FULLSCREEN" | "SPLIT_BOTTOM" | "SPLIT_SIDE" | "GRID";

export interface LayoutWidget {
  type: "clock" | "weather" | "news";
  enabled: boolean;
}

export interface LayoutConfig {
  backgroundColor: string;
  logoUrl: string | null;
  widgets: LayoutWidget[];
  fontFamily: string;
  fontSize: number;
}

export interface Zone {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  role: "media" | "widget";
}

export interface CreateLayoutInput {
  name: string;
  template: LayoutTemplate;
  config?: Partial<LayoutConfig>;
}

export interface UpdateLayoutInput {
  name?: string;
  template?: LayoutTemplate;
  config?: Partial<LayoutConfig>;
}

// ── Zonas padrão por template ────────────────────────────────────────

const DEFAULT_CONFIG: LayoutConfig = {
  backgroundColor: "#000000",
  logoUrl: null,
  widgets: [
    { type: "clock", enabled: true },
    { type: "weather", enabled: false },
    { type: "news", enabled: false },
  ],
  fontFamily: "Inter, system-ui, sans-serif",
  fontSize: 16,
};

function buildZones(template: LayoutTemplate): Zone[] {
  switch (template) {
    case "FULLSCREEN":
      return [
        { id: "main", name: "Principal", x: 0, y: 0, width: 100, height: 100, zIndex: 0, role: "media" },
      ];
    case "SPLIT_BOTTOM":
      return [
        { id: "main", name: "Principal", x: 0, y: 0, width: 100, height: 75, zIndex: 0, role: "media" },
        { id: "bottom", name: "Barra Inferior", x: 0, y: 75, width: 100, height: 25, zIndex: 1, role: "widget" },
      ];
    case "SPLIT_SIDE":
      return [
        { id: "main", name: "Principal", x: 0, y: 0, width: 70, height: 100, zIndex: 0, role: "media" },
        { id: "sidebar", name: "Coluna Lateral", x: 70, y: 0, width: 30, height: 100, zIndex: 1, role: "widget" },
      ];
    case "GRID":
      return [
        { id: "main", name: "Principal", x: 0, y: 0, width: 100, height: 70, zIndex: 0, role: "media" },
        { id: "widget-left", name: "Widget Esquerdo", x: 0, y: 70, width: 50, height: 30, zIndex: 1, role: "widget" },
        { id: "widget-right", name: "Widget Direito", x: 50, y: 70, width: 50, height: 30, zIndex: 1, role: "widget" },
      ];
    default:
      return [
        { id: "main", name: "Principal", x: 0, y: 0, width: 100, height: 100, zIndex: 0, role: "media" },
      ];
  }
}

// ── CRUD ──────────────────────────────────────────────────────────────

export async function listLayouts(prisma: PrismaClient, tenantId: string) {
  return prisma.layout.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { playlists: true, devices: true, deviceGroups: true } },
    },
  });
}

export async function getLayoutById(prisma: PrismaClient, tenantId: string, layoutId: string) {
  const layout = await prisma.layout.findFirst({
    where: { id: layoutId, tenantId },
    include: {
      playlists: { select: { id: true, name: true } },
      devices: { select: { id: true, name: true } },
      deviceGroups: { select: { id: true, name: true } },
    },
  });

  if (!layout) {
    throw Object.assign(new Error("Layout não encontrado"), {
      statusCode: 404,
      code: "LAYOUT_NOT_FOUND",
    });
  }

  return layout;
}

export async function createLayout(prisma: PrismaClient, tenantId: string, input: CreateLayoutInput) {
  const config: LayoutConfig = { ...DEFAULT_CONFIG, ...input.config };
  const zones = buildZones(input.template);

  // Se marcado como default, desmarcar os outros do tenant
  if ((input as { isDefault?: boolean }).isDefault) {
    await prisma.layout.updateMany({
      where: { tenantId, isDefault: true },
      data: { isDefault: false },
    });
  }

  return prisma.layout.create({
    data: {
      tenantId,
      name: input.name,
      template: input.template,
      zones: zones as object[],
      config: config as object,
      isDefault: false,
    },
  });
}

export async function updateLayout(
  prisma: PrismaClient,
  tenantId: string,
  layoutId: string,
  input: UpdateLayoutInput & { isDefault?: boolean }
) {
  const existing = await prisma.layout.findFirst({
    where: { id: layoutId, tenantId },
  });

  if (!existing) {
    throw Object.assign(new Error("Layout não encontrado"), {
      statusCode: 404,
      code: "LAYOUT_NOT_FOUND",
    });
  }

  const data: Record<string, unknown> = {};

  if (input.name !== undefined) data.name = input.name;

  if (input.template !== undefined) {
    data.template = input.template;
    data.zones = buildZones(input.template) as object[];
  }

  if (input.config !== undefined) {
    const currentConfig = (existing.config as Record<string, unknown>) ?? {};
    data.config = { ...DEFAULT_CONFIG, ...currentConfig, ...input.config };
  }

  if (input.isDefault === true) {
    await prisma.layout.updateMany({
      where: { tenantId, isDefault: true },
      data: { isDefault: false },
    });
    data.isDefault = true;
  } else if (input.isDefault === false) {
    data.isDefault = false;
  }

  return prisma.layout.update({
    where: { id: layoutId },
    data,
  });
}

export async function deleteLayout(prisma: PrismaClient, tenantId: string, layoutId: string): Promise<void> {
  const existing = await prisma.layout.findFirst({
    where: { id: layoutId, tenantId },
    include: { _count: { select: { playlists: true, devices: true, deviceGroups: true } } },
  });

  if (!existing) {
    throw Object.assign(new Error("Layout não encontrado"), {
      statusCode: 404,
      code: "LAYOUT_NOT_FOUND",
    });
  }

  if (existing._count.playlists > 0 || existing._count.devices > 0 || existing._count.deviceGroups > 0) {
    throw Object.assign(
      new Error("Não é possível excluir layout em uso por playlists, dispositivos ou grupos"),
      { statusCode: 409, code: "LAYOUT_IN_USE" }
    );
  }

  await prisma.layout.delete({ where: { id: layoutId } });
}

// ── Assign layout a device/group ─────────────────────────────────────

export async function assignLayout(
  prisma: PrismaClient,
  tenantId: string,
  layoutId: string,
  target: { deviceId?: string; groupId?: string }
) {
  const layout = await prisma.layout.findFirst({
    where: { id: layoutId, tenantId },
  });

  if (!layout) {
    throw Object.assign(new Error("Layout não encontrado"), {
      statusCode: 404,
      code: "LAYOUT_NOT_FOUND",
    });
  }

  if (target.deviceId) {
    const device = await prisma.device.findFirst({
      where: { id: target.deviceId, tenantId },
    });
    if (!device) {
      throw Object.assign(new Error("Dispositivo não encontrado"), {
        statusCode: 404,
        code: "DEVICE_NOT_FOUND",
      });
    }
    await prisma.device.update({
      where: { id: target.deviceId },
      data: { layoutId },
    });
  }

  if (target.groupId) {
    const group = await prisma.deviceGroup.findFirst({
      where: { id: target.groupId, tenantId },
    });
    if (!group) {
      throw Object.assign(new Error("Grupo não encontrado"), {
        statusCode: 404,
        code: "GROUP_NOT_FOUND",
      });
    }
    await prisma.deviceGroup.update({
      where: { id: target.groupId },
      data: { layoutId },
    });
  }

  return { assigned: true };
}

// ── Preview config (retorna a config completa para o frontend) ───────

export async function getPreviewConfig(prisma: PrismaClient, tenantId: string, layoutId: string) {
  const layout = await prisma.layout.findFirst({
    where: { id: layoutId, tenantId },
  });

  if (!layout) {
    throw Object.assign(new Error("Layout não encontrado"), {
      statusCode: 404,
      code: "LAYOUT_NOT_FOUND",
    });
  }

  return {
    id: layout.id,
    name: layout.name,
    template: layout.template,
    zones: layout.zones,
    config: layout.config,
  };
}

// ── Resolver layout para um device (usado pelo player/schedule) ──────

export async function resolveLayoutForDevice(prisma: PrismaClient, tenantId: string, deviceId: string) {
  // 1. Layout específico do device
  const device = await prisma.device.findFirst({
    where: { id: deviceId, tenantId },
    include: { layout: true, group: { include: { layout: true } } },
  });

  if (!device) return null;

  // Layout direto no device
  if (device.layout) {
    return {
      template: device.layout.template,
      zones: device.layout.zones,
      config: device.layout.config,
    };
  }

  // 2. Layout do grupo
  if (device.group?.layout) {
    return {
      template: device.group.layout.template,
      zones: device.group.layout.zones,
      config: device.group.layout.config,
    };
  }

  // 3. Layout default do tenant
  const defaultLayout = await prisma.layout.findFirst({
    where: { tenantId, isDefault: true },
  });

  if (defaultLayout) {
    return {
      template: defaultLayout.template,
      zones: defaultLayout.zones,
      config: defaultLayout.config,
    };
  }

  // 4. Sem layout — retorna FULLSCREEN padrão
  return {
    template: "FULLSCREEN" as const,
    zones: buildZones("FULLSCREEN"),
    config: DEFAULT_CONFIG,
  };
}
