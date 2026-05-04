import { semanticSearchSchema } from "@ideahub/shared";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";

const semanticSearchResponseSchema = z.object({
  query: z.string(),
  vaultId: z.string().uuid().nullable(),
  limit: z.number(),
  results: z.array(z.unknown()),
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
    async (request) => ({
      query: request.query.q,
      vaultId: request.query.vaultId ?? null,
      limit: request.query.limit,
      results: [],
      message:
        "Semantic search contract is ready. pgvector retrieval will be wired after migrations."
    })
  );
};
