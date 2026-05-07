import {
  analyzeEntrySchema,
  createAudioEntrySchema,
  createEntrySchema,
  layers,
  linkTypes,
  reviewSuggestionSchema,
  uuidSchema
} from "@ideahub/shared";
import { and, desc, eq } from "drizzle-orm";
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
  editedPayload: z.record(z.string(), z.unknown()).nullable(),
  applied: z.boolean()
});

const suggestionPayloadSchema = z
  .object({
    layer: z.enum(layers).optional(),
    summary: z.string().optional(),
    tags: z.array(z.string()).optional(),
    links: z
      .array(
        z.object({
          targetEntryId: z.string().uuid(),
          type: z.enum(linkTypes).default("relates_to"),
          strength: z.number().min(0).max(1),
          justification: z.string(),
          confidence: z.number().min(0).max(1)
        })
      )
      .optional()
  })
  .passthrough();

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
        summary: "Create an audio entry with optional transcript",
        body: createAudioEntrySchema,
        response: {
          202: createEntryResponseSchema
        }
      }
    },
    async (request, reply) => {
      const transcript =
        request.body.transcript ??
        "[Audio recording captured. Transcription is pending provider configuration.]";
      const created = await db.transaction(async (tx) => {
        const [entry] = await tx
          .insert(entries)
          .values({
            vaultId: request.body.vaultId,
            projectId: request.body.projectId ?? null,
            title: request.body.title ?? "Audio recording",
            content: transcript,
            source: "voice",
            status: "pending_analysis",
            metadata: {
              kind: "audio",
              audio: {
                mimeType: request.body.mimeType,
                durationSeconds: request.body.durationSeconds ?? null,
                hasInlineAudioData: Boolean(request.body.audioData),
                transcriptionStatus: request.body.transcript ? "provided" : "pending"
              }
            }
          })
          .returning();

        if (!entry) {
          throw new Error("Failed to create audio entry.");
        }

        await tx.insert(entryVersions).values({
          entryId: entry.id,
          version: 1,
          title: entry.title,
          content: entry.content,
          changeReason: "Initial audio capture"
        });

        const [job] = await tx
          .insert(llmJobs)
          .values({
            entryId: entry.id,
            type: request.body.transcript ? "analysis" : "transcription",
            status: "queued",
            input: {
              reason: "audio_entry_created",
              mimeType: request.body.mimeType,
              durationSeconds: request.body.durationSeconds ?? null,
              audioData: request.body.audioData ? "[inline audio data omitted]" : null
            }
          })
          .returning();

        if (!job) {
          throw new Error("Failed to queue audio job.");
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
          source: "voice",
          status: "pending_analysis"
        },
        job: {
          id: created.job.id,
          type: created.job.type,
          status: "queued"
        },
        message: "Audio entry captured in PostgreSQL and queued for transcription or analysis."
      });
    }
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
          200: reviewEntryResponseSchema,
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

      const suggestion = await db.query.analysisSuggestions.findFirst({
        where: and(
          eq(analysisSuggestions.id, request.body.suggestionId),
          eq(analysisSuggestions.entryId, entry.id)
        )
      });

      if (!suggestion) {
        return reply.code(404).send({
          code: "SUGGESTION_NOT_FOUND",
          message: "Suggestion not found for this entry."
        });
      }

      const editedPayload = request.body.editedPayload ?? null;
      const payload = suggestionPayloadSchema.parse(editedPayload ?? suggestion.payload);

      await db.transaction(async (tx) => {
        await tx
          .update(analysisSuggestions)
          .set({
            status: request.body.status,
            payload,
            reviewedAt: new Date()
          })
          .where(eq(analysisSuggestions.id, suggestion.id));

        if (request.body.status !== "approved") {
          return;
        }

        await tx
          .update(entries)
          .set({
            summary: payload.summary ?? entry.summary,
            layer: payload.layer ?? entry.layer,
            status: "published",
            updatedAt: new Date()
          })
          .where(eq(entries.id, entry.id));

        for (const tagName of payload.tags ?? []) {
          const name = tagName.trim().toLowerCase().slice(0, 80);

          if (!name) {
            continue;
          }

          const [tag] = await tx
            .insert(tags)
            .values({
              vaultId: entry.vaultId,
              name,
              source: "ai"
            })
            .onConflictDoUpdate({
              target: [tags.vaultId, tags.name],
              set: {
                source: "ai",
                updatedAt: new Date()
              }
            })
            .returning();

          if (!tag) {
            continue;
          }

          await tx
            .insert(entryTags)
            .values({
              entryId: entry.id,
              tagId: tag.id,
              confidence: "0.700",
              approved: true
            })
            .onConflictDoUpdate({
              target: [entryTags.entryId, entryTags.tagId],
              set: {
                confidence: "0.700",
                approved: true
              }
            });
        }

        for (const link of payload.links ?? []) {
          if (link.targetEntryId === entry.id) {
            continue;
          }

          await tx
            .insert(links)
            .values({
              vaultId: entry.vaultId,
              sourceEntryId: entry.id,
              targetEntryId: link.targetEntryId,
              type: link.type,
              strength: link.strength.toFixed(3),
              justification: link.justification,
              createdBy: "ai"
            })
            .onConflictDoUpdate({
              target: [links.sourceEntryId, links.targetEntryId, links.type],
              set: {
                strength: link.strength.toFixed(3),
                justification: link.justification,
                updatedAt: new Date()
              }
            });
        }
      });

      return {
        entryId: request.params.id,
        suggestionId: request.body.suggestionId,
        status: request.body.status,
        editedPayload,
        applied: request.body.status === "approved"
      };
    }
  );
};
