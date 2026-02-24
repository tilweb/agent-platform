FROM oven/bun:alpine AS base
WORKDIR /app

# Node.js + npm needed for MCP server packages
# su-exec is used to run MCP child processes as a separate sandboxed user
RUN apk add --no-cache nodejs npm su-exec

# Install dependencies
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production || bun install --production

# Copy source
COPY src/ src/

# Sandbox user for MCP server processes (UID 1001)
# Runner (UID 1000) owns /mcp-packages read-write; mcp user gets read-only access
RUN addgroup -g 1001 mcp && adduser -u 1001 -G mcp -s /bin/sh -D mcp
RUN mkdir -p /mcp-packages && chown -R 1000:1000 /app /mcp-packages
RUN chmod -R o+rX /mcp-packages

# Make su-exec SUID root so the runner (UID 1000) can spawn MCP processes as mcp (UID 1001)
RUN chmod u+s /sbin/su-exec

# Run as non-root (oven/bun:alpine already provides UID 1000 = bun)
USER 1000

EXPOSE 3002
CMD ["bun", "run", "src/index.ts"]
