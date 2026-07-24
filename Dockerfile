FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM deps AS build
COPY . .
RUN npx prisma generate && npm run build

FROM base AS runner
ENV NODE_ENV=production
# PDFs live under STORAGE_DIR — on Railway/Render, point this at a mounted disk.
ENV STORAGE_DIR=/data/storage
COPY --from=build /app ./
EXPOSE 3000
# Ensure the storage dir exists, apply DB migrations, then start (Next honours $PORT).
CMD ["sh", "-c", "mkdir -p \"$STORAGE_DIR\" && npx prisma migrate deploy && npm run start"]
