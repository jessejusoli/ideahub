import { createBookmarkSchema, updateBookmarkSchema, uuidSchema } from "@ideahub/shared";
import { eq } from "drizzle-orm";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "../db/client";
import { entries } from "../db/schema";
import { coerceMetadata } from "../notes/markdown";

const paramsSchema = z.object({
  id: uuidSchema
});

const bookmarksQuerySchema = z.object({
  vaultId: uuidSchema.optional()
});

const bookmarkPayloadSchema = z.object({
  type: z.enum(["note", "search", "heading", "canvas", "graph", "external"]),
  targetId: z.string().uuid().nullable(),
  targetPath: z.string().nullable(),
  query: z.string().nullable(),
  url: z.string().nullable()
});

const bookmarkResponseSchema = z.object({
  id: z.string().uuid(),
  vaultId: z.string().uuid(),
  label: z.string(),
  payload: bookmarkPayloadSchema,
  createdAt: z.string(),
  updatedAt: z.string()
});

const bookmarksResponseSchema = z.object({
  bookmarks: z.array(bookmarkResponseSchema)
});

const deleteResponseSchema = z.object({
  id: z.string().uuid(),
  deleted: z.boolean()
});

const errorResponseSchema = z.object({
  code: z.string(),
  message: z.string()
});

export const registerBookmarkRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/bookmarks",
    {
      schema: {
        tags: ["Bookmarks"],
        summary: "List saved PostgreSQL-native bookmarks",
        querystring: bookmarksQuerySchema,
        response: {
          200: bookmarksResponseSchema
        }
      }
    },
    async (request) => {
      const allEntries = await db.query.entries.findMany({
        where: request.query.vaultId ? eq(entries.vaultId, request.query.vaultId) : undefined
      });

      return {
        bookmarks: allEntries
          .filter((entry) => coerceMetadata(entry.metadata).kind === "bookmark")
          .map(serializeBookmark)
      };
    }
  );

  app.post(
    "/bookmarks",
    {
      schema: {
        tags: ["Bookmarks"],
        summary: "Create a bookmark",
        body: createBookmarkSchema,
        response: {
          201: bookmarkResponseSchema
        }
      }
    },
    async (request, reply) => {
      const payload = toBookmarkPayload(request.body);
      const [bookmark] = await db
        .insert(entries)
        .values({
          vaultId: request.body.vaultId,
          title: request.body.label,
          content: JSON.stringify(payload, null, 2),
          source: "import",
          status: "published",
          metadata: {
            kind: "bookmark",
            bookmark: payload
          }
        })
        .returning();

      if (!bookmark) {
        throw new Error("Failed to create bookmark.");
      }

      return reply.code(201).send(serializeBookmark(bookmark));
    }
  );

  app.patch(
    "/bookmarks/:id",
    {
      schema: {
        tags: ["Bookmarks"],
        summary: "Update a bookmark",
        params: paramsSchema,
        body: updateBookmarkSchema,
        response: {
          200: bookmarkResponseSchema,
          404: errorResponseSchema
        }
      }
    },
    async (request, reply) => {
      const existing = await db.query.entries.findFirst({
        where: eq(entries.id, request.params.id)
      });

      if (!existing || coerceMetadata(existing.metadata).kind !== "bookmark") {
        return reply.code(404).send({
          code: "BOOKMARK_NOT_FOUND",
          message: "Bookmark not found."
        });
      }

      const previousPayload = coerceBookmarkPayload(coerceMetadata(existing.metadata).bookmark);
      const payload = {
        ...previousPayload,
        type: request.body.type ?? previousPayload.type,
        targetId: request.body.targetId ?? previousPayload.targetId,
        targetPath: request.body.targetPath ?? previousPayload.targetPath,
        query: request.body.query ?? previousPayload.query,
        url: request.body.url ?? previousPayload.url
      };
      const label = request.body.label ?? existing.title ?? "Bookmark";
      const [bookmark] = await db
        .update(entries)
        .set({
          title: label,
          content: JSON.stringify(payload, null, 2),
          metadata: {
            ...coerceMetadata(existing.metadata),
            kind: "bookmark",
            bookmark: payload
          },
          updatedAt: new Date()
        })
        .where(eq(entries.id, existing.id))
        .returning();

      if (!bookmark) {
        throw new Error("Failed to update bookmark.");
      }

      return serializeBookmark(bookmark);
    }
  );

  app.delete(
    "/bookmarks/:id",
    {
      schema: {
        tags: ["Bookmarks"],
        summary: "Delete a bookmark",
        params: paramsSchema,
        response: {
          200: deleteResponseSchema,
          404: errorResponseSchema
        }
      }
    },
    async (request, reply) => {
      const existing = await db.query.entries.findFirst({
        where: eq(entries.id, request.params.id)
      });

      if (!existing || coerceMetadata(existing.metadata).kind !== "bookmark") {
        return reply.code(404).send({
          code: "BOOKMARK_NOT_FOUND",
          message: "Bookmark not found."
        });
      }

      await db.delete(entries).where(eq(entries.id, existing.id));

      return {
        id: existing.id,
        deleted: true
      };
    }
  );
};

function serializeBookmark(entry: typeof entries.$inferSelect) {
  return {
    id: entry.id,
    vaultId: entry.vaultId,
    label: entry.title ?? "Bookmark",
    payload: coerceBookmarkPayload(coerceMetadata(entry.metadata).bookmark),
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString()
  };
}

function toBookmarkPayload(input: {
  type: "note" | "search" | "heading" | "canvas" | "graph" | "external";
  targetId?: string;
  targetPath?: string;
  query?: string;
  url?: string;
}) {
  return {
    type: input.type,
    targetId: input.targetId ?? null,
    targetPath: input.targetPath ?? null,
    query: input.query ?? null,
    url: input.url ?? null
  };
}

function coerceBookmarkPayload(value: unknown) {
  if (typeof value !== "object" || value === null) {
    return toBookmarkPayload({ type: "note" });
  }

  const payload = value as Partial<ReturnType<typeof toBookmarkPayload>>;

  return {
    type: payload.type ?? "note",
    targetId: payload.targetId ?? null,
    targetPath: payload.targetPath ?? null,
    query: payload.query ?? null,
    url: payload.url ?? null
  };
}
