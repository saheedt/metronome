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
  ERR_INVALID_YEAR,
  ERR_FILE_NOT_FOUND,
  ERR_PROCESSING_FAILED,
  ERR_UNEXPECTED,
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
    logger.error({ year }, ERR_INVALID_YEAR);
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
        logger.error({ error: error.message }, ERR_FILE_NOT_FOUND);
        process.exit(EXIT_INPUT_ERROR);
      }
      logger.error({ error: error.message }, ERR_PROCESSING_FAILED);
    } else {
      logger.error({ error }, ERR_UNEXPECTED);
    }
    process.exit(EXIT_RUNTIME_ERROR);
  }
}

main();
