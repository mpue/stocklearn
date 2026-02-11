# Deployment Guide für chess.cflux.org mit Caddy

## Voraussetzungen
- Domain chess.cflux.org zeigt auf den Server
- Ports 80 und 443 sind offen
- Docker und Docker Compose sind installiert
- Caddy ist installiert

## 1. Umgebungsvariablen konfigurieren

Die `.env` Datei ist bereits konfiguriert mit:
```bash
FRONTEND_URL=https://chess.cflux.org
VITE_API_URL=https://chess.cflux.org
VITE_ALLOWED_HOSTS=chess.cflux.org
```

## 2. Docker Container starten

```bash
cd /pfad/zu/stocklearn
docker-compose up -d
```

Prüfe ob alle Container laufen:
```bash
docker-compose ps
```

Services sollten laufen auf:
- Backend: localhost:3004
- Frontend: localhost:3005
- Database: localhost:5433

## 3. Caddy konfigurieren

### Option A: Systemweites Caddy

Kopiere die Konfiguration:
```bash
sudo cp Caddyfile.example /etc/caddy/Caddyfile
```

Teste die Konfiguration:
```bash
sudo caddy validate --config /etc/caddy/Caddyfile
```

Starte Caddy neu:
```bash
sudo systemctl reload caddy
# oder
sudo systemctl restart caddy
```

### Option B: Caddy im aktuellen Verzeichnis

```bash
cp Caddyfile.example Caddyfile
caddy run
```

## 4. HTTPS Zertifikate

Caddy holt automatisch Let's Encrypt Zertifikate!
Keine manuelle Konfiguration nötig.

Beim ersten Start:
- Caddy kontaktiert Let's Encrypt
- Erstellt automatisch HTTPS Zertifikate
- Erneuert Zertifikate automatisch

## 5. Firewall konfigurieren

Stelle sicher, dass Ports offen sind:
```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

## 6. Testen

WebSocket-Verbindung:
```bash
curl -i -N -H "Connection: Upgrade" \
     -H "Upgrade: websocket" \
     -H "Sec-WebSocket-Version: 13" \
     -H "Sec-WebSocket-Key: test" \
     https://chess.cflux.org/socket.io/
```

API-Endpoint:
```bash
curl https://chess.cflux.org/health
```

## 7. Logs prüfen

Caddy Logs:
```bash
sudo journalctl -u caddy -f
# oder bei Option B:
caddy logs
```

Docker Logs:
```bash
docker-compose logs -f backend
docker-compose logs -f frontend
```

## Troubleshooting

### WebSocket Fehler
- Prüfe ob Backend auf Port 3004 läuft: `curl http://localhost:3004/health`
- Prüfe Caddy Logs: `sudo journalctl -u caddy -f`
- Prüfe CORS Settings in Backend

### 502 Bad Gateway
- Container nicht gestartet: `docker-compose ps`
- Backend noch nicht ready: `docker-compose logs backend`
- Warte ~10 Sekunden nach Container-Start

### SSL Zertifikat Fehler
- Domain DNS nicht korrekt: `dig chess.cflux.org`
- Ports 80/443 nicht offen: `sudo ufw status`
- Email in Caddyfile setzen (optional)

## Production Optimierung

### 1. Backend .env erstellen
```bash
cp backend/.env.example backend/.env
```

Setze in `backend/.env`:
```env
DATABASE_URL="postgresql://stocklearn:SICHERES_PASSWORT@postgres:5432/stocklearn"
PORT=3004
NODE_ENV=production
FRONTEND_URL=https://chess.cflux.org
JWT_SECRET=DEIN_SICHERER_JWT_SECRET_HIER
```

### 2. Frontend für Production builden (optional)

Für bessere Performance kannst du das Frontend static builden:

Füge zu docker-compose.yml hinzu:
```yaml
  frontend-prod:
    build:
      context: ./frontend
      dockerfile: Dockerfile.prod
    # ... Konfiguration
```

Erstelle `frontend/Dockerfile.prod`:
```dockerfile
FROM node:20-alpine AS builder
RUN npm install -g pnpm
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install
COPY . .
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### 3. Database Backup einrichten
```bash
# Backup Script
docker exec stocklearn-db pg_dump -U stocklearn stocklearn > backup_$(date +%Y%m%d).sql

# Restore
docker exec -i stocklearn-db psql -U stocklearn stocklearn < backup.sql
```

### 4. Monitoring

Logs rotieren lassen und überwachen:
```bash
# Logrotate für Caddy bereits aktiv
# Docker Logs: docker-compose logs --tail=100 backend
```
