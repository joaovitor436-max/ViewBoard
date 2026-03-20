import fp from "fastify-plugin";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import type { FastifyInstance } from "fastify";

export default fp(async function swaggerPlugin(fastify: FastifyInstance) {
  await fastify.register(swagger, {
    openapi: {
      openapi: "3.0.3",
      info: {
        title: "ViewBoard API",
        description: "API de sinalização digital ViewBoard — gerenciamento de telas, playlists, mídias, agendamentos e dispositivos.",
        version: "1.0.0",
        contact: {
          name: "ViewBoard",
        },
      },
      servers: [
        {
          url: "http://localhost:3001",
          description: "Desenvolvimento local",
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
            description: "Token JWT de autenticação de usuário",
          },
          playerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
            description: "Token JWT do player/dispositivo",
          },
        },
      },
      tags: [
        { name: "Auth", description: "Autenticação e tokens" },
        { name: "Users", description: "Gestão de utilizadores" },
        { name: "Screens", description: "Gestão de telas/ecrãs" },
        { name: "Devices", description: "Gestão de dispositivos" },
        { name: "Device Groups", description: "Grupos de dispositivos" },
        { name: "Media", description: "Biblioteca de mídias (imagens e vídeos)" },
        { name: "Content", description: "Objetos de conteúdo" },
        { name: "Playlists", description: "Playlists e itens" },
        { name: "Schedules", description: "Agendamentos e recorrência" },
        { name: "Layouts", description: "Templates de layout" },
        { name: "Widgets", description: "Configuração de widgets" },
        { name: "Player", description: "API do player" },
        { name: "Integrations", description: "Integrações externas (weather, news)" },
        { name: "Monitoring", description: "Health checks e monitoramento" },
      ],
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: "/api/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
      filter: true,
      tryItOutEnabled: true,
    },
    staticCSP: true,
  });

  fastify.log.info("Swagger UI available at /api/docs");
});
