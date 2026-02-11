import { useState, useEffect } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { api, Game } from '../api/client';
import './ChessGame.css';

export function ChessGame() {
  const [game, setGame] = useState<Chess>(new Chess());
  const [gameId, setGameId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('Bereit für ein neues Spiel');
  const [isThinking, setIsThinking] = useState(false);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);

  useEffect(() => {
    startNewGame();
  }, []);

  const startNewGame = async () => {
    try {
      setStatus('Neues Spiel wird erstellt...');
      const newGame = await api.createGame();
      setGameId(newGame.id);
      const chess = new Chess();
      setGame(chess);
      setMoveHistory([]);
      setStatus('Dein Zug! Spiele mit Weiß gegen Stockfish.');
    } catch (error) {
      console.error('Error starting new game:', error);
      setStatus('Fehler beim Erstellen des Spiels');
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
      setMoveHistory(gameCopy.history());
      setIsThinking(true);
      setStatus('Stockfish denkt nach...');

      // Zug an Backend senden
      const response = await api.makeMove(gameId, sourceSquare, targetSquare, promotion);
      
      // Spiel mit Stockfish-Antwort aktualisieren
      const updatedGame = new Chess(response.game.fen);
      setGame(updatedGame);

      // Züge-Historie aktualisieren
      const history = updatedGame.history();
      setMoveHistory(history);

      // Status aktualisieren
      if (response.game.status === 'checkmate') {
        if (updatedGame.turn() === 'w') {
          setStatus('Schachmatt! Stockfish gewinnt!');
        } else {
          setStatus('Schachmatt! Du gewinnst!');
        }
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
          <h1>StockLearn</h1>
          <div className="status-bar">
            <span className="status">{status}</span>
            {isThinking && <span className="thinking">⏳</span>}
          </div>
          <Chessboard
            position={game.fen()}
            onPieceDrop={onDrop}
            boardWidth={560}
            customBoardStyle={{
              borderRadius: '8px',
              boxShadow: '0 5px 15px rgba(0, 0, 0, 0.3)',
            }}
          />
          <div className="controls">
            <button onClick={startNewGame} disabled={isThinking}>
              Neues Spiel
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
