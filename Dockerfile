# Frontend Dockerfile (Vite dev server)
FROM node:18-slim

RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . ./

RUN chmod +x /app/dev-serve.sh

ENV DEV_PORT=5174
EXPOSE 5174
CMD ["./dev-serve.sh"]
