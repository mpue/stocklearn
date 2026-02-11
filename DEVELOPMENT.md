# Entwickler-Dokumentation

## Architektur-Übersicht

### Backend (Express + Stockfish)

Das Backend ist ein Express.js Server, der:
1. RESTful API Endpunkte bereitstellt
2. Die Stockfish Engine über Child Processes steuert
3. Prisma für Datenbankzugriffe verwendet
4. Schachlogik mit chess.js validiert

#### Stockfish Integration

Die Stockfish Engine läuft als separater Prozess und kommuniziert über UCI (Universal Chess Interface):

```typescript
// Beispiel: Position setzen und besten Zug berechnen
stockfish.stdin.write('position fen <fen-string>\n');
stockfish.stdin.write('go movetime 1000\n');
```

#### API Workflow

1. **Neues Spiel**: Client ruft POST /api/games auf
2. **Spielerzug**: Client sendet POST /api/games/:id/move mit from/to
3. **Backend validiert** Zug mit chess.js
4. **Stockfish berechnet** Gegenzug
5. **Backend speichert** beide Züge in DB
6. **Response** enthält aktualisiertes Spiel + Stockfish-Zug

### Frontend (React + Vite)

Das Frontend ist eine Single Page Application mit:
- **ChessGame Component**: Hauptkomponente mit Spiellogik
- **react-chessboard**: Visuelles Schachbrett mit Drag&Drop
- **API Client**: TypeScript Client für Backend-Kommunikation

#### State Management

```typescript
const [game, setGame] = useState<Chess>(new Chess());
const [gameId, setGameId] = useState<string | null>(null);
const [isThinking, setIsThinking] = useState(false);
```

## Datenbank Schema

### Game Tabelle
- `id`: UUID, Primary Key
- `fen`: Aktuelle Board-Position (Forsyth-Edwards Notation)
- `pgn`: Komplettes Spiel (Portable Game Notation)
- `status`: active | checkmate | draw | stalemate

### Move Tabelle
- `id`: UUID, Primary Key
- `gameId`: Foreign Key zu Game
- `from/to`: Schach-Koordinaten (z.B. "e2", "e4")
- `san`: Standard Algebraic Notation (z.B. "Nf3")
- `isPlayerMove`: boolean - unterscheidet Spieler/Engine

## Debugging

### Backend Logs anschauen

```bash
docker-compose logs -f backend
```

### In Backend Container einsteigen

```bash
docker exec -it stocklearn-backend sh

# Prisma Studio starten
pnpm prisma studio
```

### Frontend Logs

```bash
docker-compose logs -f frontend
```

### Stockfish manuell testen

```bash
docker exec -it stocklearn-backend sh
stockfish

# Im Stockfish Prompt:
uci
position startpos
go movetime 1000
quit
```

## Häufige Probleme

### Port bereits belegt

```bash
# Prüfen welcher Prozess Port 3001 verwendet
lsof -i :3001

# Oder Port 5173
lsof -i :5173
```

### Datenbank Verbindungsfehler

```bash
# PostgreSQL Container neustarten
docker-compose restart postgres

# Oder komplett neu aufsetzen
docker-compose down -v
docker-compose up --build
```

### Stockfish antwortet nicht

Prüfen ob Stockfish im Container installiert ist:
```bash
docker exec -it stocklearn-backend which stockfish
```

## Testing

### API Manual Testing

```bash
# Neues Spiel erstellen
curl -X POST http://localhost:3001/api/games

# Zug ausführen
curl -X POST http://localhost:3001/api/games/<GAME_ID>/move \
  -H "Content-Type: application/json" \
  -d '{"from":"e2","to":"e4"}'
```

## Performance Optimierungen

### Stockfish Skill Level anpassen

In [stockfish.service.ts](backend/src/services/stockfish.service.ts#L42):
```typescript
// 0 = schwach, 20 = stark
setoption name Skill Level value ${skillLevel}
```

### Denkzeit anpassen

```typescript
// In ms: 1000 = 1 Sekunde
go movetime 1000
```

## Code-Style

- TypeScript strict mode aktiviert
- ESM Modules (import/export)
- Async/Await für asynchrone Operations
- Prisma naming conventions (camelCase)

## Deployment

Für Production:
1. Environment Variables anpassen
2. `NODE_ENV=production` setzen
3. Build-Prozess durchführen
4. Secrets sicher verwalten
5. HTTPS aktivieren
6. Rate Limiting implementieren
