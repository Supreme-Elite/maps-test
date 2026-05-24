FROM node:lts-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/build /usr/share/nginx/html
COPY docker-entrypoint.d/40-runtime-env.sh /docker-entrypoint.d/40-runtime-env.sh
COPY docker-nginx.conf /etc/nginx/conf.d/default.conf
RUN chmod +x /docker-entrypoint.d/40-runtime-env.sh
EXPOSE 80
