FROM node:22-bookworm-slim AS build

WORKDIR /app
COPY package*.json ./
RUN set -eu; \
    for attempt in 1 2 3; do \
      echo "Dependency install attempt $attempt/3"; \
      if npm ci --no-audit --no-fund --maxsockets=5 --fetch-retries=8 --fetch-timeout=300000 --loglevel=verbose; then \
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
    done

COPY . .
ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

FROM nginx:alpine AS production

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/healthz || exit 1
