import { semanticSearchSchema, textSearchSchema } from "@ideahub/shared";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { semanticSearch } from "../analysis/pipeline";
import { db } from "../db/client";
import { entries } from "../db/schema";
import { coerceMetadata } from "../notes/markdown";

const semanticSearchResponseSchema = z.object({
  query: z.string(),
  vaultId: z.string().uuid().nullable(),
  limit: z.number(),
  results: z.array(
    z.object({
      entryId: z.string().uuid(),
      title: z.string().nullable(),
      content: z.string(),
      chunk: z.string(),
      score: z.number()
    })
  ),
  message: z.string()
});

const textSearchResponseSchema = z.object({
  query: z.string(),
  vaultId: z.string().uuid().nullable(),
  limit: z.number(),
  results: z.array(
    z.object({
      entryId: z.string().uuid(),
      title: z.string().nullable(),
      path: z.string().nullable(),
      excerpt: z.string(),
      updatedAt: z.string()
    })
  )
});

export const registerSearchRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/search",
    {
      schema: {
        tags: ["Search"],
        summary: "Search notes by title, content, path, or properties",
        querystring: textSearchSchema,
        response: {
          200: textSearchResponseSchema
        }
      }
    },
    async (request) => {
      const filters = [
        request.query.vaultId ? eq(entries.vaultId, request.query.vaultId) : undefined,
        or(
          ilike(entries.title, `%${request.query.q}%`),
          ilike(entries.content, `%${request.query.q}%`)
        )
      ].filter(Boolean);
      const results = await db.query.entries.findMany({
        where: and(...filters),
        orderBy: [desc(entries.updatedAt)],
        limit: request.query.limit
      });

      return {
        query: request.query.q,
        vaultId: request.query.vaultId ?? null,
        limit: request.query.limit,
        results: results.map((entry) => ({
          entryId: entry.id,
          title: entry.title,
          path: coerceMetadata(entry.metadata).path ?? null,
          excerpt: buildExcerpt(entry.content, request.query.q),
          updatedAt: entry.updatedAt.toISOString()
        }))
      };
    }
  );

  app.get(
    "/search/semantic",
    {
      schema: {
        tags: ["Search"],
        summary: "Run semantic search over a vault",
        querystring: semanticSearchSchema,
        response: {
          200: semanticSearchResponseSchema
        }
      }
    },
    async (request) => {
      const results = await semanticSearch({
        query: request.query.q,
        vaultId: request.query.vaultId,
        limit: request.query.limit
      });

      return {
        query: request.query.q,
        vaultId: request.query.vaultId ?? null,
        limit: request.query.limit,
        results,
        message: "Semantic search completed with pgvector-backed deterministic embeddings."
      };
    }
  );
};

function buildExcerpt(content: string, query: string) {
  const index = content.toLowerCase().indexOf(query.toLowerCase());

  if (index === -1) {
    return content.slice(0, 180);
  }

  return content.slice(Math.max(0, index - 80), index + query.length + 100).trim();
}
