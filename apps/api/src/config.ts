import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  API_HOST: z.string().default("0.0.0.0"),
  API_PORT: z.coerce.number().int().positive().default(3333),
  WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
  DATABASE_URL: z.string().default("postgres://ideahub:ideahub@localhost:5432/ideahub"),
  SESSION_SECRET: z.string().default("dev-session-secret"),
  LLM_PROVIDER: z.string().default("openai"),
  EMBEDDING_MODEL: z.string().default("text-embedding-3-small")
});

export const config = envSchema.parse(process.env);
