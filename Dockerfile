# Stage 1: build the frontend with the locked toolchain.
FROM oven/bun:1.4.5-alpine AS builder
WORKDIR /app
COPY package.json bun.lock biome.json ./
RUN bun install --frozen-lockfile --ignore-scripts
COPY frontend ./frontend
COPY backend ./backend
RUN bun run build

# Stage 2: production runtime — no devDependencies, no frontend sources.
FROM oven/bun:1.4.5-alpine
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=5099 \
    EZNOTIFY_DB=/data/eznotify.sqlite \
    TZ=Asia/Kuala_Lumpur
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --production --frozen-lockfile --ignore-scripts \
 && mkdir -p /data && chown bun:bun /data
COPY backend ./backend
COPY --from=builder /app/frontend/dist ./frontend/dist
USER bun
VOLUME ["/data"]
EXPOSE 5099
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:5099/healthz || exit 1
CMD ["bun", "backend/server.js"]
