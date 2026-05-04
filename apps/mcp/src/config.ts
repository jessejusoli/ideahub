import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  IDEAHUB_API_BASE_URL: z.string().url().default("http://localhost:3333/api")
});

export const config = envSchema.parse(process.env);
