# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS base
WORKDIR /app
RUN npm install -g pnpm

FROM base AS deps
COPY package.json pnpm-lock.yaml* ./
RUN --mount=type=cache,id=pnpm-ai,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile || npm install

FROM deps AS build
COPY tsconfig.json ./
COPY src ./src
RUN pnpm build || npm run build

FROM node:20-alpine AS runtime
RUN apk add --no-cache curl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]

