FROM node:20-slim AS builder

WORKDIR /app

# Install pnpm globally (optional but faster) or use npm only
RUN corepack enable


# Build gateway
WORKDIR /app/gateway
COPY gateway/package.json ./
COPY gateway/package-lock.json ./
COPY gateway/tsconfig.json ./
COPY gateway/src ./src
RUN npm install
RUN npm run build

# Build admin console
WORKDIR /app/admin-console
COPY admin-console/package.json ./
COPY admin-console/package-lock.json ./
COPY admin-console/tsconfig*.json ./
COPY admin-console/vite.config.ts ./
COPY admin-console/index.html ./
COPY admin-console/src ./src
COPY admin-console/public ./public
RUN npm install
RUN npm run build

# ---- Runtime image ----
FROM node:20-slim

# Create the same /app layout used by AdminConsoleHandler:
# /app/gateway        -> compiled gateway
# /app/admin-console  -> admin console dist
WORKDIR /app/gateway

ENV NODE_ENV=production

# Copy gateway package metadata, install only production dependencies, and copy build output
COPY --from=builder /app/gateway/package.json ./
COPY --from=builder /app/gateway/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/gateway/dist ./dist

# Copy admin-console bundle so that ../../../admin-console/dist from /app/gateway/dist resolves correctly
COPY --from=builder /app/admin-console/dist /app/admin-console/dist

EXPOSE 4000

CMD ["node", "dist/main.js"]
