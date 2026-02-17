import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { Chess } from 'chess.js';
import bcrypt from 'bcryptjs';
import { stockfishEngine } from './services/stockfish.service.js';
import { authenticateToken, generateToken, AuthRequest } from './middleware/auth.middleware.js';

dotenv.config();

const app = express();

// Trust proxy for SSL/WSS support behind reverse proxy
app.set('trust proxy', 1);

const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3005',
    methods: ['GET', 'POST'],
    credentials: true
  },
  // Allow both ws and wss connections
  transports: ['websocket', 'polling'],
  allowEIO3: true
});
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3004;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3005',
  credentials: true
}));
app.use(express.json());

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth - Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, username, password } = req.body;

    if (!email || !username || !password) {
      return res.status(400).json({ error: 'Email, username and password are required' });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { username }
        ]
      }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User with this email or username already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword
      }
    });

    // Generate token
    const token = generateToken(user.id);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username
      }
    });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// Auth - Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = generateToken(user.id);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username
      }
    });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// Auth - Get current user
app.get('/api/auth/me', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      email: user.email,
      username: user.username
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Neues Spiel erstellen
app.post('/api/games', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { gameType = 'vs_stockfish', opponentId } = req.body;
    
    const gameData: any = {
      gameType,
      whitePlayerId: req.userId!,
    };

    // Bei vs_player: wenn opponentId gegeben, direkt zuweisen, sonst status = waiting
    if (gameType === 'vs_player') {
      if (opponentId) {
        gameData.blackPlayerId = opponentId;
        gameData.status = 'active';
      } else {
        gameData.status = 'waiting'; // Wartet auf Gegner
      }
    }

    const game = await prisma.game.create({
      data: gameData,
      include: {
        whitePlayer: { select: { id: true, username: true } },
        blackPlayer: { select: { id: true, username: true } }
      }
    });
    res.json(game);
  } catch (error) {
    console.error('Error creating game:', error);
    res.status(500).json({ error: 'Failed to create game' });
  }
});

// PvP Spiel beitreten
app.post('/api/games/:id/join', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    
    const game = await prisma.game.findUnique({
      where: { id }
    });

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    if (game.gameType !== 'vs_player') {
      return res.status(400).json({ error: 'Can only join player vs player games' });
    }

    if (game.status !== 'waiting') {
      return res.status(400).json({ error: 'Game is not waiting for players' });
    }

    if (game.whitePlayerId === req.userId) {
      return res.status(400).json({ error: 'Cannot join your own game' });
    }

    if (game.blackPlayerId) {
      return res.status(400).json({ error: 'Game already has two players' });
    }

    const updatedGame = await prisma.game.update({
      where: { id },
      data: {
        blackPlayerId: req.userId,
        status: 'active'
      },
      include: {
        moves: {
          orderBy: { createdAt: 'asc' }
        },
        whitePlayer: { select: { id: true, username: true } },
        blackPlayer: { select: { id: true, username: true } }
      }
    });

    // WebSocket-Event: Benachrichtige wartenden Spieler dass jemand beigetreten ist
    io.to(`game:${id}`).emit('player-joined', updatedGame);

    res.json(updatedGame);
  } catch (error) {
    console.error('Error joining game:', error);
    res.status(500).json({ error: 'Failed to join game' });
  }
});

// Verfügbare PvP Spiele laden
app.get('/api/games/available/pvp', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const games = await prisma.game.findMany({
      where: {
        gameType: 'vs_player',
        status: 'waiting',
        whitePlayerId: { not: req.userId } // Nicht eigene Spiele
      },
      include: {
        whitePlayer: { select: { id: true, username: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    res.json(games);
  } catch (error) {
    console.error('Error fetching available games:', error);
    res.status(500).json({ error: 'Failed to fetch available games' });
  }
});

// Spiel laden
app.get('/api/games/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const game = await prisma.game.findUnique({
      where: { id },
      include: {
        moves: {
          orderBy: { createdAt: 'asc' }
        },
        whitePlayer: { select: { id: true, username: true } },
        blackPlayer: { select: { id: true, username: true } }
      }
    });
    
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Prüfen ob User am Spiel beteiligt ist
    const isParticipant = game.whitePlayerId === req.userId || game.blackPlayerId === req.userId;
    if (!isParticipant) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    res.json(game);
  } catch (error) {
    console.error('Error fetching game:', error);
    res.status(500).json({ error: 'Failed to fetch game' });
  }
});

// Zug ausführen
app.post('/api/games/:id/move', authenticateToken, async (req: AuthRequest, res) => {
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

    // Prüfen ob User am Spiel beteiligt ist
    const isWhitePlayer = game.whitePlayerId === req.userId;
    const isBlackPlayer = game.blackPlayerId === req.userId;
    
    if (!isWhitePlayer && !isBlackPlayer) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (game.status !== 'active') {
      return res.status(400).json({ error: 'Game is not active' });
    }

    const chess = new Chess(game.fen);
    const currentTurn = chess.turn(); // 'w' or 'b'

    // Bei vs_player: Prüfen ob der Spieler am Zug ist
    if (game.gameType === 'vs_player') {
      if (currentTurn === 'w' && !isWhitePlayer) {
        return res.status(400).json({ error: 'Not your turn' });
      }
      if (currentTurn === 'b' && !isBlackPlayer) {
        return res.status(400).json({ error: 'Not your turn' });
      }
    }

    // Bei vs_stockfish: Nur Weiß (Spieler) darf ziehen
    if (game.gameType === 'vs_stockfish' && currentTurn !== 'w') {
      return res.status(400).json({ error: 'Not your turn' });
    }
    
    // Spieler-Zug ausführen
    const moveResult = chess.move({ from, to, promotion });
    
    if (!moveResult) {
      return res.status(400).json({ error: 'Invalid move' });
    }

    // Spieler-Zug speichern
    const playerMove = await prisma.move.create({
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
      console.log('Checkmate detected after player move');
    } else if (chess.isStalemate()) {
      status = 'stalemate';
      console.log('Stalemate detected');
    } else if (chess.isDraw() || chess.isThreefoldRepetition() || chess.isInsufficientMaterial()) {
      status = 'draw';
      console.log('Draw detected');
    }

    // Stockfish-Zug berechnen (nur bei vs_stockfish und wenn Spiel noch aktiv)
    let stockfishMove = null;
    if (game.gameType === 'vs_stockfish' && status === 'active') {
      try {
        const skillLevel = req.body.skillLevel || 10;
        const bestMove = await stockfishEngine.getBestMove(chess.fen(), skillLevel);
        
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
            console.log('Checkmate detected after Stockfish move');
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
        currentTurn: chess.turn(),
        status
      },
      include: {
        moves: {
          orderBy: { createdAt: 'asc' }
        },
        whitePlayer: { select: { id: true, username: true } },
        blackPlayer: { select: { id: true, username: true } }
      }
    });

    // WebSocket-Event für Echtzeit-Updates
    io.to(`game:${id}`).emit('game-updated', {
      game: updatedGame,
      stockfishMove
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
app.get('/api/games', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const games = await prisma.game.findMany({
      where: {
        OR: [
          { whitePlayerId: req.userId },
          { blackPlayerId: req.userId }
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        moves: true,
        whitePlayer: { select: { id: true, username: true } },
        blackPlayer: { select: { id: true, username: true } }
      }
    });
    res.json(games);
  } catch (error) {
    console.error('Error fetching games:', error);
    res.status(500).json({ error: 'Failed to fetch games' });
  }
});

// Spiel analysieren
app.post('/api/games/:id/analyze', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    
    const game = await prisma.game.findUnique({
      where: { id },
      include: {
        moves: {
          orderBy: { moveNumber: 'asc' }
        }
      }
    });

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Prüfen ob User am Spiel beteiligt ist
    const isParticipant = game.whitePlayerId === req.userId || game.blackPlayerId === req.userId;
    if (!isParticipant) {
      console.log(`Access denied: userId=${req.userId}, whitePlayerId=${game.whitePlayerId}, blackPlayerId=${game.blackPlayerId}`);
      return res.status(403).json({ error: 'Access denied' });
    }

    const chess = new Chess();
    const analysis: any[] = [];
    
    // Nur Spielerzüge analysieren, max 200 Züge (100 pro Seite)
    const movesToAnalyze = game.moves.slice(0, 200);
    
    console.log(`Starting analysis for game ${id} (${movesToAnalyze.length} moves)`);
    
    // Startposition analysieren - wird als Referenz für den ersten Zug benötigt
    let prevEval: { evaluation: number; bestMove: string; mate?: number };
    try {
      prevEval = await stockfishEngine.evaluatePosition(chess.fen(), 8);
    } catch (err) {
      console.error('Failed to evaluate start position:', err);
      prevEval = { evaluation: 0, bestMove: '', mate: undefined };
    }
    
    for (let i = 0; i < movesToAnalyze.length; i++) {
      const move = movesToAnalyze[i];
      // Position vor dem Zug merken + bester Zug der Engine
      const bestMoveForPosition = prevEval.bestMove;
      const bestMoveEval = prevEval.evaluation;
      const turn = chess.turn();
      
      // Zug ausführen
      try {
        chess.move({
          from: move.from,
          to: move.to,
          promotion: move.san.includes('=') ? 'q' : undefined
        });
      } catch (err) {
        console.error(`Failed to apply move ${move.san} at position ${i}:`, err);
        break;
      }
      
      // Position nach dem Zug evaluieren
      const positionAfter = chess.fen();
      // chess.turn() gibt jetzt den Spieler an, der ALS NÄCHSTES dran ist (nach dem Zug)
      const sideToMoveAfter = chess.turn(); // 'w' oder 'b'
      let evaluation: { evaluation: number; bestMove: string; mate?: number };
      try {
        evaluation = await stockfishEngine.evaluatePosition(positionAfter, 8);
        // Stockfish gibt Eval aus Sicht des Spielers am Zug
        // Wir normalisieren auf Weiß-Perspektive
        if (sideToMoveAfter === 'b') {
          evaluation = { ...evaluation, evaluation: -evaluation.evaluation, mate: evaluation.mate !== undefined ? -evaluation.mate : undefined };
        }
      } catch (err) {
        console.error(`Failed to evaluate position after move ${i}:`, err);
        evaluation = { evaluation: prevEval.evaluation, bestMove: '', mate: undefined };
      }
      
      // Fehlerklassifizierung basierend auf Eval-Differenz
      let classification = 'good';
      let evalDiff = 0;

      // Beide Evals sind jetzt aus Weiß-Perspektive normalisiert
      // Für Weiß: positiver evalDiff = gut, negativer = schlecht
      // Für Schwarz: invertiert
      if (turn === 'w') {
        evalDiff = evaluation.evaluation - prevEval.evaluation;
      } else {
        evalDiff = prevEval.evaluation - evaluation.evaluation;
      }
      
      if (evalDiff < -3) classification = 'blunder';
      else if (evalDiff < -1.5) classification = 'mistake';
      else if (evalDiff < -0.5) classification = 'inaccuracy';
      else if (evalDiff > 0.5) classification = 'brilliant';
      
      analysis.push({
        moveNumber: move.moveNumber,
        move: move.san,
        from: move.from,
        to: move.to,
        isPlayerMove: move.isPlayerMove,
        evaluation: evaluation.evaluation,
        mate: evaluation.mate,
        bestMove: bestMoveForPosition,
        bestMoveEval: bestMoveEval,
        classification,
        evalDiff,
        fen: positionAfter
      });

      // Aktuelle Eval als Referenz für den nächsten Zug
      prevEval = evaluation;
      
      // Fortschritt loggen
      if ((i + 1) % 20 === 0) {
        console.log(`Analysis progress: ${i + 1}/${movesToAnalyze.length} moves analyzed`);
      }
    }
    
    console.log(`Analysis complete for game ${id}`);
    

    res.json({
      gameId: id,
      analysis,
      summary: {
        totalMoves: game.moves.length,
        blunders: analysis.filter(a => a.classification === 'blunder').length,
        mistakes: analysis.filter(a => a.classification === 'mistake').length,
        inaccuracies: analysis.filter(a => a.classification === 'inaccuracy').length,
        brilliancies: analysis.filter(a => a.classification === 'brilliant').length,
      }
    });
  } catch (error) {
    console.error('Error analyzing game:', error);
    res.status(500).json({ error: 'Failed to analyze game' });
  }
});

// Spiel aufgeben (resign)
app.post('/api/games/:id/resign', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    
    const game = await prisma.game.findUnique({
      where: { id }
    });
    
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Prüfen ob User am Spiel beteiligt ist
    const isParticipant = game.whitePlayerId === req.userId || game.blackPlayerId === req.userId;
    if (!isParticipant) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const updatedGame = await prisma.game.update({
      where: { id },
      data: {
        status: 'resigned'
      }
    });
    
    res.json(updatedGame);
  } catch (error) {
    console.error('Error resigning game:', error);
    res.status(500).json({ error: 'Failed to resign game' });
  }
});

// Spiel löschen
app.delete('/api/games/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    
    const game = await prisma.game.findUnique({
      where: { id }
    });
    
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Prüfen ob User am Spiel beteiligt ist
    const isParticipant = game.whitePlayerId === req.userId || game.blackPlayerId === req.userId;
    if (!isParticipant) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Zuerst alle Moves löschen
    await prisma.move.deleteMany({
      where: { gameId: id }
    });
    
    // Dann das Spiel löschen
    await prisma.game.delete({
      where: { id }
    });
    
    res.json({ message: 'Game deleted successfully' });
  } catch (error) {
    console.error('Error deleting game:', error);
    res.status(500).json({ error: 'Failed to delete game' });
  }
});

// WebSocket-Handler für Echtzeit-Updates
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Join game room
  socket.on('join-game', (gameId: string) => {
    socket.join(`game:${gameId}`);
    console.log(`Socket ${socket.id} joined game ${gameId}`);
  });

  // Leave game room
  socket.on('leave-game', (gameId: string) => {
    socket.leave(`game:${gameId}`);
    console.log(`Socket ${socket.id} left game ${gameId}`);
  });

  // Chat message handler
  socket.on('chat-message', ({ gameId, message, username }: { gameId: string, message: string, username: string }) => {
    if (!gameId || !message || !username) {
      return;
    }
    
    // Broadcast message to all clients in the game room
    io.to(`game:${gameId}`).emit('chat-message', {
      username,
      message,
      timestamp: new Date().toISOString()
    });
    
    console.log(`Chat message in game ${gameId} from ${username}: ${message}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend server running on http://0.0.0.0:${PORT}`);
  console.log(`🔌 WebSocket server ready`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  await prisma.$disconnect();
  stockfishEngine.close();
  process.exit(0);
});

// Prevent crash on unhandled errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
