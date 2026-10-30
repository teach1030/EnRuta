# =============================================================================
# EnRuta Architectural Simulator — Frontend Dockerfile (Multi-Stage Production)
# =============================================================================

# --- Etapa 1: Compilación estática de la SPA React/TypeScript con Vite ---
FROM node:20-alpine AS builder

WORKDIR /build

COPY package*.json ./
RUN npm install

COPY . .

ARG VITE_PUBLIC_URL=https://teach1030.github.io/EnRuta/
ENV VITE_PUBLIC_URL=${VITE_PUBLIC_URL}

RUN VITE_BASE_PATH=/ npm run build


# --- Etapa 2: Servidor Nginx 1.27 Alpine con Reverse Proxy hacia FastAPI ---
FROM nginx:1.27-alpine AS production

LABEL org.opencontainers.image.title="enruta-simulator-frontend" \
      org.opencontainers.image.description="Nginx 1.27 Reverse Proxy + React SPA for EnRuta Architectural Simulator"

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /build/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
