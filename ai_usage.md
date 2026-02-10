# AI Usage

This document describes how AI tools were used during the development of this project.

## Tools Used

- **Claude Code (using Opus 4.6)** used for code generation, test writing, and iterative development

## How AI Was Used

### Planning
AI was used to analyze the challenge requirements based entirely on the prompt supplied, explore the sample data files to understand their shape and content, and design the implementation plan including module dependency order and testing strategy.

### Implementation
Code was generated module-by-module in bottom-up dependency order:
1. `types.ts`, `constants.ts`, `logger.ts` — foundational modules with no internal dependencies
2. `normalizer.ts` — pure functions for bitlink normalization
3. `store.ts` — BitlinkStore class wrapping a Map with normalization on write
4. `inputStream.ts` — streaming factory for CSV and JSON files using `csv-parse` and `stream-json`
5. `processor.ts` — orchestration pipeline: load encodes, stream decodes, filter, count, sort
6. `index.ts` — CLI entry point with argument parsing and error handling

### Testing
AI generated unit tests for each module and a test against the real data files. The test asserts exact expected output values that were independently verified by analyzing the raw data.

### Debugging
AI identified and fixed an ESM interop issue with `stream-json` (CJS module requiring default imports in ESM context) and a validation ordering issue in `createInputStream` (extension check needed to precede file access check).

## Key Prompts Used

### Initial Prompt

The following prompt was provided as the starting point for the entire implementation. It specifies the task, architecture, tech stack, edge cases, testing requirements, and phased workflow:

<details>
<summary><strong style="font-size: 1.25em;">Full initial prompt (click to expand)</strong></summary>

> I'm working on a backend coding challenge for a senior engineer role at Bitly. The task is to process click event data and calculate click counts per URL. I'll walk you through what I need, the decisions I've already made, and the edge cases I want handled. Please don't start writing code until you've read through all of this.
>
> ## The Task
>
> I have two data files already in the project at `./data/`:
>
> - `./data/encodes.csv` maps long URLs to short bitlink components (domain + hash). Columns: `long_url`, `domain`, `hash`. Take a look at this file to understand the shape.
> - `./data/decodes.json` contains raw click events on bitlinks. Each record has: `bitlink` (full URL like `http://bit.ly/31Tt55y`), `timestamp` (ISO 8601), `user_agent`, `referrer`, `remote_ip`. Take a look at this file to understand the shape.
>
> The goal: count how many clicks each long URL received **in a given year** (defaults to 2021), then output a sorted JSON array (descending by count) in this format:
>
> ```
> [{"https://google.com": 3}, {"https://twitter.com": 2}]
> ```
>
> Include encodes with zero clicks for the target year (show them with count 0).
>
> ## Understanding Bitly's Domain Model
>
> This is important: Bitly doesn't just use `bit.ly` as a domain. Companies can configure **branded short domains** like `es.pn` (ESPN) or `amzn.to` (Amazon). These are all valid bitlinks. They're a core product feature, not edge cases or anomalies.
>
> So the decode data will naturally contain clicks for bitlinks across multiple domains. Some will match our encodes dataset and some won't. If a decode's bitlink matches an encode, count it. If it doesn't match any encode, skip it silently. It just means that encode isn't in our dataset. No warnings, no special handling. This is expected behavior.
>
> **Multiple bitlinks per long URL is also normal.** Every time someone shortens a URL, they get a new unique bitlink. A marketing team might shorten `google.com` ten times across different campaigns, each getting a unique hash, possibly across different branded domains. So you might see:
>
> ```csv
> https://google.com/,bit.ly,31Tt55y
> https://google.com/,bit.ly,abc123
> https://google.com/,es.pn,xyz789
> ```
>
> This is NOT a duplicate. These are three distinct bitlinks that all point to the same long URL. The system should create separate store entries for each bitlink, and clicks on any of them should roll up into the same `long_url` counter. The store is keyed by bitlink (for O(1) lookup), but the click counter is keyed by long URL (for correct aggregation). This happens naturally because the store and counter use different keys: bitlinks for lookup, long URLs for counting. Multiple bitlinks resolving to the same long URL increment the same counter entry. No special dedup logic is needed.
>
> The only true "duplicate" scenario is if the **same bitlink** (same domain + hash) maps to **different long URLs** in the encode data. That's anomalous. See the edge cases section for how to handle it.
>
> The test cases should explicitly demonstrate that branded/custom domains (like `es.pn`, `amzn.to`) are handled correctly alongside `bit.ly` links, and that multiple bitlinks for the same long URL aggregate correctly.
>
> ## Tech Stack (non-negotiable)
>
> - **Language**: TypeScript, targeting Node.js 20+
> - **Test framework**: Vitest
> - **CSV parsing**: `csv-parse` (streaming async API, not the sync variant. Both encode and decode files could be large)
> - **JSON streaming**: `stream-json` with `StreamArray`
> - **Logging**: `pino` for structured JSON logging
> - **CLI args**: Node's built-in `node:util` `parseArgs`. No Yargs, no Commander.
> - **No web frameworks**. This is a CLI tool, not a server.
>
> ## Architecture
>
> Flat structure. For a project with under 10 source files, nested subdirectories add navigation overhead without organizational benefit.
> File structure was generated here --->> http://bit.ly/3OgiRsl
> ```
> bitly-challenge/
> ├── src/
> │   ├── index.ts          # Entry point: CLI parsing, orchestration, error handling
> │   ├── inputStream.ts    # Factory: file path + required fields -> validated Readable stream of objects
> │   ├── store.ts          # BitlinkStore: wraps Map, normalizes on write, clear interface for future swap
> │   ├── processor.ts      # Stream pipeline: load encodes (init counters to 0), stream decodes, filter, match, count, sort
> │   ├── normalizer.ts     # Bitlink normalization (protocol stripping, lowercase domain)
> │   ├── constants.ts      # All constants: required fields, file extensions, default year, exit codes
> │   ├── logger.ts         # pino setup (writes to stderr)
> │   └── types.ts          # All TypeScript interfaces
> ├── tests/
> │   ├── inputStream.test.ts
> │   ├── store.test.ts
> │   ├── processor.test.ts
> │   └── normalizer.test.ts
> ├── data/
> │   ├── encodes.csv
> │   └── decodes.json
> ├── README.md
> ├── ai_usage.md
> ├── tsconfig.json
> ├── package.json
> └── vitest.config.ts
> ```
>
> ## Key Design Decisions (implement these, don't second-guess them)
>
> ### 1. BitlinkStore abstraction
>
> The bitlink-to-long-URL lookup lives in a `BitlinkStore` class in `store.ts` with a clear interface:
>
> ```typescript
> interface BitlinkStore {
>   set(domain: string, hash: string, longUrl: string): void;  // normalizes key internally
>   get(rawBitlink: string): string | undefined;                // normalizes input, returns longUrl
>   has(rawBitlink: string): boolean;
>   size: number;
> }
> ```
>
> The implementation uses an in-memory `Map<string, string>` where the key is the normalized bitlink (`domain/hash`, lowercased domain, no protocol) and the value is the long URL. This gives O(1) lookup per decode event.
>
> The store has a well-defined interface so the backing storage can be swapped later (e.g., to LevelDB for datasets that don't fit in memory) without touching the processor or any business logic.
>
> ### 2. Input stream factory (`inputStream.ts`)
>
> A single factory function `createInputStream` accepts a file path and a list of required fields, then returns a uniform `AsyncIterable<Record<string, string>>`. Consumers receive the same interface regardless of whether the source file is CSV or JSON.
>
> ```typescript
> function createInputStream(
>   filePath: string,
>   requiredFields: readonly string[]
> ): AsyncIterable<Record<string, string>>
> ```
>
> Internally, the factory:
>
> 1. Checks that the file exists (throws if not)
> 2. Detects format by file extension
> 3. Rejects unsupported extensions with a clear error
> 4. Sets up the appropriate stream parser (`csv-parse` for `.csv`, `stream-json` + `StreamArray` for `.json`)
> 5. Validates that the first record contains all required fields. If not, throws with a clear error showing expected vs. actual fields
> 6. Yields parsed records as plain objects
>
> Having one entry point for all file parsing keeps format detection and validation in a single place. Adding a new format later (like NDJSON) means adding one case here.
>
> For CSV files, use `csv-parse` with `columns: true` so the header row becomes object keys. This assumes the CSV always has a header row as its first line, which is how the provided `encodes.csv` is structured. This is where header validation matters most: if the CSV has wrong headers, fields silently resolve to `undefined` and you get wrong results with no error. The first-record validation catches this.
>
> For JSON files, use `stream-json` with `StreamArray` to stream array elements one at a time.
>
> ### 3. Bitlink normalization
>
> The encodes store `domain` and `hash` separately. The decodes store full URLs like `http://bit.ly/31Tt55y`. Normalize both to the same format: strip protocol (`http://`, `https://`), lowercase the domain, keep the hash case-sensitive. Both sides resolve to something like `bit.ly/31Tt55y`.
>
> This works equally well for branded domains: `http://es.pn/3MgVNnZ` normalizes to `es.pn/3MgVNnZ`.
>
> ### 4. Streaming everything
>
> Both input files are streamed. The encode file could also be large (imagine millions of shortened URLs). Both go through the same `createInputStream` factory: `csv-parse`'s async streaming API for CSV files, `stream-json` + `StreamArray` for JSON files.
>
> **Processing order**: Encodes must be fully parsed first to build the BitlinkStore before decodes can be streamed. This is a data dependency: you can't look up bitlinks without the store being populated. Streaming decodes sequentially after the store is ready keeps memory bounded to the store size plus one decode record at a time.
>
> ### 5. Dual format support (CSV and JSON for both inputs)
>
> The system detects file format by extension and handles either format for either input:
>
> - **Encodes as CSV**: headers `long_url,domain,hash`
> - **Encodes as JSON**: expects `[{ "long_url": string, "domain": string, "hash": string }]`
> - **Decodes as JSON**: array of objects with `bitlink`, `timestamp`, `user_agent`, `referrer`, `remote_ip`
> - **Decodes as CSV**: headers `bitlink,user_agent,timestamp,referrer,remote_ip`
>
> **Unsupported file formats**: If a file has an extension other than `.csv` or `.json`, log a clear error (e.g., `"Unsupported file format: .xml. Only .csv and .json files are supported."`) and exit with a non-zero code. This is a deliberate scope boundary. Document it in the README.
>
> ### 6. Configurable year filter (not hardcoded)
>
> The target year is a CLI flag with a default, not a constant buried in code. A marketer or analyst should be able to answer "how did links perform in 2022?" without modifying source code.
>
> ```bash
> # Default: 2021 (satisfies the challenge requirement)
> npx tsx src/index.ts
>
> # Different year
> npx tsx src/index.ts --year 2022
> ```
>
> Validate the `--year` flag: must be a 4-digit numeric string. If invalid (e.g., `--year banana`), log a clear error and exit.
>
> The filtering logic uses string prefix matching against the timestamp: `timestamp.startsWith(year)`. This is simple, fast, and correct for ISO 8601 timestamps.
>
> The constant `DEFAULT_YEAR = "2021"` is the default value, not the only value.
>
> ### 7. Constants, no magic strings
>
> Create a `constants.ts` file. Every literal that appears in business logic should be a named constant:
>
> - `DEFAULT_YEAR = "2021"`
> - `SUPPORTED_EXTENSIONS = [".csv", ".json"]`
> - `ENCODE_REQUIRED_FIELDS = ["long_url", "domain", "hash"] as const`
> - `DECODE_REQUIRED_FIELDS = ["bitlink", "timestamp"] as const`
> - `DEFAULT_ENCODES_PATH = "./data/encodes.csv"`
> - `DEFAULT_DECODES_PATH = "./data/decodes.json"`
> - Exit codes: `EXIT_SUCCESS = 0`, `EXIT_INPUT_ERROR = 1`, `EXIT_RUNTIME_ERROR = 2`
>
> ### 8. Zero-click encodes
>
> Initialize the click counter to 0 for each long URL during encode loading, before decodes are processed. As each encode record is loaded into the store, also set `counter.set(longUrl, 0)` if that long URL isn't already in the counter (multiple bitlinks may point to the same URL). By the time decode streaming begins, every encode long URL already has an entry. Clicks increment from 0. No post-processing reconciliation needed.
>
> ### 9. Output format
>
> The final result is a JSON array of single-key objects, sorted descending by count. Print it with `console.log(JSON.stringify(result))`. Pino logs go to stderr (configure this), final output goes to stdout, so the output is pipe-friendly.
>
> ## Edge Cases to Handle
>
> - **Unmatched bitlinks in decodes**: Decodes referencing bitlinks not in encodes (including branded domains like `es.pn`, `amzn.to`). Silently skip. This is normal, not an error.
> - **Multiple bitlinks per long URL**: Several bitlinks in encodes may map to the same long URL. This is normal. Create separate store entries for each bitlink; clicks aggregate naturally via the long URL counter. No dedup, no warning.
> - **Duplicate bitlinks (same domain/hash, different long URLs)**: This IS anomalous. Use last-write-wins for the store entry and log a warning that includes both URLs (e.g., `"Duplicate bitlink bit.ly/31Tt55y: overwriting mapping from https://google.com/ to https://bing.com/"`). This makes the behavior visible without crashing.
> - **Missing or malformed fields**: If a decode record is missing `bitlink` or `timestamp`, log a warning with the record index and skip it. Same for encodes missing required fields. Don't crash.
> - **Wrong CSV headers**: First-record validation in `createInputStream` catches this. Clear error showing expected vs. actual fields, then exit.
> - **Empty files**: Handle gracefully. Empty encodes = empty output array, empty decodes = all encodes with count 0.
> - **Malformed CSV**: If csv-parse encounters a structural error (mismatched quotes, etc.), catch it, log a clear human-readable error, and exit gracefully.
> - **Malformed JSON**: If the JSON file has a syntax error, catch the stream error, log a clear message, and exit gracefully.
> - **File not found**: If either input file doesn't exist, log an error with the path and exit with a non-zero code.
> - **Unsupported file extension**: Log and exit, as described above.
> - **Invalid year flag**: Must be 4 digits. Reject with a clear error.
>
> ## CLI Interface
>
> Flags with sensible defaults:
>
> ```bash
> # Default (looks for files in ./data/, year 2021)
> npx tsx src/index.ts
>
> # Custom paths
> npx tsx src/index.ts --encodes ./path/to/encodes.csv --decodes ./path/to/decodes.json
>
> # Custom year
> npx tsx src/index.ts --year 2022
>
> # Mix formats
> npx tsx src/index.ts --encodes ./encodes.json --decodes ./decodes.csv
>
> # Everything custom
> npx tsx src/index.ts --encodes ./encodes.json --decodes ./decodes.csv --year 2020
> ```
>
> Use `parseArgs` from `node:util`.
>
> ## Testing Requirements
>
> Every module should have unit tests. Here's what I want covered:
>
> ### normalizer.test.ts
> - Strips `http://` and `https://` protocols
> - Lowercases domain portion but preserves hash case
> - Handles branded domains: `http://es.pn/3MgVNnZ` -> `es.pn/3MgVNnZ`
> - Handles `http://amzn.to/3C5IIJm` -> `amzn.to/3C5IIJm`
> - Builds correct normalized key from separate domain + hash (encode format)
> - Edge cases: empty string, missing protocol, trailing slashes
>
> ### inputStream.test.ts
> - Parses valid CSV into objects with correct keys
> - Parses valid JSON into objects with correct keys
> - Handles empty file (headers only for CSV, empty array for JSON)
> - Validates required fields. Rejects records missing required keys with a clear error showing expected vs. actual
> - Detects wrong CSV headers and produces a clear error
> - Handles branded domains in the domain field (not just `bit.ly`)
> - Rejects unsupported file extensions with a clear message
> - Handles file not found
>
> ### store.test.ts
> - Stores and retrieves bitlinks correctly using domain + hash
> - Retrieves by raw bitlink URL (normalizes internally)
> - Handles branded domains (`es.pn`, `amzn.to`) identically to `bit.ly`
> - Multiple bitlinks mapping to the same long URL are stored as separate entries
> - Duplicate bitlink (same domain/hash, different long URL) uses last-write-wins and logs a warning
> - Returns `undefined` for unknown bitlinks
>
> ### processor.test.ts
> - Correctly counts clicks per long URL for standard `bit.ly` links
> - Correctly counts clicks for branded domains (`es.pn`, `amzn.to`) when their encodes are present
> - Multiple bitlinks for the same long URL aggregate into a single count
> - Ignores decodes for bitlinks not in the store (branded or otherwise). No crash, no error
> - Returns results sorted descending by count
> - Includes encodes with zero clicks (counter initialized during encode loading, not as a post-processing step)
> - Handles empty inputs (no encodes, no decodes)
> - Handles all decodes being outside the target year
> - Handles boundary timestamps: `2020-12-31T23:59:59Z` (excluded) and `2021-01-01T00:00:00Z` (included)
> - Works with different year values, not just 2021
>
> For stream-based tests, create a `Readable` from test data rather than hitting the filesystem.
>
> ## Logging
>
> Use pino. Configure it to write to **stderr** (so stdout is reserved for the program's actual output). Set it up once in `logger.ts` and import everywhere.
>
> - `info`: App startup, file paths and detected formats, target year, total encodes loaded, total unique long URLs, total decodes processed, total clicks counted for target year
> - `warn`: Skipped records with missing fields (include record index), duplicate bitlinks (same domain/hash, different URLs)
> - `error`: File not found, unsupported format, malformed file, wrong headers (with expected vs. actual), invalid year flag, unexpected runtime errors
>
> Don't log every single decode event. Log aggregate summaries.
>
> ## README
>
> Write a solid README that covers:
>
> - What the project does (brief)
> - Prerequisites (Node.js 20+, npm)
> - How to install dependencies (`npm install`)
> - How to run (`npm start` or `npx tsx src/index.ts`)
> - How to run with custom file paths and custom year
> - How to run tests (`npm test`)
> - Design decisions section:
>   - Why TypeScript
>   - Why streaming for both inputs
>   - The BitlinkStore abstraction and why it has a defined interface (future storage backend swap)
>   - The input stream factory and how it keeps format handling in one place
>   - Why encodes are processed before decodes (data dependency requires the store to be populated first)
>   - Why `node:util` parseArgs is sufficient for a single-purpose CLI tool
>   - Dual format support rationale
>   - Configurable year filter rationale
>   - CSV header validation: why silent wrong-key failures are dangerous and how first-record validation prevents them
>   - Branded bitlinks are a product feature, not edge cases
>   - Multiple bitlinks per URL vs. duplicate bitlinks: the distinction and how each is handled
>   - Complexity analysis: O(D + E log E) time, O(E) memory for the lookup store
> - Assumptions section (include these explicitly):
>   - CSV files always have a header row as the first line, and the headers map directly to field names used in the code (`long_url`, `domain`, `hash` for encodes; `bitlink`, `timestamp`, etc. for decodes). The parser uses these headers as object keys via `csv-parse`'s `columns: true` option.
>   - The provided data files are representative of the expected format. The system validates headers on the first record and will reject files with unexpected column names.
> - Supported file formats (.csv, .json). Explicitly state this scope boundary.
> - Future enhancements section (see below)
>
> ## Future Enhancements (document in README, do not implement)
>
> These are deliberate extensions that demonstrate forward thinking. Document them in the README as "what I'd add next":
>
> - **Persistent storage backend for large encode datasets**: For encode datasets exceeding available memory, replace the in-memory Map inside BitlinkStore with an embedded key-value store. The recommended choice is **LevelDB** (via the `level` npm package) because the access pattern is exclusively point lookups by key, and LevelDB is purpose-built for this with zero configuration and no native compilation issues. **SQLite** (via `better-sqlite3`) is a viable alternative if the requirements evolve to need range queries or aggregations (e.g., "show me all bitlinks for a given domain"), but it introduces SQL parsing overhead and native build dependencies for what is currently a key-value problem. Either way, the streaming decode pipeline and all business logic remain unchanged because the BitlinkStore interface abstracts the backing storage.
> - **Date range filtering**: `--from 2021-01-01 --to 2021-06-30` for quarterly or monthly analysis.
> - **Custom field mapping**: `--encode-fields "url:long_url,domain:domain,hash:hash"` to support CSVs/JSON with different key names without code changes. Useful when different internal teams export data with varying column naming conventions.
> - **Additional format support**: NDJSON (newline-delimited JSON) for large-scale streaming, Parquet for analytics pipelines. The `createInputStream` factory is designed so adding a new format is a single case addition.
> - **Configurable output destination and format**: Currently the tool writes JSON to stdout, which works well for piping and scripting. A `--output ./results.json` flag would write to a file instead, and a `--format csv` flag would control the output format. Supported output formats would match the supported input formats (.json and .csv only). When no `--output` is specified, behavior stays the same: JSON to stdout. When `--output` is specified without `--format`, default to JSON. This keeps the tool useful for both engineers (who pipe stdout) and analysts (who want a file they can open).
> - **Multiple decode files**: Accept multiple decode file paths (e.g., `--decodes jan.json feb.json mar.json`) to process several files in one run. Bitly might export click data in monthly or quarterly batches, and this avoids having to manually concatenate files before running the tool.
>
> ## Package.json Scripts
>
> - `start`: runs the app (`tsx src/index.ts`)
> - `test`: runs vitest
> - `test:coverage`: runs vitest with coverage
> - `lint`: if you add eslint
> - `build`: compile TypeScript (optional but nice)
>
> ## Other Notes
>
> - tsconfig should target ES2022+ with strict mode enabled
> - Don't over-engineer. No dependency injection frameworks, no abstract factory patterns. Clean, readable TypeScript with clear module boundaries. The BitlinkStore class and createInputStream factory are pragmatic abstractions with clear purpose.
> - Add JSDoc comments on public functions. Brief, focused on intent, not restating the obvious.
> - Wrap the main function in a try/catch that logs unexpected errors and exits with the appropriate code. No unhandled promise rejections.
>
> ## Workflow
>
> Work in three phases. Wait for my approval before moving to the next phase.
>
> **Phase 1: Plan.** Before writing any code, give me a plan of how you'll implement this. Walk me through the order you'll build things, any concerns or questions about the spec, and anything you'd change. I'll review and approve before you move on.
>
> **Phase 2: Scaffold.** Set up the project skeleton: `package.json`, `tsconfig.json`, `vitest.config.ts`, install all dependencies, create all source and test files with empty exports/stubs, and verify the project compiles and `npm test` runs (even if all tests are skipped/empty). This catches dependency, config, and build issues before any business logic is written. Show me the output of `npx tsc --noEmit` and `npm test` before moving on.
>
> **Phase 3: Implement.** Fill in the actual code module by module, running tests as you go. Start with the modules that have no internal dependencies (normalizer, constants, types, logger), then build upward (store, inputStream, processor, index).
>
> **Optional (time permitting):** Add a Dockerfile so reviewers can run the project without installing Node.js locally. Not a priority, only if everything else is solid.

</details>

### Code Generation
- The full prompt above gave the AI enough context to generate code that aligned with the design without back-and-forth.
- Each module was prompted individually in dependency order (e.g., "implement normalizer.ts with these functions and these test cases"), which kept generations focused and testable.

### Problem-Solving
- Asked the AI to analyze the raw data files before implementation to determine expected output values (e.g., "count clicks per long URL for year 2021 from the real data"). This produced the gold-standard for test assertion(s).
- Prompted for a dependency graph of modules to determine the correct build order.

### Debugging
- When `stream-json` imports failed at runtime, described the error and asked for the correct ESM import pattern for CJS modules. The AI identified that `stream-json` only exposes a default export in ESM and corrected the imports.
- When the "unsupported file extension" test failed because the file access check ran first, described the test failure and the AI reordered the validation logic.

## Manual Intervention and Modifications

- **Normalization ownership refactor**: After initial AI implementation, reviewed the code and identified that normalization was split between the processor and the store. Provided specific feedback (6 items) directing the AI to make the store the single owner of normalization. The AI did not identify this design issue on its own.
- **Magic string centralization**: After reviewing the codebase, directed the AI to extract all inline error and log message strings into `constants.ts`. The AI generated working code but needed explicit guidance on what the problem was.
- **Empty encodes early return**: Identified that the processor would unnecessarily stream and process the entire decodes file even when no encodes were loaded (empty file or all records skipped). Added an early return at `processor.ts:47-50` that checks `store.size === 0`, logs a message (`LOG_NO_ENCODES_LOADED`), and returns an empty array immediately, skipping the decode phase entirely. The AI did not account for this edge case.
- **Malformed file error handling**: The AI's original `streamCsv` and `streamJson` implementations piped streams directly without forwarding errors between them, meaning a file read error or parser syntax error could silently hang or crash the program. Rewrote both functions to explicitly forward upstream errors (`fileStream.on('error', ...)` destroying the downstream parser/streamArray), wrap the `for await` loop in try/catch to detect parser-specific errors (mismatched quotes in CSV, unexpected tokens in JSON), and rethrow with a clear `errFileSyntax` message including the file type, path, and original error. Added the `errFileSyntax` constant function to `constants.ts`. The AI did not handle piped stream error propagation or malformed file detection. I also expanded the tests to verify the error was handled.
- **Production build step**: The AI left `tsx` (runtime TypeScript compilation) as the production run command, which adds unnecessary overhead. Added a proper build pipeline: created `tsconfig.build.json` (extends base config, emits to `dist/`), updated `package.json` scripts so `start` runs `node dist/index.js`, and added a `dev` script to keep `tsx` available for development. Updated README usage accordingly. The AI did not distinguish between development and production execution.
- **README improvements**: Reviewed AI-generated docs and directed additions (install links, dependency tables). The AI produced solid first drafts but it needed human review to ensure completeness and accuracy.

## When AI Assistance Was Used vs. Manual Implementation

### AI was the right tool for:
- **Boilerplate and scaffolding**: package.json, tsconfig.json, vitest config, stub files, test fixtures. Repetitive setup that benefits from speed over creativity.
- **Implementation of well-specified modules**: When the architecture, interfaces, and edge cases were clearly defined in the prompt, the AI produced correct implementations on the first pass (normalizer, store, processor).
- **Test generation**: Given the function signatures and expected behaviors, the AI generated comprehensive test suites including edge cases (empty files, branded domains, boundary timestamps).
- **Data analysis**: Counting clicks in the raw decode data to determine expected test output, tedious manual work that the AI handled accurately.

### Manual judgment was needed for:
- **Architecture review**: Identifying that normalization responsibility was split across modules required understanding the design intent, not just the code. The AI implemented what was asked but didn't flag the design smell.
- **Code quality feedback**: Noticing the `as unknown as` double-casts, unused `entries()` method, and string-interpolated pino logs required reading the code with an experienced eye.
- **Documentation completeness**: Knowing what a reviewer expects in a README (install links, dependency table) vs. what the AI included by default.

- **Edge case identification**: Running various usage scenarios program to catch edge cases the AI did not account for. E.g: Malformed input files or general data parser errors.

## Challenges with AI-Generated Code

1. **ESM/CJS interop**: The AI initially used named imports (`import { parser } from "stream-json"`) which work in CJS but fail in ESM. The error only surfaced at runtime, not during type-checking. Resolution: switched to default imports (`import StreamJson from "stream-json"` then `StreamJson.parser()`).

2. **Validation ordering**: The AI placed the file access check (`fs.access`) before the extension check. This meant passing `data.xml` threw "file not found" instead of "unsupported format". The test caught it immediately. Resolution: swapped the order so extension validation runs first.

3. **Design-level blind spots**: The AI correctly implemented each module in isolation but didn't flag cross-module concerns like normalization ownership being split. It needed explicit human feedback to refactor the store into the single normalization owner. This suggests AI is stronger at local correctness than system-level design review.

4. **Overly safe type casting**: The AI used `as unknown as EncodeRecord` double-casts even though `Record<string, string>` already had validated keys. This was technically safe but unnecessarily verbose. Required explicit feedback to simplify to direct destructuring.

## What Was NOT AI-Generated

- The architectural decisions and design constraints were specified in the challenge prompt
- The data files (`encodes.csv`, `decodes.json`) were provided as-is
- All code was reviewed and approved before committing
- Design review feedback (normalization ownership, magic strings, type cast cleanup) & edge case fixing were all human.
