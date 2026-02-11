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

  close() {
    this.stockfish.kill();
  }
}

export const stockfishEngine = new StockfishEngine();
