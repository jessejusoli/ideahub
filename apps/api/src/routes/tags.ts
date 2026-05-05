import { uuidSchema } from "@ideahub/shared";
import { eq } from "drizzle-orm";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "../db/client";
import { entryTags, tags } from "../db/schema";

const tagsQuerySchema = z.object({
  vaultId: uuidSchema.optional()
});

const tagsResponseSchema = z.object({
  tags: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      source: z.enum(["manual", "ai"]),
      count: z.number()
    })
  )
});

export const registerTagRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/tags",
    {
      schema: {
        tags: ["Tags"],
        summary: "List vault tags with note counts",
        querystring: tagsQuerySchema,
        response: {
          200: tagsResponseSchema
        }
      }
    },
    async (request) => {
      const allTags = await db.query.tags.findMany({
        where: request.query.vaultId ? eq(tags.vaultId, request.query.vaultId) : undefined
      });
      const tagCounts = await db.select().from(entryTags);

      return {
        tags: allTags.map((tag) => ({
          id: tag.id,
          name: tag.name,
          source: tag.source,
          count: tagCounts.filter((entryTag) => entryTag.tagId === tag.id).length
        }))
      };
    }
  );
};
