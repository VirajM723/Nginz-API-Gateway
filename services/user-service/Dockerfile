FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json tsconfig.base.json ./
COPY shared ./shared
COPY services/user-service ./services/user-service
RUN npm install
RUN npm run build:shared && npm run build --workspace=@nginz/user-service

FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/shared ./shared
COPY --from=build /app/services/user-service ./services/user-service
COPY package*.json tsconfig.base.json ./
ENV NODE_ENV=production
EXPOSE 3002
CMD ["node", "services/user-service/dist/server.js"]
