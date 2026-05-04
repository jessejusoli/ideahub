# ADR 0001: Project Foundation

## Status

Accepted.

## Context

IdeaHub needs to be a PostgreSQL-first intelligent knowledge system with a professional foundation from the beginning. The system must support web usage, API integrations, future RAG pipelines, and AI tool access through MCP.

## Decision

- Use a TypeScript monorepo with `apps/web`, `apps/api`, `apps/mcp`, and `packages/shared`.
- Use React, Vite, Tailwind CSS, shadcn-style primitives, and Radix for the frontend.
- Use Fastify, Zod, OpenAPI 3.1, Swagger UI, Scalar, and Redoc for API delivery and documentation.
- Use PostgreSQL with pgvector as the source of truth and semantic retrieval layer.
- Use Docker, Compose, Kubernetes templates, Makefile commands, and GitHub Actions from the start.
- Keep MCP as a separate app that integrates through public API boundaries.

## Consequences

- The project has more setup upfront, but less architectural drift later.
- API documentation can stay close to route schemas.
- MCP can evolve independently without coupling to API internals.
- Kubernetes manifests are templates, not a complete cloud deployment.
