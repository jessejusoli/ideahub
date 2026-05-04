import { config } from "./config";
import { buildServer } from "./server";

const app = buildServer();

try {
  await app.listen({
    host: config.API_HOST,
    port: config.API_PORT
  });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
