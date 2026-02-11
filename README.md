# StockLearn - Schach Lern-Applikation

Eine vollständige Schach-Lern-Applikation mit Stockfish Engine, die es ermöglicht, gegen eine leistungsstarke Schach-KI zu spielen.

## 🎯 Features

- ♟️ **Spielen gegen Stockfish** - Spiele gegen eine der stärksten Schach-Engines
- 📊 **Interaktives Schachbrett** - Drag & Drop Bedienung mit react-chessboard
- ✅ **Zugvalidierung** - Automatische Validierung aller Züge
- 📝 **Spielhistorie** - Verfolge alle Züge in Standard Algebraic Notation (SAN)
- 💾 **Persistente Spiele** - Alle Spiele werden in der Datenbank gespeichert
- 🎨 **Modernes UI** - Schönes, responsives Design

## 🛠️ Tech Stack

**Backend:**
- Express.js - Web Framework
- Prisma ORM - Datenbank ORM
- PostgreSQL - Datenbank
- Stockfish Chess Engine - Schach KI
- Chess.js - Schachlogik und Validierung

**Frontend:**
- React 18 - UI Framework
- Vite - Build Tool
- TypeScript - Type Safety
- react-chessboard - Schachbrett Komponente

**Infrastructure:**
- Docker & Docker Compose - Containerisierung
- pnpm - Package Manager

## 🚀 Schnellstart

### Voraussetzungen

- Docker Desktop installiert und gestartet
- pnpm (optional, für lokale Entwicklung)

### Starten der Applikation

```bash
# 1. Start-Script ausführen (empfohlen)
./start.sh

# ODER manuell mit Docker Compose
docker-compose up --build
```

Die Applikation ist dann verfügbar unter:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001
- **PostgreSQL**: localhost:5432

### Erstes Spiel starten

1. Öffne http://localhost:5173 im Browser
2. Ein neues Spiel wird automatisch erstellt
3. Ziehe eine weiße Figur um den ersten Zug zu machen
4. Stockfish antwortet automatisch mit einem Gegenzug
5. Viel Spaß beim Spielen! ♟️

## 📁 Projektstruktur

```
stocklearn/
├── backend/                 # Express Backend
│   ├── src/
│   │   ├── index.ts        # Hauptserver
│   │   └── services/
│   │       └── stockfish.service.ts  # Stockfish Integration
│   ├── prisma/
│   │   ├── schema.prisma   # Datenbank Schema
│   │   └── migrations/     # Datenbank Migrationen
│   ├── Dockerfile
│   └── package.json
├── frontend/               # React Frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── ChessGame.tsx      # Hauptkomponente
│   │   │   └── ChessGame.css      # Styling
│   │   ├── api/
│   │   │   └── client.ts          # API Client
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml      # Docker Orchestrierung
├── start.sh               # Start-Script
└── README.md
```

## 🔧 Entwicklung

### Lokale Entwicklung ohne Docker

**Backend:**
```bash
cd backend
pnpm install
pnpm prisma generate
pnpm prisma migrate dev
pnpm dev
```

**Frontend:**
```bash
cd frontend
pnpm install
pnpm dev
```

### API Endpunkte

- `POST /api/games` - Neues Spiel erstellen
- `GET /api/games/:id` - Spiel laden
- `GET /api/games` - Alle Spiele abrufen
- `POST /api/games/:id/move` - Zug ausführen
- `GET /health` - Health Check

### Datenbank

Das Prisma Schema definiert zwei Hauptmodelle:

- **Game** - Speichert Spielzustand (FEN, PGN, Status)
- **Move** - Speichert einzelne Züge mit allen Details

## 🐳 Docker Befehle

```bash
# Container starten
docker-compose up

# Container im Hintergrund starten
docker-compose up -d

# Container neu bauen und starten
docker-compose up --build

# Container stoppen
docker-compose down

# Container stoppen und Volumes löschen
docker-compose down -v

# Logs anzeigen
docker-compose logs -f

# Logs eines spezifischen Services
docker-compose logs -f backend
docker-compose logs -f frontend
```

## 📝 Nächste Schritte / Erweiterungen

- [ ] Mehrere Schwierigkeitsstufen für Stockfish
- [ ] Unterstützung für verschiedene Zeitkontrollen
- [ ] Analyse-Modus mit Engine-Vorschlägen
- [ ] Benutzer-Accounts und Authentifizierung
- [ ] Elo-Rating System
- [ ] Eröffnungs-Bibliothek
- [ ] Taktik-Trainer
- [ ] Spielanalyse mit Graphen
- [ ] Export von Spielen (PGN Download)
- [ ] Multiplayer-Modus (Spieler vs Spieler)

## 🤝 Beitragen

Contributions sind willkommen! Bitte erstelle einen Pull Request oder öffne ein Issue für Verbesserungen.

## 📄 Lizenz

MIT
