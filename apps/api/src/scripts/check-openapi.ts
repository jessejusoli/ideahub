import { buildServer } from "../server";

async function main() {
  const app = buildServer();

  try {
    await app.ready();
    const document = app.swagger();

    if (!document || typeof document !== "object") {
      throw new Error("OpenAPI document was not generated.");
    }

    if (!("openapi" in document) || document.openapi !== "3.1.0") {
      throw new Error("OpenAPI document must use version 3.1.0.");
    }

    if (!("paths" in document) || Object.keys(document.paths ?? {}).length === 0) {
      throw new Error("OpenAPI document does not contain paths.");
    }

    console.log(
      `OpenAPI ${document.openapi} generated with ${Object.keys(document.paths ?? {}).length} paths.`
    );
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
