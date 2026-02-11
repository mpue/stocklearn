import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { Chess } from 'chess.js';
import { stockfishEngine } from './services/stockfish.service.js';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Neues Spiel erstellen
app.post('/api/games', async (req, res) => {
  try {
    const game = await prisma.game.create({
      data: {},
    });
    res.json(game);
  } catch (error) {
    console.error('Error creating game:', error);
    res.status(500).json({ error: 'Failed to create game' });
  }
});

// Spiel laden
app.get('/api/games/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const game = await prisma.game.findUnique({
      where: { id },
      include: {
        moves: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });
    
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    res.json(game);
  } catch (error) {
    console.error('Error fetching game:', error);
    res.status(500).json({ error: 'Failed to fetch game' });
  }
});

// Zug ausführen
app.post('/api/games/:id/move', async (req, res) => {
  try {
    const { id } = req.params;
    const { from, to, promotion } = req.body;

    const game = await prisma.game.findUnique({
      where: { id },
      include: { moves: true }
    });

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    if (game.status !== 'active') {
      return res.status(400).json({ error: 'Game is not active' });
    }

    const chess = new Chess(game.fen);
    
    // Spieler-Zug ausführen
    const moveResult = chess.move({ from, to, promotion });
    
    if (!moveResult) {
      return res.status(400).json({ error: 'Invalid move' });
    }

    // Spieler-Zug speichern
    await prisma.move.create({
      data: {
        gameId: id,
        from: moveResult.from,
        to: moveResult.to,
        piece: moveResult.piece,
        san: moveResult.san,
        fen: chess.fen(),
        moveNumber: game.moves.length + 1,
        isPlayerMove: true
      }
    });

    // Spiel-Status prüfen nach Spielerzug
    let status = 'active';
    if (chess.isCheckmate()) {
      status = 'checkmate';
      console.log('Checkmate detected after player move - Player wins!');
    } else if (chess.isStalemate()) {
      status = 'stalemate';
      console.log('Stalemate detected');
    } else if (chess.isDraw() || chess.isThreefoldRepetition() || chess.isInsufficientMaterial()) {
      status = 'draw';
      console.log('Draw detected');
    }

    // Stockfish-Zug berechnen (wenn Spiel noch aktiv)
    let stockfishMove = null;
    if (status === 'active') {
      try {
        const bestMove = await stockfishEngine.getBestMove(chess.fen(), 10);
        
        // Stockfish-Zug ausführen
        const sfMoveResult = chess.move({
          from: bestMove.substring(0, 2),
          to: bestMove.substring(2, 4),
          promotion: bestMove.length > 4 ? bestMove[4] : undefined
        });

        if (sfMoveResult) {
          stockfishMove = await prisma.move.create({
            data: {
              gameId: id,
              from: sfMoveResult.from,
              to: sfMoveResult.to,
              piece: sfMoveResult.piece,
              san: sfMoveResult.san,
              fen: chess.fen(),
              moveNumber: game.moves.length + 2,
              isPlayerMove: false
            }
          });

          // Status erneut prüfen nach Stockfish-Zug
          if (chess.isCheckmate()) {
            status = 'checkmate';
            console.log('Checkmate detected after Stockfish move - Stockfish wins!');
          } else if (chess.isStalemate()) {
            status = 'stalemate';
            console.log('Stalemate detected after Stockfish move');
          } else if (chess.isDraw() || chess.isThreefoldRepetition() || chess.isInsufficientMaterial()) {
            status = 'draw';
            console.log('Draw detected after Stockfish move');
          }
        }
      } catch (error) {
        console.error('Stockfish error:', error);
      }
    }

    // Spiel aktualisieren
    const updatedGame = await prisma.game.update({
      where: { id },
      data: {
        fen: chess.fen(),
        pgn: chess.pgn(),
        status
      },
      include: {
        moves: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    res.json({
      game: updatedGame,
      stockfishMove
    });
  } catch (error) {
    console.error('Error making move:', error);
    res.status(500).json({ error: 'Failed to make move' });
  }
});

// Alle Spiele abrufen
app.get('/api/games', async (req, res) => {
  try {
    const games = await prisma.game.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    res.json(games);
  } catch (error) {
    console.error('Error fetching games:', error);
    res.status(500).json({ error: 'Failed to fetch games' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend server running on http://0.0.0.0:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  await prisma.$disconnect();
  stockfishEngine.close();
  process.exit(0);
});
