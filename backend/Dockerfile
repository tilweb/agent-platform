FROM oven/bun:alpine AS base
WORKDIR /app

RUN apk add --no-cache ffmpeg

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY src/ src/
COPY data/ data/

RUN addgroup -g 1000 app && adduser -u 1000 -G app -s /bin/sh -D app
RUN chown -R app:app /app

USER 1000
ENV NODE_ENV=production
EXPOSE 3001

CMD ["bun", "run", "src/index.ts"]
