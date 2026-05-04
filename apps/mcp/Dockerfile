FROM node:24-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/mcp/package.json apps/mcp/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS builder
COPY apps/mcp apps/mcp
RUN pnpm --filter @ideahub/mcp build

FROM node:24-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/apps/mcp apps/mcp
CMD ["./apps/mcp/node_modules/.bin/tsx", "apps/mcp/src/index.ts"]
