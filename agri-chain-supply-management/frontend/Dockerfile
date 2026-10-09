# Multi-Stage Production Dockerfile for Agriculture Supply Chain Frontend
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . ./

# Build arguments for Vite environment variables
ARG VITE_API_URL
ARG VITE_CONTRACT_ADDRESS
ARG VITE_CHAIN_ID
ARG VITE_SEPOLIA_RPC_URL

ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_CONTRACT_ADDRESS=${VITE_CONTRACT_ADDRESS}
ENV VITE_CHAIN_ID=${VITE_CHAIN_ID}
ENV VITE_SEPOLIA_RPC_URL=${VITE_SEPOLIA_RPC_URL}

RUN npm run build

# Stage 2: High Performance NGINX Web Server
FROM nginx:alpine AS runner

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
