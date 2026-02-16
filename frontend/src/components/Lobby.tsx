import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, Game } from '../api/client';
import './Lobby.css';

interface LobbyProps {
  onJoinGame?: (gameId: string) => void;
}

export function Lobby({ onJoinGame }: LobbyProps) {
  const navigate = useNavigate();
  const [waitingGames, setWaitingGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadWaitingGames();
    // Aktualisiere alle 3 Sekunden
    const interval = setInterval(loadWaitingGames, 3000);
    return () => clearInterval(interval);
  }, []);

  const loadWaitingGames = async () => {
    try {
      setError(null);
      const games = await api.getAvailableGames();
      setWaitingGames(games);
    } catch (error: any) {
      console.error('Error loading waiting games:', error);
      setError('Fehler beim Laden der Lobby');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinGame = async (gameId: string) => {
    try {
      await api.joinGame(gameId);
      if (onJoinGame) {
        onJoinGame(gameId);
      } else {
        navigate(`/game/${gameId}`);
      }
      // Aktualisiere die Liste nach dem Beitreten
      await loadWaitingGames();
    } catch (error: any) {
      console.error('Error joining game:', error);
      alert(error.message || 'Fehler beim Beitreten des Spiels');
    }
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return 'gerade eben';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `vor ${minutes} ${minutes === 1 ? 'Minute' : 'Minuten'}`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `vor ${hours} ${hours === 1 ? 'Stunde' : 'Stunden'}`;
    } else {
      const days = Math.floor(diffInSeconds / 86400);
      return `vor ${days} ${days === 1 ? 'Tag' : 'Tagen'}`;
    }
  };

  if (loading && waitingGames.length === 0) {
    return (
      <div className="lobby">
        <div className="lobby-header">
          <h2>🎮 Spiel-Lobby</h2>
          <p className="lobby-subtitle">Tritt einem wartenden Spiel bei</p>
        </div>
        <div className="lobby-loading">
          <div className="spinner"></div>
          <p>Lade verfügbare Spiele...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="lobby">
        <div className="lobby-header">
          <h2>🎮 Spiel-Lobby</h2>
          <p className="lobby-subtitle">Tritt einem wartenden Spiel bei</p>
        </div>
        <div className="lobby-error">
          <p>❌ {error}</p>
          <button className="btn btn-primary" onClick={loadWaitingGames}>
            Erneut versuchen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="lobby">
      <div className="lobby-header">
        <h2>🎮 Spiel-Lobby</h2>
        <p className="lobby-subtitle">
          {waitingGames.length === 0 
            ? 'Keine wartenden Spiele' 
            : `${waitingGames.length} ${waitingGames.length === 1 ? 'Spiel wartet' : 'Spiele warten'} auf Gegner`}
        </p>
        <button className="btn btn-refresh" onClick={loadWaitingGames} title="Aktualisieren">
          🔄
        </button>
      </div>

      {waitingGames.length === 0 ? (
        <div className="lobby-empty">
          <div className="empty-icon">♟️</div>
          <h3>Keine wartenden Spiele</h3>
          <p>Erstelle ein neues Spiel oder warte, bis jemand ein Spiel erstellt.</p>
        </div>
      ) : (
        <div className="lobby-games">
          {waitingGames.map((game) => (
            <div key={game.id} className="lobby-game-card">
              <div className="lobby-game-header">
                <div className="lobby-game-player">
                  <span className="player-avatar">👤</span>
                  <div className="player-info">
                    <span className="player-name">{game.whitePlayer?.username || 'Unbekannt'}</span>
                    <span className="player-color">spielt Weiß</span>
                  </div>
                </div>
                <div className="lobby-game-time">
                  <span className="time-badge">{getTimeAgo(game.createdAt)}</span>
                </div>
              </div>

              <div className="lobby-game-info">
                <div className="info-item">
                  <span className="info-label">Status:</span>
                  <span className="badge badge-waiting">Wartet auf Gegner</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Du spielst:</span>
                  <span className="info-value">⚫ Schwarz</span>
                </div>
              </div>

              <div className="lobby-game-actions">
                <button 
                  className="btn btn-join" 
                  onClick={() => handleJoinGame(game.id)}
                >
                  ⚔️ Spiel beitreten
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
