FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json tsconfig.base.json ./
COPY shared ./shared
COPY gateway ./gateway
RUN npm install
RUN npm run build:shared && npm run build --workspace=gateway

FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/gateway/dist ./gateway/dist
COPY --from=build /app/shared ./shared
COPY --from=build /app/gateway ./gateway
COPY package*.json tsconfig.base.json ./
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "gateway/dist/server.js"]
