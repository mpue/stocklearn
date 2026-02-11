import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { api, Game as ApiGame } from '../api/client';
import './ChessGame.css';

export function ChessGame() {
  const { gameId: urlGameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket } = useSocket();
  const [game, setGame] = useState<Chess>(new Chess());
  const [gameData, setGameData] = useState<ApiGame | null>(null);
  const [gameId, setGameId] = useState<string | null>(urlGameId || null);
  const [status, setStatus] = useState<string>('Lade Spiel...');
  const [gameStatus, setGameStatus] = useState<string>('active');
  const [isThinking, setIsThinking] = useState(false);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [skillLevel] = useState(() => {
    return parseInt(localStorage.getItem('stockfishSkillLevel') || '10');
  });

  useEffect(() => {
    if (urlGameId) {
      loadGame(urlGameId);
    }
  }, [urlGameId]);

  // WebSocket: Join game room
  useEffect(() => {
    if (!socket || !gameId) return;

    socket.emit('join-game', gameId);
    console.log('Joined game room:', gameId);

    return () => {
      socket.emit('leave-game', gameId);
    };
  }, [socket, gameId]);

  // WebSocket: Listen for game updates
  useEffect(() => {
    if (!socket || !gameId) return;

    const handleGameUpdated = (data: { game: ApiGame; stockfishMove: any }) => {
      console.log('Game updated via WebSocket');
      const updatedGame = data.game;
      
      setGameData(updatedGame);
      const chess = new Chess(updatedGame.fen);
      setGame(chess);
      
      if (updatedGame.moves) {
        const history = updatedGame.moves
          .sort((a, b) => a.moveNumber - b.moveNumber)
          .map(m => m.san);
        setMoveHistory(history);
      }
      
      setGameStatus(updatedGame.status);
      
      // Status aktualisieren
      if (updatedGame.status === 'active' && updatedGame.gameType === 'vs_player') {
        const isWhite = updatedGame.whitePlayer?.id === user?.id;
        const isBlack = updatedGame.blackPlayer?.id === user?.id;
        const isMyTurn = (chess.turn() === 'w' && isWhite) || (chess.turn() === 'b' && isBlack);
        
        if (isMyTurn) {
          setStatus(chess.isCheck() ? 'Schach! Dein Zug!' : 'Dein Zug!');
        } else {
          const opponentName = isWhite 
            ? updatedGame.blackPlayer?.username 
            : updatedGame.whitePlayer?.username;
          setStatus(`${opponentName} ist am Zug...`);
        }
      } else if (updatedGame.status === 'checkmate' && updatedGame.gameType === 'vs_player') {
        const winner = chess.turn() === 'w' 
          ? updatedGame.blackPlayer?.username 
          : updatedGame.whitePlayer?.username;
        setStatus(`Schachmatt! ${winner} gewinnt!`);
      }
    };

    const handlePlayerJoined = (updatedGame: ApiGame) => {
      console.log('Player joined via WebSocket');
      setGameData(updatedGame);
      setGameStatus(updatedGame.status);
      
      if (updatedGame.status === 'active') {
        setStatus('Spiel beginnt! Weiß ist am Zug.');
      }
    };

    socket.on('game-updated', handleGameUpdated);
    socket.on('player-joined', handlePlayerJoined);

    return () => {
      socket.off('game-updated', handleGameUpdated);
      socket.off('player-joined', handlePlayerJoined);
    };
  }, [socket, gameId, user?.id]);

  const loadGame = async (id: string) => {
    try {
      setStatus('Lade Spiel...');
      const loadedGame = await api.getGame(id);
      setGameId(id);
      setGameData(loadedGame);
      const chess = new Chess(loadedGame.fen);
      setGame(chess);
      
      if (loadedGame.moves && loadedGame.moves.length > 0) {
        const history = loadedGame.moves
          .sort((a, b) => a.moveNumber - b.moveNumber)
          .map(m => m.san);
        setMoveHistory(history);
      }
      
      setGameStatus(loadedGame.status);
      
      // Status basierend auf gameType setzen
      if (loadedGame.status === 'waiting') {
        setStatus('Wartet auf einen Gegner...');
      } else if (loadedGame.status === 'active') {
        if (loadedGame.gameType === 'vs_player') {
          const isWhite = loadedGame.whitePlayer?.id === user?.id;
          const isBlack = loadedGame.blackPlayer?.id === user?.id;
          const isMyTurn = (chess.turn() === 'w' && isWhite) || (chess.turn() === 'b' && isBlack);
          
          if (isMyTurn) {
            setStatus(chess.isCheck() ? 'Schach! Dein Zug!' : 'Dein Zug!');
          } else {
            const opponentName = isWhite 
              ? loadedGame.blackPlayer?.username 
              : loadedGame.whitePlayer?.username;
            setStatus(`${opponentName} ist am Zug...`);
          }
        } else {
          setStatus(chess.turn() === 'w' ? 'Dein Zug!' : 'Stockfish ist am Zug...');
        }
      } else if (loadedGame.status === 'checkmate') {
        if (loadedGame.gameType === 'vs_player') {
          const winner = chess.turn() === 'w' 
            ? loadedGame.blackPlayer?.username 
            : loadedGame.whitePlayer?.username;
          setStatus(`Schachmatt! ${winner} gewinnt!`);
        } else {
          setStatus(chess.turn() === 'w' ? 'Schachmatt! Stockfish gewinnt!' : 'Schachmatt! Du gewinnst!');
        }
      } else {
        setStatus('Spiel beendet: ' + loadedGame.status);
      }
    } catch (error) {
      console.error('Error loading game:', error);
      setStatus('Fehler beim Laden des Spiels');
    }
  };

  const startNewGame = async () => {
    try {
      setStatus('Neues Spiel wird erstellt...');
      const newGame = await api.createGame();
      setGameId(newGame.id);
      const chess = new Chess();
      setGame(chess);
      setMoveHistory([]);
      setStatus('Dein Zug! Spiele mit Weiß gegen Stockfish.');
      // Update URL
      navigate(`/game/${newGame.id}`, { replace: true });
    } catch (error) {
      console.error('Error starting new game:', error);
      setStatus('Fehler beim Erstellen des Spiels');
    }
  };

  const backToDashboard = () => {
    navigate('/');
  };

  const resignGame = async () => {
    if (!gameId) return;
    
    if (!confirm('Spiel wirklich aufgeben?')) {
      return;
    }
    
    try {
      await api.resignGame(gameId);
      setStatus('Du hast aufgegeben. Stockfish gewinnt!');
      // Spiel neu laden um den aktualisierten Status zu zeigen
      await loadGame(gameId);
    } catch (error) {
      console.error('Error resigning game:', error);
      setStatus('Fehler beim Aufgeben');
    }
  };

  const onDrop = async (sourceSquare: string, targetSquare: string) => {
    if (!gameId || isThinking || !gameData) {
      return false;
    }

    // Prüfen ob Spiel aktiv ist
    if (gameStatus !== 'active') {
      return false;
    }

    // Bei PvP: Prüfen ob der User am Zug ist
    if (gameData.gameType === 'vs_player') {
      const isWhite = gameData.whitePlayer?.id === user?.id;
      const isBlack = gameData.blackPlayer?.id === user?.id;
      const currentTurn = game.turn();
      
      if ((currentTurn === 'w' && !isWhite) || (currentTurn === 'b' && !isBlack)) {
        return false;
      }
    }

    try {
      const gameCopy = new Chess(game.fen());
      
      // Prüfen ob Bauern-Umwandlung nötig
      let promotion = undefined;
      const piece = gameCopy.get(sourceSquare);
      if (piece?.type === 'p' && (targetSquare[1] === '8' || targetSquare[1] === '1')) {
        promotion = 'q'; // Automatisch zur Dame umwandeln
      }

      // Zug validieren
      const move = gameCopy.move({
        from: sourceSquare,
        to: targetSquare,
        promotion
      });

      if (move === null) {
        return false;
      }

      // Sofort den Spielerzug anzeigen (optimistic update)
      setGame(gameCopy);
      setIsThinking(true);
      
      if (gameData.gameType === 'vs_player') {
        setStatus('Warte auf Gegner...');
      } else {
        setStatus('Stockfish denkt nach...');
      }

      // Zug an Backend senden
      const response = await api.makeMove(gameId, sourceSquare, targetSquare, promotion);
      
      // Spiel mit Antwort aktualisieren
      const updatedGame = new Chess(response.game.fen);
      setGame(updatedGame);
      setGameData(response.game);

      // Züge-Historie aus Backend-Daten aktualisieren
      if (response.game.moves && response.game.moves.length > 0) {
        const history = response.game.moves
          .sort((a, b) => a.moveNumber - b.moveNumber)
          .map(m => m.san);
        setMoveHistory(history);
      }

      // Status aktualisieren
      if (response.game.status === 'checkmate') {
        if (response.game.gameType === 'vs_player') {
          const winner = updatedGame.turn() === 'w' 
            ? response.game.blackPlayer?.username 
            : response.game.whitePlayer?.username;
          setStatus(`Schachmatt! ${winner} gewinnt!`);
        } else {
          if (updatedGame.turn() === 'w') {
            setStatus('Schachmatt! Stockfish gewinnt!');
          } else {
            setStatus('Schachmatt! Du gewinnst!');
          }
        }
      } else if (response.game.status === 'stalemate') {
        setStatus('Patt! Das Spiel endet unentschieden.');
      } else if (response.game.status === 'draw') {
        setStatus('Remis!');
      } else if (updatedGame.isCheck()) {
        if (response.game.gameType === 'vs_player') {
          const isWhite = response.game.whitePlayer?.id === user?.id;
          const isBlack = response.game.blackPlayer?.id === user?.id;
          const isMyTurn = (updatedGame.turn() === 'w' && isWhite) || (updatedGame.turn() === 'b' && isBlack);
          
          if (isMyTurn) {
            setStatus('Schach! Dein Zug!');
          } else {
            const opponentName = isWhite 
              ? response.game.blackPlayer?.username 
              : response.game.whitePlayer?.username;
            setStatus(`Schach! ${opponentName} ist am Zug...`);
          }
        } else {
          setStatus('Schach! Dein Zug.');
        }
      } else {
        if (response.game.gameType === 'vs_player') {
          const isWhite = response.game.whitePlayer?.id === user?.id;
          const isBlack = response.game.blackPlayer?.id === user?.id;
          const isMyTurn = (updatedGame.turn() === 'w' && isWhite) || (updatedGame.turn() === 'b' && isBlack);
          
          if (isMyTurn) {
            setStatus('Dein Zug!');
          } else {
            const opponentName = isWhite 
              ? response.game.blackPlayer?.username 
              : response.game.whitePlayer?.username;
            setStatus(`${opponentName} ist am Zug...`);
          }
        } else {
          setStatus('Dein Zug!');
        }
      }

      setGameStatus(response.game.status);
      setIsThinking(false);
      return true;
    } catch (error: any) {
      console.error('Error making move:', error);
      setStatus(`Fehler: ${error.message}`);
      setIsThinking(false);
      return false;
    }
  };

  return (
    <div className="chess-game">
      <div className="game-container">
        <div className="board-container">
          <div className="game-header-bar">
            <button className="btn-back" onClick={backToDashboard}>
              ← Zurück zum Dashboard
            </button>
            <h1>StockLearn</h1>
          </div>
          <div className="status-bar">
            <span className="status">{status}</span>
            {isThinking && <span className="thinking">⏳</span>}
          </div>
          <div className="chessboard-wrapper">
            <Chessboard
              position={game.fen()}
              onPieceDrop={onDrop}
              boardWidth={560}
              animationDuration={200}
              arePiecesDraggable={!isThinking && gameStatus === 'active'}
              boardOrientation={
                gameData?.gameType === 'vs_player' && gameData.blackPlayer?.id === user?.id 
                  ? 'black' 
                  : 'white'
              }
              customBoardStyle={{
                borderRadius: '8px',
                boxShadow: '0 5px 15px rgba(0, 0, 0, 0.3)',
              }}
            />
          </div>
          <div className="controls">
            <button onClick={startNewGame} disabled={isThinking}>
              Neues Spiel
            </button>
            {gameStatus === 'active' && gameId && (
              <button onClick={resignGame} disabled={isThinking} className="btn-resign">
                Aufgeben
              </button>
            )}
            <button onClick={backToDashboard}>
              Dashboard
            </button>
          </div>
        </div>

        <div className="sidebar">
          <div className="info-panel">
            <h3>Spielinformation</h3>
            <div className="info-item">
              <strong>Züge:</strong> {Math.floor(moveHistory.length / 2) + (moveHistory.length % 2)}
            </div>
            {gameData?.gameType === 'vs_player' ? (
              <>
                <div className="info-item">
                  <strong>⚪ Weiß:</strong> {gameData.whitePlayer?.username || 'Unbekannt'}
                </div>
                <div className="info-item">
                  <strong>⚫ Schwarz:</strong> {gameData.blackPlayer?.username || 'Wartet...'}
                </div>
                <div className="info-item">
                  <strong>Deine Farbe:</strong> {
                    gameData.whitePlayer?.id === user?.id 
                      ? 'Weiß' 
                      : gameData.blackPlayer?.id === user?.id 
                        ? 'Schwarz' 
                        : 'Zuschauer'
                  }
                </div>
              </>
            ) : (
              <>
                <div className="info-item">
                  <strong>Farbe:</strong> Weiß (unten)
                </div>
                <div className="info-item">
                  <strong>Gegner:</strong> Stockfish Engine
                </div>
              </>
            )}
          </div>

          <div className="moves-panel">
            <h3>Zughistorie</h3>
            <div className="move-list">
              {moveHistory.length === 0 ? (
                <p className="no-moves">Noch keine Züge</p>
              ) : (
                <div className="moves-grid">
                  {moveHistory.map((move, index) => {
                    if (index % 2 === 0) {
                      return (
                        <div key={index} className="move-pair">
                          <span className="move-number">{Math.floor(index / 2) + 1}.</span>
                          <span className="move">{move}</span>
                          {moveHistory[index + 1] && (
                            <span className="move">{moveHistory[index + 1]}</span>
                          )}
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
