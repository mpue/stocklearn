const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3004';

const getAuthHeaders = () => {
  const token = localStorage.getItem('authToken');
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };
};

export interface User {
  id: string;
  email: string;
  username: string;
  isAdmin?: boolean;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Game {
  id: string;
  pgn: string;
  fen: string;
  status: string;
  gameType: 'vs_stockfish' | 'vs_player';
  currentTurn: 'w' | 'b';
  whitePlayer?: { id: string; username: string };
  blackPlayer?: { id: string; username: string };
  moves?: Move[];
  createdAt: string;
  updatedAt: string;
}

export interface Move {
  id: string;
  gameId: string;
  from: string;
  to: string;
  piece: string;
  san: string;
  fen: string;
  moveNumber: number;
  isPlayerMove: boolean;
  createdAt: string;
}

export interface MoveResponse {
  game: Game;
  stockfishMove: Move | null;
}

export const api = {
  async register(email: string, username: string, password: string): Promise<AuthResponse> {
    const response = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, username, password }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to register');
    }
    
    const data = await response.json();
    localStorage.setItem('authToken', data.token);
    return data;
  },

  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to login');
    }
    
    const data = await response.json();
    localStorage.setItem('authToken', data.token);
    return data;
  },

  async getCurrentUser(): Promise<User> {
    const response = await fetch(`${API_URL}/api/auth/me`, {
      headers: getAuthHeaders(),
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch current user');
    }
    
    return response.json();
  },

  logout() {
    localStorage.removeItem('authToken');
  },

  async createGame(gameType: 'vs_stockfish' | 'vs_player' = 'vs_stockfish', opponentId?: string): Promise<Game> {
    const response = await fetch(`${API_URL}/api/games`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ gameType, opponentId }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to create game');
    }
    
    return response.json();
  },

  async joinGame(gameId: string): Promise<Game> {
    const response = await fetch(`${API_URL}/api/games/${gameId}/join`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to join game');
    }
    
    return response.json();
  },

  async getAvailableGames(): Promise<Game[]> {
    const response = await fetch(`${API_URL}/api/games/available/pvp`, {
      headers: getAuthHeaders(),
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch available games');
    }
    
    return response.json();
  },

  async getGame(gameId: string): Promise<Game> {
    const response = await fetch(`${API_URL}/api/games/${gameId}`, {
      headers: getAuthHeaders(),
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch game');
    }
    
    return response.json();
  },

  async makeMove(gameId: string, from: string, to: string, promotion?: string): Promise<MoveResponse> {
    const skillLevel = parseInt(localStorage.getItem('stockfishSkillLevel') || '10');
    
    const response = await fetch(`${API_URL}/api/games/${gameId}/move`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ from, to, promotion, skillLevel }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to make move');
    }
    
    return response.json();
  },

  async getGames(): Promise<Game[]> {
    const response = await fetch(`${API_URL}/api/games`, {
      headers: getAuthHeaders(),
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch games');
    }
    
    return response.json();
  },

  async analyzeGame(gameId: string): Promise<any> {
    const response = await fetch(`${API_URL}/api/games/${gameId}/analyze`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    
    if (!response.ok) {
      throw new Error('Failed to analyze game');
    }
    
    return response.json();
  },

  async resignGame(gameId: string): Promise<Game> {
    const response = await fetch(`${API_URL}/api/games/${gameId}/resign`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    
    if (!response.ok) {
      throw new Error('Failed to resign game');
    }
    
    return response.json();
  },

  async deleteGame(gameId: string): Promise<void> {
    const response = await fetch(`${API_URL}/api/games/${gameId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    
    if (!response.ok) {
      throw new Error('Failed to delete game');
    }
  },

  // ==================== ADMIN API ====================

  // Setup endpoints (no auth required)
  async adminCheckSetup(): Promise<{ needsSetup: boolean }> {
    const response = await fetch(`${API_URL}/api/admin/setup/status`);
    if (!response.ok) {
      throw new Error('Failed to check setup status');
    }
    return response.json();
  },

  async adminCreateInitialAdmin(data: { email: string; username: string; password: string }): Promise<any> {
    const response = await fetch(`${API_URL}/api/admin/setup/create-admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create admin user');
    }
    return response.json();
  },

  async adminGetUsers(params: { page?: number; limit?: number; search?: string; sortBy?: string; sortOrder?: string } = {}): Promise<any> {
    const query = new URLSearchParams();
    if (params.page) query.set('page', params.page.toString());
    if (params.limit) query.set('limit', params.limit.toString());
    if (params.search) query.set('search', params.search);
    if (params.sortBy) query.set('sortBy', params.sortBy);
    if (params.sortOrder) query.set('sortOrder', params.sortOrder);

    const response = await fetch(`${API_URL}/api/admin/users?${query}`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch users');
    }
    return response.json();
  },

  async adminUpdateUser(userId: string, data: { email?: string; username?: string; password?: string; isAdmin?: boolean; isActive?: boolean }): Promise<any> {
    const response = await fetch(`${API_URL}/api/admin/users/${userId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update user');
    }
    return response.json();
  },

  async adminToggleUserActive(userId: string): Promise<any> {
    const response = await fetch(`${API_URL}/api/admin/users/${userId}/toggle-active`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to toggle user status');
    }
    return response.json();
  },

  async adminDeleteUser(userId: string): Promise<void> {
    const response = await fetch(`${API_URL}/api/admin/users/${userId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete user');
    }
  },

  async adminGetGames(params: { page?: number; limit?: number; search?: string; status?: string; gameType?: string; sortBy?: string; sortOrder?: string } = {}): Promise<any> {
    const query = new URLSearchParams();
    if (params.page) query.set('page', params.page.toString());
    if (params.limit) query.set('limit', params.limit.toString());
    if (params.search) query.set('search', params.search);
    if (params.status) query.set('status', params.status);
    if (params.gameType) query.set('gameType', params.gameType);
    if (params.sortBy) query.set('sortBy', params.sortBy);
    if (params.sortOrder) query.set('sortOrder', params.sortOrder);

    const response = await fetch(`${API_URL}/api/admin/games?${query}`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch games');
    }
    return response.json();
  },

  async adminDeleteGame(gameId: string): Promise<void> {
    const response = await fetch(`${API_URL}/api/admin/games/${gameId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete game');
    }
  },

  async adminGetStats(): Promise<any> {
    const response = await fetch(`${API_URL}/api/admin/stats`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      throw new Error('Failed to fetch stats');
    }
    return response.json();
  },

  async adminCreateBackup(): Promise<any> {
    const response = await fetch(`${API_URL}/api/admin/backup`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      throw new Error('Failed to create backup');
    }
    return response.json();
  },

  async adminRestore(backupData: any): Promise<any> {
    const response = await fetch(`${API_URL}/api/admin/restore`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(backupData),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to restore backup');
    }
    return response.json();
  },

  // Settings
  async adminGetSettings(): Promise<Record<string, string>> {
    const response = await fetch(`${API_URL}/api/admin/settings`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      throw new Error('Failed to fetch settings');
    }
    return response.json();
  },

  async adminUpdateSettings(settings: Record<string, string>): Promise<any> {
    const response = await fetch(`${API_URL}/api/admin/settings`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(settings),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update settings');
    }
    return response.json();
  },

  async adminTestEmail(to?: string): Promise<any> {
    const response = await fetch(`${API_URL}/api/admin/settings/test-email`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ to }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send test email');
    }
    return response.json();
  },

  // User creation & invitation
  async adminCreateUser(data: { email: string; username: string }): Promise<any> {
    const response = await fetch(`${API_URL}/api/admin/users`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create user');
    }
    return response.json();
  },

  async adminInviteUser(userId: string): Promise<{ message: string; inviteUrl: string; emailSent: boolean }> {
    const response = await fetch(`${API_URL}/api/admin/users/${userId}/invite`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to invite user');
    }
    return response.json();
  },

  // Invite accept (public)
  async validateInviteToken(token: string): Promise<{ valid: boolean; username: string; email: string }> {
    const response = await fetch(`${API_URL}/api/admin/invite/validate/${token}`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Invalid invite token');
    }
    return response.json();
  },

  async acceptInvite(token: string, password: string): Promise<any> {
    const response = await fetch(`${API_URL}/api/admin/invite/accept/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to accept invite');
    }
    return response.json();
  },
};
