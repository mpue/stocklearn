FROM node:20-alpine

# pnpm installieren
RUN npm install -g pnpm

WORKDIR /app

# Dependencies installieren
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install

# App-Code kopieren
COPY . .

EXPOSE 5173

CMD ["pnpm", "dev", "--host", "0.0.0.0"]
