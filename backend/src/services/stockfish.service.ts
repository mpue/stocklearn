import { spawn, ChildProcess } from 'child_process';
import { Chess } from 'chess.js';

export class StockfishEngine {
  private stockfish: ChildProcess | null = null;
  private ready: boolean = false;
  private queue: Array<{ resolve: (value: any) => void; reject: (reason?: any) => void; command: () => void }> = [];
  private processing: boolean = false;

  constructor() {
    this.startEngine();
  }

  private startEngine() {
    try {
      this.stockfish = spawn('/usr/games/stockfish');
      this.ready = false;

      this.stockfish.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();
        if (output.includes('uciok')) {
          this.ready = true;
          console.log('Stockfish engine ready');
        }
      });

      this.stockfish.stderr?.on('data', (data: Buffer) => {
        console.error('Stockfish stderr:', data.toString());
      });

      this.stockfish.on('close', (code) => {
        console.error('Stockfish process closed with code:', code);
        this.ready = false;
        this.stockfish = null;
        
        // Reject all pending queue items
        while (this.queue.length > 0) {
          const item = this.queue.shift()!;
          item.reject(new Error('Stockfish process died'));
        }
        this.processing = false;
        
        // Restart engine after a short delay
        setTimeout(() => {
          console.log('Restarting Stockfish engine...');
          this.startEngine();
        }, 1000);
      });

      this.stockfish.on('error', (err) => {
        console.error('Stockfish process error:', err);
      });

      this.stockfish.stdin?.write('uci\n');
    } catch (err) {
      console.error('Failed to start Stockfish:', err);
    }
  }

  private ensureEngine(): boolean {
    return this.stockfish !== null && this.ready;
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) return;
    
    if (!this.ensureEngine()) {
      // Engine not ready, reject current item and try restart
      const item = this.queue.shift()!;
      item.reject(new Error('Stockfish engine not ready'));
      this.processQueue();
      return;
    }
    
    this.processing = true;
    const item = this.queue.shift()!;
    try {
      item.command();
    } catch (e) {
      item.reject(e);
      this.processing = false;
      this.processQueue();
    }
  }

  private finishProcessing() {
    this.processing = false;
    this.processQueue();
  }

  /**
   * Map Elo rating (500-3200) to Stockfish engine parameters.
   * 
   * - Elo >= 1350: Use UCI_LimitStrength + UCI_Elo (Stockfish's official mechanism)
   * - Elo < 1350:  Stockfish UCI_Elo can't go below ~1320, so we use a
   *                "blunder" approach: get the top moves, then randomly pick
   *                a weaker one based on how low the Elo is.
   */
  private getEngineConfig(elo: number) {
    const clampedElo = Math.max(500, Math.min(3200, elo));
    
    if (clampedElo >= 1350) {
      return {
        useRandomWeakening: false,
        sfSkillLevel: 20,
        uciLimitStrength: true,
        uciElo: clampedElo,
        depth: 0,
        moveTime: 2000,
        randomMoveProbability: 0,
      };
    }
    
    // Below 1350: use random weakening
    // 500 Elo -> 70% chance of random move, 1350 -> 5% chance
    const randomMoveProbability = 0.70 - (clampedElo - 500) * 0.65 / 850;
    
    return {
      useRandomWeakening: true,
      sfSkillLevel: 0,
      uciLimitStrength: false,
      uciElo: 1320,
      depth: 4,               // Shallow search for candidate ranking
      moveTime: 200,
      randomMoveProbability,
    };
  }

  /**
   * For low Elo: pick a move with weighted randomness.
   * Uses chess.js to get all legal moves, gets Stockfish evaluations for 
   * top moves, then sometimes picks a bad move based on the Elo setting.
   */
  async getBestMove(fen: string, elo: number = 1500): Promise<string> {
    const config = this.getEngineConfig(elo);
    
    if (config.useRandomWeakening) {
      return this.getWeakenedMove(fen, elo);
    }
    
    return this.getEngineBestMove(fen, config);
  }

  /**
   * Weakened move selection for Elo < 1350.
   * Mixes random legal moves with engine moves based on probability.
   * Adds a random delay (0.5-2s) to feel more natural.
   */
  private async getWeakenedMove(fen: string, elo: number): Promise<string> {
    const config = this.getEngineConfig(elo);
    const chess = new Chess(fen);
    const legalMoves = chess.moves({ verbose: true });
    
    if (legalMoves.length === 0) {
      throw new Error('No legal moves available');
    }
    
    // Random "thinking" delay: 500-2000ms
    const delay = 500 + Math.random() * 1500;
    await new Promise(res => setTimeout(res, delay));
    
    // If only 1 legal move, just play it
    if (legalMoves.length === 1) {
      const m = legalMoves[0];
      return m.from + m.to + (m.promotion || '');
    }

    const roll = Math.random();
    
    if (roll < config.randomMoveProbability) {
      // Play a random move — but slightly prefer captures/checks for realism
      // Shuffle and pick, with some weighting
      const weighted = legalMoves.map(m => {
        let weight = 1;
        // Slight preference for captures (beginners see obvious captures)
        if (m.captured) weight += 0.5;
        return { move: m, weight };
      });
      
      const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
      let r = Math.random() * totalWeight;
      for (const w of weighted) {
        r -= w.weight;
        if (r <= 0) {
          return w.move.from + w.move.to + (w.move.promotion || '');
        }
      }
      
      // Fallback: truly random
      const randomMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
      return randomMove.from + randomMove.to + (randomMove.promotion || '');
    }
    
    // Otherwise, use Stockfish (still weakened with Skill Level 0 + shallow depth)
    return this.getEngineBestMove(fen, config);
  }

  /**
   * Get move directly from Stockfish engine with given config.
   */
  private getEngineBestMove(fen: string, config: ReturnType<StockfishEngine['getEngineConfig']>): Promise<string> {
    return new Promise((resolve, reject) => {
      const command = () => {
        if (!this.stockfish || !this.stockfish.stdout || !this.stockfish.stdin) {
          this.finishProcessing();
          return reject(new Error('Stockfish not available'));
        }

        const timeout = setTimeout(() => {
          this.stockfish?.stdout?.removeListener('data', dataHandler);
          this.finishProcessing();
          reject(new Error('Stockfish timeout'));
        }, 10000);

        const dataHandler = (data: Buffer) => {
          const output = data.toString();
          
          if (output.includes('bestmove')) {
            clearTimeout(timeout);
            this.stockfish?.stdout?.removeListener('data', dataHandler);
            
            const match = output.match(/bestmove ([a-h][1-8][a-h][1-8][qrbn]?)/);
            if (match) {
              this.finishProcessing();
              resolve(match[1]);
            } else {
              this.finishProcessing();
              reject(new Error('No best move found'));
            }
          }
        };

        this.stockfish.stdout.on('data', dataHandler);
        
        this.stockfish.stdin.write(`setoption name Skill Level value ${config.sfSkillLevel}\n`);
        this.stockfish.stdin.write(`setoption name UCI_LimitStrength value ${config.uciLimitStrength}\n`);
        this.stockfish.stdin.write(`setoption name UCI_Elo value ${config.uciElo}\n`);
        this.stockfish.stdin.write(`setoption name MultiPV value 1\n`);
        this.stockfish.stdin.write(`position fen ${fen}\n`);
        if (config.depth > 0) {
          this.stockfish.stdin.write(`go depth ${config.depth} movetime ${config.moveTime}\n`);
        } else {
          this.stockfish.stdin.write(`go movetime ${config.moveTime}\n`);
        }
      };

      this.queue.push({ resolve, reject, command });
      this.processQueue();
    });
  }

  async evaluatePosition(fen: string, depth: number = 15): Promise<{
    evaluation: number;
    bestMove: string;
    mate?: number;
  }> {
    return new Promise((resolve, reject) => {
      const command = () => {
        if (!this.stockfish || !this.stockfish.stdout || !this.stockfish.stdin) {
          this.finishProcessing();
          return reject(new Error('Stockfish not available'));
        }

        let evaluation = 0;
        let bestMove = '';
        let mate: number | undefined;
        
        const timeout = setTimeout(() => {
          this.stockfish?.stdout?.removeListener('data', dataHandler);
          this.finishProcessing();
          resolve({ evaluation: 0, bestMove: '', mate: undefined }); // Resolve with default instead of rejecting
        }, 10000);

        const dataHandler = (data: Buffer) => {
          const output = data.toString();
          const lines = output.split('\n');
          
          for (const line of lines) {
            if (line.includes('score cp')) {
              const match = line.match(/score cp (-?\d+)/);
              if (match) {
                evaluation = parseInt(match[1]) / 100;
              }
            }
            
            if (line.includes('score mate')) {
              const match = line.match(/score mate (-?\d+)/);
              if (match) {
                mate = parseInt(match[1]);
                evaluation = mate > 0 ? 100 : -100;
              }
            }
            
            if (line.includes('bestmove')) {
              clearTimeout(timeout);
              this.stockfish?.stdout?.removeListener('data', dataHandler);
              
              const match = line.match(/bestmove ([a-h][1-8][a-h][1-8][qrbn]?)/);
              if (match) {
                bestMove = match[1];
              }
              this.finishProcessing();
              resolve({ evaluation, bestMove, mate });
            }
          }
        };

        this.stockfish.stdout.on('data', dataHandler);
        
        this.stockfish.stdin.write(`position fen ${fen}\n`);
        this.stockfish.stdin.write(`go depth ${depth}\n`);
      };

      this.queue.push({ resolve, reject, command });
      this.processQueue();
    });
  }

  async getTopMoves(fen: string, elo: number = 1500, count: number = 3): Promise<Array<{ move: string; evaluation: number; mate?: number }>> {
    return new Promise((resolve, reject) => {
      const command = () => {
        if (!this.stockfish || !this.stockfish.stdout || !this.stockfish.stdin) {
          this.finishProcessing();
          return reject(new Error('Stockfish not available'));
        }

        const results: Array<{ move: string; evaluation: number; mate?: number; rank: number }> = [];
        
        const timeout = setTimeout(() => {
          this.stockfish?.stdout?.removeListener('data', dataHandler);
          this.finishProcessing();
          // Return whatever we have so far
          resolve(results.sort((a, b) => a.rank - b.rank).map(({ rank, ...rest }) => rest));
        }, 10000);

        const dataHandler = (data: Buffer) => {
          const output = data.toString();
          const lines = output.split('\n');
          
          for (const line of lines) {
            // Parse info lines with multipv
            if (line.includes('info') && line.includes('multipv') && (line.includes('score cp') || line.includes('score mate'))) {
              const pvMatch = line.match(/multipv (\d+)/);
              const moveMatch = line.match(/ pv ([a-h][1-8][a-h][1-8][qrbn]?)/);
              
              if (pvMatch && moveMatch) {
                const rank = parseInt(pvMatch[1]);
                const move = moveMatch[1];
                let evaluation = 0;
                let mate: number | undefined;
                
                const cpMatch = line.match(/score cp (-?\d+)/);
                if (cpMatch) {
                  evaluation = parseInt(cpMatch[1]) / 100;
                }
                
                const mateMatch = line.match(/score mate (-?\d+)/);
                if (mateMatch) {
                  mate = parseInt(mateMatch[1]);
                  evaluation = mate > 0 ? 100 : -100;
                }
                
                // Update or insert
                const existing = results.findIndex(r => r.rank === rank);
                if (existing >= 0) {
                  results[existing] = { move, evaluation, mate, rank };
                } else {
                  results.push({ move, evaluation, mate, rank });
                }
              }
            }
            
            if (line.includes('bestmove')) {
              clearTimeout(timeout);
              this.stockfish?.stdout?.removeListener('data', dataHandler);
              this.finishProcessing();
              resolve(results.sort((a, b) => a.rank - b.rank).map(({ rank, ...rest }) => rest));
            }
          }
        };

        this.stockfish.stdout.on('data', dataHandler);
        
        const config = this.getEngineConfig(elo);
        this.stockfish.stdin.write(`setoption name Skill Level value ${config.sfSkillLevel}\n`);
        this.stockfish.stdin.write(`setoption name UCI_LimitStrength value ${config.uciLimitStrength}\n`);
        this.stockfish.stdin.write(`setoption name UCI_Elo value ${config.uciElo}\n`);
        this.stockfish.stdin.write(`setoption name MultiPV value ${count}\n`);
        this.stockfish.stdin.write(`position fen ${fen}\n`);
        // For suggestions, always use reasonable depth so we get good move candidates
        const suggestDepth = config.depth > 0 ? Math.max(config.depth, 8) : 12;
        this.stockfish.stdin.write(`go depth ${suggestDepth}\n`);
      };

      this.queue.push({ resolve, reject, command });
      this.processQueue();
    });
  }

  close() {
    this.stockfish?.kill();
  }
}

export const stockfishEngine = new StockfishEngine();
