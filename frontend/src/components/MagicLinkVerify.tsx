import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Auth.css';

export function MagicLinkVerify() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const auth = useAuth();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [error, setError] = useState('');
  const [hasVerified, setHasVerified] = useState(false);

  useEffect(() => {
    // Verhindere mehrfache Verifikation
    if (hasVerified) {
      console.log('[MagicLinkVerify] Already verified, skipping');
      return;
    }

    if (!auth) {
      console.error('[MagicLinkVerify] Auth context not available');
      setStatus('error');
      setError('Auth context nicht verfügbar. Bitte Seite neu laden.');
      return;
    }

    const token = searchParams.get('token');

    console.log('[MagicLinkVerify] Mounted, token exists:', !!token);

    if (!token) {
      console.error('[MagicLinkVerify] No token found in URL');
      setStatus('error');
      setError('Kein Token gefunden. Der Link ist ungültig.');
      return;
    }

    const verify = async () => {
      try {
        console.log('[MagicLinkVerify] Attempting to verify token...');
        setHasVerified(true);
        await auth.verifyMagicLink(token);
        console.log('[MagicLinkVerify] Token verified successfully');
        setStatus('success');
        setTimeout(() => {
          console.log('[MagicLinkVerify] Redirecting to dashboard...');
          navigate('/', { replace: true });
        }, 2000);
      } catch (err: any) {
        console.error('[MagicLinkVerify] Token verification failed:', err);
        setStatus('error');
        setError(err.message || 'Der Magic Link ist ungültig oder abgelaufen.');
      }
    };

    verify();
  }, [searchParams, auth, navigate, hasVerified]);

  console.log('Rendering MagicLinkVerify, status:', status);

  // Fallback für den Fall, dass nichts anderes rendert
  if (!status) {
    return <div>Loading...</div>;
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>♟️ StockLearn</h1>
          <h2>Magic Link Verifikation</h2>
        </div>

        <div className="auth-form">
          {status === 'verifying' && (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🔐</div>
              <p style={{ fontSize: '1.2rem', color: '#667eea' }}>
                Verifiziere deinen Magic Link...
              </p>
              <div style={{ 
                marginTop: '20px',
                fontSize: '2rem',
                animation: 'pulse 1.5s ease-in-out infinite'
              }}>
                ⏳
              </div>
            </div>
          )}

          {status === 'success' && (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✅</div>
              <h3 style={{ color: '#28a745', marginBottom: '1rem' }}>
                Erfolgreich angemeldet!
              </h3>
              <p style={{ color: '#666' }}>
                Du wirst automatisch weitergeleitet...
              </p>
            </div>
          )}

          {status === 'error' && (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>❌</div>
              <h3 style={{ color: '#dc3545', marginBottom: '1rem' }}>
                Verifikation fehlgeschlagen
              </h3>
              <div className="error-message" style={{ marginBottom: '2rem' }}>
                {error}
              </div>
              <button 
                onClick={() => navigate('/login')} 
                className="btn btn-primary btn-large"
              >
                Neuen Magic Link anfordern
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
