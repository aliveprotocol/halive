# HAlive base image
FROM node:18-slim AS halive
WORKDIR /app
COPY package*.json ./
RUN npm install
RUN npm run compile
COPY . .

# HAlive sync
FROM node:18-slim AS halive_sync
WORKDIR /app
COPY --from=halive /app ./
CMD ["npm", "start"]

# HAlive server
FROM node:18-slim AS halive_server
WORKDIR /app
COPY --from=halive /app ./
ENV HALIVE_HTTP_PORT=3010
EXPOSE ${HALIVE_HTTP_PORT}
CMD ["npm", "run", "server"]