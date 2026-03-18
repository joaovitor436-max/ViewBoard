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

  console.log("\nSeed completed!");
  console.log("Login credentials:");
  console.log("  Email: admin@viewboard.local");
  console.log("  Password: admin123");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
