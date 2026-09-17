# --- build -------------------------------------------------------------------
FROM node:24-alpine AS build
WORKDIR /app

# Dependencies are installed from the lockfile alone so the layer is reused
# whenever only source files change.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- runtime -----------------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

# The API origin is not known at build time, so it is substituted into the nginx
# config when the container starts.
COPY docker/entrypoint.sh /docker-entrypoint.d/40-api-origin.sh
RUN chmod +x /docker-entrypoint.d/40-api-origin.sh

EXPOSE 80
