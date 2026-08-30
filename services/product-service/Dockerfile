FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json tsconfig.base.json ./
COPY shared ./shared
COPY services/product-service ./services/product-service
RUN npm install
RUN npm run build:shared && npm run build --workspace=@nginz/product-service

FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/shared ./shared
COPY --from=build /app/services/product-service ./services/product-service
COPY package*.json tsconfig.base.json ./
ENV NODE_ENV=production
EXPOSE 3003
CMD ["node", "services/product-service/dist/server.js"]
