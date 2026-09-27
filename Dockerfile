# Stage 1: test and build the static app
FROM node:22-bookworm-slim AS builder

# Pinned: an unpinned pnpm silently follows major releases
RUN npm install -g pnpm@11.24.0

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
# A failing test stops the release before an image exists
RUN pnpm test --run && pnpm build

# Stage 2: serve it with nginx
FROM nginx:stable-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
