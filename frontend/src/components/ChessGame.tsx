import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { api, Game } from '../api/client';
import './ChessGame.css';

export function ChessGame() {
  const { gameId: urlGameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const [game, setGame] = useState<Chess>(new Chess());
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

  const loadGame = async (id: string) => {
    try {
      setStatus('Lade Spiel...');
      const loadedGame = await api.getGame(id);
      setGameId(id);
      const chess = new Chess(loadedGame.fen);
      setGame(chess);
      
      if (loadedGame.moves && loadedGame.moves.length > 0) {
        const history = loadedGame.moves
          .sort((a, b) => a.moveNumber - b.moveNumber)
          .map(m => m.san);
        setMoveHistory(history);
      }
      
      setGameStatus(loadedGame.status);
      
      if (loadedGame.status === 'active') {
        setStatus(chess.turn() === 'w' ? 'Dein Zug!' : 'Stockfish ist am Zug...');
      } else if (loadedGame.status === 'checkmate') {
        setStatus(chess.turn() === 'w' ? 'Schachmatt! Stockfish gewinnt!' : 'Schachmatt! Du gewinnst!');
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
    if (!gameId || isThinking) {
      return false;
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
      // Historie NICHT zwischendurch aktualisieren - nur am Ende mit Backend-Daten
      setIsThinking(true);
      setStatus('Stockfish denkt nach...');

      // Zug an Backend senden
      const response = await api.makeMove(gameId, sourceSquare, targetSquare, promotion);
      
      // Spiel mit Stockfish-Antwort aktualisieren
      const updatedGame = new Chess(response.game.fen);
      setGame(updatedGame);

      // Züge-Historie aus Backend-Daten aktualisieren
      if (response.game.moves && response.game.moves.length > 0) {
        const history = response.game.moves
          .sort((a, b) => a.moveNumber - b.moveNumber)
          .map(m => m.san);
        setMoveHistory(history);
      }

      // Status aktualisieren
      if (response.game.status === 'checkmate') {
        if (updatedGame.turn() === 'w') {
          setStatus('Schachmatt! Stockfish gewinnt!');
        } else {
          setStatus('Schachmatt! Du gewinnst!');
        }
      } else if (response.game.status === 'stalemate') {
        setStatus('Patt! Das Spiel endet unentschieden.');
      } else if (response.game.status === 'draw') {
        setStatus('Remis!');
      } else if (updatedGame.isCheck()) {
        setStatus('Schach! Dein Zug.');
      } else {
        setStatus('Dein Zug!');
      }

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
              arePiecesDraggable={!isThinking}
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
            <div className="info-item">
              <strong>Farbe:</strong> Weiß (unten)
            </div>
            <div className="info-item">
              <strong>Gegner:</strong> Stockfish Engine
            </div>
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
