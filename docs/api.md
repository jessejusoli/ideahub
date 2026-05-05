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

| Resource      | Routes                                                                                                                        | Status                                          |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Health        | `GET /api/health`                                                                                                             | Implemented                                     |
| Vaults        | `GET /api/vaults`, `POST /api/vaults`                                                                                         | Implemented with development user ownership     |
| Projects      | `GET /api/projects`, `POST /api/projects`                                                                                     | Implemented with vault scoping                  |
| Entries       | `POST /api/entries`, `GET /api/entries/:id`, `POST /api/entries/:id/analyze`, `POST /api/entries/:id/review`                  | Capture, retrieval, queueing, and review flow   |
| Notes         | `GET/POST /api/notes`, `GET/PATCH/DELETE /api/notes/:id`, `GET /api/notes/:id/backlinks`, `GET /api/notes/:id/outgoing-links` | PostgreSQL-canonical Markdown notes             |
| Jobs          | `POST /api/jobs/process-next`, `POST /api/jobs/:id/process`                                                                   | Deterministic local analysis processing         |
| Audio         | `POST /api/entries/audio`                                                                                                     | Contract only, returns `501`                    |
| Search        | `GET /api/search`, `GET /api/search/semantic`                                                                                 | Text search and pgvector-backed semantic search |
| Tags          | `GET /api/tags`                                                                                                               | Tag view with note counts                       |
| Templates     | `GET/POST /api/templates`                                                                                                     | Markdown templates                              |
| Daily Notes   | `POST /api/daily-notes/open`                                                                                                  | Open or create date-based notes                 |
| Canvas        | `GET/POST /api/canvas`                                                                                                        | JSON Canvas storage                             |
| Graph         | `GET /api/graph`                                                                                                              | Graph nodes and edges from canonical links      |
| Workspaces    | `GET/POST /api/workspaces`                                                                                                    | Saved layout documents                          |
| Import/Export | `POST /api/import/markdown`, `GET /api/export/markdown`                                                                       | Markdown interoperability                       |

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
- `#tags` for canonical tag rows.
- frontmatter-style properties for the properties view.
- Markdown headings for outline data.

This keeps Obsidian-style editing compatible with the existing RAG, semantic
search, tags, links, and review pipeline.

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
