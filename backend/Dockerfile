FROM oven/bun:alpine AS base
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY src/ src/

ENV NODE_ENV=production
EXPOSE 3001

CMD ["bun", "run", "src/index.ts"]
