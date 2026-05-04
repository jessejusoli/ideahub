import { uuidSchema } from "@ideahub/shared";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";

const graphQuerySchema = z.object({
  vaultId: uuidSchema.optional()
});

const graphResponseSchema = z.object({
  vaultId: z.string().uuid().nullable(),
  nodes: z.array(z.unknown()),
  edges: z.array(z.unknown()),
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
    async (request) => ({
      vaultId: request.query.vaultId ?? null,
      nodes: [],
      edges: [],
      message: "Graph response shape is ready for the first 2D visualization."
    })
  );
};
