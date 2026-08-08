# syntax=docker/dockerfile:1
# Build context = repo root (consistent with the Java services):
#   docker build -f analytics-service/Dockerfile .
FROM node:22-alpine AS build
WORKDIR /app
COPY analytics-service/package.json analytics-service/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY analytics-service/tsconfig.json ./
COPY analytics-service/src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
# The runtime runs `node dist/index.js` and never invokes npm/npx, so drop the
# base image's bundled global npm. It removes its vendored `tar` (CVE-2026-59873,
# node-tar gzip-bomb DoS) from the runtime image and shrinks the attack surface.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
# the gRPC contracts ride along — analytics is a consumer of shared-api protos
COPY shared-api/src/main/proto /app/proto
ENV PROTO_DIR=/app/proto
EXPOSE 8090
USER node
CMD ["node", "dist/index.js"]
