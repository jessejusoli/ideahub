import {
  baseQuerySchema,
  formatConverterSchema,
  pagePreviewQuerySchema,
  publishSchema,
  slashCommandSchema,
  syncPushSchema,
  uuidSchema,
  webViewerSchema
} from "@ideahub/shared";
import { desc, eq } from "drizzle-orm";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "../db/client";
import { entries, entryTags, links, tags } from "../db/schema";
import { coerceMetadata, parseMarkdown } from "../notes/markdown";
import { serializeNote } from "./notes";

const errorResponseSchema = z.object({
  code: z.string(),
  message: z.string()
});

const baseResponseSchema = z.object({
  vaultId: z.string().uuid(),
  columns: z.array(z.string()),
  rows: z.array(
    z.object({
      id: z.string().uuid(),
      title: z.string().nullable(),
      path: z.string().nullable(),
      folder: z.string().nullable(),
      tags: z.array(z.string()),
      properties: z.record(z.string(), z.unknown()),
      wordCount: z.number(),
      updatedAt: z.string()
    })
  )
});

const converterResponseSchema = z.object({
  sourceFormat: z.string(),
  convertedContent: z.string(),
  changes: z.array(z.string())
});

const pagePreviewResponseSchema = z.object({
  note: z
    .object({
      id: z.string().uuid(),
      title: z.string().nullable(),
      path: z.string().nullable(),
      excerpt: z.string(),
      headings: z.array(
        z.object({
          level: z.number(),
          text: z.string(),
          slug: z.string()
        })
      ),
      properties: z.record(z.string(), z.unknown()),
      wordCount: z.number()
    })
    .nullable()
});

const slashCommandsResponseSchema = z.object({
  commands: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      insertion: z.string(),
      description: z.string()
    })
  )
});

const slashCommandExecuteResponseSchema = z.object({
  commandId: z.string(),
  insertion: z.string(),
  description: z.string()
});

const slidesResponseSchema = z.object({
  noteId: z.string().uuid(),
  title: z.string().nullable(),
  slides: z.array(
    z.object({
      index: z.number(),
      title: z.string(),
      markdown: z.string()
    })
  )
});

const publishResponseSchema = z.object({
  config: z.unknown().nullable(),
  publicNotes: z.array(z.unknown()),
  graph: z.object({
    nodes: z.array(z.unknown()),
    edges: z.array(z.unknown())
  })
});

const syncStateResponseSchema = z.object({
  vaultId: z.string().uuid(),
  serverVersion: z.string(),
  notes: z.array(z.unknown()),
  acceptedChanges: z.number().optional()
});

const webViewerResponseSchema = z.object({
  id: z.string().uuid(),
  vaultId: z.string().uuid(),
  title: z.string().nullable(),
  url: z.string(),
  embedAllowed: z.boolean(),
  message: z.string()
});

const slashCommands = [
  {
    id: "heading",
    label: "Heading",
    insertion: "## Heading",
    description: "Insert a level-two Markdown heading."
  },
  {
    id: "link",
    label: "Wiki link",
    insertion: "[[Note title]]",
    description: "Insert an Obsidian-style wiki link."
  },
  {
    id: "footnote",
    label: "Footnote",
    insertion: "Text with a note.[^1]\n\n[^1]: Footnote definition.",
    description: "Insert a footnote reference and definition."
  },
  {
    id: "callout",
    label: "Callout",
    insertion: "> [!note]\n> Callout content.",
    description: "Insert an Obsidian-style callout block."
  },
  {
    id: "task",
    label: "Task",
    insertion: "- [ ] Task",
    description: "Insert a Markdown task item."
  }
];

export const registerCorePluginRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/bases",
    {
      schema: {
        tags: ["Bases"],
        summary: "Query notes as a property-driven base view",
        querystring: baseQuerySchema,
        response: {
          200: baseResponseSchema
        }
      }
    },
    async (request) => {
      const notes = (
        await db.query.entries.findMany({
          where: eq(entries.vaultId, request.query.vaultId),
          orderBy: [desc(entries.updatedAt)]
        })
      ).filter((entry) => (coerceMetadata(entry.metadata).kind ?? "note") === "note");
      const tagRows = await db
        .select({
          entryId: entryTags.entryId,
          name: tags.name
        })
        .from(entryTags)
        .innerJoin(tags, eq(entryTags.tagId, tags.id));

      const rows = notes
        .map((note) => {
          const metadata = coerceMetadata(note.metadata);
          const parsed = parseMarkdown(note.content);
          const noteTags = tagRows
            .filter((tag) => tag.entryId === note.id)
            .map((tag) => tag.name)
            .sort();

          return {
            id: note.id,
            title: note.title,
            path: metadata.path ?? null,
            folder: metadata.folder ?? null,
            tags: noteTags,
            properties: metadata.properties ?? {},
            wordCount: metadata.wordCount ?? parsed.wordCount,
            updatedAt: note.updatedAt.toISOString()
          };
        })
        .filter((row) => (request.query.tag ? row.tags.includes(request.query.tag) : true))
        .filter((row) => (request.query.folder ? row.folder === request.query.folder : true))
        .filter((row) =>
          request.query.propertyKey
            ? String(row.properties[request.query.propertyKey] ?? "") ===
              (request.query.propertyValue ?? String(row.properties[request.query.propertyKey]))
            : true
        )
        .sort((left, right) =>
          request.query.sortDirection === "asc"
            ? sortBaseRows(left, right, request.query.sortBy)
            : sortBaseRows(right, left, request.query.sortBy)
        );

      return {
        vaultId: request.query.vaultId,
        columns: ["title", "path", "folder", "tags", "properties", "wordCount", "updatedAt"],
        rows
      };
    }
  );

  app.post(
    "/format-converter",
    {
      schema: {
        tags: ["Import"],
        summary: "Normalize Markdown from another app into IdeaHub Markdown",
        body: formatConverterSchema,
        response: {
          200: converterResponseSchema
        }
      }
    },
    async (request) => convertMarkdown(request.body.content, request.body.sourceFormat)
  );

  app.get(
    "/page-preview",
    {
      schema: {
        tags: ["Notes"],
        summary: "Preview a note by ID, title, alias, or path",
        querystring: pagePreviewQuerySchema,
        response: {
          200: pagePreviewResponseSchema
        }
      }
    },
    async (request) => {
      const candidates = await db.query.entries.findMany({
        where: eq(entries.vaultId, request.query.vaultId)
      });
      const note = request.query.noteId
        ? candidates.find((candidate) => candidate.id === request.query.noteId)
        : candidates.find((candidate) => noteMatches(candidate, request.query.target ?? ""));

      if (!note) {
        return { note: null };
      }

      const metadata = coerceMetadata(note.metadata);
      const parsed = parseMarkdown(note.content);

      return {
        note: {
          id: note.id,
          title: note.title,
          path: metadata.path ?? null,
          excerpt: note.content
            .replace(/^---[\s\S]*?---\n?/, "")
            .trim()
            .slice(0, 500),
          headings: metadata.headings ?? parsed.headings,
          properties: metadata.properties ?? parsed.properties,
          wordCount: metadata.wordCount ?? parsed.wordCount
        }
      };
    }
  );

  app.get(
    "/slash-commands",
    {
      schema: {
        tags: ["Slash Commands"],
        summary: "List slash command insertions for the editor",
        response: {
          200: slashCommandsResponseSchema
        }
      }
    },
    async () => ({ commands: slashCommands })
  );

  app.post(
    "/slash-commands/execute",
    {
      schema: {
        tags: ["Slash Commands"],
        summary: "Resolve a slash command into Markdown insertion text",
        body: slashCommandSchema,
        response: {
          200: slashCommandExecuteResponseSchema,
          404: errorResponseSchema
        }
      }
    },
    async (request, reply) => {
      const command = slashCommands.find((item) => item.id === request.body.commandId);

      if (!command) {
        return reply.code(404).send({
          code: "SLASH_COMMAND_NOT_FOUND",
          message: "Slash command not found."
        });
      }

      return {
        commandId: command.id,
        insertion: request.body.query
          ? command.insertion.replace(
              /Heading|Note title|Task|Callout content/g,
              request.body.query
            )
          : command.insertion,
        description: command.description
      };
    }
  );

  app.get(
    "/slides/:id",
    {
      schema: {
        tags: ["Slides"],
        summary: "Render a Markdown note as slides",
        params: z.object({
          id: uuidSchema
        }),
        response: {
          200: slidesResponseSchema,
          404: errorResponseSchema
        }
      }
    },
    async (request, reply) => {
      const note = await db.query.entries.findFirst({ where: eq(entries.id, request.params.id) });

      if (!note) {
        return reply.code(404).send({
          code: "NOTE_NOT_FOUND",
          message: "Note not found."
        });
      }

      return {
        noteId: note.id,
        title: note.title,
        slides: buildSlides(note.content)
      };
    }
  );

  app.get(
    "/publish",
    {
      schema: {
        tags: ["Publish"],
        summary: "Get publish configuration and public notes for a vault",
        querystring: z.object({
          vaultId: uuidSchema,
          slug: z.string().trim().min(1).max(120).optional()
        }),
        response: {
          200: publishResponseSchema
        }
      }
    },
    async (request) => getPublishState(request.query.vaultId, request.query.slug)
  );

  app.post(
    "/publish",
    {
      schema: {
        tags: ["Publish"],
        summary: "Create or replace a publish configuration",
        body: publishSchema,
        response: {
          200: publishResponseSchema
        }
      }
    },
    async (request) => {
      await upsertPublishConfig(request.body);
      return getPublishState(request.body.vaultId, request.body.slug);
    }
  );

  app.patch(
    "/publish",
    {
      schema: {
        tags: ["Publish"],
        summary: "Update a publish configuration",
        body: publishSchema,
        response: {
          200: publishResponseSchema
        }
      }
    },
    async (request) => {
      await upsertPublishConfig(request.body);
      return getPublishState(request.body.vaultId, request.body.slug);
    }
  );

  app.get(
    "/sync",
    {
      schema: {
        tags: ["Sync"],
        summary: "Get server-centric sync state for a vault",
        querystring: z.object({
          vaultId: uuidSchema,
          since: z.string().datetime().optional()
        }),
        response: {
          200: syncStateResponseSchema
        }
      }
    },
    async (request) => getSyncState(request.query.vaultId, request.query.since)
  );

  app.post(
    "/sync",
    {
      schema: {
        tags: ["Sync"],
        summary: "Record a client sync checkpoint against the server truth",
        body: syncPushSchema,
        response: {
          200: syncStateResponseSchema
        }
      }
    },
    async (request) => {
      await db.insert(entries).values({
        vaultId: request.body.vaultId,
        title: `Sync checkpoint ${request.body.clientId}`,
        content: JSON.stringify(request.body.changes, null, 2) || "[]",
        source: "import",
        status: "published",
        metadata: {
          kind: "sync-event",
          sync: {
            clientId: request.body.clientId,
            lastSeenVersion: request.body.lastSeenVersion ?? null,
            acceptedChanges: request.body.changes.length
          }
        }
      });

      return {
        ...(await getSyncState(request.body.vaultId)),
        acceptedChanges: request.body.changes.length
      };
    }
  );

  app.get(
    "/web-viewer",
    {
      schema: {
        tags: ["Web Viewer"],
        summary: "List web viewer references saved in a vault",
        querystring: z.object({
          vaultId: uuidSchema
        }),
        response: {
          200: z.object({
            documents: z.array(webViewerResponseSchema)
          })
        }
      }
    },
    async (request) => {
      const documents = (
        await db.query.entries.findMany({ where: eq(entries.vaultId, request.query.vaultId) })
      )
        .filter((entry) => coerceMetadata(entry.metadata).kind === "web-viewer")
        .map(serializeWebViewer);

      return { documents };
    }
  );

  app.post(
    "/web-viewer/open",
    {
      schema: {
        tags: ["Web Viewer"],
        summary: "Open an external URL inside the workspace model",
        body: webViewerSchema,
        response: {
          201: webViewerResponseSchema
        }
      }
    },
    async (request, reply) => {
      const [document] = await db
        .insert(entries)
        .values({
          vaultId: request.body.vaultId,
          title: request.body.title ?? request.body.url,
          content: request.body.url,
          source: "import",
          status: "published",
          metadata: {
            kind: "web-viewer",
            webViewer: {
              url: request.body.url,
              embedAllowed: false
            }
          }
        })
        .returning();

      if (!document) {
        throw new Error("Failed to create web viewer document.");
      }

      return reply.code(201).send(serializeWebViewer(document));
    }
  );
};

export function convertMarkdown(content: string, sourceFormat: string) {
  const changes: string[] = [];
  let convertedContent = content.replace(/\r\n/g, "\n");

  if (convertedContent !== content) {
    changes.push("Normalized line endings.");
  }

  const roamConverted = convertedContent.replace(/#\[\[([^\]]+)\]\]/g, (_match, tag: string) => {
    changes.push("Converted Roam-style tags.");
    return `#${String(tag).trim().replace(/\s+/g, "-").toLowerCase()}`;
  });
  convertedContent = roamConverted;

  const notionConverted = convertedContent.replace(/^>\s*💡\s?/gm, "> [!tip]\n> ");
  if (notionConverted !== convertedContent) {
    changes.push("Converted Notion-style tip callouts.");
  }
  convertedContent = notionConverted;

  const googleDocsConverted = convertedContent.replace(/\n{3,}/g, "\n\n");
  if (googleDocsConverted !== convertedContent) {
    changes.push("Collapsed excessive blank lines.");
  }
  convertedContent = googleDocsConverted;

  if (!convertedContent.startsWith("---\n")) {
    convertedContent = `---\nsourceFormat: ${sourceFormat}\nconverted: true\n---\n\n${convertedContent}`;
    changes.push("Added IdeaHub-compatible frontmatter.");
  }

  return {
    sourceFormat,
    convertedContent,
    changes: changes.length > 0 ? Array.from(new Set(changes)) : ["Content already normalized."]
  };
}

export function buildSlides(content: string) {
  const body = content.replace(/^---[\s\S]*?---\n?/, "").trim();
  const explicitSlides = body.split(/\n---+\n/g).filter((slide) => slide.trim().length > 0);
  const chunks =
    explicitSlides.length > 1
      ? explicitSlides
      : body.split(/(?=^#{1,2}\s+)/gm).filter((slide) => slide.trim().length > 0);

  return (chunks.length > 0 ? chunks : [body]).map((markdown, index) => {
    const title = markdown.match(/^#{1,6}\s+(.+)$/m)?.[1]?.trim() ?? `Slide ${index + 1}`;

    return {
      index: index + 1,
      title,
      markdown: markdown.trim()
    };
  });
}

function sortBaseRows(
  left: { title: string | null; path: string | null; updatedAt: string; wordCount: number },
  right: { title: string | null; path: string | null; updatedAt: string; wordCount: number },
  sortBy: "title" | "path" | "updatedAt" | "wordCount"
) {
  if (sortBy === "wordCount") {
    return left.wordCount - right.wordCount;
  }

  return String(left[sortBy] ?? "").localeCompare(String(right[sortBy] ?? ""));
}

function noteMatches(entry: typeof entries.$inferSelect, target: string) {
  const metadata = coerceMetadata(entry.metadata);
  const normalized = target.trim().toLowerCase().replace(/\.md$/i, "");
  const candidates = [
    entry.title,
    metadata.path,
    metadata.path?.split("/").at(-1),
    ...(metadata.aliases ?? [])
  ]
    .filter(Boolean)
    .map((value) => String(value).trim().toLowerCase().replace(/\.md$/i, ""));

  return candidates.includes(normalized);
}

async function upsertPublishConfig(input: z.infer<typeof publishSchema>) {
  const existing = (await db.query.entries.findMany({ where: eq(entries.vaultId, input.vaultId) }))
    .filter((entry) => coerceMetadata(entry.metadata).kind === "publish")
    .find((entry) => coerceMetadata(entry.metadata).publish?.slug === input.slug);
  const content = JSON.stringify(input, null, 2);
  const metadata = {
    kind: "publish",
    publish: input
  };

  if (existing) {
    await db
      .update(entries)
      .set({
        title: input.siteName,
        content,
        metadata,
        updatedAt: new Date()
      })
      .where(eq(entries.id, existing.id));
    return;
  }

  await db.insert(entries).values({
    vaultId: input.vaultId,
    title: input.siteName,
    content,
    source: "import",
    status: "published",
    metadata
  });
}

async function getPublishState(vaultId: string, slug?: string) {
  const allEntries = await db.query.entries.findMany({ where: eq(entries.vaultId, vaultId) });
  const configs = allEntries
    .filter((entry) => coerceMetadata(entry.metadata).kind === "publish")
    .map((entry) => coerceMetadata(entry.metadata).publish);
  const config =
    (slug ? configs.find((candidate) => candidate?.slug === slug) : configs[0]) ?? null;
  const noteIds = Array.isArray(config?.noteIds) ? config.noteIds.map(String) : [];
  const publicNotes = allEntries
    .filter((entry) => noteIds.includes(entry.id))
    .map((entry) => serializeNote(entry));
  const publicLinks = await db.query.links.findMany({ where: eq(links.vaultId, vaultId) });

  return {
    config,
    publicNotes,
    graph: {
      nodes: publicNotes.map((note) => ({
        id: note.id,
        title: note.title,
        path: note.path
      })),
      edges: publicLinks
        .filter(
          (link) => noteIds.includes(link.sourceEntryId) && noteIds.includes(link.targetEntryId)
        )
        .map((link) => ({
          id: link.id,
          source: link.sourceEntryId,
          target: link.targetEntryId,
          type: link.type
        }))
    }
  };
}

async function getSyncState(vaultId: string, since?: string) {
  const sinceDate = since ? new Date(since) : null;
  const notes = (
    await db.query.entries.findMany({
      where: eq(entries.vaultId, vaultId),
      orderBy: [desc(entries.updatedAt)]
    })
  )
    .filter((entry) => (coerceMetadata(entry.metadata).kind ?? "note") === "note")
    .filter((entry) => (sinceDate ? entry.updatedAt > sinceDate : true))
    .map((entry) => serializeNote(entry));

  return {
    vaultId,
    serverVersion: new Date().toISOString(),
    notes
  };
}

function serializeWebViewer(entry: typeof entries.$inferSelect) {
  const metadata = coerceMetadata(entry.metadata);
  const url = String(metadata.webViewer?.url ?? entry.content);

  return {
    id: entry.id,
    vaultId: entry.vaultId,
    title: entry.title,
    url,
    embedAllowed: false,
    message: "External URL is tracked in PostgreSQL; browser embedding depends on site policy."
  };
}
