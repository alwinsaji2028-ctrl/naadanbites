# Multi-stage / OpenShift hardened Node.js Containerfile
FROM node:20-alpine AS base

# Install dumb-init for proper PID 1 signal forwarding
RUN apk add --no-cache dumb-init

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=8080

# Copy package manifests first to leverage Docker layer caching
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production --ignore-scripts && npm cache clean --force

# Copy source code and static assets
COPY server.js ./
COPY public/ ./public/

# Ensure directory permissions comply with OpenShift restricted SCC (arbitrary UID, GID 0)
RUN chown -R 1001:0 /app && \
    chmod -R g=u /app

# Switch to non-root user (OpenShift best practice)
USER 1001

# Expose standard unprivileged OpenShift container port
EXPOSE 8080

# Container healthcheck for Kubernetes / OpenShift
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:8080/healthz || exit 1

# Start server using dumb-init
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "server.js"]

