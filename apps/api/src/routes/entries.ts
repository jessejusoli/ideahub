import crypto from "node:crypto";
import {
  analyzeEntrySchema,
  createEntrySchema,
  reviewSuggestionSchema,
  uuidSchema
} from "@ideahub/shared";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";

const paramsSchema = z.object({
  id: uuidSchema
});

const queuedJobSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(["analysis", "embedding", "transcription"]),
  status: z.enum(["queued", "running", "succeeded", "failed"])
});

const createEntryResponseSchema = z.object({
  entry: z.object({
    id: z.string().uuid(),
    vaultId: z.string().uuid(),
    projectId: z.string().uuid().optional(),
    title: z.string().optional(),
    content: z.string(),
    source: z.enum(["text", "voice", "import"]),
    status: z.literal("pending_analysis")
  }),
  job: queuedJobSchema,
  message: z.string()
});

const notImplementedSchema = z.object({
  code: z.string(),
  message: z.string()
});

const entryDetailResponseSchema = z.object({
  id: z.string().uuid(),
  status: z.string(),
  versions: z.array(z.unknown()),
  tags: z.array(z.unknown()),
  links: z.array(z.unknown()),
  suggestions: z.array(z.unknown())
});

const analyzeEntryResponseSchema = z.object({
  entryId: z.string().uuid(),
  force: z.boolean(),
  job: queuedJobSchema
});

const reviewEntryResponseSchema = z.object({
  entryId: z.string().uuid(),
  suggestionId: z.string().uuid(),
  status: z.enum(["pending", "approved", "rejected"]),
  editedPayload: z.record(z.string(), z.unknown()).nullable()
});

export const registerEntryRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    "/entries",
    {
      schema: {
        tags: ["Entries"],
        summary: "Create a text entry",
        body: createEntrySchema,
        response: {
          202: createEntryResponseSchema
        }
      }
    },
    async (request, reply) => {
      const input = request.body;
      const entryId = crypto.randomUUID();

      return reply.code(202).send({
        entry: {
          id: entryId,
          ...input,
          status: "pending_analysis"
        },
        job: {
          id: crypto.randomUUID(),
          type: "analysis",
          status: "queued"
        },
        message: "Entry accepted. Database-backed persistence is the next implementation step."
      });
    }
  );

  app.post(
    "/entries/audio",
    {
      schema: {
        tags: ["Entries"],
        summary: "Create an audio entry",
        response: {
          501: notImplementedSchema
        }
      }
    },
    async (_request, reply) =>
      reply.code(501).send({
        code: "AUDIO_PIPELINE_PENDING",
        message: "Audio upload and transcription are planned for the ingestion pipeline phase."
      })
  );

  app.get(
    "/entries/:id",
    {
      schema: {
        tags: ["Entries"],
        summary: "Get an entry with versions, tags, links, and suggestions",
        params: paramsSchema,
        response: {
          200: entryDetailResponseSchema
        }
      }
    },
    async (request) => ({
      id: request.params.id,
      status: "not_persisted_yet",
      versions: [],
      tags: [],
      links: [],
      suggestions: []
    })
  );

  app.post(
    "/entries/:id/analyze",
    {
      schema: {
        tags: ["Entries"],
        summary: "Queue LLM/RAG analysis for an entry",
        params: paramsSchema,
        body: analyzeEntrySchema,
        response: {
          202: analyzeEntryResponseSchema
        }
      }
    },
    async (request, reply) =>
      reply.code(202).send({
        entryId: request.params.id,
        force: request.body.force,
        job: {
          id: crypto.randomUUID(),
          type: "analysis",
          status: "queued"
        }
      })
  );

  app.post(
    "/entries/:id/review",
    {
      schema: {
        tags: ["Entries"],
        summary: "Review an AI-generated analysis suggestion",
        params: paramsSchema,
        body: reviewSuggestionSchema,
        response: {
          200: reviewEntryResponseSchema
        }
      }
    },
    async (request) => ({
      entryId: request.params.id,
      suggestionId: request.body.suggestionId,
      status: request.body.status,
      editedPayload: request.body.editedPayload ?? null
    })
  );
};
