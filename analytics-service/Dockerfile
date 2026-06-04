# Build context = repo root (consistent with the Java services):
#   docker build -f analytics-service/Dockerfile .
FROM node:22-alpine AS build
WORKDIR /app
COPY analytics-service/package.json analytics-service/package-lock.json ./
RUN npm ci
COPY analytics-service/tsconfig.json ./
COPY analytics-service/src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
# the gRPC contracts ride along — analytics is a consumer of shared-api protos
COPY shared-api/src/main/proto /app/proto
ENV PROTO_DIR=/app/proto
EXPOSE 8090
USER node
CMD ["node", "dist/index.js"]
