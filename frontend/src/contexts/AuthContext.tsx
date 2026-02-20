import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api, User } from '../api/client';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  requestMagicLink: (email: string) => Promise<{ message: string; email: string }>;
  verifyMagicLink: (token: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in on mount
    const checkAuth = async () => {
      const token = localStorage.getItem('authToken');
      console.log('[AuthContext] Checking auth, token exists:', !!token);
      
      if (token) {
        try {
          const currentUser = await api.getCurrentUser();
          console.log('[AuthContext] User loaded successfully:', currentUser.username);
          setUser(currentUser);
          // Cache user für offline-Fälle
          localStorage.setItem('cachedUser', JSON.stringify(currentUser));
        } catch (error: any) {
          console.error('[AuthContext] Failed to fetch user:', error);
          // Nur bei Authentifizierungsfehlern (401, 403) den Token löschen
          // Bei anderen Fehlern (z.B. Netzwerkfehler, Backend offline) Token behalten
          if (error.status === 401 || error.status === 403) {
            console.log('[AuthContext] Token ist ungültig oder abgelaufen, entferne Token');
            localStorage.removeItem('authToken');
            localStorage.removeItem('cachedUser');
            setUser(null);
          } else {
            console.log('[AuthContext] Temporärer Fehler (Status:', error.status, '), behalte Token');
            // Bei temporären Fehlern: versuche gecachten User zu laden
            const cachedUser = localStorage.getItem('cachedUser');
            if (cachedUser) {
              try {
                const parsedUser = JSON.parse(cachedUser);
                console.log('[AuthContext] Verwende gecachten User:', parsedUser.username);
                setUser(parsedUser);
              } catch (parseError) {
                console.error('[AuthContext] Fehler beim Parsen des gecachten Users, lasse leer');
                // Wenn gecachter User nicht geparsed werden kann, setze null
                // NICHT einen Dummy-User setzen!
                setUser(null);
              }
            } else {
              console.log('[AuthContext] Kein gecachter User vorhanden, setze null');
              // Kein gecachter User, also auch null setzen
              setUser(null);
            }
          }
        }
      }
      setLoading(false);
      console.log('[AuthContext] Auth check complete');
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const response = await api.login(email, password);
    setUser(response.user);
    localStorage.setItem('cachedUser', JSON.stringify(response.user));
  };

  const register = async (email: string, username: string, password: string) => {
    const response = await api.register(email, username, password);
    setUser(response.user);
    localStorage.setItem('cachedUser', JSON.stringify(response.user));
  };

  const requestMagicLink = async (email: string) => {
    return await api.requestMagicLink(email);
  };

  const verifyMagicLink = async (token: string) => {
    const response = await api.verifyMagicLink(token);
    setUser(response.user);
    localStorage.setItem('cachedUser', JSON.stringify(response.user));
  };

  const logout = () => {
    api.logout();
    setUser(null);
    localStorage.removeItem('cachedUser');
  };

  const value = {
    user,
    loading,
    login,
    register,
    requestMagicLink,
    verifyMagicLink,
    logout,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
