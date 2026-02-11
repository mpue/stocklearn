const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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
  async createGame(): Promise<Game> {
    const response = await fetch(`${API_URL}/api/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (!response.ok) {
      throw new Error('Failed to create game');
    }
    
    return response.json();
  },

  async getGame(gameId: string): Promise<Game> {
    const response = await fetch(`${API_URL}/api/games/${gameId}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch game');
    }
    
    return response.json();
  },

  async makeMove(gameId: string, from: string, to: string, promotion?: string): Promise<MoveResponse> {
    const response = await fetch(`${API_URL}/api/games/${gameId}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, promotion }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to make move');
    }
    
    return response.json();
  },

  async getGames(): Promise<Game[]> {
    const response = await fetch(`${API_URL}/api/games`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch games');
    }
    
    return response.json();
  },
};
