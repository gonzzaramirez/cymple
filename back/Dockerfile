FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3080

COPY package*.json ./
# 1. Instalamos SOLO dependencias de producción para una imagen súper liviana
RUN npm ci --omit=dev

# 2. Copiamos los esquemas de Prisma
COPY prisma ./prisma/

# 3. Generamos el cliente de Prisma en esta etapa final
RUN npx prisma generate

# 4. Copiamos el código transpilado
COPY --from=builder /app/dist ./dist

EXPOSE 3080
CMD ["node", "dist/src/main.js"]