import { parseArgs } from "node:util";
import { processClicks } from "./processor.js";
import { logger } from "./logger.js";
import {
  DEFAULT_ENCODES_PATH,
  DEFAULT_DECODES_PATH,
  DEFAULT_YEAR,
  YEAR_PATTERN,
  EXIT_INPUT_ERROR,
  EXIT_RUNTIME_ERROR,
} from "./constants.js";

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      encodes: { type: "string", default: DEFAULT_ENCODES_PATH },
      decodes: { type: "string", default: DEFAULT_DECODES_PATH },
      year: { type: "string", default: DEFAULT_YEAR },
    },
    strict: true,
  });

  const { encodes, decodes, year } = values as {
    encodes: string;
    decodes: string;
    year: string;
  };

  if (!YEAR_PATTERN.test(year)) {
    logger.error({ year }, "Invalid year format. Expected 4-digit year (e.g., 2021)");
    process.exit(EXIT_INPUT_ERROR);
  }

  try {
    const result = await processClicks({
      encodesPath: encodes,
      decodesPath: decodes,
      year,
    });

    console.log(JSON.stringify(result));
  } catch (error) {
    if (error instanceof Error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        logger.error({ error: error.message }, "File not found");
        process.exit(EXIT_RUNTIME_ERROR);
      }
      logger.error({ error: error.message }, "Processing failed");
    } else {
      logger.error({ error }, "Unexpected error");
    }
    process.exit(EXIT_RUNTIME_ERROR);
  }
}

main();
