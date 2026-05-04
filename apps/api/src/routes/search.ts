import { semanticSearchSchema } from "@ideahub/shared";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { semanticSearch } from "../analysis/pipeline";

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

export const registerSearchRoutes: FastifyPluginAsyncZod = async (app) => {
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
