import { createNoteSchema, updateNoteSchema, uuidSchema } from "@ideahub/shared";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "../db/client";
import { entries, entryVersions, links } from "../db/schema";
import {
  buildMetadata,
  coerceMetadata,
  parseMarkdown,
  syncMarkdownRelations,
  toDefaultPath
} from "../notes/markdown";

const paramsSchema = z.object({
  id: uuidSchema
});

const listNotesQuerySchema = z.object({
  vaultId: uuidSchema.optional(),
  projectId: uuidSchema.optional(),
  q: z.string().trim().optional()
});

const noteResponseSchema = z.object({
  id: z.string().uuid(),
  vaultId: z.string().uuid(),
  projectId: z.string().uuid().nullable(),
  title: z.string().nullable(),
  content: z.string(),
  summary: z.string().nullable(),
  layer: z.string().nullable(),
  status: z.string(),
  source: z.enum(["text", "voice", "import"]),
  path: z.string().nullable(),
  folder: z.string().nullable(),
  aliases: z.array(z.string()),
  properties: z.record(z.string(), z.unknown()),
  headings: z.array(
    z.object({
      level: z.number(),
      text: z.string(),
      slug: z.string()
    })
  ),
  wordCount: z.number(),
  characterCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string()
});

const notesListResponseSchema = z.object({
  notes: z.array(noteResponseSchema)
});

const linkNoteSchema = z.object({
  id: z.string().uuid(),
  title: z.string().nullable(),
  path: z.string().nullable()
});

const outgoingLinksResponseSchema = z.object({
  noteId: z.string().uuid(),
  links: z.array(
    z.object({
      raw: z.string(),
      target: z.string(),
      alias: z.string().nullable(),
      resolved: z.boolean(),
      note: linkNoteSchema.nullable()
    })
  )
});

const backlinksResponseSchema = z.object({
  noteId: z.string().uuid(),
  backlinks: z.array(
    z.object({
      source: linkNoteSchema,
      type: z.string(),
      strength: z.string(),
      context: z.string().nullable()
    })
  ),
  unlinkedMentions: z.array(
    z.object({
      source: linkNoteSchema,
      excerpt: z.string()
    })
  )
});

const deleteResponseSchema = z.object({
  id: z.string().uuid(),
  deleted: z.boolean()
});

const errorResponseSchema = z.object({
  code: z.string(),
  message: z.string()
});

export const registerNoteRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/notes",
    {
      schema: {
        tags: ["Notes"],
        summary: "List Markdown notes",
        querystring: listNotesQuerySchema,
        response: {
          200: notesListResponseSchema
        }
      }
    },
    async (request) => {
      const filters = [
        request.query.vaultId ? eq(entries.vaultId, request.query.vaultId) : undefined,
        request.query.projectId ? eq(entries.projectId, request.query.projectId) : undefined,
        request.query.q
          ? or(
              ilike(entries.title, `%${request.query.q}%`),
              ilike(entries.content, `%${request.query.q}%`)
            )
          : undefined
      ].filter(Boolean);

      const notes = await db.query.entries.findMany({
        where: filters.length > 0 ? and(...filters) : undefined,
        orderBy: [desc(entries.updatedAt)]
      });

      return {
        notes: notes.map(serializeNote)
      };
    }
  );

  app.post(
    "/notes",
    {
      schema: {
        tags: ["Notes"],
        summary: "Create a Markdown note",
        body: createNoteSchema,
        response: {
          201: noteResponseSchema
        }
      }
    },
    async (request, reply) => {
      const created = await db.transaction(async (tx) => {
        const metadata = buildMetadata({
          content: request.body.content,
          kind: "note",
          path: request.body.path ?? toDefaultPath(request.body.title, request.body.folder),
          folder: request.body.folder ?? null,
          aliases: request.body.aliases ?? [],
          properties: request.body.properties ?? {}
        });
        const [entry] = await tx
          .insert(entries)
          .values({
            vaultId: request.body.vaultId,
            projectId: request.body.projectId ?? null,
            title: request.body.title,
            content: request.body.content,
            source: "text",
            status: "published",
            metadata
          })
          .returning();

        if (!entry) {
          throw new Error("Failed to create note.");
        }

        await tx.insert(entryVersions).values({
          entryId: entry.id,
          version: 1,
          title: entry.title,
          content: entry.content,
          changeReason: "Initial Markdown note"
        });

        await syncMarkdownRelations(tx, entry);

        return entry;
      });

      return reply.code(201).send(serializeNote(created));
    }
  );

  app.get(
    "/notes/:id",
    {
      schema: {
        tags: ["Notes"],
        summary: "Get a Markdown note",
        params: paramsSchema,
        response: {
          200: noteResponseSchema,
          404: errorResponseSchema
        }
      }
    },
    async (request, reply) => {
      const note = await db.query.entries.findFirst({
        where: eq(entries.id, request.params.id)
      });

      if (!note) {
        return reply.code(404).send({
          code: "NOTE_NOT_FOUND",
          message: "Note not found."
        });
      }

      return serializeNote(note);
    }
  );

  app.patch(
    "/notes/:id",
    {
      schema: {
        tags: ["Notes"],
        summary: "Update a Markdown note and create a recovery version",
        params: paramsSchema,
        body: updateNoteSchema,
        response: {
          200: noteResponseSchema,
          404: errorResponseSchema
        }
      }
    },
    async (request, reply) => {
      const existing = await db.query.entries.findFirst({
        where: eq(entries.id, request.params.id)
      });

      if (!existing) {
        return reply.code(404).send({
          code: "NOTE_NOT_FOUND",
          message: "Note not found."
        });
      }

      const updated = await db.transaction(async (tx) => {
        const content = request.body.content ?? existing.content;
        const title = request.body.title ?? existing.title ?? "Untitled";
        const metadata = buildMetadata({
          content,
          kind: "note",
          path: request.body.path ?? coerceMetadata(existing.metadata).path ?? toDefaultPath(title),
          folder: request.body.folder ?? coerceMetadata(existing.metadata).folder ?? null,
          aliases: request.body.aliases ?? coerceMetadata(existing.metadata).aliases ?? [],
          properties: request.body.properties ?? coerceMetadata(existing.metadata).properties ?? {},
          current: existing.metadata
        });
        const latestVersion = await tx.query.entryVersions.findFirst({
          where: eq(entryVersions.entryId, existing.id),
          orderBy: [desc(entryVersions.version)]
        });
        const [entry] = await tx
          .update(entries)
          .set({
            title,
            content,
            projectId: request.body.projectId ?? existing.projectId,
            metadata,
            updatedAt: new Date()
          })
          .where(eq(entries.id, existing.id))
          .returning();

        if (!entry) {
          throw new Error("Failed to update note.");
        }

        await tx.insert(entryVersions).values({
          entryId: entry.id,
          version: (latestVersion?.version ?? 0) + 1,
          title: entry.title,
          content: entry.content,
          changeReason: "Markdown note update"
        });

        await syncMarkdownRelations(tx, entry);

        return entry;
      });

      return serializeNote(updated);
    }
  );

  app.delete(
    "/notes/:id",
    {
      schema: {
        tags: ["Notes"],
        summary: "Delete a Markdown note",
        params: paramsSchema,
        response: {
          200: deleteResponseSchema,
          404: errorResponseSchema
        }
      }
    },
    async (request, reply) => {
      const [deleted] = await db
        .delete(entries)
        .where(eq(entries.id, request.params.id))
        .returning();

      if (!deleted) {
        return reply.code(404).send({
          code: "NOTE_NOT_FOUND",
          message: "Note not found."
        });
      }

      return {
        id: request.params.id,
        deleted: true
      };
    }
  );

  app.get(
    "/notes/:id/outgoing-links",
    {
      schema: {
        tags: ["Notes"],
        summary: "Get wiki-links from a note",
        params: paramsSchema,
        response: {
          200: outgoingLinksResponseSchema,
          404: errorResponseSchema
        }
      }
    },
    async (request, reply) => {
      const note = await db.query.entries.findFirst({
        where: eq(entries.id, request.params.id)
      });

      if (!note) {
        return reply.code(404).send({
          code: "NOTE_NOT_FOUND",
          message: "Note not found."
        });
      }

      const parsed = parseMarkdown(note.content);
      const candidates = await db.query.entries.findMany({
        where: eq(entries.vaultId, note.vaultId)
      });

      return {
        noteId: note.id,
        links: parsed.wikiLinks.map((wikiLink) => {
          const target = candidates.find((candidate) => noteMatches(candidate, wikiLink.target));

          return {
            raw: wikiLink.raw,
            target: wikiLink.target,
            alias: wikiLink.alias,
            resolved: Boolean(target),
            note: target ? toLinkNote(target) : null
          };
        })
      };
    }
  );

  app.get(
    "/notes/:id/backlinks",
    {
      schema: {
        tags: ["Notes"],
        summary: "Get backlinks and unlinked mentions for a note",
        params: paramsSchema,
        response: {
          200: backlinksResponseSchema,
          404: errorResponseSchema
        }
      }
    },
    async (request, reply) => {
      const note = await db.query.entries.findFirst({
        where: eq(entries.id, request.params.id)
      });

      if (!note) {
        return reply.code(404).send({
          code: "NOTE_NOT_FOUND",
          message: "Note not found."
        });
      }

      const [rawBacklinks, mentionCandidates] = await Promise.all([
        db
          .select({
            id: entries.id,
            title: entries.title,
            metadata: entries.metadata,
            type: links.type,
            strength: links.strength,
            context: links.justification
          })
          .from(links)
          .innerJoin(entries, eq(links.sourceEntryId, entries.id))
          .where(eq(links.targetEntryId, note.id)),
        db.query.entries.findMany({
          where: and(eq(entries.vaultId, note.vaultId), sql`${entries.id} <> ${note.id}`)
        })
      ]);
      const title = note.title?.trim();
      const unlinkedMentions = title
        ? mentionCandidates
            .filter((candidate) => candidate.content.toLowerCase().includes(title.toLowerCase()))
            .filter(
              (candidate) =>
                !parseMarkdown(candidate.content).wikiLinks.some((link) =>
                  noteMatches(note, link.target)
                )
            )
            .map((candidate) => ({
              source: toLinkNote(candidate),
              excerpt: buildExcerpt(candidate.content, title)
            }))
        : [];

      return {
        noteId: note.id,
        backlinks: rawBacklinks.map((backlink) => ({
          source: {
            id: backlink.id,
            title: backlink.title,
            path: coerceMetadata(backlink.metadata).path ?? null
          },
          type: backlink.type,
          strength: backlink.strength,
          context: backlink.context
        })),
        unlinkedMentions
      };
    }
  );
};

export function serializeNote(entry: typeof entries.$inferSelect) {
  const metadata = coerceMetadata(entry.metadata);

  return {
    id: entry.id,
    vaultId: entry.vaultId,
    projectId: entry.projectId,
    title: entry.title,
    content: entry.content,
    summary: entry.summary,
    layer: entry.layer,
    status: entry.status,
    source: entry.source,
    path: metadata.path ?? null,
    folder: metadata.folder ?? null,
    aliases: metadata.aliases ?? [],
    properties: metadata.properties ?? {},
    headings: metadata.headings ?? [],
    wordCount: metadata.wordCount ?? parseMarkdown(entry.content).wordCount,
    characterCount: metadata.characterCount ?? entry.content.length,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString()
  };
}

function noteMatches(entry: typeof entries.$inferSelect, target: string) {
  const metadata = coerceMetadata(entry.metadata);
  const normalizedTarget = target.trim().toLowerCase().replace(/\.md$/i, "");
  const candidates = [
    entry.title,
    metadata.path,
    metadata.path?.split("/").at(-1),
    ...(metadata.aliases ?? [])
  ]
    .filter(Boolean)
    .map((value) => String(value).trim().toLowerCase().replace(/\.md$/i, ""));

  return candidates.includes(normalizedTarget);
}

function toLinkNote(entry: typeof entries.$inferSelect) {
  return {
    id: entry.id,
    title: entry.title,
    path: coerceMetadata(entry.metadata).path ?? null
  };
}

function buildExcerpt(content: string, needle: string) {
  const index = content.toLowerCase().indexOf(needle.toLowerCase());
  if (index === -1) {
    return content.slice(0, 160);
  }

  return content.slice(Math.max(0, index - 70), index + needle.length + 70).trim();
}
