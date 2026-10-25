# Monorepo image with two targets: `web` (Next.js) and `api` (Express).
# Build one with: docker build --target web -t nera-web .

FROM node:20-alpine AS deps
RUN npm i -g pnpm@10.29.3
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile

FROM deps AS web
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @nera/web build
ENV NODE_ENV=production
EXPOSE 3000
CMD ["pnpm", "--filter", "@nera/web", "start"]

# The API imports workspace packages as TypeScript source, so it runs through tsx.
FROM deps AS api
ENV NODE_ENV=production
WORKDIR /app/apps/api
EXPOSE 4000
CMD ["pnpm", "exec", "tsx", "src/server.ts"]
