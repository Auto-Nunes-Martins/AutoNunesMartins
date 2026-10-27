# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS builder
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app
COPY package.json yarn.lock .yarnrc.yml ./
COPY apps/crm/package.json ./apps/crm/
COPY apps/website/package.json ./apps/website/
COPY backend/package.json ./backend/
COPY shared/types/package.json ./shared/types/
ENV HUSKY=0
RUN yarn install --immutable
COPY apps ./apps
COPY backend ./backend
COPY shared ./shared
COPY scripts/build-service.mjs ./scripts/build-service.mjs
COPY deployment ./deployment
# Only this public key and paths are build arguments. Never pass private credentials.
ARG PUBLIC_CLERK_PUBLISHABLE_KEY
ARG CRM_BASE_PATH=/crm
ARG PUBLIC_WEBSITE_URL=
ENV PUBLIC_CLERK_PUBLISHABLE_KEY=$PUBLIC_CLERK_PUBLISHABLE_KEY
ENV CRM_BASE_PATH=$CRM_BASE_PATH
ENV PUBLIC_WEBSITE_URL=$PUBLIC_WEBSITE_URL
RUN yarn build:service && mkdir -p apps/crm/node_modules apps/website/node_modules backend/node_modules
# Fail the Linux image build if the native Sharp runtime cannot load/process an image.
RUN node --input-type=module -e "import sharp from 'sharp'; await sharp({create:{width:2,height:2,channels:3,background:'white'}}).webp().toBuffer()"

FROM node:22-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates tini && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production PORT=10000
WORKDIR /app
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/apps/crm/package.json ./apps/crm/package.json
COPY --from=builder --chown=node:node /app/apps/crm/build ./apps/crm/build
COPY --from=builder --chown=node:node /app/apps/website/package.json ./apps/website/package.json
COPY --from=builder --chown=node:node /app/apps/website/build ./apps/website/build
COPY --from=builder --chown=node:node /app/backend/package.json ./backend/package.json
COPY --from=builder --chown=node:node /app/backend/dist ./backend/dist
# The installed Prisma CLI/engines are retained in node_modules; migrations run only at startup.
COPY --from=builder --chown=node:node /app/backend/prisma/schema.prisma ./backend/prisma/schema.prisma
COPY --from=builder --chown=node:node /app/backend/prisma/migrations ./backend/prisma/migrations
COPY --from=builder --chown=node:node /app/backend/node_modules ./backend/node_modules
COPY --from=builder --chown=node:node /app/apps/crm/node_modules ./apps/crm/node_modules
COPY --from=builder --chown=node:node /app/apps/website/node_modules ./apps/website/node_modules
COPY --from=builder --chown=node:node /app/shared ./shared
COPY --from=builder --chown=node:node /app/deployment ./deployment
USER node
EXPOSE 10000
HEALTHCHECK --interval=30s --timeout=3s --start-period=45s CMD ["node", "deployment/healthcheck.mjs"]
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "deployment/container-start.mjs"]
