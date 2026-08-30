FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json tsconfig.base.json ./
COPY shared ./shared
COPY services/order-service ./services/order-service
RUN npm install
RUN npm run build:shared && npm run build --workspace=@nginz/order-service

FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/shared ./shared
COPY --from=build /app/services/order-service ./services/order-service
COPY package*.json tsconfig.base.json ./
ENV NODE_ENV=production
EXPOSE 3004
CMD ["node", "services/order-service/dist/server.js"]
