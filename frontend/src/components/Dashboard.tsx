import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api, Game } from '../api/client';
import './Dashboard.css';

export function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [games, setGames] = useState<Game[]>([]);
  const [availableGames, setAvailableGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [gameType, setGameType] = useState<'vs_stockfish' | 'vs_player'>('vs_stockfish');
  const [skillLevel, setSkillLevel] = useState(() => {
    return parseInt(localStorage.getItem('stockfishSkillLevel') || '10');
  });

  useEffect(() => {
    loadGames();
  }, []);

  useEffect(() => {
    // Reload when navigating back to dashboard
    if (location.pathname === '/') {
      loadGames();
      if (gameType === 'vs_player') {
        loadAvailableGames();
      }
    }
  }, [location.key, gameType]);

  useEffect(() => {
    // Reload games when window gets focus (user returns from game)
    const handleFocus = () => {
      loadGames();
      if (gameType === 'vs_player') {
        loadAvailableGames();
      }
    };
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [gameType]);

  useEffect(() => {
    if (gameType === 'vs_player') {
      loadAvailableGames();
      // Refresh available games every 5 seconds
      const interval = setInterval(loadAvailableGames, 5000);
      return () => clearInterval(interval);
    } else {
      setAvailableGames([]);
    }
  }, [gameType]);

  const loadGames = async () => {
    try {
      setLoading(true);
      const gamesData = await api.getGames();
      setGames(gamesData);
    } catch (error) {
      console.error('Error loading games:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableGames = async () => {
    try {
      setLoadingAvailable(true);
      const available = await api.getAvailableGames();
      setAvailableGames(available);
    } catch (error) {
      console.error('Error loading available games:', error);
    } finally {
      setLoadingAvailable(false);
    }
  };

  const startNewGame = async () => {
    try {
      const newGame = await api.createGame(gameType);
      if (gameType === 'vs_stockfish') {
        localStorage.setItem('stockfishSkillLevel', skillLevel.toString());
      }
      navigate(`/game/${newGame.id}`);
    } catch (error) {
      console.error('Error creating game:', error);
    }
  };

  const joinGame = async (gameId: string) => {
    try {
      await api.joinGame(gameId);
      // Refresh games lists
      await loadGames();
      await loadAvailableGames();
      navigate(`/game/${gameId}`);
    } catch (error: any) {
      console.error('Error joining game:', error);
      alert(error.message || 'Fehler beim Beitreten des Spiels');
    }
  };

  const viewGame = (gameId: string) => {
    navigate(`/game/${gameId}`);
  };

  const analyzeGame = (gameId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    navigate(`/analysis/${gameId}`);
  };

  const deleteGame = async (gameId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
    if (!confirm('Spiel wirklich löschen?')) {
      return;
    }
    
    try {
      await api.deleteGame(gameId);
      // Spiele neu laden
      await loadGames();
    } catch (error) {
      console.error('Error deleting game:', error);
      alert('Fehler beim Löschen des Spiels');
    }
  };

  const handleSkillChange = (value: number) => {
    setSkillLevel(value);
    localStorage.setItem('stockfishSkillLevel', value.toString());
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="badge badge-active">Aktiv</span>;
      case 'waiting':
        return <span className="badge badge-waiting">Wartet auf Gegner</span>;
      case 'checkmate':
        return <span className="badge badge-checkmate">Schachmatt</span>;
      case 'stalemate':
      case 'draw':
        return <span className="badge badge-draw">Remis</span>;
      case 'resigned':
        return <span className="badge badge-resigned">Aufgegeben</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  const getSkillDescription = (level: number) => {
    if (level <= 5) return 'Anfänger';
    if (level <= 10) return 'Fortgeschritten';
    if (level <= 15) return 'Experte';
    return 'Meister';
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1>♟️ StockLearn</h1>
          <p className="subtitle">Lerne Schach mit der Stockfish Engine</p>
        </div>
        <div className="user-section">
          <span className="username">👤 {user?.username}</span>
          <button onClick={logout} className="btn btn-logout">
            Abmelden
          </button>
        </div>
      </div>

      <div className="dashboard-container">
        <div className="main-section">
          <div className="card new-game-card">
            <h2>Neues Spiel starten</h2>
            
            <div className="game-type-selector">
              <button
                className={`btn ${gameType === 'vs_stockfish' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setGameType('vs_stockfish')}
              >
                🤖 vs Stockfish
              </button>
              <button
                className={`btn ${gameType === 'vs_player' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setGameType('vs_player')}
              >
                👤 vs Spieler
              </button>
            </div>

            {gameType === 'vs_stockfish' && (
              <div className="skill-selector">
                <label>
                  <strong>Stockfish Schwierigkeit:</strong> {skillLevel} - {getSkillDescription(skillLevel)}
                </label>
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={skillLevel}
                  onChange={(e) => handleSkillChange(parseInt(e.target.value))}
                  className="skill-slider"
                />
                <div className="skill-labels">
                  <span>1 (Leicht)</span>
                  <span>10 (Mittel)</span>
                  <span>20 (Sehr schwer)</span>
                </div>
              </div>
            )}

            <button className="btn btn-primary btn-large" onClick={startNewGame}>
              {gameType === 'vs_stockfish' ? 'Neues Spiel gegen Stockfish' : 'Neues PvP-Spiel erstellen'}
            </button>
          </div>

          {gameType === 'vs_player' && (
            <div className="card available-games-card">
              <h2>Verfügbare Spiele</h2>
              {loadingAvailable ? (
                <div className="loading">Lade verfügbare Spiele...</div>
              ) : availableGames.length === 0 ? (
                <p className="empty-state">Keine verfügbaren Spiele. Erstelle ein neues Spiel oder warte, bis jemand ein Spiel erstellt.</p>
              ) : (
                <div className="games-grid">
                  {availableGames.map((game) => (
                    <div key={game.id} className="game-item">
                      <div className="game-header">
                        <span className="game-player">
                          ⚪ {game.whitePlayer?.username || 'Unbekannt'}
                        </span>
                        {getStatusBadge(game.status)}
                      </div>
                      <div className="game-actions">
                        <button className="btn btn-primary" onClick={() => joinGame(game.id)}>
                          Spiel beitreten
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="card games-list-card">
            <h2>Deine Spiele</h2>
            {loading ? (
              <div className="loading">Lade Spiele...</div>
            ) : games.length === 0 ? (
              <p className="empty-state">Noch keine Spiele. Starte dein erstes Spiel!</p>
            ) : (
              <div className="games-grid">
                {games.map((game) => (
                  <div key={game.id} className="game-item" onClick={() => viewGame(game.id)}>
                    <div className="game-header">
                      <span className="game-date">
                        {new Date(game.createdAt).toLocaleDateString('de-DE', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {getStatusBadge(game.status)}
                    </div>
                    <div className="game-info">
                      {game.gameType === 'vs_player' ? (
                        <>
                          <span className="game-players">
                            ⚪ {game.whitePlayer?.username || 'Unbekannt'} vs ⚫ {game.blackPlayer?.username || 'Wartet...'}
                          </span>
                        </>
                      ) : (
                        <span className="game-mode">vs Stockfish</span>
                      )}
                      <span className="game-moves">
                        {game.moves?.length || 0} Züge
                      </span>
                    </div>
                    <div className="game-actions">
                      <button className="btn btn-small" onClick={(e) => {
                        e.stopPropagation();
                        viewGame(game.id);
                      }}>
                        {game.status === 'active' ? 'Weiterspielen' : game.status === 'waiting' ? 'Warten' : 'Ansehen'}
                      </button>
                      <button className="btn btn-small btn-analyze" onClick={(e) => analyzeGame(game.id, e)}>
                        📊 Analysieren
                      </button>
                      <button className="btn btn-small btn-delete" onClick={(e) => deleteGame(game.id, e)}>
                        🗑️ Löschen
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="sidebar-section">
          <div className="card info-card">
            <h3>ℹ️ Info</h3>
            <p>Spiele gegen die leistungsstarke Stockfish Engine oder fordere andere Spieler heraus!</p>
            <ul>
              <li>Wähle den Schwierigkeitsgrad gegen Stockfish</li>
              <li>Spiele gegen andere Benutzer (PvP)</li>
              <li>Analysiere deine Spiele</li>
              <li>Lerne aus deinen Fehlern</li>
            </ul>
          </div>

          <div className="card stats-card">
            <h3>📊 Statistiken</h3>
            <div className="stat-item">
              <span className="stat-label">Gespielte Spiele:</span>
              <span className="stat-value">{games.length}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Aktive Spiele:</span>
              <span className="stat-value">
                {games.filter((g) => g.status === 'active').length}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Abgeschlossene:</span>
              <span className="stat-value">
                {games.filter((g) => g.status !== 'active').length}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
