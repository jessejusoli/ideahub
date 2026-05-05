import { z } from "zod";

export const layers = ["intention", "concept", "structure", "execution"] as const;

export const layerLabels = {
  intention: "Intention",
  concept: "Concept",
  structure: "Structure",
  execution: "Execution"
} as const satisfies Record<Layer, string>;

export type Layer = (typeof layers)[number];

export const linkTypes = [
  "relates_to",
  "supports",
  "depends_on",
  "contradicts",
  "evolves_from",
  "duplicates"
] as const;

export type LinkType = (typeof linkTypes)[number];

export const entryStatuses = [
  "draft",
  "pending_analysis",
  "review",
  "published",
  "archived"
] as const;

export type EntryStatus = (typeof entryStatuses)[number];

export const suggestionStatuses = ["pending", "approved", "rejected"] as const;

export type SuggestionStatus = (typeof suggestionStatuses)[number];

export const layerSchema = z.enum(layers);
export const linkTypeSchema = z.enum(linkTypes);
export const entryStatusSchema = z.enum(entryStatuses);
export const suggestionStatusSchema = z.enum(suggestionStatuses);

export const uuidSchema = z.string().uuid();

export const createEntrySchema = z.object({
  vaultId: uuidSchema,
  projectId: uuidSchema.optional(),
  title: z.string().trim().min(1).max(160).optional(),
  content: z.string().trim().min(1),
  source: z.enum(["text", "voice", "import"]).default("text")
});

export type CreateEntryInput = z.infer<typeof createEntrySchema>;

export const createNoteSchema = z.object({
  vaultId: uuidSchema,
  projectId: uuidSchema.optional(),
  title: z.string().trim().min(1).max(180),
  content: z.string().min(1),
  path: z.string().trim().min(1).max(500).optional(),
  folder: z.string().trim().min(1).max(300).optional(),
  aliases: z.array(z.string().trim().min(1).max(160)).default([]),
  properties: z.record(z.string(), z.unknown()).default({})
});

export type CreateNoteInput = z.infer<typeof createNoteSchema>;

export const updateNoteSchema = z.object({
  projectId: uuidSchema.nullable().optional(),
  title: z.string().trim().min(1).max(180).optional(),
  content: z.string().min(1).optional(),
  path: z.string().trim().min(1).max(500).optional(),
  folder: z.string().trim().min(1).max(300).nullable().optional(),
  aliases: z.array(z.string().trim().min(1).max(160)).optional(),
  properties: z.record(z.string(), z.unknown()).optional()
});

export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;

export const moveNoteSchema = z.object({
  title: z.string().trim().min(1).max(180).optional(),
  path: z.string().trim().min(1).max(500),
  folder: z.string().trim().min(1).max(300).nullable().optional()
});

export type MoveNoteInput = z.infer<typeof moveNoteSchema>;

export const restoreNoteVersionSchema = z.object({
  version: z.coerce.number().int().min(1)
});

export type RestoreNoteVersionInput = z.infer<typeof restoreNoteVersionSchema>;

export const createVaultSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional()
});

export type CreateVaultInput = z.infer<typeof createVaultSchema>;

export const createProjectSchema = z.object({
  vaultId: uuidSchema,
  parentProjectId: uuidSchema.optional(),
  name: z.string().trim().min(1).max(140),
  description: z.string().trim().max(500).optional()
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const analyzeEntrySchema = z.object({
  force: z.boolean().default(false)
});

export type AnalyzeEntryInput = z.infer<typeof analyzeEntrySchema>;

export const reviewSuggestionSchema = z.object({
  suggestionId: uuidSchema,
  status: suggestionStatusSchema,
  editedPayload: z.record(z.string(), z.unknown()).optional()
});

export type ReviewSuggestionInput = z.infer<typeof reviewSuggestionSchema>;

export const semanticSearchSchema = z.object({
  q: z.string().trim().min(1),
  vaultId: uuidSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10)
});

export type SemanticSearchInput = z.infer<typeof semanticSearchSchema>;

export const textSearchSchema = z.object({
  q: z.string().trim().min(1),
  vaultId: uuidSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20)
});

export type TextSearchInput = z.infer<typeof textSearchSchema>;

export const createTemplateSchema = z.object({
  vaultId: uuidSchema,
  title: z.string().trim().min(1).max(180),
  content: z.string().min(1),
  path: z.string().trim().min(1).max(500).optional()
});

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;

export const createCanvasSchema = z.object({
  vaultId: uuidSchema,
  title: z.string().trim().min(1).max(180),
  path: z.string().trim().min(1).max(500).optional(),
  canvas: z.object({
    nodes: z.array(z.record(z.string(), z.unknown())).default([]),
    edges: z.array(z.record(z.string(), z.unknown())).default([])
  })
});

export type CreateCanvasInput = z.infer<typeof createCanvasSchema>;

export const createWorkspaceSchema = z.object({
  vaultId: uuidSchema,
  name: z.string().trim().min(1).max(180),
  layout: z.record(z.string(), z.unknown())
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

export const createBookmarkSchema = z.object({
  vaultId: uuidSchema,
  label: z.string().trim().min(1).max(180),
  type: z.enum(["note", "search", "heading", "canvas", "graph", "external"]),
  targetId: uuidSchema.optional(),
  targetPath: z.string().trim().min(1).max(500).optional(),
  query: z.string().trim().min(1).max(500).optional(),
  url: z.string().url().optional()
});

export type CreateBookmarkInput = z.infer<typeof createBookmarkSchema>;

export const updateBookmarkSchema = createBookmarkSchema.partial().omit({ vaultId: true });

export type UpdateBookmarkInput = z.infer<typeof updateBookmarkSchema>;

export const randomNoteSchema = z.object({
  vaultId: uuidSchema
});

export type RandomNoteInput = z.infer<typeof randomNoteSchema>;

export const uniqueNoteSchema = z.object({
  vaultId: uuidSchema,
  projectId: uuidSchema.optional(),
  prefix: z.string().trim().min(1).max(80).default("Note"),
  folder: z.string().trim().min(1).max(300).default("Unique"),
  templateId: uuidSchema.optional()
});

export type UniqueNoteInput = z.infer<typeof uniqueNoteSchema>;

export const composeNoteSchema = z.object({
  vaultId: uuidSchema,
  projectId: uuidSchema.optional(),
  title: z.string().trim().min(1).max(180),
  sourceNoteIds: z.array(uuidSchema).min(1).max(20),
  mode: z.enum(["merge"]).default("merge")
});

export type ComposeNoteInput = z.infer<typeof composeNoteSchema>;

export const coverageStatuses = ["not_started", "planned", "implemented", "verified"] as const;

export type CoverageStatus = (typeof coverageStatuses)[number];

export type Vault = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Project = {
  id: string;
  vaultId: string;
  parentProjectId: string | null;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Tag = {
  id: string;
  vaultId: string;
  name: string;
  source: "manual" | "ai";
};

export type Entry = {
  id: string;
  vaultId: string;
  projectId: string | null;
  title: string | null;
  content: string;
  summary: string | null;
  layer: Layer | null;
  status: EntryStatus;
  source: "text" | "voice" | "import";
  createdAt: string;
  updatedAt: string;
};

export type Note = Entry & {
  path: string | null;
  folder: string | null;
  aliases: string[];
  properties: Record<string, unknown>;
  headings: Array<{
    level: number;
    text: string;
    slug: string;
  }>;
  wordCount: number;
  characterCount: number;
};

export type Link = {
  id: string;
  vaultId: string;
  sourceEntryId: string;
  targetEntryId: string;
  type: LinkType;
  strength: number;
  justification: string | null;
};

export type AnalysisSuggestion = {
  id: string;
  entryId: string;
  status: SuggestionStatus;
  payload: {
    layer?: Layer;
    summary?: string;
    tags?: string[];
    projectId?: string;
    links?: Array<{
      targetEntryId: string;
      type: LinkType;
      strength: number;
      justification: string;
      confidence: number;
    }>;
  };
};

export type CanvasDocument = {
  id: string;
  vaultId: string;
  title: string;
  canvas: {
    nodes: Array<Record<string, unknown>>;
    edges: Array<Record<string, unknown>>;
  };
};

export type Workspace = {
  id: string;
  vaultId: string;
  name: string;
  layout: Record<string, unknown>;
};
