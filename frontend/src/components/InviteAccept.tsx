import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import './Auth.css';

export function InviteAccept() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [invalidToken, setInvalidToken] = useState(false);

  useEffect(() => {
    if (token) {
      validateToken(token);
    }
  }, [token]);

  const validateToken = async (t: string) => {
    try {
      setLoading(true);
      const result = await api.validateInviteToken(t);
      setUsername(result.username);
    } catch (err: any) {
      setError(err.message || 'Ungültiger oder abgelaufener Einladungslink.');
      setInvalidToken(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Passwort muss mindestens 8 Zeichen lang sein.');
      return;
    }

    const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!strongPassword.test(password)) {
      setError('Passwort muss mindestens einen Großbuchstaben, einen Kleinbuchstaben und eine Zahl enthalten.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwörter stimmen nicht überein.');
      return;
    }

    try {
      setSubmitting(true);
      await api.acceptInvite(token!, password);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      setError(err.message || 'Fehler beim Setzen des Passworts.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <h1>⏳</h1>
            <p>Einladung wird überprüft...</p>
          </div>
        </div>
      </div>
    );
  }

  if (invalidToken) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <h1>❌</h1>
            <h2>Ungültiger Link</h2>
            <p>{error}</p>
          </div>
          <button className="auth-button" onClick={() => navigate('/login')}>
            Zur Anmeldung
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <h1>✅</h1>
            <h2>Willkommen, {username}!</h2>
            <p>Dein Passwort wurde erfolgreich gesetzt und dein Account ist jetzt aktiv.</p>
            <p style={{ fontSize: '0.9rem', opacity: 0.7 }}>Du wirst gleich zur Anmeldung weitergeleitet...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>♟️</h1>
          <h2>Willkommen bei Stocklearn!</h2>
          <p>Hallo <strong>{username}</strong>, bitte setze ein sicheres Passwort für deinen Account.</p>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field">
            <label>Passwort</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mindestens 8 Zeichen"
              required
              disabled={submitting}
            />
          </div>

          <div className="auth-field">
            <label>Passwort bestätigen</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Passwort wiederholen"
              required
              disabled={submitting}
            />
          </div>

          <div className="password-requirements">
            <p>Passwort-Anforderungen:</p>
            <ul>
              <li className={password.length >= 8 ? 'met' : ''}>Mindestens 8 Zeichen</li>
              <li className={/[A-Z]/.test(password) ? 'met' : ''}>Mindestens ein Großbuchstabe</li>
              <li className={/[a-z]/.test(password) ? 'met' : ''}>Mindestens ein Kleinbuchstabe</li>
              <li className={/\d/.test(password) ? 'met' : ''}>Mindestens eine Zahl</li>
            </ul>
          </div>

          <button type="submit" className="auth-button" disabled={submitting}>
            {submitting ? 'Wird gesetzt...' : 'Passwort setzen & Account aktivieren'}
          </button>
        </form>
      </div>
    </div>
  );
}
