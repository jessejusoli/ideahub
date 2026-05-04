import { createProjectSchema, uuidSchema } from "@ideahub/shared";
import { and, desc, eq } from "drizzle-orm";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "../db/client";
import { projects, vaults } from "../db/schema";

const projectQuerySchema = z.object({
  vaultId: uuidSchema
});

const projectResponseSchema = z.object({
  id: z.string().uuid(),
  vaultId: z.string().uuid(),
  parentProjectId: z.string().uuid().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});

const projectListResponseSchema = z.object({
  projects: z.array(projectResponseSchema)
});

function serializeProject(project: typeof projects.$inferSelect) {
  return {
    ...project,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString()
  };
}

async function assertVaultExists(vaultId: string) {
  const vault = await db.query.vaults.findFirst({
    where: eq(vaults.id, vaultId)
  });

  if (!vault) {
    throw new Error("Vault not found.");
  }
}

export const registerProjectRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/projects",
    {
      schema: {
        tags: ["Projects"],
        summary: "List projects for a vault",
        querystring: projectQuerySchema,
        response: {
          200: projectListResponseSchema
        }
      }
    },
    async (request) => {
      const rows = await db.query.projects.findMany({
        where: eq(projects.vaultId, request.query.vaultId),
        orderBy: [desc(projects.createdAt)]
      });

      return {
        projects: rows.map(serializeProject)
      };
    }
  );

  app.post(
    "/projects",
    {
      schema: {
        tags: ["Projects"],
        summary: "Create a project or subproject",
        body: createProjectSchema,
        response: {
          201: projectResponseSchema
        }
      }
    },
    async (request, reply) => {
      await assertVaultExists(request.body.vaultId);

      if (request.body.parentProjectId) {
        const parent = await db.query.projects.findFirst({
          where: and(
            eq(projects.id, request.body.parentProjectId),
            eq(projects.vaultId, request.body.vaultId)
          )
        });

        if (!parent) {
          throw new Error("Parent project not found in this vault.");
        }
      }

      const [project] = await db
        .insert(projects)
        .values({
          vaultId: request.body.vaultId,
          parentProjectId: request.body.parentProjectId ?? null,
          name: request.body.name,
          description: request.body.description ?? null
        })
        .returning();

      if (!project) {
        throw new Error("Failed to create project.");
      }

      return reply.code(201).send(serializeProject(project));
    }
  );
};
