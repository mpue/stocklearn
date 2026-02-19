import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Auth.css';

export function Login() {
  const navigate = useNavigate();
  const { requestMagicLink, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [useMagicLink, setUseMagicLink] = useState(true);

  const handleMagicLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await requestMagicLink(email);
      setEmailSent(true);
    } catch (err: any) {
      setError(err.message || 'Fehler beim Senden des Magic Links');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Login fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <h1>♟️ StockLearn</h1>
            <h2>📧 E-Mail gesendet</h2>
          </div>

          <div className="auth-form">
            <div className="success-message">
              <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>✉️</p>
              <p style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>
                Wir haben dir einen Magic Link an <strong>{email}</strong> gesendet.
              </p>
              <p style={{ color: '#666', marginBottom: '1.5rem' }}>
                Klicke auf den Link in der E-Mail, um dich anzumelden.
              </p>
              <p style={{ fontSize: '0.9rem', color: '#999' }}>
                Der Link ist 15 Minuten gültig.
              </p>
              <p style={{ fontSize: '0.85rem', color: '#ff9800', marginTop: '1rem', background: '#fff3e0', padding: '10px', borderRadius: '6px' }}>
                💡 <strong>Tipp:</strong> Wenn SMTP nicht konfiguriert ist, findest du den Magic Link in den Backend-Logs!
              </p>
            </div>

            <button 
              onClick={() => setEmailSent(false)} 
              className="btn btn-secondary btn-large"
              style={{ marginTop: '2rem' }}
            >
              Andere E-Mail verwenden
            </button>
          </div>

          <div className="auth-footer">
            <p>
              <Link to="/">← Zurück zur Startseite</Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>♟️ StockLearn</h1>
          <h2>🔐 Anmelden</h2>
        </div>

        <div style={{ 
          display: 'flex', 
          gap: '10px', 
          marginBottom: '20px',
          background: '#f5f5f5',
          padding: '4px',
          borderRadius: '8px'
        }}>
          <button
            onClick={() => setUseMagicLink(true)}
            style={{
              flex: 1,
              padding: '10px',
              border: 'none',
              borderRadius: '6px',
              background: useMagicLink ? 'white' : 'transparent',
              color: useMagicLink ? '#667eea' : '#666',
              fontWeight: useMagicLink ? '600' : 'normal',
              cursor: 'pointer',
              boxShadow: useMagicLink ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            🪄 Magic Link
          </button>
          <button
            onClick={() => setUseMagicLink(false)}
            style={{
              flex: 1,
              padding: '10px',
              border: 'none',
              borderRadius: '6px',
              background: !useMagicLink ? 'white' : 'transparent',
              color: !useMagicLink ? '#667eea' : '#666',
              fontWeight: !useMagicLink ? '600' : 'normal',
              cursor: 'pointer',
              boxShadow: !useMagicLink ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            🔑 Passwort
          </button>
        </div>

        {useMagicLink ? (
          <form onSubmit={handleMagicLinkSubmit} className="auth-form">
            {error && <div className="error-message">{error}</div>}

            <div style={{ 
              background: '#e7f3ff', 
              border: '1px solid #2196F3', 
              borderRadius: '8px', 
              padding: '15px', 
              marginBottom: '20px',
              fontSize: '0.9rem',
              color: '#1976D2'
            }}>
              <strong>🪄 Magic Link Login</strong>
              <p style={{ margin: '8px 0 0 0' }}>
                Gib deine E-Mail ein und wir senden dir einen sicheren Login-Link.
              </p>
            </div>

            <div className="form-group">
              <label htmlFor="email">E-Mail</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="deine@email.com"
                autoComplete="email"
                autoFocus
              />
            </div>

            <button type="submit" className="btn btn-primary btn-large" disabled={loading}>
              {loading ? '📧 Wird gesendet...' : '🚀 Magic Link senden'}
            </button>
          </form>
        ) : (
          <form onSubmit={handlePasswordSubmit} className="auth-form">
            {error && <div className="error-message">{error}</div>}

            <div style={{ 
              background: '#fff3e0', 
              border: '1px solid #ff9800', 
              borderRadius: '8px', 
              padding: '15px', 
              marginBottom: '20px',
              fontSize: '0.9rem',
              color: '#e65100'
            }}>
              <strong>🔑 Passwort Login</strong>
              <p style={{ margin: '8px 0 0 0' }}>
                Für Admin-Accounts oder wenn SMTP nicht konfiguriert ist.
              </p>
            </div>

            <div className="form-group">
              <label htmlFor="email-password">E-Mail</label>
              <input
                id="email-password"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="deine@email.com"
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Passwort</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            <button type="submit" className="btn btn-primary btn-large" disabled={loading}>
              {loading ? 'Anmelden...' : 'Anmelden'}
            </button>
          </form>
        )}

        <div className="auth-footer">
          <p>
            <Link to="/">← Zurück zur Startseite</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
