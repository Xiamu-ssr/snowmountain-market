FROM node:24-alpine AS build
RUN corepack enable && corepack prepare pnpm@10.12.1 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml tsconfig.json vite.config.ts index.html ./
COPY scripts ./scripts
COPY catalog ./catalog
COPY artifacts ./artifacts
COPY src ./src
ARG PUBLIC_BASE_URL=http://127.0.0.1:4320
ENV PUBLIC_BASE_URL=$PUBLIC_BASE_URL
RUN pnpm install --frozen-lockfile && pnpm build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
