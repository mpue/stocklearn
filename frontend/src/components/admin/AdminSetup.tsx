import { useState } from 'react';
import { api } from '../../api/client';

interface AdminSetupProps {
  onComplete: () => void;
}

export function AdminSetup({ onComplete }: AdminSetupProps) {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email || !username || !password) {
      setError('Alle Felder müssen ausgefüllt werden.');
      return;
    }

    if (password.length < 6) {
      setError('Passwort muss mindestens 6 Zeichen lang sein.');
      return;
    }

    if (password !== passwordConfirm) {
      setError('Passwörter stimmen nicht überein.');
      return;
    }

    try {
      setLoading(true);
      const result = await api.adminCreateInitialAdmin({ email, username, password });
      setSuccess(result.message);
      setTimeout(() => {
        onComplete();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Fehler beim Erstellen des Admin-Benutzers.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-setup-overlay">
      <div className="admin-setup-container">
        <div className="admin-setup-icon">🛠️</div>
        <h1 className="admin-setup-title">Stocklearn Setup</h1>
        <p className="admin-setup-subtitle">
          Willkommen! Es wurde noch kein Administrator angelegt.<br />
          Erstellen Sie jetzt den ersten Admin-Benutzer.
        </p>

        {error && <div className="admin-setup-error">{error}</div>}
        {success && <div className="admin-setup-success">{success}</div>}

        <form onSubmit={handleSubmit} className="admin-setup-form">
          <div className="admin-setup-field">
            <label htmlFor="setup-username">Benutzername</label>
            <input
              id="setup-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              autoFocus
              disabled={loading || !!success}
            />
          </div>

          <div className="admin-setup-field">
            <label htmlFor="setup-email">E-Mail</label>
            <input
              id="setup-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              disabled={loading || !!success}
            />
          </div>

          <div className="admin-setup-field">
            <label htmlFor="setup-password">Passwort</label>
            <input
              id="setup-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mindestens 6 Zeichen"
              disabled={loading || !!success}
            />
          </div>

          <div className="admin-setup-field">
            <label htmlFor="setup-password-confirm">Passwort bestätigen</label>
            <input
              id="setup-password-confirm"
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              placeholder="Passwort wiederholen"
              disabled={loading || !!success}
            />
          </div>

          <button
            type="submit"
            className="admin-setup-submit"
            disabled={loading || !!success}
          >
            {loading ? 'Wird erstellt...' : success ? '✓ Erstellt' : 'Admin erstellen'}
          </button>
        </form>

        <p className="admin-setup-hint">
          Dieser Setup-Schritt ist nur einmalig verfügbar und wird nach der Erstellung des ersten Admins deaktiviert.
        </p>
      </div>
    </div>
  );
}
