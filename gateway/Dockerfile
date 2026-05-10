FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./
COPY packages/events/package.json packages/events/package.json
COPY gateway/package.json gateway/package.json
RUN npm install
COPY packages/events packages/events
COPY gateway gateway
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/package-lock.json* ./
COPY --from=build /app/packages/events/package.json packages/events/package.json
COPY --from=build /app/gateway/package.json gateway/package.json
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/packages/events/dist packages/events/dist
COPY --from=build /app/gateway/dist gateway/dist
EXPOSE 4000
CMD ["node", "gateway/dist/index.js"]
