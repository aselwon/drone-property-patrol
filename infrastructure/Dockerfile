FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY tsconfig.base.json ./
COPY packages/ packages/
COPY services/ services/
COPY apps/ apps/

RUN npm install
RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app

COPY --from=builder /app /app

EXPOSE 3001

CMD ["npm", "start"]
