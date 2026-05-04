import { createVaultSchema } from "@ideahub/shared";
import { desc, eq } from "drizzle-orm";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "../db/client";
import { getOrCreateDevUser } from "../db/dev-user";
import { vaultMembers, vaults } from "../db/schema";

const vaultResponseSchema = z.object({
  id: z.string().uuid(),
  ownerId: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});

const vaultListResponseSchema = z.object({
  vaults: z.array(vaultResponseSchema)
});

function serializeVault(vault: typeof vaults.$inferSelect) {
  return {
    ...vault,
    createdAt: vault.createdAt.toISOString(),
    updatedAt: vault.updatedAt.toISOString()
  };
}

export const registerVaultRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/vaults",
    {
      schema: {
        tags: ["Vaults"],
        summary: "List vaults for the development user",
        response: {
          200: vaultListResponseSchema
        }
      }
    },
    async () => {
      const user = await getOrCreateDevUser();
      const rows = await db.query.vaults.findMany({
        where: eq(vaults.ownerId, user.id),
        orderBy: [desc(vaults.createdAt)]
      });

      return {
        vaults: rows.map(serializeVault)
      };
    }
  );

  app.post(
    "/vaults",
    {
      schema: {
        tags: ["Vaults"],
        summary: "Create a vault",
        body: createVaultSchema,
        response: {
          201: vaultResponseSchema
        }
      }
    },
    async (request, reply) => {
      const user = await getOrCreateDevUser();
      const created = await db.transaction(async (tx) => {
        const [vault] = await tx
          .insert(vaults)
          .values({
            ownerId: user.id,
            name: request.body.name,
            description: request.body.description ?? null
          })
          .returning();

        if (!vault) {
          throw new Error("Failed to create vault.");
        }

        await tx.insert(vaultMembers).values({
          vaultId: vault.id,
          userId: user.id,
          role: "owner"
        });

        return vault;
      });

      return reply.code(201).send(serializeVault(created));
    }
  );
};
