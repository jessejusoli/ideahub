import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import scalarApiReference from "@scalar/fastify-api-reference";
import type { FastifyInstance } from "fastify";
import { jsonSchemaTransform } from "fastify-type-provider-zod";

export function registerOpenApi(app: FastifyInstance) {
  app.register(swagger, {
    openapi: {
      openapi: "3.1.0",
      info: {
        title: "IdeaHub API",
        description:
          "API contract for IdeaHub, an intelligent second brain for capturing, connecting, and evolving knowledge.",
        version: "0.1.0"
      },
      servers: [
        {
          url: "http://localhost:3333",
          description: "Local API server"
        }
      ],
      tags: [
        { name: "Health", description: "Service health and readiness." },
        { name: "Vaults", description: "Knowledge vault ownership and scoping." },
        { name: "Projects", description: "Vault-scoped project and subproject organization." },
        { name: "Entries", description: "Thought capture, analysis, and review workflows." },
        { name: "Jobs", description: "Async processing hooks for analysis and ingestion work." },
        { name: "Search", description: "Semantic retrieval and RAG entry points." },
        { name: "Graph", description: "Knowledge graph retrieval." }
      ]
    },
    transform: jsonSchemaTransform
  });

  app.register(swaggerUi, {
    routePrefix: "/api/docs/swagger",
    uiConfig: {
      deepLinking: true,
      displayRequestDuration: true,
      docExpansion: "list"
    }
  });

  app.register(scalarApiReference, {
    routePrefix: "/api/docs/scalar",
    configuration: {
      title: "IdeaHub API Reference",
      url: "/api/openapi.json"
    }
  });

  app.get(
    "/api/openapi.json",
    {
      schema: {
        hide: true
      }
    },
    async () => app.swagger()
  );

  app.get(
    "/api/docs/redoc",
    {
      schema: {
        hide: true
      }
    },
    async (_request, reply) =>
      reply.type("text/html").send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>IdeaHub API Docs</title>
    <style>body{margin:0;padding:0}</style>
  </head>
  <body>
    <redoc spec-url="/api/openapi.json"></redoc>
    <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
  </body>
</html>`)
  );
}
