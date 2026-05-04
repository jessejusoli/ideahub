import cors from "@fastify/cors";
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { config } from "./config";
import { registerOpenApi } from "./openapi";
import { registerEntryRoutes } from "./routes/entries";
import { registerGraphRoutes } from "./routes/graph";
import { registerHealthRoutes } from "./routes/health";
import { registerJobRoutes } from "./routes/jobs";
import { registerProjectRoutes } from "./routes/projects";
import { registerSearchRoutes } from "./routes/search";
import { registerVaultRoutes } from "./routes/vaults";

export function buildServer() {
  const app = Fastify({
    logger: true
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  void app.register(cors, {
    origin: config.WEB_ORIGIN,
    credentials: true
  });

  registerOpenApi(app);

  void app.register(registerHealthRoutes, { prefix: "/api" });
  void app.register(registerVaultRoutes, { prefix: "/api" });
  void app.register(registerProjectRoutes, { prefix: "/api" });
  void app.register(registerEntryRoutes, { prefix: "/api" });
  void app.register(registerJobRoutes, { prefix: "/api" });
  void app.register(registerSearchRoutes, { prefix: "/api" });
  void app.register(registerGraphRoutes, { prefix: "/api" });

  return app;
}
