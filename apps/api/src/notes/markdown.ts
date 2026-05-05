import type { LinkType } from "@ideahub/shared";
import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "../db/schema";
import { entries, entryTags, links, tags } from "../db/schema";

export type EntryMetadata = {
  kind?: "note" | "template" | "canvas" | "workspace";
  path?: string;
  folder?: string;
  aliases?: string[];
  properties?: Record<string, unknown>;
  headings?: Array<{ level: number; text: string; slug: string }>;
  wordCount?: number;
  characterCount?: number;
  backlinksReady?: boolean;
  canvas?: unknown;
  workspace?: unknown;
};

export type ParsedMarkdown = {
  properties: Record<string, unknown>;
  aliases: string[];
  headings: Array<{ level: number; text: string; slug: string }>;
  tags: string[];
  wikiLinks: Array<{ raw: string; target: string; alias: string | null }>;
  wordCount: number;
  characterCount: number;
};

type Database = NodePgDatabase<typeof schema>;
type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

const WIKI_LINK_PATTERN = /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g;
const TAG_PATTERN = /(?:^|\s)#([a-zA-Z0-9_/-]{2,80})\b/g;
const FRONTMATTER_PATTERN = /^---\n([\s\S]*?)\n---\n?/;

export function normalizeTitle(value: string) {
  return value.trim().toLowerCase().replace(/\.md$/i, "").replace(/\s+/g, " ");
}

export function toDefaultPath(title: string, folder?: string | null) {
  const filename = `${title.trim() || "Untitled"}.md`;
  return folder ? `${folder.replace(/\/+$/g, "")}/${filename}` : filename;
}

export function parseMarkdown(content: string): ParsedMarkdown {
  const properties = parseFrontmatter(content);
  const aliases = parseAliases(properties.aliases);
  const body = content.replace(FRONTMATTER_PATTERN, "");
  const headings = Array.from(body.matchAll(/^(#{1,6})\s+(.+)$/gm)).map((match) => ({
    level: match[1]?.length ?? 1,
    text: (match[2] ?? "").trim(),
    slug: slugify(match[2] ?? "")
  }));
  const wikiLinks = Array.from(body.matchAll(WIKI_LINK_PATTERN)).map((match) => ({
    raw: match[0],
    target: (match[1] ?? "").trim(),
    alias: match[2]?.trim() ?? null
  }));
  const tags = Array.from(body.matchAll(TAG_PATTERN)).map((match) =>
    (match[1] ?? "").trim().toLowerCase()
  );
  const words = body.trim().match(/\S+/g) ?? [];

  return {
    properties,
    aliases,
    headings,
    tags: Array.from(new Set(tags)).sort(),
    wikiLinks,
    wordCount: words.length,
    characterCount: body.length
  };
}

export function buildMetadata(input: {
  content: string;
  kind?: EntryMetadata["kind"];
  path?: string | null;
  folder?: string | null;
  aliases?: string[];
  properties?: Record<string, unknown>;
  current?: unknown;
}) {
  const parsed = parseMarkdown(input.content);
  const current = coerceMetadata(input.current);
  const properties = {
    ...parsed.properties,
    ...(input.properties ?? {})
  };
  const aliases = Array.from(new Set([...(parsed.aliases ?? []), ...(input.aliases ?? [])]));

  return {
    ...current,
    kind: input.kind ?? current.kind ?? "note",
    path: input.path ?? current.path,
    folder: input.folder ?? current.folder,
    aliases,
    properties,
    headings: parsed.headings,
    wordCount: parsed.wordCount,
    characterCount: parsed.characterCount,
    backlinksReady: true
  } satisfies EntryMetadata;
}

export function coerceMetadata(value: unknown): EntryMetadata {
  return typeof value === "object" && value !== null ? (value as EntryMetadata) : {};
}

export async function syncMarkdownRelations(tx: Tx, entry: typeof entries.$inferSelect) {
  const parsed = parseMarkdown(entry.content);

  await tx.delete(links).where(and(eq(links.sourceEntryId, entry.id), eq(links.createdBy, "wiki")));

  for (const tagName of parsed.tags) {
    const [tag] = await tx
      .insert(tags)
      .values({
        vaultId: entry.vaultId,
        name: tagName,
        source: "manual"
      })
      .onConflictDoUpdate({
        target: [tags.vaultId, tags.name],
        set: {
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
        confidence: "1.000",
        approved: true
      })
      .onConflictDoUpdate({
        target: [entryTags.entryId, entryTags.tagId],
        set: {
          confidence: "1.000",
          approved: true
        }
      });
  }

  const candidates = await tx.query.entries.findMany({
    where: eq(entries.vaultId, entry.vaultId)
  });
  const candidateMap = new Map<string, typeof entries.$inferSelect>();

  for (const candidate of candidates) {
    const metadata = coerceMetadata(candidate.metadata);
    if (candidate.title) {
      candidateMap.set(normalizeTitle(candidate.title), candidate);
    }
    if (metadata.path) {
      candidateMap.set(normalizeTitle(metadata.path.split("/").at(-1) ?? metadata.path), candidate);
      candidateMap.set(normalizeTitle(metadata.path), candidate);
    }
    for (const alias of metadata.aliases ?? []) {
      candidateMap.set(normalizeTitle(alias), candidate);
    }
  }

  for (const wikiLink of parsed.wikiLinks) {
    const target = candidateMap.get(normalizeTitle(wikiLink.target));

    if (!target || target.id === entry.id) {
      continue;
    }

    await tx
      .insert(links)
      .values({
        vaultId: entry.vaultId,
        sourceEntryId: entry.id,
        targetEntryId: target.id,
        type: "relates_to" satisfies LinkType,
        strength: "1.000",
        justification: `Markdown wiki-link [[${wikiLink.target}]].`,
        createdBy: "wiki"
      })
      .onConflictDoUpdate({
        target: [links.sourceEntryId, links.targetEntryId, links.type],
        set: {
          strength: "1.000",
          justification: `Markdown wiki-link [[${wikiLink.target}]].`,
          createdBy: "wiki",
          updatedAt: new Date()
        }
      });
  }
}

function parseAliases(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map(String)
      .map((alias) => alias.trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((alias) => alias.trim())
      .filter(Boolean);
  }

  return [];
}

function parseFrontmatter(content: string) {
  const match = content.match(FRONTMATTER_PATTERN);

  if (!match?.[1]) {
    return {};
  }

  const properties: Record<string, unknown> = {};

  for (const line of match[1].split("\n")) {
    const separator = line.indexOf(":");
    if (separator === -1) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    const rawValue = line.slice(separator + 1).trim();

    if (!key) {
      continue;
    }

    properties[key] = rawValue.includes(",")
      ? rawValue.split(",").map((item) => item.trim())
      : rawValue;
  }

  return properties;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
