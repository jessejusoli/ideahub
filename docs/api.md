# API Guide

IdeaHub uses OpenAPI 3.1 as the canonical API contract. Runtime validation is handled with Zod schemas attached directly to Fastify routes.

## API Documentation

| Route               | Purpose                     |
| ------------------- | --------------------------- |
| `/api/openapi.json` | Canonical OpenAPI document. |
| `/api/docs/swagger` | Swagger UI documentation.   |
| `/api/docs/scalar`  | Scalar API reference.       |
| `/api/docs/redoc`   | Redoc API documentation.    |

## Current MVP Resources

| Resource       | Routes                                                                                                                                                                                                                                                  | Status                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Health         | `GET /api/health`                                                                                                                                                                                                                                       | Implemented                                                         |
| Vaults         | `GET /api/vaults`, `POST /api/vaults`                                                                                                                                                                                                                   | Implemented with development user ownership                         |
| Projects       | `GET /api/projects`, `POST /api/projects`                                                                                                                                                                                                               | Implemented with vault scoping                                      |
| Entries        | `POST /api/entries`, `GET /api/entries/:id`, `POST /api/entries/:id/analyze`, `POST /api/entries/:id/review`                                                                                                                                            | Capture, retrieval, queueing, and review flow                       |
| Notes          | `GET/POST /api/notes`, `GET/PATCH/DELETE /api/notes/:id`, `GET /api/notes/:id/backlinks`, `GET /api/notes/:id/outgoing-links`, `GET /api/notes/:id/footnotes`, `GET /api/notes/:id/versions`, `POST /api/notes/:id/restore`, `POST /api/notes/:id/move` | PostgreSQL-canonical Markdown notes, recovery, and logical movement |
| Navigation     | `GET /api/explorer`, `GET /api/quick-switcher`, `GET /api/commands`                                                                                                                                                                                     | Logical explorer, fuzzy note opening, and command registry          |
| Bookmarks      | `GET/POST/PATCH/DELETE /api/bookmarks`                                                                                                                                                                                                                  | PostgreSQL-native bookmarks                                         |
| Note Utilities | `POST /api/notes/random`, `POST /api/notes/unique`, `POST /api/notes/compose`                                                                                                                                                                           | Random, unique, and composed notes                                  |
| Jobs           | `POST /api/jobs/process-next`, `POST /api/jobs/:id/process`                                                                                                                                                                                             | Deterministic local analysis processing                             |
| Audio          | `POST /api/entries/audio`                                                                                                                                                                                                                               | Browser audio/transcript capture queued for transcription/analysis  |
| Search         | `GET /api/search`, `GET /api/search/semantic`                                                                                                                                                                                                           | Text search and pgvector-backed semantic search                     |
| Tags           | `GET /api/tags`                                                                                                                                                                                                                                         | Tag view with note counts                                           |
| Bases          | `GET /api/bases`                                                                                                                                                                                                                                        | Property-driven note table over canonical PostgreSQL notes          |
| Templates      | `GET/POST /api/templates`                                                                                                                                                                                                                               | Markdown templates                                                  |
| Daily Notes    | `POST /api/daily-notes/open`                                                                                                                                                                                                                            | Open or create date-based notes                                     |
| Canvas         | `GET/POST /api/canvas`                                                                                                                                                                                                                                  | JSON Canvas storage                                                 |
| Graph          | `GET /api/graph`                                                                                                                                                                                                                                        | Graph nodes and edges from canonical links                          |
| Workspaces     | `GET/POST /api/workspaces`                                                                                                                                                                                                                              | Saved layout documents                                              |
| Import/Export  | `POST /api/import/markdown`, `GET /api/export/markdown`                                                                                                                                                                                                 | Markdown interoperability                                           |
| Converter      | `POST /api/format-converter`                                                                                                                                                                                                                            | Normalize imported Markdown variants                                |
| Preview        | `GET /api/page-preview`                                                                                                                                                                                                                                 | Resolve hover/page previews from PostgreSQL notes                   |
| Slash Commands | `GET /api/slash-commands`, `POST /api/slash-commands/execute`                                                                                                                                                                                           | Editor insertions for links, headings, footnotes, callouts, tasks   |
| Slides         | `GET /api/slides/:id`                                                                                                                                                                                                                                   | Markdown note presentation slices                                   |
| Publish        | `GET/POST/PATCH /api/publish`                                                                                                                                                                                                                           | Server-centric public knowledge base selection                      |
| Sync           | `GET/POST /api/sync`                                                                                                                                                                                                                                    | Server-centric sync state and checkpoints                           |
| Web Viewer     | `GET /api/web-viewer`, `POST /api/web-viewer/open`                                                                                                                                                                                                      | External URL workspace references                                   |

## Capture Contract

Creating an entry now performs the first real product workflow:

1. Validate `vaultId`, optional `projectId`, title, content, and source.
2. Insert the entry with `pending_analysis` status.
3. Insert `entry_versions` version `1` using the captured content.
4. Insert an `llm_jobs` row with `type = analysis` and `status = queued`.
5. Return the entry and queued job to the client.

## Analysis Contract

The MVP includes a deterministic local analysis pipeline so the product workflow can be validated before external LLM credentials exist.

1. `POST /api/jobs/process-next` selects the oldest queued analysis job.
2. The API chunks the entry content and writes 1536-dimensional local embeddings to PostgreSQL.
3. The API retrieves semantically related chunks from the same vault through pgvector.
4. The API creates a pending `analysis_suggestions` record with summary, layer, tags, candidate links, confidence, rationale, and retrieved context.
5. The entry status becomes `review`.
6. `POST /api/entries/:id/review` approves or rejects the suggestion.
7. Approval consolidates summary, layer, AI tags, and candidate links into canonical tables.

The local analyzer is a scaffold for future LLM-backed RAG. It must not be treated as production-grade intelligence.

## Semantic Search

`GET /api/search/semantic?q=...&vaultId=...` embeds the query with the same local deterministic embedding model and ranks matching chunks with pgvector cosine distance. This keeps the public API stable while the embedding provider is still replaceable.

## Markdown Notes

`entries` now also act as PostgreSQL-canonical Markdown notes through the
`/api/notes` surface. Note metadata stores logical path, folder, aliases,
properties, extracted headings, word count, and character count. Saving a note
creates a new `entry_versions` snapshot for recovery.

The Markdown note flow parses:

- `[[wiki links]]` for outgoing links and backlinks.
- `[^footnotes]` and footnote definitions for the footnotes view.
- `#tags` for canonical tag rows.
- frontmatter-style properties for the properties view.
- Markdown headings for outline data.

This keeps Obsidian-style editing compatible with the existing RAG, semantic
search, tags, links, and review pipeline.

## Explorer, Recovery, and Quick Switcher

The file explorer is logical and PostgreSQL-backed. Note paths/folders are stored
in metadata and can be moved with `POST /api/notes/:id/move`; files are not the
source of truth.

Recovery uses `entry_versions`:

1. `GET /api/notes/:id/versions` lists snapshots.
2. `GET /api/notes/:id/versions/:version/diff` compares a snapshot with current content.
3. `POST /api/notes/:id/restore` restores content and creates a new recovery snapshot.

`GET /api/quick-switcher` ranks notes by title, path, alias, tags, and content.
`GET /api/commands` exposes the initial command registry used by the future
command palette.

## Command Palette, Bookmarks, and Note Utilities

The command registry is exposed through `GET /api/commands` and the web workspace
can execute the first set of command actions: create note, open daily note, open
random note, create unique note, bookmark current note, and compose a note.

Bookmarks are native PostgreSQL records stored as `entries` with bookmark
metadata. They can point to notes, searches, headings, canvas, graph, external
URLs, or future workspace targets.

Note utilities:

1. `POST /api/notes/random` returns a random note from the active vault.
2. `POST /api/notes/unique` creates a timestamp-based note in a logical folder.
3. `POST /api/notes/compose` creates a merged note from selected source notes.

## Core Obsidian Completion

The remaining core plugin surfaces now have MVP contracts that keep PostgreSQL as
the native system of record:

1. `POST /api/entries/audio` captures browser audio metadata and optional
   transcript as a `voice` entry, then queues transcription or analysis.
2. `GET /api/bases` returns a property/table view derived from note metadata,
   tags, folders, and word counts.
3. `POST /api/format-converter` normalizes Markdown from generic, Notion, Roam,
   or Google Docs style input.
4. `GET /api/page-preview` resolves note previews by note ID, title, alias, or
   path.
5. `GET/POST /api/slash-commands` exposes editor insertion commands.
6. `GET /api/slides/:id` converts Markdown sections into presentation slides.
7. `GET/POST/PATCH /api/publish` stores publish selections in PostgreSQL and
   returns public notes plus graph data.
8. `GET/POST /api/sync` treats the server as truth and records client sync
   checkpoints.
9. `GET/POST /api/web-viewer` saves external URL references for workspace use.

## Job Runner

For local development, one queued analysis job can also be processed from the CLI:

```bash
pnpm analysis:run-once
```

or:

```bash
make analysis-run-once
```

## Conventions

- Public API routes are prefixed with `/api`.
- Request bodies, params, query strings, and responses must declare schemas.
- New route schemas should reuse `packages/shared` whenever a shape is shared across apps.
- Error responses should eventually follow a consistent shape: `code`, `message`, and optional `details`.
- API versioning will start pathless during the MVP and move to `/api/v1` before external public adoption.

## Authentication Direction

Authentication is not implemented yet. During MVP development, the API uses a deterministic development user, `dev@ideahub.local`, when creating and listing vaults. The planned model is session-based auth for the web app, with scoped API access by user, vault, and vault membership.

## OpenAPI Quality Gate

Run:

```bash
pnpm openapi:check
```

The command boots the Fastify app in memory and verifies that the OpenAPI document is generated with paths.
