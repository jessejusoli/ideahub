# API Guide

IdeaHub uses OpenAPI 3.1 as the canonical API contract. Runtime validation is handled with Zod schemas attached directly to Fastify routes.

## API Documentation

| Route               | Purpose                     |
| ------------------- | --------------------------- |
| `/api/openapi.json` | Canonical OpenAPI document. |
| `/api/docs/swagger` | Swagger UI documentation.   |
| `/api/docs/scalar`  | Scalar API reference.       |
| `/api/docs/redoc`   | Redoc API documentation.    |

## Conventions

- Public API routes are prefixed with `/api`.
- Request bodies, params, query strings, and responses must declare schemas.
- New route schemas should reuse `packages/shared` whenever a shape is shared across apps.
- Error responses should eventually follow a consistent shape: `code`, `message`, and optional `details`.
- API versioning will start pathless during the MVP and move to `/api/v1` before external public adoption.

## Authentication Direction

Authentication is not implemented yet. The planned model is session-based auth for the web app, with scoped API access by user, vault, and vault membership.

## OpenAPI Quality Gate

Run:

```bash
pnpm openapi:check
```

The command boots the Fastify app in memory and verifies that the OpenAPI document is generated with paths.
