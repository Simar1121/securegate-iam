FROM node:22-alpine AS base

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund     && npm cache clean --force

COPY --chown=node:node src ./src

FROM base AS production

USER node
EXPOSE 5000
CMD ["node", "src/server.js"]

# The security test runner is kept in a separate image target so test code
# and its seeded test credentials are not included in the application image.
FROM base AS test

COPY --chown=node:node testSecurityAudit.js ./testSecurityAudit.js
USER node
CMD ["npm", "test"]
