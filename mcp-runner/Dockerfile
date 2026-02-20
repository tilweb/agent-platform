FROM oven/bun:alpine AS base
WORKDIR /app

# Node.js + npm needed for npx (MCP servers are npm packages)
RUN apk add --no-cache nodejs npm

# Install dependencies
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production || bun install --production

# Copy source
COPY src/ src/

# Non-root user with writable home (npm cache)
RUN addgroup -g 1000 app && adduser -u 1000 -G app -s /bin/sh -D app
RUN chown -R app:app /app /home/app
USER 1000

EXPOSE 3002
CMD ["bun", "run", "src/index.ts"]
