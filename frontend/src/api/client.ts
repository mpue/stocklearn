const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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

  async createGame(): Promise<Game> {
    const response = await fetch(`${API_URL}/api/games`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    
    if (!response.ok) {
      throw new Error('Failed to create game');
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
};
