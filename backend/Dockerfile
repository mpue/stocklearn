FROM node:20-slim

# Stockfish, build tools und Dependencies installieren
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    stockfish \
    curl \
    python3 \
    make \
    g++ \
    && apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# pnpm installieren
RUN npm install -g pnpm

WORKDIR /app

# Dependencies installieren
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install

# App-Code kopieren
COPY . .

# Prisma generieren
RUN pnpm prisma generate

EXPOSE 3001

CMD ["pnpm", "dev"]
