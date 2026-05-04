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

## Docker Images

The project defines images for:

- `ideahub-api`
- `ideahub-web`
- `ideahub-mcp`

Build locally:

```bash
make docker-build IMAGE_NAMESPACE=local IMAGE_TAG=dev
```

## GitHub Container Registry

CI publishes images to GHCR on `main` and version tags:

- `ghcr.io/<owner>/ideahub-api`
- `ghcr.io/<owner>/ideahub-web`
- `ghcr.io/<owner>/ideahub-mcp`

## Kubernetes

The `k8s/` directory contains production-oriented templates. They are intentionally cloud-neutral and should be adapted with real domains, managed PostgreSQL, secret management, and ingress controller annotations before production use.
