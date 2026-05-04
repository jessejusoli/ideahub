import {
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector
} from "drizzle-orm/pg-core";
import { layers, linkTypes } from "@ideahub/shared";

export const layerEnum = pgEnum("layer", layers);
export const entrySourceEnum = pgEnum("entry_source", ["text", "voice", "import"]);
export const entryStatusEnum = pgEnum("entry_status", [
  "draft",
  "pending_analysis",
  "review",
  "published",
  "archived"
]);
export const tagSourceEnum = pgEnum("tag_source", ["manual", "ai"]);
export const linkTypeEnum = pgEnum("link_type", linkTypes);
export const suggestionStatusEnum = pgEnum("suggestion_status", [
  "pending",
  "approved",
  "rejected"
]);
export const jobStatusEnum = pgEnum("job_status", ["queued", "running", "succeeded", "failed"]);
export const jobTypeEnum = pgEnum("job_type", ["transcription", "embedding", "analysis"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
};

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash"),
    ...timestamps
  },
  (table) => ({
    emailIdx: uniqueIndex("users_email_idx").on(table.email)
  })
);

export const vaults = pgTable(
  "vaults",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    ...timestamps
  },
  (table) => ({
    ownerIdx: index("vaults_owner_idx").on(table.ownerId)
  })
);

export const vaultMembers = pgTable(
  "vault_members",
  {
    vaultId: uuid("vault_id")
      .notNull()
      .references(() => vaults.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("owner"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    pk: primaryKey({ columns: [table.vaultId, table.userId] })
  })
);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vaultId: uuid("vault_id")
      .notNull()
      .references(() => vaults.id, { onDelete: "cascade" }),
    parentProjectId: uuid("parent_project_id"),
    name: text("name").notNull(),
    description: text("description"),
    ...timestamps
  },
  (table) => ({
    vaultIdx: index("projects_vault_idx").on(table.vaultId),
    parentIdx: index("projects_parent_idx").on(table.parentProjectId),
    parentFk: foreignKey({
      columns: [table.parentProjectId],
      foreignColumns: [table.id],
      name: "projects_parent_project_id_projects_id_fk"
    }).onDelete("set null")
  })
);

export const entries = pgTable(
  "entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vaultId: uuid("vault_id")
      .notNull()
      .references(() => vaults.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    title: text("title"),
    content: text("content").notNull(),
    summary: text("summary"),
    layer: layerEnum("layer"),
    source: entrySourceEnum("source").notNull().default("text"),
    status: entryStatusEnum("status").notNull().default("draft"),
    metadata: jsonb("metadata").notNull().default({}),
    ...timestamps
  },
  (table) => ({
    vaultIdx: index("entries_vault_idx").on(table.vaultId),
    projectIdx: index("entries_project_idx").on(table.projectId),
    layerIdx: index("entries_layer_idx").on(table.layer),
    statusIdx: index("entries_status_idx").on(table.status)
  })
);

export const entryVersions = pgTable(
  "entry_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    title: text("title"),
    content: text("content").notNull(),
    changeReason: text("change_reason"),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    entryVersionIdx: uniqueIndex("entry_versions_entry_version_idx").on(
      table.entryId,
      table.version
    )
  })
);

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vaultId: uuid("vault_id")
      .notNull()
      .references(() => vaults.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    source: tagSourceEnum("source").notNull().default("manual"),
    ...timestamps
  },
  (table) => ({
    vaultNameIdx: uniqueIndex("tags_vault_name_idx").on(table.vaultId, table.name)
  })
);

export const entryTags = pgTable(
  "entry_tags",
  {
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    confidence: numeric("confidence", { precision: 4, scale: 3 }),
    approved: boolean("approved").notNull().default(true)
  },
  (table) => ({
    pk: primaryKey({ columns: [table.entryId, table.tagId] })
  })
);

export const links = pgTable(
  "links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vaultId: uuid("vault_id")
      .notNull()
      .references(() => vaults.id, { onDelete: "cascade" }),
    sourceEntryId: uuid("source_entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    targetEntryId: uuid("target_entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    type: linkTypeEnum("type").notNull().default("relates_to"),
    strength: numeric("strength", { precision: 4, scale: 3 }).notNull().default("0.500"),
    justification: text("justification"),
    createdBy: text("created_by").notNull().default("ai"),
    ...timestamps
  },
  (table) => ({
    sourceIdx: index("links_source_idx").on(table.sourceEntryId),
    targetIdx: index("links_target_idx").on(table.targetEntryId),
    uniqueLinkIdx: uniqueIndex("links_unique_idx").on(
      table.sourceEntryId,
      table.targetEntryId,
      table.type
    )
  })
);

export const embeddings = pgTable(
  "embeddings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    model: text("model").notNull(),
    embedding: vector("embedding", { dimensions: 1536 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    entryChunkIdx: uniqueIndex("embeddings_entry_chunk_idx").on(table.entryId, table.chunkIndex),
    vectorIdx: index("embeddings_vector_idx").using("hnsw", table.embedding.op("vector_cosine_ops"))
  })
);

export const analysisSuggestions = pgTable(
  "analysis_suggestions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    status: suggestionStatusEnum("status").notNull().default("pending"),
    payload: jsonb("payload").notNull(),
    model: text("model").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true })
  },
  (table) => ({
    entryIdx: index("analysis_suggestions_entry_idx").on(table.entryId),
    statusIdx: index("analysis_suggestions_status_idx").on(table.status)
  })
);

export const llmJobs = pgTable(
  "llm_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entryId: uuid("entry_id").references(() => entries.id, { onDelete: "cascade" }),
    type: jobTypeEnum("type").notNull(),
    status: jobStatusEnum("status").notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    error: text("error"),
    input: jsonb("input").notNull().default({}),
    output: jsonb("output"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    entryIdx: index("llm_jobs_entry_idx").on(table.entryId),
    statusIdx: index("llm_jobs_status_idx").on(table.status)
  })
);
