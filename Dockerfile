FROM node:lts-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Placeholders inlinés par Vite, remplacés au runtime par docker-entrypoint.d/40-runtime-env.sh.
ENV VITE_OM_WORKER_URL=__OM_WORKER_URL__
ENV VITE_CUMUL_ENABLED=__CUMUL_ENABLED__
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/build /usr/share/nginx/html
COPY docker-entrypoint.d/40-runtime-env.sh /docker-entrypoint.d/40-runtime-env.sh
RUN chmod +x /docker-entrypoint.d/40-runtime-env.sh
EXPOSE 80
