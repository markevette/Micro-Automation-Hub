# ---- build stage ----
FROM node:20-alpine AS build

WORKDIR /app

# Copy the manifest and lockfile first so this layer is cached until
# dependencies actually change. npm ci installs the exact locked versions.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG REACT_APP_API_URL=http://localhost:8000
ENV REACT_APP_API_URL=$REACT_APP_API_URL
RUN npm run build

# ---- runtime stage ----
FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
