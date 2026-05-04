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
