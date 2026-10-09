# Multi-Stage Production Dockerfile for Agriculture Supply Chain API Backend
FROM node:20-alpine AS dependencies

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Copy node modules and source code
COPY --from=dependencies /app/node_modules ./node_modules
COPY package*.json ./
COPY server.js ./
COPY config/ ./config/
COPY middleware/ ./middleware/
COPY models/ ./models/
COPY routes/ ./routes/
COPY data/ ./data/

# Secure execution as non-root user
RUN chown -R node:node /app
USER node

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

CMD ["node", "server.js"]
