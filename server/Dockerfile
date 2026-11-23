FROM node:22-bookworm-slim AS base

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN set -eu; \
    for attempt in 1 2 3; do \
      echo "Dependency install attempt $attempt/3"; \
      if npm ci --omit=dev --no-audit --no-fund --maxsockets=5 --fetch-retries=8 --fetch-timeout=300000 --loglevel=verbose; then \
        break; \
      else \
        status=$?; \
        if [ "$attempt" -eq 3 ]; then \
          echo "npm failed after 3 attempts; printing recent npm diagnostics"; \
          for logfile in /root/.npm/_logs/*debug-0.log; do \
            if [ -f "$logfile" ]; then tail -n 120 "$logfile"; fi; \
          done; \
          exit "$status"; \
        fi; \
        echo "npm attempt failed (exit $status); retrying with the npm cache retained"; \
        sleep 8; \
      fi; \
    done \
    && npm cache clean --force

COPY --chown=node:node src ./src

FROM base AS production

USER node
EXPOSE 5000
CMD ["node", "src/server.js"]

# The security test runner is kept in a separate image target so test code
# and its seeded test credentials are not included in the application image.
FROM base AS test

COPY --chown=node:node testSecurityAudit.js ./testSecurityAudit.js
COPY --chown=node:node test ./test
USER node
CMD ["npm", "test"]
