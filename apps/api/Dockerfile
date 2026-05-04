FROM node:24-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS builder
COPY apps/api apps/api
COPY packages/shared packages/shared
RUN pnpm --filter @ideahub/shared build && pnpm --filter @ideahub/api build

FROM node:24-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/apps/api apps/api
COPY --from=builder /app/packages/shared packages/shared
EXPOSE 3333
CMD ["./apps/api/node_modules/.bin/tsx", "apps/api/src/index.ts"]
