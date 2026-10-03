FROM node:20-alpine AS deps

WORKDIR /app

RUN apk add --no-cache openssl

COPY package.json package-lock.json ./
COPY prisma ./prisma

RUN npm ci --ignore-scripts \
    && npx prisma generate

FROM node:20-alpine AS production-deps

WORKDIR /app

RUN apk add --no-cache openssl

COPY package.json package-lock.json ./
COPY prisma ./prisma

RUN npm ci --omit=dev --ignore-scripts \
    && npx prisma generate

FROM node:20-alpine AS build

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

RUN apk add --no-cache openssl \
    && addgroup --system --gid 1001 nestjs \
    && adduser --system --uid 1001 --ingroup nestjs nestjs

COPY --from=build --chown=nestjs:nestjs /app/dist ./dist
COPY --from=production-deps --chown=nestjs:nestjs /app/node_modules ./node_modules
COPY --from=build --chown=nestjs:nestjs /app/package.json ./package.json
COPY --from=build --chown=nestjs:nestjs /app/prisma ./prisma
COPY --chown=nestjs:nestjs docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER nestjs

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3001/api/v1/health || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
