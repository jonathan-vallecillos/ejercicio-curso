FROM cgr.dev/chainguard/node:latest-dev AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM cgr.dev/chainguard/node:latest
WORKDIR /app
ARG APP_VERSION=1.0.0
ARG GIT_SHA=local
ARG BUILD_DATE=unknown
ENV NODE_ENV=production
ENV APP_VERSION=$APP_VERSION
ENV GIT_SHA=$GIT_SHA
ENV BUILD_DATE=$BUILD_DATE
COPY --from=deps /app/node_modules ./node_modules
COPY server.js ./
EXPOSE 3000
USER nonroot
CMD ["server.js"]
