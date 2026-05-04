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

## Docker Images

The project defines images for:

- `ideahub-api`
- `ideahub-web`
- `ideahub-mcp`

Build locally:

```bash
make docker-build IMAGE_NAMESPACE=local IMAGE_TAG=dev
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

## Kubernetes

The `k8s/` directory contains production-oriented templates. They are intentionally cloud-neutral and should be adapted with real domains, managed PostgreSQL, secret management, and ingress controller annotations before production use.

The Kubernetes `ConfigMap` documents both runtime service variables and the intended public web API URL. Because the current web image is static nginx output, `VITE_API_BASE_URL` must still be provided at Docker build time for deployed web images.
