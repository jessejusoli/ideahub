import { processNextAnalysisJob } from "../analysis/pipeline";
import { closeDb } from "../db/client";

async function main() {
  const result = await processNextAnalysisJob();

  if (!result) {
    console.log("No queued analysis job is ready to process.");
    return;
  }

  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
