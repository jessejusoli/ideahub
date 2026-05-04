import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { processAnalysisJob, processNextAnalysisJob } from "../analysis/pipeline";
import { db } from "../db/client";
import { llmJobs } from "../db/schema";
import { eq } from "drizzle-orm";
import { uuidSchema } from "@ideahub/shared";

const jobParamsSchema = z.object({
  id: uuidSchema
});

const processedJobSchema = z.object({
  jobId: z.string().uuid(),
  entryId: z.string().uuid(),
  suggestionId: z.string().uuid(),
  chunks: z.number(),
  retrievedContext: z.number()
});

const noJobResponseSchema = z.object({
  processed: z.literal(false),
  message: z.string()
});

const processJobResponseSchema = z.object({
  processed: z.literal(true),
  result: processedJobSchema
});

const jobNotFoundResponseSchema = z.object({
  code: z.string(),
  message: z.string()
});

export const registerJobRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    "/jobs/process-next",
    {
      schema: {
        tags: ["Jobs"],
        summary: "Process the next queued analysis job",
        response: {
          200: z.union([processJobResponseSchema, noJobResponseSchema])
        }
      }
    },
    async () => {
      const result = await processNextAnalysisJob();

      if (!result) {
        return {
          processed: false as const,
          message: "No queued analysis job is ready to process."
        };
      }

      return {
        processed: true as const,
        result
      };
    }
  );

  app.post(
    "/jobs/:id/process",
    {
      schema: {
        tags: ["Jobs"],
        summary: "Process a specific queued analysis job",
        params: jobParamsSchema,
        response: {
          200: processJobResponseSchema,
          404: jobNotFoundResponseSchema
        }
      }
    },
    async (request, reply) => {
      const job = await db.query.llmJobs.findFirst({
        where: eq(llmJobs.id, request.params.id)
      });

      if (!job) {
        return reply.code(404).send({
          code: "JOB_NOT_FOUND",
          message: "Job not found."
        });
      }

      const result = await processAnalysisJob(job.id);

      if (!result) {
        return reply.code(404).send({
          code: "JOB_NOT_PROCESSABLE",
          message: "Only analysis jobs associated with an entry can be processed."
        });
      }

      return {
        processed: true as const,
        result
      };
    }
  );
};
