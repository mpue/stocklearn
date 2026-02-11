import { spawn } from 'child_process';

export class StockfishEngine {
  private stockfish: any;
  private ready: boolean = false;

  constructor() {
    // Stockfish ist unter /usr/games/stockfish in Debian installiert
    this.stockfish = spawn('/usr/games/stockfish');
    this.init();
  }

  private init() {
    this.stockfish.stdout.on('data', (data: Buffer) => {
      const output = data.toString();
      if (output.includes('uciok')) {
        this.ready = true;
      }
    });

    this.stockfish.stdin.write('uci\n');
  }

  async getBestMove(fen: string, skillLevel: number = 10): Promise<string> {
    return new Promise((resolve, reject) => {
      let bestMove = '';
      
      const timeout = setTimeout(() => {
        reject(new Error('Stockfish timeout'));
      }, 10000);

      const dataHandler = (data: Buffer) => {
        const output = data.toString();
        
        if (output.includes('bestmove')) {
          clearTimeout(timeout);
          this.stockfish.stdout.removeListener('data', dataHandler);
          
          const match = output.match(/bestmove ([a-h][1-8][a-h][1-8][qrbn]?)/);
          if (match) {
            bestMove = match[1];
            resolve(bestMove);
          } else {
            reject(new Error('No best move found'));
          }
        }
      };

      this.stockfish.stdout.on('data', dataHandler);
      
      // Skill Level setzen (0-20)
      this.stockfish.stdin.write(`setoption name Skill Level value ${skillLevel}\n`);
      this.stockfish.stdin.write(`position fen ${fen}\n`);
      this.stockfish.stdin.write('go movetime 1000\n');
    });
  }

  async evaluatePosition(fen: string, depth: number = 15): Promise<{
    evaluation: number;
    bestMove: string;
    mate?: number;
  }> {
    return new Promise((resolve, reject) => {
      let evaluation = 0;
      let bestMove = '';
      let mate: number | undefined;
      
      const timeout = setTimeout(() => {
        reject(new Error('Stockfish evaluation timeout'));
      }, 20000);

      const dataHandler = (data: Buffer) => {
        const output = data.toString();
        const lines = output.split('\n');
        
        for (const line of lines) {
          // Evaluation in Centipawns
          if (line.includes('score cp')) {
            const match = line.match(/score cp (-?\d+)/);
            if (match) {
              evaluation = parseInt(match[1]) / 100; // Convert to pawns
            }
          }
          
          // Matt-Score
          if (line.includes('score mate')) {
            const match = line.match(/score mate (-?\d+)/);
            if (match) {
              mate = parseInt(match[1]);
              evaluation = mate > 0 ? 100 : -100; // High value for mate
            }
          }
          
          // Best move
          if (line.includes('bestmove')) {
            clearTimeout(timeout);
            this.stockfish.stdout.removeListener('data', dataHandler);
            
            const match = line.match(/bestmove ([a-h][1-8][a-h][1-8][qrbn]?)/);
            if (match) {
              bestMove = match[1];
              resolve({ evaluation, bestMove, mate });
            } else {
              reject(new Error('No best move found'));
            }
          }
        }
      };

      this.stockfish.stdout.on('data', dataHandler);
      
      // Analyse mit fester Tiefe
      this.stockfish.stdin.write(`position fen ${fen}\n`);
      this.stockfish.stdin.write(`go depth ${depth}\n`);
    });
  }

  close() {
    this.stockfish.kill();
  }
}

export const stockfishEngine = new StockfishEngine();
