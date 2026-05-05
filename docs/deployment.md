# Deployment Guide

IdeaHub is designed to run locally through Docker Compose and to publish service images to GitHub Container Registry.

## Local Development

```bash
make install
make db-up
make db-migrate
make dev
```

## Production-like Compose

```bash
make compose-prod-up
```

The production-like Compose file builds the API and web images locally, runs PostgreSQL with pgvector, and exposes:

- Web: `http://localhost:8080`
- API: `http://localhost:3333`

The web image receives `VITE_API_BASE_URL` at build time because Vite bakes public environment variables into the static bundle. In production-like Compose this points to:

```bash
http://localhost:3333/api
```

The current production-like bundle includes the first Obsidian core coverage
milestones, **Editor + Links** and **Explorer + Recovery + Quick Switcher**:

- PostgreSQL-canonical Markdown notes through `/api/notes`.
- Wiki-link, backlink, tag, property, outline, word-count, and text-search APIs.
- Daily notes, templates, JSON Canvas storage, graph data, workspace storage,
  and Markdown import/export routes.
- The web workspace editor, note explorer, preview, outgoing-links panel, and
  backlinks panel.
- Logical folder/path explorer, note move/rename, recovery version restore,
  quick switcher, and command registry surfaces.

No additional runtime environment variable or database service is required for
this milestone. The implementation reuses the existing API/Web images,
PostgreSQL, pgvector, and the `entries.metadata` JSONB column. Deployments only
need freshly built images plus the normal database migration step.

## Docker Images

The project defines images for:

- `ideahub-api`
- `ideahub-web`
- `ideahub-mcp`

Build locally:

```bash
make docker-build IMAGE_NAMESPACE=local IMAGE_TAG=dev
```

Build one service at a time when working in a small development environment:

```bash
make docker-build-api IMAGE_NAMESPACE=local IMAGE_TAG=dev
make docker-build-web IMAGE_NAMESPACE=local IMAGE_TAG=dev
make docker-build-mcp IMAGE_NAMESPACE=local IMAGE_TAG=dev
```

To build the web image for a non-local API, pass the build argument directly:

```bash
docker build \
  -f apps/web/Dockerfile \
  --build-arg VITE_API_BASE_URL=https://ideahub.example.com/api \
  -t ghcr.io/<owner>/ideahub-web:latest .
```

## GitHub Container Registry

CI publishes images to GHCR on `main` and version tags:

- `ghcr.io/<owner>/ideahub-api`
- `ghcr.io/<owner>/ideahub-web`
- `ghcr.io/<owner>/ideahub-mcp`

The CI quality job also validates formatting, linting, typechecking, tests,
builds, OpenAPI generation, TypeDoc reference generation, Compose syntax, and
Kubernetes manifests before the image publishing job runs.

When the Obsidian coverage matrix changes, image publication still follows the
same path: push to `main`, let CI validate docs/API/Compose/Kubernetes, and then
publish updated API, Web, and MCP images to GHCR.

## Kubernetes

The `k8s/` directory contains production-oriented templates. They are intentionally cloud-neutral and should be adapted with real domains, managed PostgreSQL, secret management, and ingress controller annotations before production use.

The Kubernetes `ConfigMap` documents both runtime service variables and the intended public web API URL. Because the current web image is static nginx output, `VITE_API_BASE_URL` must still be provided at Docker build time for deployed web images.

The Kubernetes templates also record the active product milestone through
`IDEAHUB_FEATURE_SET` and `IDEAHUB_COVERAGE_DOC`. These are informational
deployment markers for operators and do not change runtime behavior yet.
