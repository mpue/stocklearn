import { useState, useRef } from 'react';
import { api } from '../../api/client';

export function BackupRestore() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [restorePreview, setRestorePreview] = useState<any>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleBackup = async () => {
    try {
      setLoading(true);
      setMessage(null);
      const backup = await api.adminCreateBackup();

      // Download as file
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stocklearn-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setMessage({ type: 'success', text: 'Backup wurde erfolgreich erstellt und heruntergeladen.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Fehler beim Erstellen des Backups' });
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (!data.data || !data.data.users || !data.data.games || !data.data.moves) {
          setMessage({ type: 'error', text: 'Ungültiges Backup-Format. Die Datei enthält nicht die erwartete Struktur.' });
          return;
        }
        setRestorePreview(data);
        setConfirmRestore(false);
        setMessage(null);
      } catch {
        setMessage({ type: 'error', text: 'Die Datei konnte nicht gelesen werden. Bitte wählen Sie eine gültige JSON-Datei.' });
      }
    };
    reader.readAsText(file);
  };

  const handleRestore = async () => {
    if (!restorePreview) return;

    try {
      setLoading(true);
      setMessage(null);
      const result = await api.adminRestore(restorePreview);
      setMessage({
        type: 'success',
        text: `Backup erfolgreich wiederhergestellt: ${result.counts.users} Benutzer, ${result.counts.games} Spiele, ${result.counts.moves} Züge.`
      });
      setRestorePreview(null);
      setConfirmRestore(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Fehler beim Wiederherstellen des Backups' });
    } finally {
      setLoading(false);
    }
  };

  const cancelRestore = () => {
    setRestorePreview(null);
    setConfirmRestore(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="admin-module">
      {message && (
        <div className={`admin-message admin-message-${message.type}`}>
          {message.text}
        </div>
      )}

      {/* Backup Section */}
      <div className="admin-section">
        <h2>💾 Backup erstellen</h2>
        <p className="admin-section-desc">
          Erstellt eine vollständige Sicherung aller Daten (Benutzer, Spiele, Züge) als JSON-Datei.
        </p>
        <button
          className="admin-btn admin-btn-primary"
          onClick={handleBackup}
          disabled={loading}
        >
          {loading ? 'Backup wird erstellt...' : 'Backup herunterladen'}
        </button>
      </div>

      <hr className="admin-divider" />

      {/* Restore Section */}
      <div className="admin-section">
        <h2>📥 Backup wiederherstellen</h2>
        <p className="admin-section-desc">
          Stellt alle Daten aus einer zuvor erstellten Backup-Datei wieder her.
        </p>
        <p className="admin-warning">
          ⚠️ Achtung: Beim Wiederherstellen werden alle bestehenden Daten gelöscht und durch die Daten aus dem Backup ersetzt!
        </p>

        <div className="admin-file-upload">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            className="admin-file-input"
            id="backup-file"
          />
          <label htmlFor="backup-file" className="admin-btn admin-btn-secondary">
            Backup-Datei auswählen
          </label>
        </div>

        {restorePreview && (
          <div className="admin-restore-preview">
            <h3>Vorschau</h3>
            <div className="admin-preview-info">
              <p><strong>Backup erstellt am:</strong> {new Date(restorePreview.createdAt).toLocaleString('de-DE')}</p>
              <p><strong>Version:</strong> {restorePreview.version}</p>
              <table className="admin-preview-table">
                <thead>
                  <tr>
                    <th>Datentyp</th>
                    <th>Anzahl</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Benutzer</td>
                    <td>{restorePreview.data.users.length}</td>
                  </tr>
                  <tr>
                    <td>Spiele</td>
                    <td>{restorePreview.data.games.length}</td>
                  </tr>
                  <tr>
                    <td>Züge</td>
                    <td>{restorePreview.data.moves.length}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {!confirmRestore ? (
              <div className="admin-restore-actions">
                <button className="admin-btn admin-btn-cancel" onClick={cancelRestore}>
                  Abbrechen
                </button>
                <button
                  className="admin-btn admin-btn-warning"
                  onClick={() => setConfirmRestore(true)}
                >
                  Wiederherstellen...
                </button>
              </div>
            ) : (
              <div className="admin-restore-confirm">
                <p className="admin-warning">
                  ⚠️ Sind Sie sicher? Alle bestehenden Daten werden unwiderruflich gelöscht!
                </p>
                <div className="admin-restore-actions">
                  <button className="admin-btn admin-btn-cancel" onClick={() => setConfirmRestore(false)}>
                    Nein, abbrechen
                  </button>
                  <button
                    className="admin-btn admin-btn-delete-confirm"
                    onClick={handleRestore}
                    disabled={loading}
                  >
                    {loading ? 'Wird wiederhergestellt...' : 'Ja, jetzt wiederherstellen'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
