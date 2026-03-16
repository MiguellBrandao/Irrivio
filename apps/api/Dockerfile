FROM node:22-alpine AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable && corepack prepare pnpm@10.0.0 --activate

WORKDIR /workspace

FROM base AS prod-deps

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml turbo.json ./
COPY apps/api/package.json apps/api/package.json

RUN pnpm install --filter api... --prod --frozen-lockfile

FROM base AS build-deps

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml turbo.json ./
COPY apps/api/package.json apps/api/package.json

RUN pnpm install --filter api... --frozen-lockfile

FROM build-deps AS build

COPY apps/api ./apps/api

RUN pnpm --filter api build

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=prod-deps /workspace/node_modules ./node_modules
COPY --from=prod-deps /workspace/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /workspace/apps/api/dist ./apps/api/dist
COPY --from=build /workspace/apps/api/package.json ./apps/api/package.json
COPY --from=build /workspace/apps/api/drizzle ./apps/api/drizzle
COPY --from=build /workspace/apps/api/drizzle.config.ts ./apps/api/drizzle.config.ts

EXPOSE 3000

WORKDIR /app/apps/api

CMD ["node", "dist/main"]
