import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api/client';
import { UserManagement } from './admin/UserManagement';
import { GameManagement } from './admin/GameManagement';
import { BackupRestore } from './admin/BackupRestore';
import { AdminSetup } from './admin/AdminSetup';
import './AdminDashboard.css';

type AdminModule = 'users' | 'games' | 'backup';

interface Stats {
  users: number;
  games: number;
  moves: number;
  activeGames: number;
  recentUsers: number;
}

export function AdminDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [activeModule, setActiveModule] = useState<AdminModule>('users');
  const [stats, setStats] = useState<Stats | null>(null);
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [checkingSetup, setCheckingSetup] = useState(true);

  useEffect(() => {
    checkSetupStatus();
  }, []);

  const checkSetupStatus = async () => {
    try {
      setCheckingSetup(true);
      const { needsSetup: needs } = await api.adminCheckSetup();
      setNeedsSetup(needs);
      if (!needs) {
        loadStats();
      }
    } catch (error) {
      console.error('Failed to check setup status:', error);
      setNeedsSetup(false);
      loadStats();
    } finally {
      setCheckingSetup(false);
    }
  };

  const handleSetupComplete = () => {
    setNeedsSetup(false);
    navigate('/login');
  };

  const loadStats = async () => {
    try {
      const data = await api.adminGetStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const modules: { key: AdminModule; label: string; icon: string }[] = [
    { key: 'users', label: 'Benutzerverwaltung', icon: '👥' },
    { key: 'games', label: 'Spielverwaltung', icon: '♟️' },
    { key: 'backup', label: 'Backup / Restore', icon: '💾' },
  ];

  // Show loading while checking setup status
  if (checkingSetup) {
    return (
      <div className="admin-setup-overlay">
        <div className="admin-setup-container">
          <div className="admin-setup-icon">⏳</div>
          <h1 className="admin-setup-title">Lade...</h1>
        </div>
      </div>
    );
  }

  // Show installer if no admin exists
  if (needsSetup) {
    return <AdminSetup onComplete={handleSetupComplete} />;
  }

  return (
    <div className="admin-dashboard">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-header">
          <h2>Admin Panel</h2>
          <span className="admin-user">{user?.username}</span>
        </div>

        <nav className="admin-nav">
          {modules.map((mod) => (
            <button
              key={mod.key}
              className={`admin-nav-item ${activeModule === mod.key ? 'active' : ''}`}
              onClick={() => setActiveModule(mod.key)}
            >
              <span className="admin-nav-icon">{mod.icon}</span>
              <span className="admin-nav-label">{mod.label}</span>
            </button>
          ))}
        </nav>

        {stats && (
          <div className="admin-stats-summary">
            <h3>Übersicht</h3>
            <div className="admin-stat-item">
              <span className="admin-stat-label">Benutzer</span>
              <span className="admin-stat-value">{stats.users}</span>
            </div>
            <div className="admin-stat-item">
              <span className="admin-stat-label">Spiele</span>
              <span className="admin-stat-value">{stats.games}</span>
            </div>
            <div className="admin-stat-item">
              <span className="admin-stat-label">Züge</span>
              <span className="admin-stat-value">{stats.moves}</span>
            </div>
            <div className="admin-stat-item">
              <span className="admin-stat-label">Aktive Spiele</span>
              <span className="admin-stat-value">{stats.activeGames}</span>
            </div>
            <div className="admin-stat-item">
              <span className="admin-stat-label">Neue Benutzer (7d)</span>
              <span className="admin-stat-value">{stats.recentUsers}</span>
            </div>
          </div>
        )}

        <div className="admin-sidebar-footer">
          <button className="admin-btn-back" onClick={() => navigate('/')}>
            ← Zurück zur App
          </button>
          <button className="admin-btn-logout" onClick={logout}>
            Abmelden
          </button>
        </div>
      </aside>

      <main className="admin-content">
        <div className="admin-content-header">
          <h1>{modules.find(m => m.key === activeModule)?.icon} {modules.find(m => m.key === activeModule)?.label}</h1>
        </div>

        <div className="admin-content-body">
          {activeModule === 'users' && <UserManagement />}
          {activeModule === 'games' && <GameManagement />}
          {activeModule === 'backup' && <BackupRestore />}
        </div>
      </main>
    </div>
  );
}
