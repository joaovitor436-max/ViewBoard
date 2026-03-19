import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create default tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: "default" },
    update: {},
    create: {
      name: "ViewBoard Demo",
      slug: "default",
      timezone: "America/Sao_Paulo",
      settings: {},
    },
  });

  console.log(`Tenant created: ${tenant.name} (${tenant.id})`);

  // Create admin user
  const passwordHash = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: "admin@viewboard.local" } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: "admin@viewboard.local",
      passwordHash,
      name: "Administrador",
      role: "ADMIN",
    },
  });

  console.log(`Admin user created: ${admin.email}`);

  // Create a default layout with a single fullscreen zone
  const layout = await prisma.layout.upsert({
    where: { id: "default-layout" },
    update: {},
    create: {
      id: "default-layout",
      tenantId: tenant.id,
      name: "Tela Inteira",
      zones: [
        {
          id: "main",
          name: "Principal",
          x: 0,
          y: 0,
          width: 100,
          height: 100,
        },
      ],
    },
  });

  console.log(`Layout created: ${layout.name}`);

  // Create sample content
  const announcement = await prisma.content.upsert({
    where: { id: "sample-announcement" },
    update: {},
    create: {
      id: "sample-announcement",
      tenantId: tenant.id,
      name: "Bem-vindo ao ViewBoard",
      type: "ANNOUNCEMENT",
      body: {
        title: "Bem-vindo ao ViewBoard",
        message: "Sistema de sinalização digital pronto para uso!",
        backgroundColor: "#1e40af",
        textColor: "#ffffff",
      },
      durationSec: 10,
      tags: ["demo", "welcome"],
    },
  });

  console.log(`Content created: ${announcement.name}`);

  // Create a default playlist
  const playlist = await prisma.playlist.upsert({
    where: { id: "default-playlist" },
    update: {},
    create: {
      id: "default-playlist",
      tenantId: tenant.id,
      name: "Playlist Padrão",
      layoutId: layout.id,
      isDefault: true,
      items: {
        create: [
          {
            contentId: announcement.id,
            zoneId: "main",
            order: 0,
          },
        ],
      },
    },
  });

  console.log(`Playlist created: ${playlist.name}`);

  // ── Device Management seed data ──────────────────────────────────────

  // Create 2 device groups
  const groupLobby = await prisma.deviceGroup.upsert({
    where: { id: "group-lobby" },
    update: {},
    create: {
      id: "group-lobby",
      tenantId: tenant.id,
      name: "Lobby / Recepção",
      description: "TVs na área de recepção e entrada principal",
    },
  });

  const groupSalas = await prisma.deviceGroup.upsert({
    where: { id: "group-salas" },
    update: {},
    create: {
      id: "group-salas",
      tenantId: tenant.id,
      name: "Salas de Reunião",
      description: "TVs nas salas de reunião e auditórios",
    },
  });

  console.log(`Device groups created: ${groupLobby.name}, ${groupSalas.name}`);

  // Create 5 devices with varied statuses
  const devicesData = [
    {
      id: "device-01",
      name: "TV Recepção Principal",
      location: "Lobby - Andar Térreo",
      groupId: groupLobby.id,
      pairingCode: "ABC123",
      status: "ONLINE" as const,
      lastSeenAt: new Date(),
    },
    {
      id: "device-02",
      name: "TV Corredor Elevadores",
      location: "Lobby - Corredor A",
      groupId: groupLobby.id,
      pairingCode: "DEF456",
      status: "ONLINE" as const,
      lastSeenAt: new Date(Date.now() - 60 * 1000), // 1 min ago
    },
    {
      id: "device-03",
      name: "TV Sala Reunião 1",
      location: "3º Andar - Sala 301",
      groupId: groupSalas.id,
      pairingCode: "GHJ789",
      status: "OFFLINE" as const,
      lastSeenAt: new Date(Date.now() - 30 * 60 * 1000), // 30 min ago
    },
    {
      id: "device-04",
      name: "TV Auditório",
      location: "2º Andar - Auditório Principal",
      groupId: groupSalas.id,
      pairingCode: "KLM246",
      status: "PENDING" as const,
      lastSeenAt: null,
    },
    {
      id: "device-05",
      name: "TV Cafeteria",
      location: "Térreo - Área de Convivência",
      groupId: null,
      pairingCode: "NPQ357",
      status: "OFFLINE" as const,
      lastSeenAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    },
  ];

  for (const d of devicesData) {
    await prisma.device.upsert({
      where: { id: d.id },
      update: {},
      create: {
        id: d.id,
        tenantId: tenant.id,
        name: d.name,
        location: d.location,
        groupId: d.groupId,
        pairingCode: d.pairingCode,
        status: d.status,
        lastSeenAt: d.lastSeenAt,
      },
    });
  }

  console.log(`Devices created: ${devicesData.length} devices`);

  console.log("\nSeed completed!");
  console.log("Login credentials:");
  console.log("  Email: admin@viewboard.local");
  console.log("  Password: admin123");
  console.log("\nSample pairing codes: ABC123, DEF456, GHJ789, KLM246, NPQ357");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
