import { createHash } from "node:crypto";

export const EMBEDDING_DIMENSIONS = 1536;
export const LOCAL_EMBEDDING_MODEL = "ideahub-local-hash-embedding-v1";

const TOKEN_PATTERN = /[\p{L}\p{N}_-]+/gu;

export function tokenize(text: string) {
  return Array.from(text.toLowerCase().matchAll(TOKEN_PATTERN), (match) => match[0]).filter(
    (token) => token.length > 1
  );
}

export function createDeterministicEmbedding(text: string) {
  const vector = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0);
  const tokens = tokenize(text);

  for (const token of tokens) {
    const digest = createHash("sha256").update(token).digest();
    const index = digest.readUInt32BE(0) % EMBEDDING_DIMENSIONS;
    const sign = digest[4] % 2 === 0 ? 1 : -1;
    const weight = 1 + Math.min(token.length, 16) / 16;
    vector[index] += sign * weight;
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));

  if (magnitude === 0) {
    return vector;
  }

  return vector.map((value) => Number((value / magnitude).toFixed(6)));
}

export function toPgVectorLiteral(vector: number[]) {
  return `[${vector.join(",")}]`;
}
