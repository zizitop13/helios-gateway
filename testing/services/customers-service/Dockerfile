FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY src ./src

ENV NODE_ENV=production
ENV PORT=5003

EXPOSE 5003

CMD ["node", "src/index.js"]
