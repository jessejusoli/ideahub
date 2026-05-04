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

| Resource | Routes                                                                                                       | Status                                      |
| -------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| Health   | `GET /api/health`                                                                                            | Implemented                                 |
| Vaults   | `GET /api/vaults`, `POST /api/vaults`                                                                        | Implemented with development user ownership |
| Projects | `GET /api/projects`, `POST /api/projects`                                                                    | Implemented with vault scoping              |
| Entries  | `POST /api/entries`, `GET /api/entries/:id`, `POST /api/entries/:id/analyze`, `POST /api/entries/:id/review` | Text capture and read implemented           |
| Audio    | `POST /api/entries/audio`                                                                                    | Contract only, returns `501`                |
| Search   | `GET /api/search/semantic`                                                                                   | Contract only, returns empty results        |
| Graph    | `GET /api/graph`                                                                                             | Contract only, returns empty graph          |

## Capture Contract

Creating an entry now performs the first real product workflow:

1. Validate `vaultId`, optional `projectId`, title, content, and source.
2. Insert the entry with `pending_analysis` status.
3. Insert `entry_versions` version `1` using the captured content.
4. Insert an `llm_jobs` row with `type = analysis` and `status = queued`.
5. Return the entry and queued job to the client.

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
