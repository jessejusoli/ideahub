import { uuidSchema } from "@ideahub/shared";
import { eq } from "drizzle-orm";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "../db/client";
import { entries, links } from "../db/schema";
import { coerceMetadata } from "../notes/markdown";

const graphQuerySchema = z.object({
  vaultId: uuidSchema.optional()
});

const graphResponseSchema = z.object({
  vaultId: z.string().uuid().nullable(),
  nodes: z.array(
    z.object({
      id: z.string().uuid(),
      title: z.string().nullable(),
      path: z.string().nullable(),
      layer: z.string().nullable()
    })
  ),
  edges: z.array(
    z.object({
      id: z.string().uuid(),
      source: z.string().uuid(),
      target: z.string().uuid(),
      type: z.string(),
      strength: z.string()
    })
  ),
  message: z.string()
});

export const registerGraphRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/graph",
    {
      schema: {
        tags: ["Graph"],
        summary: "Get graph nodes and edges for a vault",
        querystring: graphQuerySchema,
        response: {
          200: graphResponseSchema
        }
      }
    },
    async (request) => {
      const [rawEntries, rawLinks] = await Promise.all([
        db.query.entries.findMany({
          where: request.query.vaultId ? eq(entries.vaultId, request.query.vaultId) : undefined
        }),
        db.query.links.findMany({
          where: request.query.vaultId ? eq(links.vaultId, request.query.vaultId) : undefined
        })
      ]);

      return {
        vaultId: request.query.vaultId ?? null,
        nodes: rawEntries.map((entry) => ({
          id: entry.id,
          title: entry.title,
          path: coerceMetadata(entry.metadata).path ?? null,
          layer: entry.layer
        })),
        edges: rawLinks.map((link) => ({
          id: link.id,
          source: link.sourceEntryId,
          target: link.targetEntryId,
          type: link.type,
          strength: link.strength
        })),
        message: "Graph generated from canonical PostgreSQL notes and links."
      };
    }
  );
};
