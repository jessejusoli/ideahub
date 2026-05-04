FROM node:24-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS builder
ARG VITE_API_BASE_URL=http://localhost:3333/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
COPY apps/web apps/web
COPY packages/shared packages/shared
RUN pnpm --filter @ideahub/shared build && pnpm --filter @ideahub/web build

FROM nginx:1.27-alpine AS runner
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
