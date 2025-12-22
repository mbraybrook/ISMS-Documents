# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS base
RUN apk add --no-cache openssl xvfb \
    ttf-dejavu ttf-liberation font-noto font-noto-extra ttf-opensans libreoffice

WORKDIR /app
RUN npm install -g pnpm

FROM base AS deps
COPY package.json pnpm-lock.yaml* ./
RUN --mount=type=cache,id=pnpm-doc,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile || npm install

FROM deps AS build
COPY tsconfig.json ./
COPY src ./src
RUN pnpm build || npm run build

FROM node:20-alpine AS runtime
RUN apk add --no-cache curl xvfb libreoffice \
    ttf-dejavu ttf-liberation font-noto font-noto-extra ttf-opensans
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
ENV NODE_ENV=production
ENV SAL_USE_VCLPLUGIN=gen \
    OOO_FORCE_DESKTOP=gnome \
    DISPLAY=:99 \
    JAVA_HOME="" \
    SAL_DISABLE_OPENCL=1
CMD ["node", "dist/index.js"]

