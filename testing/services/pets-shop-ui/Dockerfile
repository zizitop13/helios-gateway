FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html ./
COPY tsconfig*.json ./
COPY vite.config.ts ./
COPY src ./src

RUN npm run build

FROM nginx:1.27-alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY docker-entrypoint.d/40-write-runtime-config.sh /docker-entrypoint.d/40-write-runtime-config.sh

RUN chmod +x /docker-entrypoint.d/40-write-runtime-config.sh

ENV PORT=8080

EXPOSE 8080
