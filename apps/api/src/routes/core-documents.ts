import {
  createCanvasSchema,
  createTemplateSchema,
  createWorkspaceSchema,
  uuidSchema
} from "@ideahub/shared";
import { and, eq } from "drizzle-orm";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "../db/client";
import { entries, entryVersions } from "../db/schema";
import { buildMetadata, coerceMetadata, toDefaultPath } from "../notes/markdown";
import { serializeNote } from "./notes";

const vaultQuerySchema = z.object({
  vaultId: uuidSchema.optional()
});

const dailyNoteSchema = z.object({
  vaultId: uuidSchema,
  projectId: uuidSchema.optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  templateId: uuidSchema.optional()
});

const markdownImportSchema = z.object({
  vaultId: uuidSchema,
  projectId: uuidSchema.optional(),
  path: z.string().trim().min(1).max(500),
  content: z.string().min(1)
});

const markdownExportQuerySchema = z.object({
  vaultId: uuidSchema,
  noteId: uuidSchema.optional()
});

const documentResponseSchema = z.object({
  id: z.string().uuid(),
  vaultId: z.string().uuid(),
  title: z.string().nullable(),
  content: z.string(),
  path: z.string().nullable(),
  metadata: z.unknown(),
  createdAt: z.string(),
  updatedAt: z.string()
});

const documentListResponseSchema = z.object({
  documents: z.array(documentResponseSchema)
});

const dailyNoteResponseSchema = z.object({
  note: z.unknown(),
  created: z.boolean()
});

const exportResponseSchema = z.object({
  vaultId: z.string().uuid(),
  files: z.array(
    z.object({
      path: z.string(),
      content: z.string()
    })
  )
});

export const registerCoreDocumentRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/templates",
    {
      schema: {
        tags: ["Templates"],
        summary: "List Markdown templates",
        querystring: vaultQuerySchema,
        response: {
          200: documentListResponseSchema
        }
      }
    },
    async (request) => ({
      documents: (await listDocuments("template", request.query.vaultId)).map(serializeDocument)
    })
  );

  app.post(
    "/templates",
    {
      schema: {
        tags: ["Templates"],
        summary: "Create a Markdown template",
        body: createTemplateSchema,
        response: {
          201: documentResponseSchema
        }
      }
    },
    async (request, reply) => {
      const [template] = await db
        .insert(entries)
        .values({
          vaultId: request.body.vaultId,
          title: request.body.title,
          content: request.body.content,
          source: "text",
          status: "published",
          metadata: buildMetadata({
            content: request.body.content,
            kind: "template",
            path: request.body.path ?? toDefaultPath(request.body.title, "Templates"),
            folder: "Templates"
          })
        })
        .returning();

      if (!template) {
        throw new Error("Failed to create template.");
      }

      return reply.code(201).send(serializeDocument(template));
    }
  );

  app.post(
    "/daily-notes/open",
    {
      schema: {
        tags: ["Daily Notes"],
        summary: "Open or create the daily note",
        body: dailyNoteSchema,
        response: {
          200: dailyNoteResponseSchema
        }
      }
    },
    async (request) => {
      const date = request.body.date ?? new Date().toISOString().slice(0, 10);
      const path = `Daily/${date}.md`;
      const existing = (
        await db.query.entries.findMany({
          where: eq(entries.vaultId, request.body.vaultId)
        })
      ).find((entry) => coerceMetadata(entry.metadata).path === path);

      if (existing) {
        return {
          note: serializeNote(existing),
          created: false
        };
      }

      const template = request.body.templateId
        ? await db.query.entries.findFirst({ where: eq(entries.id, request.body.templateId) })
        : null;
      const content = (template?.content ?? `# ${date}\n\n`).replaceAll("{{date}}", date);
      const [note] = await db
        .insert(entries)
        .values({
          vaultId: request.body.vaultId,
          projectId: request.body.projectId ?? null,
          title: date,
          content,
          source: "text",
          status: "published",
          metadata: buildMetadata({
            content,
            kind: "note",
            path,
            folder: "Daily",
            properties: { date }
          })
        })
        .returning();

      if (!note) {
        throw new Error("Failed to create daily note.");
      }

      await db.insert(entryVersions).values({
        entryId: note.id,
        version: 1,
        title: note.title,
        content: note.content,
        changeReason: "Daily note created"
      });

      return {
        note: serializeNote(note),
        created: true
      };
    }
  );

  app.get(
    "/canvas",
    {
      schema: {
        tags: ["Canvas"],
        summary: "List JSON Canvas documents",
        querystring: vaultQuerySchema,
        response: {
          200: documentListResponseSchema
        }
      }
    },
    async (request) => ({
      documents: (await listDocuments("canvas", request.query.vaultId)).map(serializeDocument)
    })
  );

  app.post(
    "/canvas",
    {
      schema: {
        tags: ["Canvas"],
        summary: "Create a JSON Canvas document",
        body: createCanvasSchema,
        response: {
          201: documentResponseSchema
        }
      }
    },
    async (request, reply) => {
      const content = JSON.stringify(request.body.canvas, null, 2);
      const [canvas] = await db
        .insert(entries)
        .values({
          vaultId: request.body.vaultId,
          title: request.body.title,
          content,
          source: "import",
          status: "published",
          metadata: {
            kind: "canvas",
            path: request.body.path ?? `${request.body.title}.canvas`,
            canvas: request.body.canvas
          }
        })
        .returning();

      if (!canvas) {
        throw new Error("Failed to create canvas.");
      }

      return reply.code(201).send(serializeDocument(canvas));
    }
  );

  app.get(
    "/workspaces",
    {
      schema: {
        tags: ["Workspaces"],
        summary: "List saved workspaces",
        querystring: vaultQuerySchema,
        response: {
          200: documentListResponseSchema
        }
      }
    },
    async (request) => ({
      documents: (await listDocuments("workspace", request.query.vaultId)).map(serializeDocument)
    })
  );

  app.post(
    "/workspaces",
    {
      schema: {
        tags: ["Workspaces"],
        summary: "Save a workspace layout",
        body: createWorkspaceSchema,
        response: {
          201: documentResponseSchema
        }
      }
    },
    async (request, reply) => {
      const content = JSON.stringify(request.body.layout, null, 2);
      const [workspace] = await db
        .insert(entries)
        .values({
          vaultId: request.body.vaultId,
          title: request.body.name,
          content,
          source: "import",
          status: "published",
          metadata: {
            kind: "workspace",
            workspace: request.body.layout
          }
        })
        .returning();

      if (!workspace) {
        throw new Error("Failed to save workspace.");
      }

      return reply.code(201).send(serializeDocument(workspace));
    }
  );

  app.post(
    "/import/markdown",
    {
      schema: {
        tags: ["Import"],
        summary: "Import a Markdown file as a note",
        body: markdownImportSchema,
        response: {
          201: z.unknown()
        }
      }
    },
    async (request, reply) => {
      const title = request.body.path.split("/").at(-1)?.replace(/\.md$/i, "") ?? "Imported note";
      const [note] = await db
        .insert(entries)
        .values({
          vaultId: request.body.vaultId,
          projectId: request.body.projectId ?? null,
          title,
          content: request.body.content,
          source: "import",
          status: "published",
          metadata: buildMetadata({
            content: request.body.content,
            kind: "note",
            path: request.body.path,
            folder: request.body.path.includes("/")
              ? request.body.path.split("/").slice(0, -1).join("/")
              : null
          })
        })
        .returning();

      if (!note) {
        throw new Error("Failed to import Markdown.");
      }

      return reply.code(201).send(serializeNote(note));
    }
  );

  app.get(
    "/export/markdown",
    {
      schema: {
        tags: ["Export"],
        summary: "Export Markdown notes from PostgreSQL",
        querystring: markdownExportQuerySchema,
        response: {
          200: exportResponseSchema
        }
      }
    },
    async (request) => {
      const notes = request.query.noteId
        ? await db.query.entries.findMany({
            where: and(
              eq(entries.vaultId, request.query.vaultId),
              eq(entries.id, request.query.noteId)
            )
          })
        : await db.query.entries.findMany({
            where: eq(entries.vaultId, request.query.vaultId)
          });

      return {
        vaultId: request.query.vaultId,
        files: notes
          .filter((note) => (coerceMetadata(note.metadata).kind ?? "note") === "note")
          .map((note) => ({
            path: coerceMetadata(note.metadata).path ?? toDefaultPath(note.title ?? "Untitled"),
            content: note.content
          }))
      };
    }
  );
};

async function listDocuments(kind: "template" | "canvas" | "workspace", vaultId?: string) {
  const allEntries = await db.query.entries.findMany({
    where: vaultId ? eq(entries.vaultId, vaultId) : undefined
  });

  return allEntries.filter((entry) => coerceMetadata(entry.metadata).kind === kind);
}

function serializeDocument(entry: typeof entries.$inferSelect) {
  const metadata = coerceMetadata(entry.metadata);

  return {
    id: entry.id,
    vaultId: entry.vaultId,
    title: entry.title,
    content: entry.content,
    path: metadata.path ?? null,
    metadata,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString()
  };
}
