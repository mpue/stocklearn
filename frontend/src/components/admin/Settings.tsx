import { useState, useEffect } from 'react';
import { api } from '../../api/client';

interface SettingsData {
  // SMTP Settings
  smtp_host: string;
  smtp_port: string;
  smtp_user: string;
  smtp_password: string;
  smtp_secure: string;
  smtp_from_email: string;
  smtp_from_name: string;
  // App Settings
  app_url: string;
  // Email Templates
  invite_email_subject: string;
  invite_email_template: string;
}

const defaultSettings: SettingsData = {
  smtp_host: '',
  smtp_port: '587',
  smtp_user: '',
  smtp_password: '',
  smtp_secure: 'false',
  smtp_from_email: '',
  smtp_from_name: 'Stocklearn',
  app_url: '',
  invite_email_subject: 'Willkommen bei Stocklearn!',
  invite_email_template:
    'Hallo {{username}},\n\nfür dich wurde ein Benutzerkonto bei Stocklearn erstellt.\n\nBitte klicke auf den folgenden Link, um dein Passwort zu setzen und deinen Account zu aktivieren:\n\n{{inviteUrl}}\n\nDer Link ist 7 Tage gültig.\n\nViel Spaß beim Schachspielen!',
};

export function Settings() {
  const [settings, setSettings] = useState<SettingsData>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [testingSend, setTestingSend] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await api.adminGetSettings();
      setSettings({ ...defaultSettings, ...data });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Fehler beim Laden der Einstellungen' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);
      await api.adminUpdateSettings(settings as unknown as Record<string, string>);
      setMessage({ type: 'success', text: 'Einstellungen erfolgreich gespeichert.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Fehler beim Speichern' });
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    try {
      setTestingSend(true);
      setMessage(null);
      await api.adminTestEmail(testEmail || undefined);
      setMessage({ type: 'success', text: 'Test-E-Mail erfolgreich gesendet!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Fehler beim Senden der Test-E-Mail' });
    } finally {
      setTestingSend(false);
    }
  };

  const updateSetting = (key: keyof SettingsData, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return <div className="admin-module"><div className="admin-loading">Laden...</div></div>;
  }

  return (
    <div className="admin-module">
      {message && (
        <div className={`admin-message ${message.type === 'success' ? 'admin-message-success' : 'admin-message-error'}`}>
          {message.text}
        </div>
      )}

      {/* App Settings */}
      <div className="admin-settings-section">
        <h2>🌐 Allgemein</h2>
        <p className="admin-section-desc">Grundlegende Einstellungen der Anwendung.</p>

        <div className="admin-settings-grid">
          <div className="admin-form-group">
            <label>App URL</label>
            <input
              type="text"
              value={settings.app_url}
              onChange={(e) => updateSetting('app_url', e.target.value)}
              placeholder="https://chess.example.com"
            />
            <span className="admin-field-hint">Die öffentliche URL der Anwendung (für Einladungslinks)</span>
          </div>
        </div>
      </div>

      <hr className="admin-divider" />

      {/* SMTP Settings */}
      <div className="admin-settings-section">
        <h2>📧 E-Mail Server (SMTP)</h2>
        <p className="admin-section-desc">
          Konfigurieren Sie den SMTP-Server für den Versand von E-Mails (Einladungen, Benachrichtigungen).
        </p>

        <div className="admin-settings-grid">
          <div className="admin-form-group">
            <label>SMTP Host</label>
            <input
              type="text"
              value={settings.smtp_host}
              onChange={(e) => updateSetting('smtp_host', e.target.value)}
              placeholder="smtp.gmail.com"
            />
          </div>

          <div className="admin-form-group">
            <label>SMTP Port</label>
            <input
              type="text"
              value={settings.smtp_port}
              onChange={(e) => updateSetting('smtp_port', e.target.value)}
              placeholder="587"
            />
          </div>

          <div className="admin-form-group">
            <label>SMTP Benutzer</label>
            <input
              type="text"
              value={settings.smtp_user}
              onChange={(e) => updateSetting('smtp_user', e.target.value)}
              placeholder="user@example.com"
            />
          </div>

          <div className="admin-form-group">
            <label>SMTP Passwort</label>
            <input
              type="password"
              value={settings.smtp_password}
              onChange={(e) => updateSetting('smtp_password', e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <div className="admin-form-group admin-form-checkbox">
            <label>
              <input
                type="checkbox"
                checked={settings.smtp_secure === 'true'}
                onChange={(e) => updateSetting('smtp_secure', e.target.checked ? 'true' : 'false')}
              />
              SSL/TLS verwenden
            </label>
          </div>

          <div className="admin-form-group">
            <label>Absender E-Mail</label>
            <input
              type="email"
              value={settings.smtp_from_email}
              onChange={(e) => updateSetting('smtp_from_email', e.target.value)}
              placeholder="noreply@example.com"
            />
          </div>

          <div className="admin-form-group">
            <label>Absender Name</label>
            <input
              type="text"
              value={settings.smtp_from_name}
              onChange={(e) => updateSetting('smtp_from_name', e.target.value)}
              placeholder="Stocklearn"
            />
          </div>
        </div>

        {/* Test Email */}
        <div className="admin-test-email">
          <h3>Verbindung testen</h3>
          <div className="admin-test-email-row">
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="Test-Empfänger (optional, sonst SMTP-User)"
              className="admin-search-input"
            />
            <button
              className="admin-btn-primary"
              onClick={handleTestEmail}
              disabled={testingSend}
            >
              {testingSend ? 'Sende...' : 'Test-E-Mail senden'}
            </button>
          </div>
        </div>
      </div>

      <hr className="admin-divider" />

      {/* Email Templates */}
      <div className="admin-settings-section">
        <h2>✉️ E-Mail Vorlagen</h2>
        <p className="admin-section-desc">
          Vorlagen für automatisch versendete E-Mails. Verfügbare Platzhalter:
          <code className="admin-code">{'{{username}}'}</code>,
          <code className="admin-code">{'{{email}}'}</code>,
          <code className="admin-code">{'{{inviteUrl}}'}</code>
        </p>

        <div className="admin-form-group">
          <label>Einladung – Betreff</label>
          <input
            type="text"
            value={settings.invite_email_subject}
            onChange={(e) => updateSetting('invite_email_subject', e.target.value)}
            placeholder="Willkommen bei Stocklearn!"
          />
        </div>

        <div className="admin-form-group">
          <label>Einladung – Nachricht</label>
          <textarea
            className="admin-textarea"
            value={settings.invite_email_template}
            onChange={(e) => updateSetting('invite_email_template', e.target.value)}
            rows={12}
            placeholder="E-Mail Vorlage..."
          />
        </div>
      </div>

      {/* Save Button */}
      <div className="admin-settings-actions">
        <button
          className="admin-btn-primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Speichere...' : '💾 Einstellungen speichern'}
        </button>
      </div>
    </div>
  );
}
