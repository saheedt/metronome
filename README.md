# Metronome

A CLI tool that processes Bitly click event data and calculates click counts per long URL for a given year. Takes encode mappings (long URL to short bitlink) and decode events (clicks on bitlinks), then outputs a sorted JSON array of click counts.

## Prerequisites

- [Node.js](https://nodejs.org/) 20+ — [download](https://nodejs.org/en/download/)
- [npm](https://www.npmjs.com/) (ships with Node.js)

## Dependencies

### Production
| Package | Purpose |
|---------|---------|
| [csv-parse](https://www.npmjs.com/package/csv-parse) | Streaming async CSV parser |
| [stream-json](https://www.npmjs.com/package/stream-json) | Streaming JSON parser with `StreamArray` |
| [pino](https://www.npmjs.com/package/pino) | Structured JSON logging (writes to stderr) |

### Development
| Package | Purpose |
|---------|---------|
| [typescript](https://www.npmjs.com/package/typescript) | Type checking (`tsc --noEmit`) |
| [tsx](https://www.npmjs.com/package/tsx) | TypeScript execution for Node.js |
| [vitest](https://www.npmjs.com/package/vitest) | Test framework |
| [@types/node](https://www.npmjs.com/package/@types/node) | Node.js type definitions |
| [@types/stream-json](https://www.npmjs.com/package/@types/stream-json) | stream-json type definitions |

## Setup

```bash
npm install
npm run build
```

## Usage

```bash
# Production: compile once, run with Node
npm run build
npm start -- [flags]

# Development: run directly with tsx (no build step)
npm run dev -- [flags]
```

### Examples

```bash
# Default: processes ./data/ files for year 2021
npm start

# Custom year
npm run dev -- --year 2022

# Custom file paths
npm start -- --encodes ./path/to/encodes.csv --decodes ./path/to/decodes.json

# Mix formats (CSV encodes, JSON decodes or vice versa)
npm run dev -- --encodes ./encodes.json --decodes ./decodes.csv

# Everything custom
npm start -- --encodes ./encodes.json --decodes ./decodes.csv --year 2020
```

### Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--encodes` | `data/encodes.csv` | Path to the encodes file (`.csv` or `.json`) |
| `--decodes` | `data/decodes.json` | Path to the decodes file (`.csv` or `.json`) |
| `--year` | `2021` | 4-digit year to filter clicks by |

### Output

JSON array to stdout, sorted descending by click count:

```json
[{"https://youtube.com/":557},{"https://twitter.com/":512},{"https://reddit.com/":510}]
```

All log messages go to stderr (via pino), so output is pipe-friendly:

```bash
npm start 2>/dev/null | jq '.'
```

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Type checking
npm run typecheck
```

## Design Decisions

### Why TypeScript
Strict typing catches field name mismatches and structural errors at compile time rather than at runtime with silent `undefined` lookups. Critical for a data pipeline where wrong field names produce wrong results with no error.

### Stream-Based Architecture
**Decodes (Log Data):** The decode file is treated as an unbounded stream. Records are processed one-by-one and immediately discarded. This ensures the application runs with constant O(1) memory relative to the size of the decode file, allowing it to process terabytes of logs without crashing.

**Encodes (Lookup Data):** The encode file is streamed to optimize ingestion efficiency. Streaming prevents the engine from loading the entire raw file string into RAM before parsing, which significantly reduces peak memory pressure during startup. Note: While streaming optimizes the read phase, the application currently stores the parsed mappings in an in-memory Map (O(E) space). If the encodes dataset itself exceeds available RAM, the BitlinkStore backend would need to be swapped for an on-disk key-value store (like LevelDB), as detailed in the Future Enhancements section.

### BitlinkStore abstraction
The `BitlinkStore` class wraps a `Map<string, string>` with a clear interface (`set`, `get`, `has`, `size`). This abstraction exists so the backing storage can be swapped later (e.g., to LevelDB for datasets that don't fit in memory) without touching the processor or any business logic.

### Input stream factory
`createInputStream` is a single factory function that accepts a file path and required field names, detects format by extension, and returns a uniform `AsyncIterable<Record<string, string>>`. This keeps format detection and validation in one place. Adding a new format (like NDJSON) means adding one case here.

### Encodes processed before decodes
This is a data dependency: you can't look up bitlinks without the store being populated first. Streaming decodes sequentially after the store is ready keeps memory bounded to the store size plus one decode record at a time.

### `node:util` parseArgs
Node's built-in `parseArgs` (stable since Node 20) is sufficient for a single-purpose CLI tool with three optional flags. No need for Commander or Yargs.

### Dual format support
Both inputs (encodes & decodes) support `.csv` and `.json` formats, detected by file extension. This allows flexibility in how data is provided without code changes.

### Configurable year filter
The target year is a CLI flag (`--year`) with a default of 2021. A marketer or analyst can answer "how did links perform in 2022?" without having to modifying source code. Filtering uses `timestamp.startsWith(year)` — simple, fast, and correct for ISO 8601 timestamps.

### CSV header validation
`csv-parse` with `columns: true` uses the first CSV row as object keys. If the CSV has wrong headers, fields silently resolve to `undefined` and you get wrong results with no error. The first-record validation in `createInputStream` catches this immediately with a clear error showing expected vs. actual fields.

### Branded bitlinks are a product feature
Bitly supports branded short domains like `es.pn` (ESPN) and `amzn.to` (Amazon). These are core product features, not edge cases. The normalization and store handle all domains uniformly.

### Multiple bitlinks per URL vs. duplicate bitlinks
Multiple bitlinks pointing to the same long URL is normal (different campaigns, different domains). Each gets a separate store entry; clicks aggregate via the long URL counter. A *duplicate* bitlink (same domain/hash mapping to different long URLs) is anomalous — the store uses last-write-wins and logs a warning.

### Complexity analysis
- **Time**: O(E + D) where E = number of encodes and D = number of decodes. Sorting the output is O(U log U) where U = unique long URLs, which is bounded by E.
- **Memory**: O(E) for the BitlinkStore + O(U) for the click counter. Decode records are streamed one at a time.

## Assumptions
- CSV files always have a header row as the first line. Headers map directly to field names used in the code (`long_url`, `domain`, `hash` for encodes; `bitlink`, `timestamp`, etc. for decodes). The parser uses these headers as object keys via `csv-parse`'s `columns: true` option.
- The provided data files are representative of the expected format. The system validates headers on the first record and will reject files with unexpected column names.
- Timestamps are always in ISO 8601 format where the first 4 characters represent the year and use a consistent format across entire dataset. Given these assumptions, year filtering is implemented using a string prefix check (`timestamp.startsWith(year)`), which avoids full timestamp parsing and provides significantly better performance for large datasets.
- A duplicate bitlink (same domain + hash mapping to different long URLs) is treated as anomalous. Multiple bitlinks pointing to the same long URL is normal (different campaigns, different domains), but a single bitlink resolving to two different long URLs suggests a data integrity issue. The system uses last-write-wins and logs a warning so the behavior is visible without crashing.

## Supported File Formats
Only `.csv` and `.json` files are supported. Files with any other extension are rejected with a clear error message. This is a deliberate scope boundary.

## Future Enhancements

- **Persistent storage backend**: For encode datasets exceeding available memory, replace the in-memory Map inside BitlinkStore with LevelDB (via the `level` npm package). The access pattern is exclusively point lookups by key, which LevelDB is purpose-built for. SQLite (via `better-sqlite3`) is a viable alternative if requirements evolve to need range queries. The streaming pipeline and business logic remain unchanged because the BitlinkStore interface abstracts the backing storage.

- **Date range filtering**: `--from 2021-01-01 --to 2021-06-30` for quarterly or monthly analysis.

- **Custom field mapping**: `--encode-fields "url:long_url,domain:domain,hash:hash"` to support CSVs/JSON with different key names without code changes.

- **Additional format support**: NDJSON (newline-delimited JSON) for large-scale streaming, Parquet for analytics pipelines. The `createInputStream` factory is designed so adding a new format is a single case addition.

- **Configurable output destination and format**: `--output ./results.json` to write to a file, `--format csv` to control output format. When no `--output` is specified, behavior stays the same: JSON to stdout.

- **Multiple decode files**: `--decodes jan.json feb.json mar.json` to process several files in one run, avoiding manual file concatenation.
