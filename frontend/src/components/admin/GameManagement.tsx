import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client';

interface AdminGame {
  id: string;
  gameType: string;
  status: string;
  fen: string;
  currentTurn: string;
  whitePlayer: { id: string; username: string } | null;
  blackPlayer: { id: string; username: string } | null;
  _count: { moves: number };
  createdAt: string;
  updatedAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function GameManagement() {
  const [games, setGames] = useState<AdminGame[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [gameTypeFilter, setGameTypeFilter] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingGame, setDeletingGame] = useState<AdminGame | null>(null);

  const loadGames = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await api.adminGetGames({
        page: pagination.page,
        limit: pagination.limit,
        search,
        status: statusFilter,
        gameType: gameTypeFilter,
        sortBy,
        sortOrder,
      });
      setGames(data.games);
      setPagination(data.pagination);
    } catch (err: any) {
      setError(err.message || 'Fehler beim Laden der Spiele');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, search, statusFilter, gameTypeFilter, sortBy, sortOrder]);

  useEffect(() => {
    loadGames();
  }, [loadGames]);

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const handleDelete = async () => {
    if (!deletingGame) return;
    try {
      await api.adminDeleteGame(deletingGame.id);
      setDeletingGame(null);
      loadGames();
    } catch (err: any) {
      setError(err.message || 'Fehler beim Löschen');
      setDeletingGame(null);
    }
  };

  const getSortIndicator = (column: string) => {
    if (sortBy !== column) return '';
    return sortOrder === 'asc' ? ' ▲' : ' ▼';
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      active: 'Aktiv',
      waiting: 'Wartend',
      checkmate: 'Schachmatt',
      stalemate: 'Patt',
      draw: 'Remis',
      resigned: 'Aufgegeben',
    };
    return labels[status] || status;
  };

  const getGameTypeLabel = (gameType: string) => {
    return gameType === 'vs_stockfish' ? 'vs Stockfish' : 'vs Spieler';
  };

  return (
    <div className="admin-module">
      {/* Toolbar */}
      <div className="admin-toolbar">
        <input
          type="text"
          placeholder="Spieler suchen..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="admin-search-input"
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPagination(prev => ({ ...prev, page: 1 })); }}
          className="admin-filter-select"
        >
          <option value="">Alle Status</option>
          <option value="active">Aktiv</option>
          <option value="waiting">Wartend</option>
          <option value="checkmate">Schachmatt</option>
          <option value="stalemate">Patt</option>
          <option value="draw">Remis</option>
          <option value="resigned">Aufgegeben</option>
        </select>
        <select
          value={gameTypeFilter}
          onChange={(e) => { setGameTypeFilter(e.target.value); setPagination(prev => ({ ...prev, page: 1 })); }}
          className="admin-filter-select"
        >
          <option value="">Alle Typen</option>
          <option value="vs_stockfish">vs Stockfish</option>
          <option value="vs_player">vs Spieler</option>
        </select>
      </div>

      {error && <div className="admin-error">{error}</div>}

      {/* Games Table */}
      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('gameType')} className="sortable">
                Typ{getSortIndicator('gameType')}
              </th>
              <th>Weiß</th>
              <th>Schwarz</th>
              <th onClick={() => handleSort('status')} className="sortable">
                Status{getSortIndicator('status')}
              </th>
              <th>Züge</th>
              <th onClick={() => handleSort('createdAt')} className="sortable">
                Erstellt{getSortIndicator('createdAt')}
              </th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="admin-loading">Laden...</td></tr>
            ) : games.length === 0 ? (
              <tr><td colSpan={7} className="admin-empty">Keine Spiele gefunden</td></tr>
            ) : (
              games.map((game) => (
                <tr key={game.id}>
                  <td>
                    <span className="admin-badge badge-gametype">
                      {getGameTypeLabel(game.gameType)}
                    </span>
                  </td>
                  <td>{game.whitePlayer?.username || '—'}</td>
                  <td>{game.blackPlayer?.username || (game.gameType === 'vs_stockfish' ? 'Stockfish' : '—')}</td>
                  <td>
                    <span className={`admin-badge badge-status-${game.status}`}>
                      {getStatusLabel(game.status)}
                    </span>
                  </td>
                  <td>{game._count.moves}</td>
                  <td>{formatDate(game.createdAt)}</td>
                  <td className="admin-actions">
                    <button
                      className="admin-btn admin-btn-delete"
                      onClick={() => setDeletingGame(game)}
                      title="Löschen"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="admin-pagination">
          <button
            disabled={pagination.page <= 1}
            onClick={() => handlePageChange(pagination.page - 1)}
          >
            ← Zurück
          </button>
          <span className="admin-page-info">
            Seite {pagination.page} von {pagination.totalPages} ({pagination.total} Einträge)
          </span>
          <button
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => handlePageChange(pagination.page + 1)}
          >
            Weiter →
          </button>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingGame && (
        <div className="admin-modal-overlay" onClick={() => setDeletingGame(null)}>
          <div className="admin-modal admin-modal-small" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>Spiel löschen</h2>
              <button className="admin-modal-close" onClick={() => setDeletingGame(null)}>×</button>
            </div>
            <div className="admin-modal-body">
              <p>
                Möchten Sie das Spiel zwischen <strong>{deletingGame.whitePlayer?.username || '?'}</strong> und{' '}
                <strong>{deletingGame.blackPlayer?.username || (deletingGame.gameType === 'vs_stockfish' ? 'Stockfish' : '?')}</strong> wirklich löschen?
              </p>
              <p className="admin-warning">
                ⚠️ Alle Züge dieses Spiels werden ebenfalls gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
              </p>
            </div>
            <div className="admin-modal-footer">
              <button className="admin-btn admin-btn-cancel" onClick={() => setDeletingGame(null)}>
                Abbrechen
              </button>
              <button className="admin-btn admin-btn-delete-confirm" onClick={handleDelete}>
                Endgültig löschen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
