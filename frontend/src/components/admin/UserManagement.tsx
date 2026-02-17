import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client';

interface AdminUser {
  id: string;
  email: string;
  username: string;
  isAdmin: boolean;
  isActive: boolean;
  inviteToken?: string | null;
  createdAt: string;
  updatedAt: string;
  _count: {
    gamesAsWhite: number;
    gamesAsBlack: number;
  };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface EditUserData {
  email: string;
  username: string;
  password: string;
  isAdmin: boolean;
  isActive: boolean;
}

interface CreateUserData {
  email: string;
  username: string;
}

export function UserManagement() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  // Edit modal state
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editData, setEditData] = useState<EditUserData>({ email: '', username: '', password: '', isAdmin: false, isActive: true });
  const [editError, setEditError] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createData, setCreateData] = useState<CreateUserData>({ email: '', username: '' });
  const [createError, setCreateError] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  // Delete confirmation
  const [deletingUser, setDeletingUser] = useState<AdminUser | null>(null);

  // Invite state
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null);
  const [inviteResult, setInviteResult] = useState<{ url: string; emailSent: boolean; message: string } | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await api.adminGetUsers({
        page: pagination.page,
        limit: pagination.limit,
        search,
        sortBy,
        sortOrder,
      });
      setUsers(data.users);
      setPagination(data.pagination);
    } catch (err: any) {
      setError(err.message || 'Fehler beim Laden der Benutzer');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, search, sortBy, sortOrder]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

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

  const handleToggleActive = async (user: AdminUser) => {
    try {
      await api.adminToggleUserActive(user.id);
      loadUsers();
    } catch (err: any) {
      setError(err.message || 'Fehler beim Ändern des Status');
    }
  };

  const handleEdit = (user: AdminUser) => {
    setEditingUser(user);
    setEditData({
      email: user.email,
      username: user.username,
      password: '',
      isAdmin: user.isAdmin,
      isActive: user.isActive,
    });
    setEditError('');
  };

  const handleEditSave = async () => {
    if (!editingUser) return;
    try {
      setEditLoading(true);
      setEditError('');
      const updateData: any = {
        email: editData.email,
        username: editData.username,
        isAdmin: editData.isAdmin,
        isActive: editData.isActive,
      };
      if (editData.password) {
        updateData.password = editData.password;
      }
      await api.adminUpdateUser(editingUser.id, updateData);
      setEditingUser(null);
      loadUsers();
    } catch (err: any) {
      setEditError(err.message || 'Fehler beim Speichern');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingUser) return;
    try {
      await api.adminDeleteUser(deletingUser.id);
      setDeletingUser(null);
      loadUsers();
    } catch (err: any) {
      setError(err.message || 'Fehler beim Löschen');
      setDeletingUser(null);
    }
  };

  const handleCreateUser = async () => {
    try {
      setCreateLoading(true);
      setCreateError('');
      if (!createData.email || !createData.username) {
        setCreateError('E-Mail und Benutzername sind erforderlich.');
        return;
      }
      await api.adminCreateUser(createData);
      setShowCreateModal(false);
      setCreateData({ email: '', username: '' });
      setSuccessMessage('Benutzer erfolgreich erstellt (inaktiv). Sie können jetzt eine Einladung senden.');
      loadUsers();
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err: any) {
      setCreateError(err.message || 'Fehler beim Erstellen');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleInvite = async (userId: string) => {
    try {
      setInvitingUserId(userId);
      setError('');
      const result = await api.adminInviteUser(userId);
      setInviteResult({
        url: result.inviteUrl,
        emailSent: result.emailSent,
        message: result.message,
      });
    } catch (err: any) {
      setError(err.message || 'Fehler beim Senden der Einladung');
    } finally {
      setInvitingUserId(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setSuccessMessage('Link in die Zwischenablage kopiert!');
    setTimeout(() => setSuccessMessage(''), 3000);
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

  return (
    <div className="admin-module">
      {/* Search Bar + Create Button */}
      <div className="admin-toolbar">
        <input
          type="text"
          placeholder="Benutzer suchen (Name oder E-Mail)..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="admin-search-input"
        />
        <button
          className="admin-btn-primary"
          onClick={() => { setShowCreateModal(true); setCreateError(''); setCreateData({ email: '', username: '' }); }}
        >
          + Neuer Benutzer
        </button>
      </div>

      {error && <div className="admin-error">{error}</div>}
      {successMessage && <div className="admin-message admin-message-success">{successMessage}</div>}

      {/* Users Table */}
      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('username')} className="sortable">
                Benutzername{getSortIndicator('username')}
              </th>
              <th onClick={() => handleSort('email')} className="sortable">
                E-Mail{getSortIndicator('email')}
              </th>
              <th>Spiele</th>
              <th onClick={() => handleSort('isAdmin')} className="sortable">
                Admin{getSortIndicator('isAdmin')}
              </th>
              <th onClick={() => handleSort('isActive')} className="sortable">
                Aktiv{getSortIndicator('isActive')}
              </th>
              <th onClick={() => handleSort('createdAt')} className="sortable">
                Erstellt{getSortIndicator('createdAt')}
              </th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="admin-loading">Laden...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={7} className="admin-empty">Keine Benutzer gefunden</td></tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className={!user.isActive ? 'inactive-row' : ''}>
                  <td>{user.username}</td>
                  <td>{user.email}</td>
                  <td>{user._count.gamesAsWhite + user._count.gamesAsBlack}</td>
                  <td>
                    <span className={`admin-badge ${user.isAdmin ? 'badge-admin' : 'badge-user'}`}>
                      {user.isAdmin ? 'Admin' : 'User'}
                    </span>
                  </td>
                  <td>
                    <span className={`admin-badge ${user.isActive ? 'badge-active' : 'badge-inactive'}`}>
                      {user.isActive ? 'Aktiv' : 'Inaktiv'}
                    </span>
                  </td>
                  <td>{formatDate(user.createdAt)}</td>
                  <td className="admin-actions">
                    <button
                      className="admin-btn admin-btn-edit"
                      onClick={() => handleEdit(user)}
                      title="Bearbeiten"
                    >
                      ✏️
                    </button>
                    <button
                      className={`admin-btn ${user.isActive ? 'admin-btn-deactivate' : 'admin-btn-activate'}`}
                      onClick={() => handleToggleActive(user)}
                      title={user.isActive ? 'Deaktivieren' : 'Aktivieren'}
                    >
                      {user.isActive ? '🔒' : '🔓'}
                    </button>
                    {!user.isActive && (
                      <button
                        className="admin-btn admin-btn-invite"
                        onClick={() => handleInvite(user.id)}
                        disabled={invitingUserId === user.id}
                        title="Einladung senden"
                      >
                        {invitingUserId === user.id ? '⏳' : '📧'}
                      </button>
                    )}
                    <button
                      className="admin-btn admin-btn-delete"
                      onClick={() => setDeletingUser(user)}
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

      {/* Edit Modal */}
      {editingUser && (
        <div className="admin-modal-overlay" onClick={() => setEditingUser(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>Benutzer bearbeiten</h2>
              <button className="admin-modal-close" onClick={() => setEditingUser(null)}>×</button>
            </div>
            <div className="admin-modal-body">
              {editError && <div className="admin-error">{editError}</div>}
              <div className="admin-form-group">
                <label>Benutzername</label>
                <input
                  type="text"
                  value={editData.username}
                  onChange={(e) => setEditData({ ...editData, username: e.target.value })}
                />
              </div>
              <div className="admin-form-group">
                <label>E-Mail</label>
                <input
                  type="email"
                  value={editData.email}
                  onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                />
              </div>
              <div className="admin-form-group">
                <label>Neues Passwort (leer lassen = unverändert)</label>
                <input
                  type="password"
                  value={editData.password}
                  onChange={(e) => setEditData({ ...editData, password: e.target.value })}
                  placeholder="Neues Passwort..."
                />
              </div>
              <div className="admin-form-group admin-form-checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={editData.isAdmin}
                    onChange={(e) => setEditData({ ...editData, isAdmin: e.target.checked })}
                  />
                  Administrator
                </label>
              </div>
              <div className="admin-form-group admin-form-checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={editData.isActive}
                    onChange={(e) => setEditData({ ...editData, isActive: e.target.checked })}
                  />
                  Aktiv
                </label>
              </div>
            </div>
            <div className="admin-modal-footer">
              <button className="admin-btn admin-btn-cancel" onClick={() => setEditingUser(null)}>
                Abbrechen
              </button>
              <button
                className="admin-btn admin-btn-save"
                onClick={handleEditSave}
                disabled={editLoading}
              >
                {editLoading ? 'Speichern...' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingUser && (
        <div className="admin-modal-overlay" onClick={() => setDeletingUser(null)}>
          <div className="admin-modal admin-modal-small" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>Benutzer löschen</h2>
              <button className="admin-modal-close" onClick={() => setDeletingUser(null)}>×</button>
            </div>
            <div className="admin-modal-body">
              <p>
                Möchten Sie den Benutzer <strong>{deletingUser.username}</strong> ({deletingUser.email}) wirklich löschen?
              </p>
              <p className="admin-warning">
                ⚠️ Alle Spiele und Züge dieses Benutzers werden ebenfalls gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
              </p>
            </div>
            <div className="admin-modal-footer">
              <button className="admin-btn admin-btn-cancel" onClick={() => setDeletingUser(null)}>
                Abbrechen
              </button>
              <button className="admin-btn admin-btn-delete-confirm" onClick={handleDelete}>
                Endgültig löschen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="admin-modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>Neuer Benutzer</h2>
              <button className="admin-modal-close" onClick={() => setShowCreateModal(false)}>×</button>
            </div>
            <div className="admin-modal-body">
              {createError && <div className="admin-error">{createError}</div>}
              <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '16px', fontSize: '0.9rem' }}>
                Der Benutzer wird als <strong>inaktiv</strong> erstellt. Sie können ihm anschließend eine Einladung senden,
                damit er sein Passwort setzen und seinen Account aktivieren kann.
              </p>
              <div className="admin-form-group">
                <label>Benutzername</label>
                <input
                  type="text"
                  value={createData.username}
                  onChange={(e) => setCreateData({ ...createData, username: e.target.value })}
                  placeholder="Benutzername"
                />
              </div>
              <div className="admin-form-group">
                <label>E-Mail</label>
                <input
                  type="email"
                  value={createData.email}
                  onChange={(e) => setCreateData({ ...createData, email: e.target.value })}
                  placeholder="benutzer@beispiel.de"
                />
              </div>
            </div>
            <div className="admin-modal-footer">
              <button className="admin-btn admin-btn-cancel" onClick={() => setShowCreateModal(false)}>
                Abbrechen
              </button>
              <button
                className="admin-btn admin-btn-save"
                onClick={handleCreateUser}
                disabled={createLoading}
              >
                {createLoading ? 'Erstelle...' : 'Benutzer erstellen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Result Modal */}
      {inviteResult && (
        <div className="admin-modal-overlay" onClick={() => setInviteResult(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>📧 Einladung</h2>
              <button className="admin-modal-close" onClick={() => setInviteResult(null)}>×</button>
            </div>
            <div className="admin-modal-body">
              <div className={`admin-message ${inviteResult.emailSent ? 'admin-message-success' : 'admin-message-error'}`}>
                {inviteResult.message}
              </div>

              <div className="admin-form-group" style={{ marginTop: '16px' }}>
                <label>Einladungslink</label>
                <div className="admin-invite-link-row">
                  <input
                    type="text"
                    value={inviteResult.url}
                    readOnly
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <button
                    className="admin-btn-primary"
                    onClick={() => copyToClipboard(inviteResult.url)}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    📋 Kopieren
                  </button>
                </div>
                <span className="admin-field-hint">
                  {inviteResult.emailSent
                    ? 'Der Link wurde auch per E-Mail gesendet.'
                    : 'Bitte senden Sie diesen Link manuell an den Benutzer.'}
                </span>
              </div>
            </div>
            <div className="admin-modal-footer">
              <button className="admin-btn admin-btn-save" onClick={() => setInviteResult(null)}>
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
