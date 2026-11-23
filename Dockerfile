FROM node:22.22.3-bookworm-slim AS build
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates g++ make python3 \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN install -d -o node -g node /app/data \
    && DEVLOG_DOCKER_BUILD=1 AI_MODE=demo NEXT_TELEMETRY_DISABLED=1 npm run build

FROM node:22.22.3-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/src/server/db/migrations ./src/server/db/migrations
RUN install -d -o node -g node /app/data

USER node
EXPOSE 3000
CMD ["node", "server.js"]
