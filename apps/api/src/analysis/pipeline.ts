import type { AnalysisSuggestion, Layer, LinkType } from "@ideahub/shared";
import { layers } from "@ideahub/shared";
import { and, asc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "../db/client";
import { analysisSuggestions, embeddings, entries, llmJobs } from "../db/schema";
import {
  createDeterministicEmbedding,
  LOCAL_EMBEDDING_MODEL,
  toPgVectorLiteral,
  tokenize
} from "./embeddings";

const ANALYSIS_MODEL = "ideahub-local-analysis-v1";
const MAX_CHUNK_LENGTH = 900;
const MAX_RETRIEVAL_RESULTS = 6;

const STOPWORDS = new Set([
  "about",
  "after",
  "again",
  "also",
  "because",
  "before",
  "could",
  "every",
  "from",
  "have",
  "into",
  "just",
  "more",
  "need",
  "over",
  "project",
  "should",
  "that",
  "their",
  "there",
  "this",
  "through",
  "what",
  "when",
  "where",
  "with",
  "would",
  "para",
  "como",
  "isso",
  "essa",
  "esse",
  "sobre",
  "uma",
  "que",
  "com"
]);

type RetrievalRow = {
  entryId: string;
  title: string | null;
  content: string;
  chunk: string;
  score: string | number;
};

export type SemanticSearchResult = {
  entryId: string;
  title: string | null;
  content: string;
  chunk: string;
  score: number;
};

type AnalysisPayload = AnalysisSuggestion["payload"] & {
  confidence: number;
  rationale: string;
  retrievedContext: Array<{
    entryId: string;
    title: string | null;
    score: number;
    chunk: string;
  }>;
};

export function chunkContent(content: string) {
  const paragraphs = content
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const source = paragraphs.length > 0 ? paragraphs : [content.trim()];
  const chunks: string[] = [];

  for (const paragraph of source) {
    if (paragraph.length <= MAX_CHUNK_LENGTH) {
      chunks.push(paragraph);
      continue;
    }

    for (let start = 0; start < paragraph.length; start += MAX_CHUNK_LENGTH) {
      chunks.push(paragraph.slice(start, start + MAX_CHUNK_LENGTH).trim());
    }
  }

  return chunks.length > 0 ? chunks : [content.trim()];
}

export function guessLayer(content: string): { layer: Layer; confidence: number } {
  const text = content.toLowerCase();
  const scores: Record<Layer, number> = {
    intention: scoreTerms(text, ["purpose", "why", "mission", "vision", "goal", "motivation"]),
    concept: scoreTerms(text, ["idea", "concept", "principle", "model", "meaning", "pattern"]),
    structure: scoreTerms(text, [
      "system",
      "process",
      "architecture",
      "schema",
      "project",
      "organize"
    ]),
    execution: scoreTerms(text, ["task", "build", "implement", "deliver", "action", "next", "todo"])
  };

  const layer = layers.reduce((current, candidate) =>
    scores[candidate] > scores[current] ? candidate : current
  );
  const total = Object.values(scores).reduce((sum, value) => sum + value, 0);
  const confidence = total === 0 ? 0.52 : Math.min(0.92, 0.55 + scores[layer] / (total + 4));

  return { layer, confidence: Number(confidence.toFixed(2)) };
}

export function summarize(content: string) {
  const firstSentence = content.trim().split(/(?<=[.!?])\s+/)[0] ?? content.trim();
  const summary =
    firstSentence.length > 220 ? `${firstSentence.slice(0, 217).trim()}...` : firstSentence;

  return summary || "Captured thought awaiting human review.";
}

export function suggestTags(content: string, limit = 8) {
  const counts = new Map<string, number>();

  for (const token of tokenize(content)) {
    if (token.length < 4 || STOPWORDS.has(token)) {
      continue;
    }

    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([tag]) => tag);
}

export async function semanticSearch(input: {
  query: string;
  vaultId?: string;
  excludeEntryId?: string;
  limit?: number;
}) {
  const limit = input.limit ?? 10;
  const vectorLiteral = toPgVectorLiteral(createDeterministicEmbedding(input.query));
  const where = [
    input.vaultId ? sql`${entries.vaultId} = ${input.vaultId}` : undefined,
    input.excludeEntryId ? sql`${entries.id} <> ${input.excludeEntryId}` : undefined
  ].filter(Boolean);
  const whereSql = where.length > 0 ? sql`where ${sql.join(where, sql` and `)}` : sql``;

  const result = await db.execute<RetrievalRow>(sql`
    select
      ${entries.id} as "entryId",
      ${entries.title} as "title",
      ${entries.content} as "content",
      ${embeddings.content} as "chunk",
      1 - (${embeddings.embedding} <=> ${vectorLiteral}::vector) as "score"
    from ${embeddings}
    inner join ${entries} on ${embeddings.entryId} = ${entries.id}
    ${whereSql}
    order by ${embeddings.embedding} <=> ${vectorLiteral}::vector
    limit ${limit}
  `);

  return result.rows.map((row) => ({
    entryId: row.entryId,
    title: row.title,
    content: row.content,
    chunk: row.chunk,
    score: Number(Number(row.score).toFixed(4))
  }));
}

export async function processAnalysisJob(jobId: string) {
  const job = await db.query.llmJobs.findFirst({
    where: eq(llmJobs.id, jobId)
  });

  if (!job || job.type !== "analysis" || !job.entryId) {
    return null;
  }

  const entry = await db.query.entries.findFirst({
    where: eq(entries.id, job.entryId)
  });

  if (!entry) {
    await markJobFailed(job.id, "Entry not found for analysis job.");
    return null;
  }

  try {
    await db
      .update(llmJobs)
      .set({
        status: "running",
        attempts: job.attempts + 1,
        error: null,
        updatedAt: new Date()
      })
      .where(eq(llmJobs.id, job.id));

    const chunks = chunkContent(entry.content);

    await db.transaction(async (tx) => {
      await tx.delete(embeddings).where(eq(embeddings.entryId, entry.id));

      for (const [chunkIndex, chunk] of chunks.entries()) {
        const vectorLiteral = toPgVectorLiteral(createDeterministicEmbedding(chunk));

        await tx.execute(sql`
          insert into ${embeddings}
            (entry_id, chunk_index, content, model, embedding)
          values
            (${entry.id}, ${chunkIndex}, ${chunk}, ${LOCAL_EMBEDDING_MODEL}, ${vectorLiteral}::vector)
        `);
      }
    });

    const retrieved = await semanticSearch({
      query: entry.content,
      vaultId: entry.vaultId,
      excludeEntryId: entry.id,
      limit: MAX_RETRIEVAL_RESULTS
    });
    const payload = buildAnalysisPayload(entry.content, retrieved);

    const [suggestion] = await db
      .insert(analysisSuggestions)
      .values({
        entryId: entry.id,
        payload,
        model: ANALYSIS_MODEL
      })
      .returning();

    if (!suggestion) {
      throw new Error("Failed to create analysis suggestion.");
    }

    await db
      .update(entries)
      .set({
        status: "review",
        updatedAt: new Date()
      })
      .where(eq(entries.id, entry.id));

    await db
      .update(llmJobs)
      .set({
        status: "succeeded",
        output: {
          suggestionId: suggestion.id,
          chunks: chunks.length,
          retrievedContext: retrieved.length
        },
        updatedAt: new Date()
      })
      .where(eq(llmJobs.id, job.id));

    return {
      jobId: job.id,
      entryId: entry.id,
      suggestionId: suggestion.id,
      chunks: chunks.length,
      retrievedContext: retrieved.length
    };
  } catch (error) {
    await markJobFailed(job.id, error instanceof Error ? error.message : "Unknown analysis error.");
    throw error;
  }
}

export async function processNextAnalysisJob() {
  const [job] = await db
    .select()
    .from(llmJobs)
    .where(
      and(eq(llmJobs.type, "analysis"), eq(llmJobs.status, "queued"), isNotNull(llmJobs.entryId))
    )
    .orderBy(asc(llmJobs.createdAt))
    .limit(1);

  if (!job) {
    return null;
  }

  return processAnalysisJob(job.id);
}

function buildAnalysisPayload(content: string, retrieved: SemanticSearchResult[]): AnalysisPayload {
  const layer = guessLayer(content);
  const tags = suggestTags(content);
  const links = retrieved
    .filter((item) => item.score >= 0.05)
    .slice(0, 5)
    .map((item) => ({
      targetEntryId: item.entryId,
      type: "relates_to" as LinkType,
      strength: Math.min(0.95, Math.max(0.35, item.score)),
      confidence: Math.min(0.9, Math.max(0.4, item.score)),
      justification: `Retrieved by semantic similarity with score ${item.score}. Human review is required before consolidation.`
    }));

  return {
    layer: layer.layer,
    summary: summarize(content),
    tags,
    links,
    confidence: layer.confidence,
    rationale:
      "Local deterministic MVP analysis generated from keyword heuristics and pgvector retrieval. This is reviewable scaffolding for future LLM-backed analysis.",
    retrievedContext: retrieved.map((item) => ({
      entryId: item.entryId,
      title: item.title,
      score: item.score,
      chunk: item.chunk
    }))
  };
}

function scoreTerms(text: string, terms: string[]) {
  return terms.reduce((score, term) => score + (text.includes(term) ? 1 : 0), 1);
}

async function markJobFailed(jobId: string, message: string) {
  await db
    .update(llmJobs)
    .set({
      status: "failed",
      error: message,
      updatedAt: new Date()
    })
    .where(eq(llmJobs.id, jobId));
}
