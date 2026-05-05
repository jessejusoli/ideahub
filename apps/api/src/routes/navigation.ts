import { uuidSchema } from "@ideahub/shared";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "../db/client";
import { entries, tags, entryTags } from "../db/schema";
import { coerceMetadata } from "../notes/markdown";

const vaultQuerySchema = z.object({
  vaultId: uuidSchema,
  q: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20)
});

const explorerResponseSchema = z.object({
  vaultId: z.string().uuid(),
  folders: z.array(
    z.object({
      path: z.string(),
      depth: z.number(),
      noteCount: z.number()
    })
  ),
  notes: z.array(
    z.object({
      id: z.string().uuid(),
      title: z.string().nullable(),
      path: z.string().nullable(),
      folder: z.string().nullable(),
      updatedAt: z.string()
    })
  )
});

const quickSwitcherResponseSchema = z.object({
  query: z.string(),
  vaultId: z.string().uuid(),
  results: z.array(
    z.object({
      id: z.string().uuid(),
      title: z.string().nullable(),
      path: z.string().nullable(),
      aliases: z.array(z.string()),
      tags: z.array(z.string()),
      score: z.number()
    })
  )
});

const commandsResponseSchema = z.object({
  commands: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      category: z.string(),
      enabled: z.boolean()
    })
  )
});

const commands = [
  { id: "note.create", label: "Create note", category: "Notes", enabled: true },
  { id: "daily.open", label: "Open daily note", category: "Daily Notes", enabled: true },
  {
    id: "quick-switcher.open",
    label: "Open quick switcher",
    category: "Navigation",
    enabled: true
  },
  { id: "graph.open", label: "Open graph", category: "Graph", enabled: true },
  { id: "canvas.create", label: "Create canvas", category: "Canvas", enabled: true },
  { id: "template.create", label: "Create template", category: "Templates", enabled: true },
  { id: "note.random", label: "Open random note", category: "Notes", enabled: false },
  { id: "note.unique", label: "Create unique note", category: "Notes", enabled: false }
];

export const registerNavigationRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/explorer",
    {
      schema: {
        tags: ["Navigation"],
        summary: "Get the logical PostgreSQL-backed file explorer",
        querystring: vaultQuerySchema.pick({ vaultId: true }),
        response: {
          200: explorerResponseSchema
        }
      }
    },
    async (request) => {
      const notes = await db.query.entries.findMany({
        where: eq(entries.vaultId, request.query.vaultId),
        orderBy: [desc(entries.updatedAt)]
      });
      const folderCounts = new Map<string, number>();

      for (const note of notes) {
        const folder = coerceMetadata(note.metadata).folder;

        if (!folder) {
          continue;
        }

        const parts = folder.split("/");
        for (let index = 1; index <= parts.length; index += 1) {
          const path = parts.slice(0, index).join("/");
          folderCounts.set(path, (folderCounts.get(path) ?? 0) + 1);
        }
      }

      return {
        vaultId: request.query.vaultId,
        folders: Array.from(folderCounts.entries())
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([path, noteCount]) => ({
            path,
            depth: path.split("/").length,
            noteCount
          })),
        notes: notes.map((note) => {
          const metadata = coerceMetadata(note.metadata);

          return {
            id: note.id,
            title: note.title,
            path: metadata.path ?? null,
            folder: metadata.folder ?? null,
            updatedAt: note.updatedAt.toISOString()
          };
        })
      };
    }
  );

  app.get(
    "/quick-switcher",
    {
      schema: {
        tags: ["Navigation"],
        summary: "Fuzzy-open notes by title, path, alias, tag, or content",
        querystring: vaultQuerySchema,
        response: {
          200: quickSwitcherResponseSchema
        }
      }
    },
    async (request) => {
      const filters = [
        eq(entries.vaultId, request.query.vaultId),
        request.query.q
          ? or(
              ilike(entries.title, `%${request.query.q}%`),
              ilike(entries.content, `%${request.query.q}%`)
            )
          : undefined
      ].filter(Boolean);
      const notes = await db.query.entries.findMany({
        where: and(...filters),
        orderBy: [desc(entries.updatedAt)],
        limit: request.query.limit
      });
      const noteTags = await db
        .select({
          entryId: entryTags.entryId,
          name: tags.name
        })
        .from(entryTags)
        .innerJoin(tags, eq(entryTags.tagId, tags.id));
      const query = request.query.q ?? "";

      return {
        query,
        vaultId: request.query.vaultId,
        results: notes
          .map((note) => {
            const metadata = coerceMetadata(note.metadata);
            const aliases = metadata.aliases ?? [];
            const noteTagNames = noteTags
              .filter((tag) => tag.entryId === note.id)
              .map((tag) => tag.name);

            return {
              id: note.id,
              title: note.title,
              path: metadata.path ?? null,
              aliases,
              tags: noteTagNames,
              score: scoreQuickSwitch(note, aliases, noteTagNames, query)
            };
          })
          .sort((left, right) => right.score - left.score)
      };
    }
  );

  app.get(
    "/commands",
    {
      schema: {
        tags: ["Navigation"],
        summary: "List workspace commands for the command palette",
        response: {
          200: commandsResponseSchema
        }
      }
    },
    async () => ({
      commands
    })
  );
};

function scoreQuickSwitch(
  note: typeof entries.$inferSelect,
  aliases: string[],
  tagNames: string[],
  query: string
) {
  const metadata = coerceMetadata(note.metadata);
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return 0.5;
  }

  const candidates = [
    note.title ?? "",
    metadata.path ?? "",
    metadata.folder ?? "",
    ...aliases,
    ...tagNames
  ].map((candidate) => candidate.toLowerCase());

  if (candidates.some((candidate) => candidate === normalizedQuery)) {
    return 1;
  }

  if (candidates.some((candidate) => candidate.startsWith(normalizedQuery))) {
    return 0.85;
  }

  if (candidates.some((candidate) => candidate.includes(normalizedQuery))) {
    return 0.7;
  }

  return note.content.toLowerCase().includes(normalizedQuery) ? 0.45 : 0.2;
}
