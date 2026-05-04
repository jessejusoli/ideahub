import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";

const healthResponseSchema = z.object({
  ok: z.boolean(),
  service: z.string(),
  status: z.string()
});

export const registerHealthRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/health",
    {
      schema: {
        tags: ["Health"],
        summary: "Check API health",
        response: {
          200: healthResponseSchema
        }
      }
    },
    async () => ({
      ok: true,
      service: "@ideahub/api",
      status: "mvp-foundation"
    })
  );
};
