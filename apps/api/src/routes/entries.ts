import {
  analyzeEntrySchema,
  createEntrySchema,
  reviewSuggestionSchema,
  uuidSchema
} from "@ideahub/shared";
import { desc, eq } from "drizzle-orm";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "../db/client";
import {
  analysisSuggestions,
  entries,
  entryTags,
  entryVersions,
  links,
  llmJobs,
  tags
} from "../db/schema";

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

const errorResponseSchema = z.object({
  code: z.string(),
  message: z.string()
});

const entryTagResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  source: z.enum(["manual", "ai"]),
  confidence: z.string().nullable(),
  approved: z.boolean()
});

const entryLinkResponseSchema = z.object({
  id: z.string().uuid(),
  sourceEntryId: z.string().uuid(),
  targetEntryId: z.string().uuid(),
  type: z.string(),
  strength: z.string(),
  justification: z.string().nullable(),
  createdBy: z.string()
});

const entryVersionResponseSchema = z.object({
  id: z.string().uuid(),
  version: z.number(),
  title: z.string().nullable(),
  content: z.string(),
  changeReason: z.string().nullable(),
  createdAt: z.string()
});

const entrySuggestionResponseSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["pending", "approved", "rejected"]),
  payload: z.unknown(),
  model: z.string(),
  createdAt: z.string(),
  reviewedAt: z.string().nullable()
});

const entryDetailResponseSchema = z.object({
  id: z.string().uuid(),
  vaultId: z.string().uuid(),
  projectId: z.string().uuid().nullable(),
  title: z.string().nullable(),
  content: z.string(),
  summary: z.string().nullable(),
  layer: z.string().nullable(),
  source: z.enum(["text", "voice", "import"]),
  status: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  versions: z.array(entryVersionResponseSchema),
  tags: z.array(entryTagResponseSchema),
  links: z.array(entryLinkResponseSchema),
  suggestions: z.array(entrySuggestionResponseSchema)
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

function serializeEntry(entry: typeof entries.$inferSelect) {
  return {
    ...entry,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString()
  };
}

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
      const created = await db.transaction(async (tx) => {
        const [entry] = await tx
          .insert(entries)
          .values({
            vaultId: request.body.vaultId,
            projectId: request.body.projectId ?? null,
            title: request.body.title ?? null,
            content: request.body.content,
            source: request.body.source,
            status: "pending_analysis"
          })
          .returning();

        if (!entry) {
          throw new Error("Failed to create entry.");
        }

        await tx.insert(entryVersions).values({
          entryId: entry.id,
          version: 1,
          title: entry.title,
          content: entry.content,
          changeReason: "Initial capture"
        });

        const [job] = await tx
          .insert(llmJobs)
          .values({
            entryId: entry.id,
            type: "analysis",
            status: "queued",
            input: {
              reason: "entry_created"
            }
          })
          .returning();

        if (!job) {
          throw new Error("Failed to queue analysis job.");
        }

        return { entry, job };
      });

      return reply.code(202).send({
        entry: {
          id: created.entry.id,
          vaultId: created.entry.vaultId,
          projectId: created.entry.projectId ?? undefined,
          title: created.entry.title ?? undefined,
          content: created.entry.content,
          source: created.entry.source,
          status: "pending_analysis"
        },
        job: {
          id: created.job.id,
          type: created.job.type,
          status: "queued"
        },
        message: "Entry captured and analysis job queued."
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
          200: entryDetailResponseSchema,
          404: errorResponseSchema
        }
      }
    },
    async (request, reply) => {
      const entry = await db.query.entries.findFirst({
        where: eq(entries.id, request.params.id)
      });

      if (!entry) {
        return reply.code(404).send({
          code: "ENTRY_NOT_FOUND",
          message: "Entry not found."
        });
      }

      const [versions, rawTags, rawLinks, suggestions] = await Promise.all([
        db.query.entryVersions.findMany({
          where: eq(entryVersions.entryId, entry.id),
          orderBy: [desc(entryVersions.version)]
        }),
        db
          .select({
            id: tags.id,
            name: tags.name,
            source: tags.source,
            confidence: entryTags.confidence,
            approved: entryTags.approved
          })
          .from(entryTags)
          .innerJoin(tags, eq(entryTags.tagId, tags.id))
          .where(eq(entryTags.entryId, entry.id)),
        db.query.links.findMany({
          where: eq(links.sourceEntryId, entry.id),
          orderBy: [desc(links.createdAt)]
        }),
        db.query.analysisSuggestions.findMany({
          where: eq(analysisSuggestions.entryId, entry.id),
          orderBy: [desc(analysisSuggestions.createdAt)]
        })
      ]);

      return {
        ...serializeEntry(entry),
        versions: versions.map((version) => ({
          ...version,
          createdAt: version.createdAt.toISOString()
        })),
        tags: rawTags,
        links: rawLinks,
        suggestions: suggestions.map((suggestion) => ({
          ...suggestion,
          createdAt: suggestion.createdAt.toISOString(),
          reviewedAt: suggestion.reviewedAt?.toISOString() ?? null
        }))
      };
    }
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
          202: analyzeEntryResponseSchema,
          404: errorResponseSchema
        }
      }
    },
    async (request, reply) => {
      const entry = await db.query.entries.findFirst({
        where: eq(entries.id, request.params.id)
      });

      if (!entry) {
        return reply.code(404).send({
          code: "ENTRY_NOT_FOUND",
          message: "Entry not found."
        });
      }

      const [job] = await db
        .insert(llmJobs)
        .values({
          entryId: entry.id,
          type: "analysis",
          status: "queued",
          input: {
            reason: "manual_analyze",
            force: request.body.force
          }
        })
        .returning();

      if (!job) {
        throw new Error("Failed to queue analysis job.");
      }

      return reply.code(202).send({
        entryId: entry.id,
        force: request.body.force,
        job: {
          id: job.id,
          type: job.type,
          status: "queued"
        }
      });
    }
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
