FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY src ./src

ENV NODE_ENV=production
ENV PORT=5002

EXPOSE 5002

CMD ["node", "src/index.js"]
