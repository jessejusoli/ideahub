SHELL := /bin/bash

IMAGE_REGISTRY ?= ghcr.io
IMAGE_NAMESPACE ?= ideahub
IMAGE_TAG ?= local

.PHONY: install dev test typecheck build lint format format-check docs-generate openapi-check db-up db-migrate db-studio docker-build compose-up compose-prod-up compose-down k8s-dry-run

install:
	pnpm install

dev:
	pnpm dev

test:
	pnpm test

typecheck:
	pnpm typecheck

build:
	pnpm build

lint:
	pnpm lint

format:
	pnpm format

format-check:
	pnpm format:check

docs-generate:
	pnpm docs:generate

openapi-check:
	pnpm openapi:check

db-up:
	docker compose up -d postgres

db-migrate:
	pnpm db:migrate

db-studio:
	pnpm db:studio

docker-build:
	docker build -f apps/api/Dockerfile -t $(IMAGE_REGISTRY)/$(IMAGE_NAMESPACE)/ideahub-api:$(IMAGE_TAG) .
	docker build -f apps/web/Dockerfile -t $(IMAGE_REGISTRY)/$(IMAGE_NAMESPACE)/ideahub-web:$(IMAGE_TAG) .
	docker build -f apps/mcp/Dockerfile -t $(IMAGE_REGISTRY)/$(IMAGE_NAMESPACE)/ideahub-mcp:$(IMAGE_TAG) .

compose-up:
	docker compose up --build

compose-prod-up:
	docker compose -f docker-compose.prod.yml up --build

compose-down:
	docker compose down
	docker compose -f docker-compose.prod.yml down

k8s-dry-run:
	@if kubectl cluster-info >/dev/null 2>&1; then \
		kubectl apply --dry-run=client --validate=false -f k8s/; \
	else \
		echo "No Kubernetes cluster context is available; skipping kubectl dry run."; \
	fi
